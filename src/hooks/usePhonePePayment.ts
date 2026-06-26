import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import {
  FeeType,
  PayOptions,
  PaymentStatusResponse,
  getFeePaymentStatus,
  initiateFeePayment,
} from '../api/feeApi';

export type PaymentPhase =
  | 'idle'
  | 'initiating' // creating the order on the backend
  | 'awaiting' // user is on the PhonePe checkout (app backgrounded)
  | 'checking' // polling the backend for the final state
  | 'completed'
  | 'failed'
  | 'error'; // network / unexpected error

interface UsePhonePePayment {
  phase: PaymentPhase;
  result: PaymentStatusResponse | null;
  error: string | null;
  /** Start a payment for the given amount (₹). Opens the PhonePe checkout. */
  payFees: (amount: number, feeType?: FeeType, opts?: PayOptions) => Promise<void>;
  /** Manually re-check the current order's status (e.g. an "I've paid" button). */
  checkStatus: () => Promise<void>;
  /** Clear state back to idle. */
  reset: () => void;
}

const POLL_ATTEMPTS = 6;
const POLL_DELAY_MS = 2500;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Drives an online fee payment via PhonePe (hosted checkout).
 *
 *   const { phase, payFees, checkStatus } = usePhonePePayment();
 *   <Button onPress={() => payFees(remaining, 'academic')} />
 *
 * The flow: create an order → open the checkout URL in the browser → when the
 * user returns to the app, poll the backend until the state is final. A manual
 * `checkStatus()` is exposed for an "I've completed payment" fallback button.
 */
export function usePhonePePayment(
  onSettled?: (result: PaymentStatusResponse) => void,
): UsePhonePePayment {
  const [phase, setPhase] = useState<PaymentPhase>('idle');
  const [result, setResult] = useState<PaymentStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orderIdRef = useRef<string | null>(null);
  const pollingRef = useRef(false);

  const settle = useCallback(
    (res: PaymentStatusResponse) => {
      setResult(res);
      setPhase(res.state === 'COMPLETED' ? 'completed' : res.state === 'FAILED' ? 'failed' : 'awaiting');
      if (res.state === 'COMPLETED' || res.state === 'FAILED') {
        onSettled?.(res);
      }
    },
    [onSettled],
  );

  const pollUntilFinal = useCallback(async () => {
    const orderId = orderIdRef.current;
    if (!orderId || pollingRef.current) return;

    pollingRef.current = true;
    setPhase('checking');
    try {
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        const res = await getFeePaymentStatus(orderId);
        if (res.state !== 'PENDING') {
          settle(res);
          return;
        }
        await sleep(POLL_DELAY_MS);
      }
      // Still pending after retries — leave it awaiting; user can re-check.
      setPhase('awaiting');
    } catch (e: any) {
      setError(e?.message ?? 'Could not verify payment.');
      setPhase('error');
    } finally {
      pollingRef.current = false;
    }
  }, [settle]);

  const checkStatus = useCallback(async () => {
    if (!orderIdRef.current) return;
    await pollUntilFinal();
  }, [pollUntilFinal]);

  const payFees = useCallback(async (amount: number, feeType: FeeType = 'academic', opts: PayOptions = {}) => {
    setError(null);
    setResult(null);
    setPhase('initiating');
    try {
      const init = await initiateFeePayment(amount, feeType, opts);
      orderIdRef.current = init.merchant_order_id;

      if (!init.redirect_url) {
        throw new Error('No checkout URL received.');
      }

      const canOpen = await Linking.canOpenURL(init.redirect_url);
      if (!canOpen) {
        throw new Error('Unable to open the payment page.');
      }

      await Linking.openURL(init.redirect_url);
      setPhase('awaiting');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Could not start payment.');
      setPhase('error');
    }
  }, []);

  const reset = useCallback(() => {
    orderIdRef.current = null;
    pollingRef.current = false;
    setResult(null);
    setError(null);
    setPhase('idle');
  }, []);

  // When the user returns to the app from the PhonePe checkout, verify the result.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && phase === 'awaiting' && orderIdRef.current) {
        void pollUntilFinal();
      }
    });
    return () => sub.remove();
  }, [phase, pollUntilFinal]);

  return { phase, result, error, payFees, checkStatus, reset };
}

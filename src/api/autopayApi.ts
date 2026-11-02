import apiClient from './apiClient';

// Fee Autopay (PhonePe UPI AutoPay) — the backend's /fees/autopay
// (App\Services\FeeAutopay): the parent approves a mandate once in their UPI
// app, and each academic installment is then taken from their bank on its own,
// told to them a day ahead.

export type MandateStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'cancelling'
  | 'cancelled'
  | 'revoked'
  | 'expired'
  | 'failed';

export type DebitStatus = 'notifying' | 'notified' | 'debiting' | 'completed' | 'failed' | 'skipped';

export interface AutopayMandate {
  id: number;
  status: MandateStatus;
  status_label: string;
  max_amount: number;
  activated_at: string | null;
  expires_at: string | null;
}

export interface AutopayUpcoming {
  label: string;
  due_date: string;
  outstanding: number;
  /** What Autopay will take (up to the mandate's maximum). */
  autopay: number;
}

export interface AutopayDebit {
  label: string | null;
  amount: number;
  status: DebitStatus;
  status_label: string;
  debit_on: string | null;
  paid_on: string | null;
  reason: string | null;
}

export interface AutopaySummary {
  available: boolean;
  max_allowed: number;
  suggested_max: number | null;
  mandate: AutopayMandate | null;
  upcoming: AutopayUpcoming[];
  debits: AutopayDebit[];
}

/** `refresh` asks PhonePe about a setup still waiting (after coming back from it). */
export const getAutopay = async (refresh = false): Promise<AutopaySummary> => {
  const { data } = await apiClient.get('/fees/autopay', { params: refresh ? { refresh: 1 } : {} });
  return data?.data;
};

/** Opens a mandate; the returned page is where the parent approves it. */
export const setupAutopay = async (): Promise<{ redirect_url: string; autopay: AutopaySummary }> => {
  const { data } = await apiClient.post('/fees/autopay/setup');
  return data?.data;
};

export const cancelAutopay = async (): Promise<AutopaySummary> => {
  const { data } = await apiClient.post('/fees/autopay/cancel');
  return data?.data;
};

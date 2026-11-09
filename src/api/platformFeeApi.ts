import apiClient from './apiClient';

/**
 * The platform fee a student pays in the app, when their school has set the
 * Per Student fee to be paid by students (Super Admin → Fees → Who Pays).
 * Until it is paid the server answers every other request with 402
 * (code "platform_fee_due") and the app shows only PlatformFeeScreen.
 */

export interface PlatformFee {
  /** The school has its students pay this fee themselves. */
  required: boolean;
  /** Still to pay — the app shows the payment screen. */
  must_pay: boolean;
  paid: boolean;
  amount: number;
  collected: number;
  due: number;
  label: string;
  academic_year: string;
  school: { name: string | null; logo: string | null };
  student: { name: string | null; class: string; admission_no: string | null };
  last_payment: {
    amount: number;
    date: string | null;
    mode: string | null;
    receipt_number: string | null;
  } | null;
}

export interface PlatformFeePayStart {
  merchant_order_id: string;
  redirect_url: string;
  state: string;
  amount: number;
}

export interface PlatformFeePayStatus {
  merchant_order_id: string;
  state: 'PENDING' | 'COMPLETED' | 'FAILED';
  amount: number;
  paid: boolean;
  fee: PlatformFee | null;
}

/** The 402 the server sends a student who must pay first, if this error is one. */
export const platformFeeDue = (e: any): PlatformFee | null =>
  e?.response?.status === 402 && e?.response?.data?.code === 'platform_fee_due'
    ? (e.response.data.data as PlatformFee) ?? ({} as PlatformFee)
    : null;

// GET /platform-fee
export const getPlatformFee = async (): Promise<PlatformFee> => {
  const { data } = await apiClient.get('/platform-fee');
  return data?.data ?? data;
};

// POST /platform-fee/pay — PhonePe's checkout for what is due
export const startPlatformFeePayment = async (): Promise<PlatformFeePayStart> => {
  const { data } = await apiClient.post('/platform-fee/pay', {}, { retry: false });
  return data?.data ?? data;
};

// GET /platform-fee/pay/{merchantOrderId}
export const getPlatformFeePayment = async (merchantOrderId: string): Promise<PlatformFeePayStatus> => {
  const { data } = await apiClient.get(`/platform-fee/pay/${encodeURIComponent(merchantOrderId)}`);
  return data?.data ?? data;
};

/**
 * For the login and splash screens: does this freshly signed-in student have
 * to pay first? Any trouble asking says no — the server's 402 still brings the
 * payment screen up on the first request that needs it.
 */
export const studentMustPayFirst = async (): Promise<PlatformFee | null> => {
  try {
    // Asked on the way in (splash, login): never held up long by a slow network.
    const { data } = await apiClient.get('/platform-fee', { retry: false, timeout: 6000 });
    const fee: PlatformFee = data?.data ?? data;
    return fee?.must_pay ? fee : null;
  } catch (e) {
    return platformFeeDue(e);
  }
};

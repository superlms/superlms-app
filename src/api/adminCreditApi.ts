import apiClient from './apiClient';

// Credit module. Mirrors app/Livewire/Admin/Credit.php over /admin/credit.
// The org raises credit "queries" to the super-admin and tracks their status.

const unwrap = (data: any) => data?.data ?? data;

export type CreditStatus = 'pending' | 'processing' | 'approved' | 'denied';

export interface CreditStats {
  total: number;
  pending: number;
  processing: number;
  approved: number;
  denied: number;
}

export interface CreditPolicy {
  id: number;
  title: string;
  content: string | null;
  image: string | null;
  link: string | null;
  document: string | null;
}

export interface CreditQuery {
  id: number;
  amount: number;
  start_date: string | null;
  end_date: string | null;
  start_label: string | null;
  end_label: string | null;
  heading: string;
  reason: string;
  status: CreditStatus;
  admin_remark: string | null;
  penalties_per_day: number | null;
  created_at: string | null;
  created_label: string | null;
  editable: boolean;
}

export interface CreditListResponse {
  data: CreditQuery[];
  pagination: { total: number; per_page: number; current_page: number; last_page: number };
}

export const getCreditStats = async (): Promise<{ stats: CreditStats; policies: CreditPolicy[] }> => {
  const { data } = await apiClient.get('/admin/credit/stats');
  return unwrap(data);
};

export const getCredits = async (p: {
  search?: string;
  status?: CreditStatus | '';
  per_page?: number;
  page?: number;
}): Promise<CreditListResponse> => {
  const { data } = await apiClient.get('/admin/credit', { params: p });
  const d = unwrap(data);
  return { data: d?.items ?? [], pagination: d?.pagination ?? {} } as CreditListResponse;
};

export const getCredit = async (id: number): Promise<CreditQuery> => {
  const { data } = await apiClient.get(`/admin/credit/${id}`);
  return unwrap(data)?.query;
};

export interface CreditPayload {
  amount: number;
  start_date: string;
  end_date: string;
  heading: string;
  reason: string;
}

export const createCredit = async (p: CreditPayload): Promise<CreditQuery> => {
  const { data } = await apiClient.post('/admin/credit', p);
  return unwrap(data)?.query;
};

export const updateCredit = async (id: number, p: CreditPayload): Promise<CreditQuery> => {
  const { data } = await apiClient.post(`/admin/credit/${id}`, p);
  return unwrap(data)?.query;
};

export const deleteCredit = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/credit/${id}`);
};

/** End date defaults to start + 20 days (matches web). */
export const suggestCreditEndDate = async (start_date: string): Promise<string> => {
  const { data } = await apiClient.post('/admin/credit/suggest-end', { start_date });
  return unwrap(data)?.end_date;
};

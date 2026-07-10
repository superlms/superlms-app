import apiClient from './apiClient';

const unwrap = (data: any) => data?.data ?? data;

// ─── Admissions ──────────────────────────────────────────────────────────────
export interface AdmissionRow {
  id: number;
  student_name: string;
  email?: string | null;
  mobile?: string | null;
  guardian_name?: string | null;
  address?: string | null;
  class?: string | null;
  stream?: string | null;
  admission_fee: number;
  collected_amount: number;
  total_marks?: number | null;
  obtained_marks?: number | null;
  remarks?: string | null;
  status: string;
  created_at?: string | null;
}
export interface AdmissionStats { total: number; pending: number; admitted: number }

export const getAdmissions = async (opts: { search?: string; status?: string } = {}): Promise<{ admissions: AdmissionRow[]; stats: AdmissionStats }> => {
  const params: any = {};
  if (opts.search) params.search = opts.search;
  if (opts.status) params.status = opts.status;
  const { data } = await apiClient.get('/admin/admissions', { params });
  return unwrap(data);
};

// ─── Users (org staff) ───────────────────────────────────────────────────────
export interface AdminUserRow {
  id: number;
  name: string;
  email?: string | null;
  mobile?: string | null;
  role: string;
  gender?: string | null;
  is_active: boolean;
  image?: string | null;
  date_of_joining?: string | null;
}
export interface AdminUserStats { total: number; admins: number; active: number }

export const getAdminUsers = async (opts: { search?: string; status?: string } = {}): Promise<{ users: AdminUserRow[]; stats: AdminUserStats }> => {
  const params: any = {};
  if (opts.search) params.search = opts.search;
  if (opts.status) params.status = opts.status;
  const { data } = await apiClient.get('/admin/users', { params });
  return unwrap(data);
};

// ─── Rate LMS ────────────────────────────────────────────────────────────────
export interface LmsRating { rated: boolean; rating: number; feedback: string; submitted_at?: string | null }

export const getRating = async (): Promise<LmsRating> => {
  const { data } = await apiClient.get('/admin/rating');
  return unwrap(data);
};

export const submitRating = async (rating: number, feedback: string): Promise<LmsRating> => {
  const { data } = await apiClient.post('/admin/rating', { rating, feedback });
  return unwrap(data);
};

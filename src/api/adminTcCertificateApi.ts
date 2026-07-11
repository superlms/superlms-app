import apiClient from './apiClient';
import { authHeader, downloadPdf } from './pdfDownload';

// TC & Certificate module. Mirrors app/Livewire/Admin/TcCertificate.php over
// /admin/tc-certificate. Three tabs: achievement / participation certificates
// and transfer certificates (TC).

export { authHeader };

const unwrap = (data: any) => data?.data ?? data;

export type TcTab = 'achievement' | 'participation' | 'tc';

export interface TcSection { id: number; name: string }
export interface TcClass { id: number; name: string; sections: TcSection[] }

export interface TcLookups {
  classes: TcClass[];
  conduct_options: string[];
  failed_options: string[];
  ncc_options: string[];
}

export interface TcStatistics { achievement: number; participation: number; tc: number }
export interface TcAnalytics { total: number; this_month: number; last_month: number; this_week: number }

export interface TcStudent {
  id: number;
  full_name: string;
  admission_no: string | null;
  class: string;
}

export interface CertItem {
  id: number;
  certificate_no: string | null;
  type: 'achievement' | 'participation';
  student_id: number;
  student_name: string | null;
  admission_no: string | null;
  event_name: string;
  issued_by: string;
  issued_by_designation: string | null;
  description: string | null;
  issued_date: string | null;
  issued_label: string | null;
  pdf_url: string;
}

export interface TcItem {
  id: number;
  tc_no: string | null;
  student_id: number;
  student_name: string | null;
  admission_no: string | null;
  book_no: string | null;
  nationality: string;
  is_sc_st: boolean;
  last_class_studied: string | null;
  exam_last_taken: string | null;
  whether_failed: string;
  subjects_studied: string | null;
  qualified_for_promotion: string;
  fees_paid_upto: string | null;
  fee_concession: string | null;
  total_working_days: number;
  days_present: number;
  is_ncc_scout: string;
  extra_activities: string | null;
  general_conduct: string;
  application_date: string | null;
  issue_date: string | null;
  issue_label: string | null;
  reason_for_leaving: string | null;
  remarks: string | null;
  pdf_url: string;
}

export interface TcListResponse<T> {
  data: T[];
  pagination: { total: number; per_page: number; current_page: number; last_page: number };
}

export const getTcLookups = async (): Promise<TcLookups> => {
  const { data } = await apiClient.get('/admin/tc-certificate/lookups');
  return unwrap(data);
};

export const getTcStats = async (p: {
  tab: TcTab;
  standard_id?: number | null;
  section_id?: number | null;
}): Promise<{ statistics: TcStatistics; analytics: TcAnalytics }> => {
  const { data } = await apiClient.get('/admin/tc-certificate/stats', { params: p });
  return unwrap(data);
};

export const getTcStudents = async (p: {
  standard_id: number;
  section_id?: number | null;
  search?: string;
}): Promise<TcStudent[]> => {
  const { data } = await apiClient.get('/admin/tc-certificate/students', { params: p });
  return unwrap(data)?.students ?? [];
};

export const getTcList = async <T = CertItem | TcItem>(p: {
  tab: TcTab;
  search?: string;
  standard_id?: number | null;
  section_id?: number | null;
  month?: string;
  per_page?: number;
  page?: number;
}): Promise<TcListResponse<T>> => {
  const { data } = await apiClient.get('/admin/tc-certificate', { params: p });
  const d = unwrap(data);
  return { data: d?.items ?? [], pagination: d?.pagination ?? {} } as TcListResponse<T>;
};

export interface CertPayload {
  type: 'achievement' | 'participation';
  student_detail_id: number;
  event_name: string;
  issued_by: string;
  issued_by_designation?: string;
  description?: string;
  issued_date: string;
}

export const createCert = async (p: CertPayload): Promise<CertItem> => {
  const { data } = await apiClient.post('/admin/tc-certificate/cert', p);
  return unwrap(data)?.certificate;
};

export const updateCert = async (id: number, p: CertPayload): Promise<CertItem> => {
  const { data } = await apiClient.post(`/admin/tc-certificate/cert/${id}`, p);
  return unwrap(data)?.certificate;
};

export const deleteCert = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/tc-certificate/cert/${id}`);
};

export interface TcPayload {
  student_detail_id: number;
  book_no?: string;
  nationality?: string;
  is_sc_st?: boolean;
  last_class_studied?: string;
  exam_last_taken?: string;
  whether_failed?: string;
  subjects_studied?: string;
  qualified_for_promotion?: string;
  fees_paid_upto?: string;
  fee_concession?: string;
  total_working_days?: number;
  days_present?: number;
  is_ncc_scout?: string;
  extra_activities?: string;
  general_conduct: string;
  application_date: string;
  issue_date: string;
  reason_for_leaving?: string;
  remarks?: string;
}

export const createTc = async (p: TcPayload): Promise<TcItem> => {
  const { data } = await apiClient.post('/admin/tc-certificate/tc', p);
  return unwrap(data)?.tc;
};

export const updateTc = async (id: number, p: TcPayload): Promise<TcItem> => {
  const { data } = await apiClient.post(`/admin/tc-certificate/tc/${id}`, p);
  return unwrap(data)?.tc;
};

export const deleteTc = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/tc-certificate/tc/${id}`);
};

export const downloadCertificatePdf = (pdfUrl: string, fileName: string): Promise<string> =>
  downloadPdf(pdfUrl, fileName);

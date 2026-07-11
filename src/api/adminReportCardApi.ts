import apiClient from './apiClient';
import { authHeader, downloadPdf } from './pdfDownload';

// Report Card module. Mirrors app/Livewire/Admin/ReportCard.php over /admin/report-card.
// Filtered listing of issued cards + an "issue" flow gated by marks-completeness.

export { authHeader };

const unwrap = (data: any) => data?.data ?? data;

export interface RcSection { id: number; name: string }
export interface RcClass { id: number; name: string; sections: RcSection[] }

export interface RcStats {
  total_students: number;
  active_students: number;
  issued: number;
  pending: number;
}

export type RcStatus = 'issued' | 'revoked';

export interface ReportCardItem {
  id: number;
  student_id: number;
  full_name: string;
  admission_no: string | null;
  roll_no: string | null;
  standard: string | null;
  section: string | null;
  academic_year: string | null;
  status: RcStatus;
  issued_by: string | null;
  issued_at: string | null;
  issued_label: string | null;
  pdf_url: string;
}

export interface RcIssueStudent {
  id: number;
  full_name: string;
  admission_no: string | null;
  roll_no: string;
  marks_complete: boolean;
  already_issued: boolean;
  missing_info: string;
}

export interface ReportCardListResponse {
  data: ReportCardItem[];
  pagination: { total: number; per_page: number; current_page: number; last_page: number };
}

export const getReportCardLookups = async (): Promise<{ classes: RcClass[] }> => {
  const { data } = await apiClient.get('/admin/report-card/lookups');
  return unwrap(data);
};

export const getReportCardStats = async (p: {
  standard_id?: number | null;
  section_id?: number | null;
}): Promise<RcStats> => {
  const { data } = await apiClient.get('/admin/report-card/stats', { params: p });
  return unwrap(data);
};

export const getReportCards = async (p: {
  search?: string;
  standard_id?: number | null;
  section_id?: number | null;
  status?: RcStatus | '';
  per_page?: number;
  page?: number;
}): Promise<ReportCardListResponse> => {
  const { data } = await apiClient.get('/admin/report-card', { params: p });
  const d = unwrap(data);
  return { data: d?.items ?? [], pagination: d?.pagination ?? {} } as ReportCardListResponse;
};

export const getReportCardIssueStudents = async (
  standard_id: number,
  section_id: number,
): Promise<RcIssueStudent[]> => {
  const { data } = await apiClient.get('/admin/report-card/issue-students', {
    params: { standard_id, section_id },
  });
  return unwrap(data)?.students ?? [];
};

export const issueReportCards = async (p: {
  standard_id: number;
  section_id: number;
  student_ids: number[];
}): Promise<{ issued: number; skipped: number }> => {
  const { data } = await apiClient.post('/admin/report-card/issue', p);
  return unwrap(data);
};

export const revokeReportCard = async (id: number): Promise<void> => {
  await apiClient.post(`/admin/report-card/${id}/revoke`);
};

export const downloadReportCardPdf = (pdfUrl: string, fileName: string): Promise<string> =>
  downloadPdf(pdfUrl, fileName);

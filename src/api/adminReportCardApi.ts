import apiClient from './apiClient';
import constant from '../utils/constant';
import { authHeader, downloadPdf } from './pdfDownload';

// Report Card module. Mirrors app/Livewire/Admin/ReportCard.php over /admin/report-card.
// Filtered listing of issued cards + an "issue" flow gated by marks-completeness.

export { authHeader };

const unwrap = (data: any) => data?.data ?? data;

export interface RcSection {
  id: number;
  name: string;
  /** How many students it has, and how many hold an issued card (newer servers). */
  students?: number;
  issued?: number;
}
export interface RcClass {
  id: number;
  name: string;
  students?: number;
  issued?: number;
  sections: RcSection[];
}

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
  /** What the issue form put on the card — blank means worked out from the marks. */
  standard_id?: number | null;
  section_id?: number | null;
  regd_no?: string | null;
  remark?: string | null;
  result?: RcResult | null;
}

export type RcResult = 'PASSED' | 'FAILED';

export interface RcIssueStudent {
  id: number;
  full_name: string;
  admission_no: string | null;
  roll_no: string;
  marks_complete: boolean;
  already_issued: boolean;
  missing_info: string;
  image?: string | null;
  /** Where the issue form's Regd. No starts from. */
  registration_number?: string | null;
  /** The card issued here, to open it. */
  report_card_id?: number | null;
  issued_label?: string | null;
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

export interface RcIssueDetail {
  student_id: number;
  regd_no?: string;
  remark?: string;
  /** '' is Auto: the card works it out from the marks. */
  result?: RcResult | '';
}

export const issueReportCards = async (p: {
  standard_id: number;
  section_id: number;
  student_ids: number[];
  /** YYYY-MM-DD — printed as the card's Issue Date. */
  issue_date?: string;
  details?: RcIssueDetail[];
}): Promise<{ issued: number; skipped: number; message?: string }> => {
  const { data } = await apiClient.post('/admin/report-card/issue', p);
  return { ...unwrap(data), message: data?.message };
};

/** One card, as the list shows it. */
export const getReportCard = async (id: number): Promise<ReportCardItem> => {
  const { data } = await apiClient.get(`/admin/report-card/${id}`);
  return unwrap(data);
};

export const revokeReportCard = async (id: number): Promise<void> => {
  await apiClient.post(`/admin/report-card/${id}/revoke`);
};

export const downloadReportCardPdf = (pdfUrl: string, fileName: string): Promise<string> =>
  downloadPdf(pdfUrl, fileName);

/** A card's PDF — the panel's own report card, as the list's pdf_url gives it. */
export const adminReportCardPdfUrl = (id: number) => `${constant.API_BASE_URL}/admin/report-card/${id}/pdf`;

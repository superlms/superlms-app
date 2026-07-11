import apiClient from './apiClient';
import { authHeader, downloadPdf } from './pdfDownload';

// Admit Card module. Mirrors app/Livewire/Admin/AdmitCard.php over /admin/admit-card.
// Pick exam + class (+ section) → list students by issued status, issue one,
// bulk-generate by criteria, view a card, delete.

export { authHeader };

const unwrap = (data: any) => data?.data ?? data;

export interface AdmitSection { id: number; name: string }
export interface AdmitClass { id: number; name: string; sections: AdmitSection[] }
export interface AdmitExam { id: number; name: string; academic_year: string | null }

export interface AdmitCardLookups {
  exams: AdmitExam[];
  classes: AdmitClass[];
}

export interface AdmitStudent {
  id: number;
  full_name: string;
  roll_no: string | null;
  admission_no: string | null;
  standard: string | null;
  section: string | null;
  image: string | null;
  issued: boolean;
  admit_card_id: number | null;
}

export interface AdmitAnalytics {
  total: number;
  issued: number;
  remaining: number;
}

export interface AdmitStudentListResponse {
  data: AdmitStudent[];
  pagination: { total: number; per_page: number; current_page: number; last_page: number };
}

export interface AdmitCardView {
  id: number;
  admit_card_number: string | null;
  issue_date: string | null;
  exam_name: string | null;
  academic_year: string | null;
  student: {
    full_name: string | null;
    father_name: string | null;
    mother_name: string | null;
    roll_number: string | null;
    class: string | null;
    admission_no: string | null;
    image_url: string | null;
  };
  subjects: { subject_name: string; exam_date: string; exam_time: string; exam_duration: string }[];
  seating_label: string | null;
  exam_center: string | null;
  organization: { name: string | null; address: string | null; logo: string | null };
  pdf_url: string;
}

export const getAdmitLookups = async (): Promise<AdmitCardLookups> => {
  const { data } = await apiClient.get('/admin/admit-card/lookups');
  return unwrap(data);
};

export const getAdmitAnalytics = async (p: {
  exam_id?: number | null;
  standard_id?: number | null;
  section_id?: number | null;
}): Promise<AdmitAnalytics> => {
  const { data } = await apiClient.get('/admin/admit-card/analytics', { params: p });
  return unwrap(data);
};

export const getAdmitStudents = async (p: {
  exam_id: number;
  standard_id: number;
  section_id?: number | null;
  search?: string;
  status?: '' | 'issued' | 'not_issued';
  per_page?: number;
  page?: number;
}): Promise<AdmitStudentListResponse> => {
  const { data } = await apiClient.get('/admin/admit-card', { params: p });
  const d = unwrap(data);
  return { data: d?.items ?? [], pagination: d?.pagination ?? {} } as AdmitStudentListResponse;
};

export const getAdmitCard = async (id: number): Promise<AdmitCardView> => {
  const { data } = await apiClient.get(`/admin/admit-card/${id}`);
  return unwrap(data)?.card;
};

export const issueAdmitCard = async (exam_id: number, student_id: number): Promise<{ already?: boolean }> => {
  const { data } = await apiClient.post('/admin/admit-card/issue', { exam_id, student_id });
  return unwrap(data) ?? {};
};

export const generateAdmitCards = async (p: {
  exam_id: number;
  standard_id: number;
  section_id?: number | null;
  criteria: 'none' | 'attendance' | 'fee';
  percentage?: number;
}): Promise<{ generated: number; skipped: number }> => {
  const { data } = await apiClient.post('/admin/admit-card/generate', p);
  return unwrap(data);
};

export const deleteAdmitCard = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/admit-card/${id}`);
};

export const downloadAdmitCardPdf = (pdfUrl: string, fileName: string): Promise<string> =>
  downloadPdf(pdfUrl, fileName);

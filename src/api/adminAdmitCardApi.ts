import apiClient from './apiClient';
import constant from '../utils/constant';
import { mapExam } from './examApi';
import type { Exam } from '../screens/exam/examData';
import { authHeader, downloadPdf } from './pdfDownload';

// Admit Card module. Mirrors app/Livewire/Admin/AdmitCard.php over /admin/admit-card.
// Pick exam + class (+ section) → list students by issued status, issue one,
// bulk-generate by criteria, view a card, delete — and print as the panel does:
// the cards not printed yet (or all, as a reprint), stamped as printed, on the
// four-up sheet.

export { authHeader };

const unwrap = (data: any) => data?.data ?? data;

export interface AdmitSection { id: number; name: string }
export interface AdmitClass { id: number; name: string; sections: AdmitSection[] }
export interface AdmitExam {
  id: number;
  name: string;
  academic_year: string | null;
  // What the student app's exam rows read, and the cards issued for it.
  term?: string | null;
  exam_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  total_marks?: number | null;
  passing_marks?: number | null;
  issued?: number;
}

/** A lookups exam as the student app's exam rows take it. */
export const admitExamToExam = (e: AdmitExam): Exam =>
  mapExam({
    id: e.id,
    exam_name: e.name,
    term: e.term ?? null,
    exam_type: e.exam_type ?? null,
    academic_year: e.academic_year,
    start_date: e.start_date ?? null,
    end_date: e.end_date ?? null,
    status: e.status ?? '',
    total_marks: e.total_marks ?? null,
    passing_marks: e.passing_marks ?? null,
  });

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
  admit_card_number?: string | null;
  /** "26 Sep 2026, 10:16 AM", or null while it waits for a print run. */
  printed_at?: string | null;
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
  exam_id?: number;
  student_detail_id?: number;
  standard_id?: number | null;
  section_id?: number | null;
  printed_at?: string | null;
}

/** One class of an exam: its students, and how many of them hold the exam's card. */
export interface AdmitClassCount {
  id: number;
  name: string;
  students: number;
  issued: number;
  sections: { id: number; name: string; students: number; issued: number }[];
}

export interface AdmitClassOverview {
  classes: AdmitClassCount[];
  totals: AdmitAnalytics;
}

/** A card the Print panel offers. */
export interface PrintableCard {
  id: number;
  student_name: string | null;
  roll_number: string | null;
  admit_card_number: string | null;
  printed_at: string | null;
}

/** The card as a full A4 page, as View / Download give it. */
export const admitCardPagePdfUrl = (id: number) => `${constant.API_BASE_URL}/admin/admit-card/${id}/pdf`;

/** The four-up print sheet of these cards. */
export const admitCardSheetPdfUrl = (ids: number[]) =>
  `${constant.API_BASE_URL}/admin/admit-card/sheet?ids=${ids.join(',')}`;

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

/** One exam's classes and sections, each with its students and cards issued. */
export const getAdmitClasses = async (exam_id: number): Promise<AdmitClassOverview> => {
  const { data } = await apiClient.get('/admin/admit-card/classes', { params: { exam_id } });
  const d = unwrap(data);
  return { classes: d?.classes ?? [], totals: d?.totals ?? { total: 0, issued: 0, remaining: 0 } };
};

/** The Print panel's list: not printed yet, or — with include_done — every card issued. */
export const getPrintableCards = async (p: {
  exam_id: number;
  standard_id: number;
  section_id?: number | null;
  include_done?: boolean;
}): Promise<{ cards: PrintableCard[]; already_printed: number }> => {
  const { data } = await apiClient.get('/admin/admit-card/printable', {
    params: { ...p, include_done: p.include_done ? 1 : 0 },
  });
  const d = unwrap(data);
  return { cards: d?.cards ?? [], already_printed: d?.already_printed ?? 0 };
};

/** Stamps the cards as printed; the four-up sheet of them is then at admitCardSheetPdfUrl(ids). */
export const printAdmitCards = async (ids: number[]): Promise<{ count: number; ids: number[] }> => {
  const { data } = await apiClient.post('/admin/admit-card/print', { ids });
  const d = unwrap(data);
  return { count: d?.count ?? ids.length, ids: d?.ids ?? ids };
};

/** Takes the printed stamp off, so the card comes out on the next run. */
export const markAdmitCardUnprinted = async (id: number): Promise<void> => {
  await apiClient.post(`/admin/admit-card/${id}/unprinted`);
};

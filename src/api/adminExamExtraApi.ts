import apiClient from './apiClient';

const unwrap = (data: any) => data?.data ?? data;

export interface ExamFilterOptions {
  exams: { id: number; name: string }[];
  standards: { id: number; name: string }[];
  subjects: { id: number; name: string }[];
}

export interface ExamCopyFilters {
  exam_id?: number;
  standard_id?: number;
  section_id?: number;
  subject_id?: number;
  search?: string;
}

// ─── Performance ─────────────────────────────────────────────────────────────
export interface PerfSubject { subject: string; count: number; avg: number; max: number; min: number }
export interface PerfStats { copies: number; avg: number; exams: number; students: number }

export const getPerformance = async (f: ExamCopyFilters = {}): Promise<{ stats: PerfStats; subjects: PerfSubject[]; options: ExamFilterOptions }> => {
  const { data } = await apiClient.get('/admin/performance', { params: f });
  return unwrap(data);
};

// ─── Exam Copies ─────────────────────────────────────────────────────────────
export interface ExamCopyRow {
  id: number;
  student: string;
  class?: string | null;
  section?: string | null;
  subject?: string | null;
  exam?: string | null;
  marks_obtained?: number | null;
  max_marks?: number | null;
  percentage?: number | null;
  grade?: string | null;
  remarks?: string | null;
  is_absent: boolean;
  has_pdf: boolean;
  pdf_url?: string | null;
}
export interface ExamCopyStats { total: number; uploaded: number; pending: number }

export const getExamCopies = async (f: ExamCopyFilters = {}): Promise<{ copies: ExamCopyRow[]; stats: ExamCopyStats; options: ExamFilterOptions }> => {
  const { data } = await apiClient.get('/admin/exam-copies', { params: f });
  return unwrap(data);
};

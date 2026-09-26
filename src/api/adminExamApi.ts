import apiClient from './apiClient';
import { Pagination } from './adminStudentApi';
import { PickedFile } from './adminProfileApi';

// Exams module. Mirrors app/Livewire/Admin/AddExam.php over /admin/exams.

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/** The panel's status, from the dates on every read: not published → draft; ended → completed; running → active; within 10 days → upcoming; else published. */
export type AdminExamStatus = 'draft' | 'published' | 'upcoming' | 'active' | 'completed';

export interface AdminExam {
  id: number;
  exam_name: string;
  term?: string | null;
  academic_year: string;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  exam_type: string;
  exam_type_label?: string;
  total_marks?: number | null;
  passing_marks?: number | null;
  uses_grading_system: boolean;
  is_published: boolean;
  is_completed?: boolean;
  status?: AdminExamStatus;
  status_label?: string;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ExamStats {
  total: number;
  published: number;
  upcoming: number;
  active: number;
  completed?: number;
  syllabus_rows: number;
}

export interface ExamOptions {
  academic_years: string[];
  exam_types: Record<string, string>;
  terms: string[];
}

export interface ExamFilters {
  search?: string;
  academic_year?: string;
  exam_type?: string;
  term?: string;
  status?: 'published' | 'draft' | 'active' | 'upcoming' | 'completed';
  page?: number;
  per_page?: number;
}

export const getExams = async (
  filters: ExamFilters = {},
): Promise<{ exams: AdminExam[]; pagination: Pagination; stats: ExamStats; options: ExamOptions }> => {
  const { data } = await apiClient.get('/admin/exams', { params: filters });
  return unwrap(data);
};

/** One exam, as the panel's view shows it. */
export const getExam = async (id: number): Promise<AdminExam> => {
  const { data } = await apiClient.get(`/admin/exams/${id}`);
  return unwrap(data);
};

export interface ExamPayload {
  exam_name: string;
  term: string;
  academic_year: string;
  /** YYYY-MM-DD; either date may be left out (null), as on the panel. */
  start_date: string | null;
  end_date: string | null;
  exam_type: string;
  description?: string;
  is_published?: boolean;
  uses_grading_system?: boolean;
  total_marks?: number | string;
  passing_marks?: number | string;
}

export const createExam = async (p: ExamPayload): Promise<AdminExam> => {
  const { data } = await apiClient.post('/admin/exams', p);
  return unwrap(data);
};

export const updateExam = async (id: number, p: ExamPayload): Promise<AdminExam> => {
  const { data } = await apiClient.put(`/admin/exams/${id}`, p);
  return unwrap(data);
};

export const toggleExamPublish = async (id: number): Promise<{ is_published: boolean }> => {
  const { data } = await apiClient.post(`/admin/exams/${id}/toggle-publish`);
  return unwrap(data);
};

export const deleteExam = async (id: number) => {
  await apiClient.delete(`/admin/exams/${id}`);
};

// ─── Syllabus ─────────────────────────────────────────────────────────────────
export interface SyllabusGroup {
  exam_id: number;
  exam_name: string;
  standard_id: number;
  standard_name: string;
  section_id?: number | null;
  section_name?: string | null;
  subject_id: number;
  subject_name: string;
  chapter_count: number;
}

export interface SyllabusChapter {
  id: number;
  name: string;
  description?: string | null;
  topics: string[];
}

export interface SyllabusFilters {
  exam_id?: number;
  standard_id?: number;
  section_id?: number;
  subject_id?: number;
}

export const getSyllabus = async (
  filters: SyllabusFilters = {},
): Promise<
  | { mode: 'list'; groups: SyllabusGroup[] }
  | { mode: 'detail'; exam_name: string; standard_name: string; subject_name: string; section_name?: string | null; chapters: SyllabusChapter[] }
> => {
  const { data } = await apiClient.get('/admin/exams/syllabus', { params: filters });
  return unwrap(data);
};

export interface SyllabusOptions {
  exams: { id: number; exam_name: string; academic_year: string }[];
  standards: { id: number; name: string; code: string }[];
  sections: { id: number; name: string }[];
  subjects: { id: number; name: string }[];
  chapters: {
    id: number;
    name: string;
    description?: string | null;
    topics: string[];
    owning_exam_id?: number | null;
    owning_exam_name?: string | null;
  }[];
  selected_chapter_ids?: number[];
}

export const getSyllabusOptions = async (filters: SyllabusFilters = {}): Promise<SyllabusOptions> => {
  const { data } = await apiClient.get('/admin/exams/syllabus/options', { params: filters });
  return unwrap(data);
};

export const saveSyllabus = async (p: {
  exam_id: number;
  standard_id: number;
  section_id?: number | null;
  subject_id: number;
  chapter_ids: number[];
  /** Editing: every chapter may be unticked, which removes the syllabus. */
  edit?: boolean;
}) => {
  const { data } = await apiClient.post('/admin/exams/syllabus', p);
  return unwrap(data);
};

export const deleteSyllabusGroup = async (p: { exam_id: number; standard_id: number; subject_id: number }) => {
  await apiClient.delete('/admin/exams/syllabus', { data: p });
};

// ─── Exam Papers ──────────────────────────────────────────────────────────────
// The panel's Exam Papers tab: a question paper PDF per exam, class, section
// and subject — or "Other", for a paper tied to none of the class's subjects.
export const PAPER_SUBJECT_OTHER = 'other';

export interface ExamPaper {
  id: number;
  title: string;
  description?: string | null;
  exam_id: number;
  exam_name?: string | null;
  academic_year?: string | null;
  standard_id: number;
  standard_name?: string | null;
  section_id?: number | null;
  section_name?: string | null;
  /** null when filed under Other. */
  subject_id?: number | null;
  /** The subject's name, or "Other". */
  subject_name: string;
  has_file: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PaperFilters {
  exam_id?: number;
  standard_id?: number;
  section_id?: number;
  /** A subject's id, or PAPER_SUBJECT_OTHER. */
  subject_id?: number | string;
}

export const getExamPapers = async (
  filters: PaperFilters = {},
): Promise<{ papers: ExamPaper[]; pagination: Pagination | null; total: number }> => {
  const { data } = await apiClient.get('/admin/exams/papers', { params: filters });
  return unwrap(data);
};

export interface PaperOptions {
  exams: { id: number; exam_name: string; academic_year: string }[];
  standards: { id: number; name: string; code?: string }[];
  sections: { id: number; name: string }[];
  /** The class's (and section's) subjects; every active subject when no class is given. */
  subjects: { id: number; name: string }[];
}

export const getPaperOptions = async (p: { standard_id?: number; section_id?: number } = {}): Promise<PaperOptions> => {
  const { data } = await apiClient.get('/admin/exams/papers/options', { params: p });
  return unwrap(data);
};

export interface PaperPayload {
  exam_id: number;
  standard_id: number;
  section_id?: number | null;
  subject_id: number | string;
  title: string;
  description?: string;
  /** Required for a new paper; on an edit, left out to keep the PDF it has. */
  file?: PickedFile | null;
}

const paperForm = (p: PaperPayload) => {
  const form = new FormData();
  form.append('exam_id', String(p.exam_id));
  form.append('standard_id', String(p.standard_id));
  if (p.section_id) form.append('section_id', String(p.section_id));
  form.append('subject_id', String(p.subject_id));
  form.append('title', p.title);
  if (p.description) form.append('description', p.description);
  if (p.file) {
    form.append('file', {
      uri: p.file.uri,
      type: p.file.type || 'application/pdf',
      name: p.file.name || 'exam-paper.pdf',
    } as any);
  }
  return form;
};

export const createExamPaper = async (p: PaperPayload): Promise<ExamPaper> => {
  const { data } = await apiClient.post('/admin/exams/papers', paperForm(p), MULTIPART);
  return unwrap(data);
};

export const updateExamPaper = async (id: number, p: PaperPayload): Promise<ExamPaper> => {
  const { data } = await apiClient.post(`/admin/exams/papers/${id}`, paperForm(p), MULTIPART);
  return unwrap(data);
};

export const deleteExamPaper = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/exams/papers/${id}`);
};

/** A short-lived link that downloads the paper's PDF, and the name to save it under. */
export const getExamPaperFile = async (id: number): Promise<{ url: string; file_name: string }> => {
  const { data } = await apiClient.get(`/admin/exams/papers/${id}/file`);
  return unwrap(data);
};

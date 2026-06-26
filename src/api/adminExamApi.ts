import apiClient from './apiClient';
import { Pagination } from './adminStudentApi';

// Exams module. Mirrors app/Livewire/Admin/AddExam.php over /admin/exams.

const unwrap = (data: any) => data?.data ?? data;

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
  created_by?: string | null;
}

export interface ExamStats {
  total: number;
  published: number;
  upcoming: number;
  active: number;
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

export interface ExamPayload {
  exam_name: string;
  term: string;
  academic_year: string;
  start_date: string;
  end_date: string;
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
}) => {
  const { data } = await apiClient.post('/admin/exams/syllabus', p);
  return unwrap(data);
};

export const deleteSyllabusGroup = async (p: { exam_id: number; standard_id: number; subject_id: number }) => {
  await apiClient.delete('/admin/exams/syllabus', { data: p });
};

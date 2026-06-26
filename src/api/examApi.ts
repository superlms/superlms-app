import apiClient from './apiClient';
import {
  DEFAULT_EXAM_INSTRUCTIONS,
  Exam,
  SyllabusItem,
  statusFromApi,
} from '../screens/exam/examData';

// ─── Envelope helpers ──────────────────────────────────────────────────────────
const unwrap = (data: any) => data?.data ?? data;
const unwrapList = (data: any): any[] => {
  const d = data?.data ?? data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.items)) return d.items;
  return [];
};

// ─── API shapes (snake_case from Laravel) ──────────────────────────────────────
export interface ApiExam {
  id: number;
  exam_name: string;
  term: string | null;
  exam_type: string | null;
  academic_year: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'upcoming' | 'ongoing' | 'completed' | string;
  total_marks: number | null;
  passing_marks: number | null;
  description?: string | null;
  status_label?: string;
  days_remaining?: number;
}

export interface ApiSyllabusTopic {
  id: number;
  topic_name: string;
}

export interface ApiSyllabusChapter {
  id: number;
  name: string;
  description: string | null;
  order: number;
  topics: ApiSyllabusTopic[];
}

export interface ApiSyllabusGroup {
  standard_id: number;
  standard_name: string | null;
  subject_id: number;
  subject_name: string | null;
  chapter_count: number;
  chapters: ApiSyllabusChapter[];
}

// ─── Mappers ───────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-02-03" → "03 Feb 2026". Returns '' for null/unparseable values.
const fmtDate = (iso?: string | null): string => {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const month = MONTHS[Number(mo) - 1] ?? mo;
  return `${d} ${month} ${y}`;
};

const fmtRange = (start?: string | null, end?: string | null): string => {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (s && e) return `${s} - ${e}`;
  return s || e || 'Dates to be announced';
};

// Turn the grouped API syllabus into the flat { subject, topics[] } the UI uses.
export const mapSyllabus = (groups: ApiSyllabusGroup[]): SyllabusItem[] =>
  (groups || []).map(g => ({
    subject: g.subject_name || 'Subject',
    topics: (g.chapters || []).flatMap(ch =>
      ch.topics?.length ? ch.topics.map(t => t.topic_name) : [ch.name],
    ),
  }));

export const mapExam = (e: ApiExam, syllabus: SyllabusItem[] = []): Exam => ({
  id: String(e.id),
  name: e.exam_name || 'Exam',
  subtitle: e.term || e.exam_type || 'Examination',
  academicYear: e.academic_year || '',
  type: e.exam_type || 'Exam',
  dateRange: fmtRange(e.start_date, e.end_date),
  startDate: fmtDate(e.start_date) || '—',
  endDate: fmtDate(e.end_date) || '—',
  status: statusFromApi(e.status),
  totalMarks: e.total_marks ?? 0,
  passingMarks: e.passing_marks ?? 0,
  venue: '',
  instructions: DEFAULT_EXAM_INSTRUCTIONS,
  syllabus,
});

// ─── Endpoints ─────────────────────────────────────────────────────────────────
export interface ExamFilters {
  academic_year?: string;
  exam_type?: string;
  term?: string;
  search?: string;
}

// GET /exams — scoped server-side to the caller's class/subjects (student or teacher).
export const getExams = async (filters: ExamFilters = {}, perPage = 50): Promise<Exam[]> => {
  const { data } = await apiClient.get('/exams', {
    params: { per_page: perPage, ...filters },
  });
  return unwrapList(data).map((e: ApiExam) => mapExam(e));
};

// GET /exams/{id} — full detail including the scoped syllabus.
export const getExamDetail = async (id: number | string): Promise<Exam> => {
  const { data } = await apiClient.get(`/exams/${id}`);
  const e = unwrap(data);
  const syllabus = mapSyllabus(e?.syllabus ?? []);
  return mapExam(e, syllabus);
};

// GET /exams/{id}/syllabus — just the syllabus groups for an exam.
export const getExamSyllabus = async (
  id: number | string,
  subjectId?: number,
): Promise<SyllabusItem[]> => {
  const { data } = await apiClient.get(`/exams/${id}/syllabus`, {
    params: subjectId ? { subject_id: subjectId } : undefined,
  });
  return mapSyllabus(unwrapList(data) as ApiSyllabusGroup[]);
};

// ─── Error → friendly message ──────────────────────────────────────────────────
export const examErrorMessage = (e: any): string => {
  const status = e?.response?.status;
  const serverMsg = e?.response?.data?.message;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 404) return serverMsg || 'Exam not found.';
  if (e?.message === 'Network Error' || !e?.response) {
    return 'No internet connection. Check your network and try again.';
  }
  if (status >= 500) return serverMsg || 'The server ran into a problem. Please try again.';
  return serverMsg || 'Something went wrong. Please try again.';
};

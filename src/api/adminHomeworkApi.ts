import apiClient from './apiClient';
import { PickedFile } from './adminProfileApi';

// Homework module. Mirrors app/Livewire/Admin/Homework.php over /admin/homework.

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

const filePart = (f: PickedFile, fallback: string, type: string) =>
  ({ uri: f.uri, name: f.name || fallback, type: f.type || type } as any);

export interface HwClass {
  id: number;
  name: string;
  sections: { id: number; name: string }[];
}
export interface HwTeacher { id: number; name: string }
export interface HwSubject { id: number; name: string }

export interface HomeworkLookups {
  classes: HwClass[];
  teachers: HwTeacher[];
}

export interface HomeworkStats {
  total: number;
  this_week: number;
  by_teacher: number;
  by_class: number;
}

export interface HomeworkItem {
  id: number;
  title: string;
  description: string;
  file: string | null;
  standard_id: number;
  section_id: number | null;
  subject_id: number | null;
  standard: string;
  section: string | null;
  subject: string;
  teacher: string;
  created_at: string | null;
  created_label: string | null;
  // The panel's "Set by": who entered it, and whether a teacher or the
  // school's admin ("d M Y, h:i A" for when). Absent from an older server.
  set_by?: string | null;
  set_by_role?: string | null;
  created_time_label?: string | null;
}

export interface HomeworkListResponse {
  data: HomeworkItem[];
  pagination: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

export interface StatusRow {
  date: string;
  day: string;
  items: { subject: string; title: string; complete: boolean }[];
}

export const getHomeworkLookups = async (): Promise<HomeworkLookups> => {
  const { data } = await apiClient.get('/admin/homework/lookups');
  return unwrap(data);
};

export const getHomeworkSubjects = async (
  standard_id: number,
  section_id?: number | null,
): Promise<HwSubject[]> => {
  const { data } = await apiClient.get('/admin/homework/subjects', {
    params: { standard_id, section_id: section_id || undefined },
  });
  return unwrap(data)?.subjects ?? [];
};

export const getHomeworkStats = async (): Promise<HomeworkStats> => {
  const { data } = await apiClient.get('/admin/homework/stats');
  return unwrap(data);
};

export const getHomeworks = async (p: {
  search?: string;
  teacher_id?: number | null;
  standard_id?: number | null;
  section_id?: number | null;
  subject_id?: number | null;
  per_page?: number;
  page?: number;
  /** The day it was assigned (YYYY-MM-DD). */
  date?: string;
  /** A teacher's user id, read as the panel's teacher filter (their subjects too). */
  teacher?: number | null;
}): Promise<HomeworkListResponse> => {
  const { data } = await apiClient.get('/admin/homework', { params: p });
  // paginated() → success({ items, pagination }) → { data: { items, pagination } }
  const d = unwrap(data);
  return { data: d?.items ?? [], pagination: d?.pagination ?? {} } as HomeworkListResponse;
};

export interface HomeworkPayload {
  title: string;
  standard_id: number;
  section_id?: number | null;
  subject_id: number;
  description: string;
  file?: PickedFile | null;
}

const buildForm = (p: HomeworkPayload) => {
  const form = new FormData();
  form.append('title', p.title);
  form.append('standard_id', String(p.standard_id));
  if (p.section_id) form.append('section_id', String(p.section_id));
  form.append('subject_id', String(p.subject_id));
  form.append('description', p.description);
  if (p.file) {
    const isPdf = (p.file.type || '').includes('pdf') || (p.file.name || '').toLowerCase().endsWith('.pdf');
    form.append('file', filePart(p.file, isPdf ? 'homework.pdf' : 'homework.jpg', isPdf ? 'application/pdf' : 'image/jpeg'));
  }
  return form;
};

export const createHomework = async (p: HomeworkPayload): Promise<HomeworkItem> => {
  const { data } = await apiClient.post('/admin/homework', buildForm(p), MULTIPART);
  return unwrap(data)?.homework;
};

export const updateHomework = async (id: number, p: HomeworkPayload): Promise<HomeworkItem> => {
  const { data } = await apiClient.post(`/admin/homework/${id}`, buildForm(p), MULTIPART);
  return unwrap(data)?.homework;
};

/** "All subjects" bulk create — one row per filled-in subject (no per-row files). */
export const createHomeworkBulk = async (p: {
  standard_id: number;
  section_id?: number | null;
  items: { subject_id: number; title: string; description: string }[];
}): Promise<{ created: number }> => {
  const { data } = await apiClient.post('/admin/homework', {
    mode: 'all',
    standard_id: p.standard_id,
    section_id: p.section_id || undefined,
    items: p.items,
  });
  return unwrap(data);
};

export const deleteHomework = async (id: number) => {
  await apiClient.delete(`/admin/homework/${id}`);
};

export const getHomeworkStatus = async (p: {
  standard_id: number;
  section_id: number;
  student_id: number;
  days?: number;
}): Promise<{ student: any; days: number; rows: StatusRow[] }> => {
  const { data } = await apiClient.get('/admin/homework/status', { params: p });
  return unwrap(data);
};

// ── The panel's Homework tab and Status register, in full ──────────────────

/** How many homework each of the last 30 days holds under the list's filters (bar the day). */
export const getHomeworkDays = async (p: {
  standard_id: number;
  section_id: number;
  subject_id?: number | null;
  teacher?: number | null;
  search?: string;
}): Promise<Record<string, number>> => {
  const { data } = await apiClient.get('/admin/homework/days', { params: p });
  return unwrap(data)?.dates ?? {};
};

export interface StatusStudentRow {
  student_id: number;
  name: string;
  roll_no: string | null;
  items: { subject: string; title: string; date: string; complete: boolean }[];
  completed: number;
  total: number;
}

export interface HomeworkRegister {
  /** by_day: one student, day by day; by_student: every student in the section. */
  mode: 'by_day' | 'by_student';
  scope: string;
  date: string | null;
  window_start: string;
  student: { id: number; name: string; roll_no: string | null } | null;
  days: number;
  rows: StatusRow[] | StatusStudentRow[];
  students: { id: number; name: string; roll_no: string | null }[];
  subjects: HwSubject[];
}

/**
 * The panel's Homework Status register: a class and a section, narrowed by a
 * student (day by day), a subject and a day (within the last 30).
 */
export const getHomeworkRegister = async (p: {
  standard_id: number;
  section_id: number;
  student_id?: number | null;
  subject_id?: number | null;
  date?: string | null;
  days?: number;
}): Promise<HomeworkRegister> => {
  const { data } = await apiClient.get('/admin/homework/status', {
    params: {
      standard_id: p.standard_id,
      section_id: p.section_id,
      student_id: p.student_id || undefined,
      subject_id: p.subject_id || undefined,
      date: p.date || undefined,
      days: p.days,
    },
  });
  return unwrap(data);
};

/**
 * "All subjects" create as the panel makes it — each filled-in subject with its
 * own attachment (≤1 MB), sent as `files[<subject_id>]`.
 */
export const createHomeworkAll = async (p: {
  standard_id: number;
  section_id?: number | null;
  items: { subject_id: number; title: string; description: string; file?: PickedFile | null }[];
}): Promise<{ created: number }> => {
  const form = new FormData();
  form.append('mode', 'all');
  form.append('standard_id', String(p.standard_id));
  if (p.section_id) form.append('section_id', String(p.section_id));
  form.append('items', JSON.stringify(p.items.map(({ subject_id, title, description }) => ({ subject_id, title, description }))));
  p.items.forEach(it => {
    if (!it.file) return;
    const isPdf = (it.file.type || '').includes('pdf') || (it.file.name || '').toLowerCase().endsWith('.pdf');
    form.append(`files[${it.subject_id}]`, filePart(it.file, isPdf ? 'homework.pdf' : 'homework.jpg', isPdf ? 'application/pdf' : 'image/jpeg'));
  });
  const { data } = await apiClient.post('/admin/homework', form, MULTIPART);
  return unwrap(data);
};

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

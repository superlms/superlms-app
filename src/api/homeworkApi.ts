import apiClient from './apiClient';

const unwrap = (data: any) => data?.data ?? data;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface HomeworkItem {
  id: number;
  title: string;
  description: string | null;
  subject: { id: number; name: string; code: string | null } | null;
  standard: string | null;
  standard_id: number | null;
  section: string | null;
  section_id: number | null;
  assigned_by: string;
  assigned_date: string | null; // YYYY-MM-DD
  assigned_time: string | null;
  days_ago: string | null;
  file_url: string | null;
  file_type: 'pdf' | 'image' | 'doc' | null;
}

export interface TeacherHomeworkResponse {
  homeworks: HomeworkItem[];
  pagination: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface StudentHomeworkResponse {
  student_info: { id: number; name: string; standard: string | null; section: string | null; roll_no: string | null };
  homeworks: HomeworkItem[];
  pagination: { current_page: number; last_page: number; per_page: number; total: number };
  summary: { total_homework: number };
}

// POST /homework/get — teacher's own homework (last `days` days)
export const getTeacherHomework = async (days = 15): Promise<TeacherHomeworkResponse> => {
  const { data } = await apiClient.post('/homework/get', { days, per_page: 100 });
  return unwrap(data);
};

// POST /homework/student — student's class homework (last `days` days)
export const getStudentHomework = async (days = 15): Promise<StudentHomeworkResponse> => {
  const { data } = await apiClient.post('/homework/student', { days, per_page: 100 });
  return unwrap(data);
};

export interface CreateHomeworkPayload {
  standard_id: number;
  section_id: number;
  subject_id: number;
  title: string;
  description?: string;
}

export interface HomeworkFile {
  uri: string;
  name: string;
  type?: string;
}

// POST /homework/upload — multipart when a file is attached, JSON otherwise
export const createHomework = async (
  payload: CreateHomeworkPayload,
  file?: HomeworkFile | null,
): Promise<HomeworkItem> => {
  if (file?.uri) {
    const fd = new FormData();
    fd.append('standard_id', String(payload.standard_id));
    fd.append('section_id', String(payload.section_id));
    fd.append('subject_id', String(payload.subject_id));
    fd.append('title', payload.title);
    if (payload.description) fd.append('description', payload.description);
    fd.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type ?? 'application/octet-stream',
    } as any);
    const { data } = await apiClient.post('/homework/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(data);
  }
  const { data } = await apiClient.post('/homework/upload', payload);
  return unwrap(data);
};

// DELETE /homework/delete/{id}
export const deleteHomework = async (id: number): Promise<void> => {
  await apiClient.delete(`/homework/delete/${id}`);
};

// ─── Subject visuals (server has no styling fields) ───────────────────────────
const PALETTE = [
  { color: '#6366F1', bg: '#EEF2FF' },
  { color: '#0EA5E9', bg: '#E0F2FE' },
  { color: '#10B981', bg: '#D1FAE5' },
  { color: '#F59E0B', bg: '#FEF3C7' },
  { color: '#EF4444', bg: '#FEE2E2' },
  { color: '#8B5CF6', bg: '#EDE9FE' },
  { color: '#EC4899', bg: '#FCE7F3' },
];
const EMOJI: { match: string; icon: string }[] = [
  { match: 'math', icon: '📐' },
  { match: 'eng', icon: '📖' },
  { match: 'phys', icon: '⚛️' },
  { match: 'chem', icon: '🧪' },
  { match: 'bio', icon: '🌿' },
  { match: 'sci', icon: '🔬' },
  { match: 'hist', icon: '🏛️' },
  { match: 'geo', icon: '🌍' },
  { match: 'comp', icon: '💻' },
  { match: 'hindi', icon: '🕉️' },
];
export const homeworkSubjectVisual = (name: string): { icon: string; color: string; bg: string } => {
  const n = (name || '').toLowerCase();
  const icon = EMOJI.find(e => n.includes(e.match))?.icon ?? '📚';
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h + n.charCodeAt(i)) % PALETTE.length;
  return { icon, ...PALETTE[h] };
};

export const homeworkErrorMessage = (e: any): string => {
  const status = e?.response?.status;
  const serverMsg = e?.response?.data?.message;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 422) return serverMsg || 'Please fill all required fields.';
  if (status === 404) return serverMsg || 'Not found.';
  if (e?.message === 'Network Error' || !e?.response) {
    return 'No internet connection. Check your network and try again.';
  }
  if (status >= 500) return serverMsg || 'The server ran into a problem. Please try again.';
  return serverMsg || 'Something went wrong. Please try again.';
};

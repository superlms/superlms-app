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
  // Teacher list only: the class's period in the teacher's timetable ("09:00").
  period_start?: string | null;
  period_end?: string | null;
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

// POST /homework/update/{id} — the same fields as create. `removeFile` drops
// the current attachment when no new file is sent; a new file replaces it.
export const updateHomework = async (
  id: number,
  payload: CreateHomeworkPayload,
  file?: HomeworkFile | null,
  removeFile = false,
): Promise<HomeworkItem> => {
  const fields: Record<string, string> = {
    standard_id: String(payload.standard_id),
    section_id: String(payload.section_id),
    subject_id: String(payload.subject_id),
    title: payload.title,
    // Always sent, so clearing the description clears it on the server too.
    description: payload.description ?? '',
  };
  if (removeFile && !file?.uri) fields.remove_file = '1';

  if (file?.uri) {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type ?? 'application/octet-stream',
    } as any);
    const { data } = await apiClient.post(`/homework/update/${id}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(data);
  }
  const { data } = await apiClient.post(`/homework/update/${id}`, fields);
  return unwrap(data);
};

// DELETE /homework/delete/{id}
export const deleteHomework = async (id: number): Promise<void> => {
  await apiClient.delete(`/homework/delete/${id}`);
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

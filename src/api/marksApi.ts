import apiClient from './apiClient';

// Unwrap the various success envelopes the API uses.
const unwrap = (data: any) => data?.data ?? data;
const unwrapList = (data: any): any[] => {
  const d = data?.data ?? data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.items)) return d.items;
  return [];
};

// ════════════════════════════════════════════════════════════════════════════
//  STUDENT
// ════════════════════════════════════════════════════════════════════════════
export interface StudentMark {
  id: number;
  exam_id: number;
  exam_name: string;
  subject_id: number;
  subject_name: string;
  marks_obtained: number | null;
  max_marks: number | null;
  percentage: number | null;
  grade: string | null;
  is_absent: boolean;
  remarks: string | null;
}

export const getStudentMarks = async (perPage = 100): Promise<StudentMark[]> => {
  const { data } = await apiClient.get('/student/marks', { params: { per_page: perPage } });
  return unwrapList(data);
};

export interface StudentPerformance {
  student?: { id: number; name: string; roll_no: string; admission_no: string };
  total_exams_given: number;
  overall_percentage: number;
  total_marks_obtained: number;
  total_max_marks: number;
  subject_wise_performance: {
    subject_id: number;
    subject_name: string;
    percentage: number;
    exam_count: number;
    average_marks: number;
  }[];
  performance_trend: {
    exam_id: number;
    exam_name: string;
    percentage: number;
    marks_obtained: number;
    max_marks: number;
    date: string | null;
  }[];
  grade_distribution: Record<string, number>;
}

export const getStudentPerformance = async (): Promise<StudentPerformance> => {
  const { data } = await apiClient.get('/student/marks/overall-performance');
  return unwrap(data);
};

export interface StudentExamCopy {
  id: number;
  exam: { id: number; name: string };
  subject: { id: number; name: string };
  standard: { id: number; name: string };
  section: { id: number; name: string };
  pdf_url: string | null;
  marks_obtained: number | null;
  max_marks: number | null;
  percentage: number | null;
  grade: string | null;
  remarks: string | null;
  uploaded_at: string | null;
}

export const getStudentExamCopies = async (perPage = 100): Promise<StudentExamCopy[]> => {
  const { data } = await apiClient.get('/student/exam-copies', { params: { per_page: perPage } });
  return unwrapList(data);
};

// ════════════════════════════════════════════════════════════════════════════
//  TEACHER
// ════════════════════════════════════════════════════════════════════════════
export interface ExamItem {
  id: number;
  exam_name: string;
  term: string | null;
  exam_type: string | null;
  academic_year: string | null;
  total_marks: number | null;
}

export const getExams = async (perPage = 100): Promise<ExamItem[]> => {
  const { data } = await apiClient.get('/exams', { params: { per_page: perPage } });
  return unwrapList(data);
};

export interface ClassSubject {
  standard_id: number;
  standard_name: string;
  section_id: number;
  section_name: string;
  subject_id: number;
  subject_name: string;
  label: string;
}

export const getTeacherClassesSubjects = async (): Promise<ClassSubject[]> => {
  const { data } = await apiClient.get('/teacher/classes-subjects');
  return unwrapList(data);
};

export interface RosterStudent {
  student_detail_id: number;
  name: string;
  roll_no: string | null;
  admission_no: string | null;
  email: string | null;
}

export const getMarksStudents = async (
  standardId: number,
  sectionId: number,
): Promise<RosterStudent[]> => {
  const { data } = await apiClient.get('/teacher/marks/students', {
    params: { standard_id: standardId, section_id: sectionId },
  });
  return unwrapList(data);
};

// Max exam-copy file size accepted by the API (2 MB). Enforced client-side
// too so the user gets an instant, friendly message instead of a 422.
export const MAX_COPY_BYTES = 2 * 1024 * 1024;
export const MAX_COPY_LABEL = '2 MB';

// ─── Existing teacher rows (used to pre-fill the upload screens for CRUD) ─────
export interface TeacherMarkRow {
  id: number;
  student: { id: number; name: string; roll_no: string | null } | null;
  marks_obtained: number | null;
  max_marks: number | null;
  grade: string | null;
  is_absent: boolean;
}

export interface ExistingFilter {
  exam_id: number;
  standard_id: number;
  section_id: number;
  subject_id: number;
}

// Marks already saved for an exam+class+subject, keyed by student_detail_id.
export const getTeacherMarks = async (
  filter: ExistingFilter,
): Promise<Record<number, TeacherMarkRow>> => {
  const { data } = await apiClient.get('/teacher/marks', {
    params: { ...filter, per_page: 200 },
  });
  const map: Record<number, TeacherMarkRow> = {};
  unwrapList(data).forEach((r: any) => {
    if (r?.student?.id != null) map[r.student.id] = r;
  });
  return map;
};

export interface TeacherCopyRow {
  id: number;
  student: { id: number; name: string; roll_no: string | null } | null;
  pdf_url: string | null;
}

// Exam copies already uploaded for an exam+class+subject, keyed by student_detail_id.
export const getTeacherExamCopies = async (
  filter: ExistingFilter,
): Promise<Record<number, TeacherCopyRow>> => {
  const { data } = await apiClient.get('/teacher/exam-copies', {
    params: { ...filter, per_page: 200 },
  });
  const map: Record<number, TeacherCopyRow> = {};
  unwrapList(data).forEach((r: any) => {
    if (r?.student?.id != null) map[r.student.id] = r;
  });
  return map;
};

export const deleteMark = async (id: number): Promise<void> => {
  await apiClient.delete(`/teacher/marks/${id}`);
};

export const deleteExamCopy = async (id: number): Promise<void> => {
  await apiClient.delete(`/teacher/exam-copies/${id}`);
};

export interface MarkPayload {
  exam_id: number;
  student_detail_id: number;
  standard_id: number;
  section_id: number;
  subject_id: number;
  marks_obtained: number;
  max_marks: number;
  is_absent?: boolean;
}

// Create marks; if a row already exists (409), find it and update instead.
export const upsertMark = async (payload: MarkPayload): Promise<void> => {
  try {
    await apiClient.post('/teacher/marks', payload);
  } catch (e: any) {
    if (e?.response?.status !== 409) throw e;
    const { data } = await apiClient.get('/teacher/marks', {
      params: {
        exam_id: payload.exam_id,
        student_detail_id: payload.student_detail_id,
        subject_id: payload.subject_id,
        standard_id: payload.standard_id,
        section_id: payload.section_id,
        per_page: 1,
      },
    });
    const id = unwrapList(data)[0]?.id;
    if (!id) throw e;
    await apiClient.put(`/teacher/marks/${id}`, {
      marks_obtained: payload.marks_obtained,
      max_marks: payload.max_marks,
      is_absent: payload.is_absent ?? false,
    });
  }
};

export interface CopyFile {
  uri: string;
  name: string;
  type?: string;
}

// Upload an exam-copy PDF; if a row already exists (409), replace it.
export const upsertExamCopy = async (
  meta: {
    exam_id: number;
    student_detail_id: number;
    standard_id: number;
    section_id: number;
    subject_id: number;
  },
  file: CopyFile,
): Promise<void> => {
  const buildForm = (extra?: Record<string, string>) => {
    const fd = new FormData();
    Object.entries(meta).forEach(([k, v]) => fd.append(k, String(v)));
    if (extra) Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    fd.append('pdf', {
      uri: file.uri,
      name: file.name,
      type: file.type ?? 'application/pdf',
    } as any);
    return fd;
  };

  const headers = { 'Content-Type': 'multipart/form-data' };
  try {
    await apiClient.post('/teacher/exam-copies', buildForm(), { headers });
  } catch (e: any) {
    if (e?.response?.status !== 409) throw e;
    const { data } = await apiClient.get('/teacher/exam-copies', {
      params: {
        exam_id: meta.exam_id,
        student_detail_id: meta.student_detail_id,
        subject_id: meta.subject_id,
        standard_id: meta.standard_id,
        section_id: meta.section_id,
        per_page: 1,
      },
    });
    const id = unwrapList(data)[0]?.id;
    if (!id) throw e;
    await apiClient.post(`/teacher/exam-copies/${id}`, buildForm({ _method: 'PUT' }), { headers });
  }
};

// ─── Shared error → message helper ─────────────────────────────────────────────
export const marksErrorMessage = (e: any): string => {
  const status = e?.response?.status;
  const serverMsg = e?.response?.data?.message;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return serverMsg || "You don't teach this class/subject.";
  if (status === 404) return serverMsg || 'Not found.';
  if (e?.message === 'Network Error' || !e?.response) {
    return 'No internet connection. Check your network and try again.';
  }
  if (status >= 500) return serverMsg || 'The server ran into a problem. Please try again.';
  return serverMsg || 'Something went wrong. Please try again.';
};

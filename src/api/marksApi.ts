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

// ─── One exam's result, subject by subject (Performance) ──────────────────────
export interface ExamSubjectResult {
  subject_id: number;
  subject_name: string;
  subject_image: string | null;
  /** false while the subject's marks haven't been added. */
  uploaded: boolean;
  is_absent: boolean;
  marks_obtained: number | null;
  max_marks: number | null;
  percentage: number | null;
  grade: string | null;
  remarks: string | null;
}

export interface GradeBand {
  grade: string;
  min: number;
  max: number;
  remark: string;
}

export interface StudentExamResult {
  exam: { id: number; name: string; total_marks: number | null; passing_marks: number | null };
  subjects: ExamSubjectResult[];
  summary: {
    subjects: number;
    uploaded: number;
    absent: number;
    marks_obtained: number;
    max_marks: number;
    percentage: number | null;
    grade: string | null;
    remark: string | null;
  };
  grading_scale: GradeBand[];
}

export const getStudentExamResult = async (examId: number | string): Promise<StudentExamResult> => {
  const { data } = await apiClient.get(`/student/marks/exams/${examId}`);
  return unwrap(data);
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

// Max exam-copy file size accepted by the API (5 MB, as the admin panel takes).
// Enforced client-side too so the user gets an instant, friendly message
// instead of a 422.
export const MAX_COPY_BYTES = 5 * 1024 * 1024;
export const MAX_COPY_LABEL = '5 MB';

// ─── Upload Copies: exam → class → the class's copies ────────────────────────
export interface CopyClass {
  standard_id: number;
  standard_name: string;
  section_id: number;
  section_name: string;
  subject_id: number;
  subject_name: string;
  subject_image: string | null;
  students: number;
  /** Students with marks saved for the exam, absent ones included. */
  marked: number;
  uploaded: number;
  /** Copies can only go up once the exam's marks are saved for the subject. */
  has_marks: boolean;
}

export const getCopyClasses = async (examId: number | string): Promise<CopyClass[]> => {
  const { data } = await apiClient.get('/teacher/exam-copies/classes', { params: { exam_id: examId } });
  return unwrapList(data);
};

export interface CopyStudent {
  student_detail_id: number;
  name: string;
  roll_no: string | null;
  admission_no: string | null;
  marked: boolean;
  is_absent: boolean;
  marks_obtained: number | null;
  max_marks: number | null;
  grade: string | null;
  has_copy: boolean;
  pdf_url: string | null;
  remarks: string | null;
  uploaded_at: string | null;
}

export interface CopySheet {
  exam: { id: number; name: string; total_marks: number | null };
  has_marks: boolean;
  /** Largest copy the server takes, in kilobytes. */
  max_kb: number;
  students: CopyStudent[];
}

export const getCopySheet = async (key: ExistingFilter): Promise<CopySheet> => {
  const { data } = await apiClient.get('/teacher/exam-copies/sheet', { params: key });
  return unwrap(data);
};

// One student's copy goes up (or replaces the one there); the sheet comes back.
export const uploadCopyPdf = async (
  key: ExistingFilter,
  studentDetailId: number,
  file: CopyFile,
): Promise<CopySheet> => {
  const form = new FormData();
  Object.entries(key).forEach(([k, v]) => form.append(k, String(v)));
  form.append('student_detail_id', String(studentDetailId));
  form.append('pdf', { uri: file.uri, name: file.name, type: file.type ?? 'application/pdf' } as any);
  const { data } = await apiClient.post('/teacher/exam-copies/sheet/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // A copy can take a while on a slow connection.
    timeout: 120000,
  });
  return unwrap(data);
};

/** Take one student's copy down; their marks stay. */
export const removeCopyPdf = async (key: ExistingFilter, studentDetailId: number): Promise<CopySheet> => {
  const { data } = await apiClient.post('/teacher/exam-copies/sheet/remove', {
    ...key,
    student_detail_id: studentDetailId,
  });
  return unwrap(data);
};

// ─── One exam's copies, subject by subject (students) ────────────────────────
export interface ExamCopySubject {
  subject_id: number;
  subject_name: string;
  subject_image: string | null;
  has_copy: boolean;
  pdf_url: string | null;
  marked: boolean;
  is_absent: boolean;
  marks_obtained: number | null;
  max_marks: number | null;
  grade: string | null;
  remarks: string | null;
  uploaded_at: string | null;
}

export interface StudentExamCopies {
  exam: { id: number; name: string; total_marks: number | null };
  subjects: ExamCopySubject[];
  copies: number;
}

export const getStudentExamCopies = async (examId: number | string): Promise<StudentExamCopies> => {
  const { data } = await apiClient.get(`/student/exam-copies/exams/${examId}`);
  return unwrap(data);
};

export interface ExistingFilter {
  exam_id: number;
  standard_id: number;
  section_id: number;
  subject_id: number;
}

// ─── Upload Marks: exam → class → the whole class's marks ────────────────────
export interface MarksClass {
  standard_id: number;
  standard_name: string;
  section_id: number;
  section_name: string;
  subject_id: number;
  subject_name: string;
  subject_image: string | null;
  students: number;
  /** Students with marks saved for the exam, absent ones included. */
  saved: number;
  absent: number;
}

// The (class, section, subject) rows a teacher teaches, with the exam's progress in each.
export const getMarksClasses = async (examId: number | string): Promise<MarksClass[]> => {
  const { data } = await apiClient.get('/teacher/marks/classes', { params: { exam_id: examId } });
  return unwrapList(data);
};

export interface SheetStudent {
  student_detail_id: number;
  name: string;
  roll_no: string | null;
  admission_no: string | null;
  mark_id: number | null;
  saved: boolean;
  is_absent: boolean;
  /** null when absent or not saved. */
  marks_obtained: number | null;
  max_marks: number | null;
  percentage: number | null;
  grade: string | null;
}

export interface MarksSheet {
  exam: { id: number; name: string; total_marks: number; passing_marks: number | null };
  /** Marks have been saved for this class before. */
  uploaded: boolean;
  students: SheetStudent[];
}

export const getMarksSheet = async (key: ExistingFilter): Promise<MarksSheet> => {
  const { data } = await apiClient.get('/teacher/marks/sheet', { params: key });
  return unwrap(data);
};

// Saves the whole class at once. The server marks every student sent without
// marks — or left out — absent, as the web panel does.
export const saveMarksSheet = async (
  key: ExistingFilter,
  marks: { student_detail_id: number; marks_obtained: number | null }[],
): Promise<{ sheet: MarksSheet; message: string }> => {
  const { data } = await apiClient.post('/teacher/marks/sheet', { ...key, marks });
  return { sheet: unwrap(data), message: data?.message ?? 'Marks saved.' };
};

export interface CopyFile {
  uri: string;
  name: string;
  type?: string;
}

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

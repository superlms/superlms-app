import apiClient from './apiClient';

// ─────────────────────────────────────────────────────────────────────────────
//  Assignments — the admin panel's Assignments, in the app.
//
//  An assignment is set for one class, section and subject and is open from a
//  start to a due date and time. It is written (the student answers with text,
//  a file, or both — `submission_mode`) or a set of MCQs scored on the spot.
//  A student sees their class's and answers once (a written one can be sent
//  again until it is checked); a teacher adds and edits them for the classes
//  and subjects they teach and sees what each student turned in.
// ─────────────────────────────────────────────────────────────────────────────

const unwrap = (data: any) => data?.data ?? data;

export type AssignmentType = 'written' | 'mcq';
export type SubmissionMode = 'text' | 'file' | 'both';
export type WindowStatus = 'open' | 'upcoming' | 'closed';
export type SubmissionStatus = 'submitted' | 'reviewed' | 'approved' | 'rejected';

export interface AssignmentOption {
  id: number;
  text: string;
  // Hidden from a student (null) until they have submitted.
  is_correct: boolean | null;
}

export interface AssignmentQuestion {
  id: number;
  question_text: string;
  marks: number;
  options: AssignmentOption[];
  // A student's own answer, once submitted.
  chosen_option_id?: number | null;
  is_correct?: boolean | null;
}

export interface AssignmentSubmission {
  id: number;
  status: SubmissionStatus;
  answer_text: string | null;
  file: string | null;
  file_name: string | null;
  marks: number | null;
  mcq_score: number | null;
  remarks: string | null;
  submitted_at: string | null;
}

export interface RosterRow {
  student_detail_id: number;
  name: string;
  roll_no: string | null;
  image: string | null;
  status: SubmissionStatus | 'pending';
  submission_id: number | null;
  submitted_at: string | null;
  marks: number | null;
  mcq_score: number | null;
}

export interface Assignment {
  id: number;
  title: string;
  description: string | null;
  type: AssignmentType;
  submission_mode: SubmissionMode;
  file: string | null;
  standard_id: number | null;
  standard: string | null;
  section_id: number | null;
  section: string | null;
  subject_id: number | null;
  subject: string | null;
  subject_image: string | null;
  created_by: string | null;
  start_date: string | null; // "YYYY-MM-DD HH:mm:ss"
  end_date: string | null;
  window_status: WindowStatus;
  total_marks: number;
  question_count: number;
  questions?: AssignmentQuestion[];
  // A student's
  submission?: AssignmentSubmission | null;
  // A teacher's
  is_active?: boolean;
  marks_set?: number;
  class_size?: number;
  submitted_count?: number;
  stats?: { total: number; submitted: number; pending: number; reviewed: number };
  roster?: RosterRow[];
}

export interface SubmissionAnswer extends AssignmentQuestion {
  question_id: number;
}

export interface SubmissionDetail {
  id: number;
  assignment: Assignment;
  student: { id: number | null; name: string | null; roll_no: string | null; image: string | null };
  status: SubmissionStatus;
  answer_text: string | null;
  file: string | null;
  file_name: string | null;
  marks: number | null;
  mcq_score: number | null;
  remarks: string | null;
  submitted_at: string | null;
  answers: SubmissionAnswer[];
}

export interface PickedAttachment {
  uri: string;
  name: string;
  type?: string;
  size?: number;
}

const fileField = (f: PickedAttachment) =>
  ({ uri: f.uri, name: f.name, type: f.type ?? 'application/octet-stream' } as any);

// ── A student's ──────────────────────────────────────────────────────────────

// POST /assignment/student — their class's, leaving out any past its due date.
export const getStudentAssignments = async (): Promise<Assignment[]> => {
  const { data } = await apiClient.post('/assignment/student', { hide_closed: 1, per_page: 100 });
  return unwrap(data)?.assignments ?? [];
};

// GET /assignment/{id} — with its questions (the right answers once submitted).
export const getAssignment = async (id: number): Promise<Assignment> => {
  const { data } = await apiClient.get(`/assignment/${id}`);
  return unwrap(data);
};

// POST /assignment/submit/{id} — text and/or a file, or the MCQ answers.
export const submitAssignment = async (
  id: number,
  attempt: { answer_text?: string; file?: PickedAttachment | null; answers?: { question_id: number; option_id: number }[] },
): Promise<Assignment> => {
  if (attempt.file?.uri) {
    const fd = new FormData();
    if (attempt.answer_text) fd.append('answer_text', attempt.answer_text);
    fd.append('file', fileField(attempt.file));
    const { data } = await apiClient.post(`/assignment/submit/${id}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(data);
  }
  const { data } = await apiClient.post(`/assignment/submit/${id}`, {
    answer_text: attempt.answer_text,
    answers: attempt.answers,
  });
  return unwrap(data);
};

// ── A teacher's ──────────────────────────────────────────────────────────────

// GET /teacher/assignments — for their classes and subjects, not past due.
export const getTeacherAssignments = async (): Promise<Assignment[]> => {
  const { data } = await apiClient.get('/teacher/assignments');
  return unwrap(data)?.assignments ?? [];
};

// GET /teacher/assignments/{id} — questions with the right answers, and the roster.
export const getTeacherAssignment = async (id: number): Promise<Assignment> => {
  const { data } = await apiClient.get(`/teacher/assignments/${id}`);
  return unwrap(data);
};

// GET /teacher/assignments/{id}/submissions/{sid} — what one student turned in.
export const getAssignmentSubmission = async (id: number, submissionId: number): Promise<SubmissionDetail> => {
  const { data } = await apiClient.get(`/teacher/assignments/${id}/submissions/${submissionId}`);
  return unwrap(data);
};

export interface QuestionDraft {
  id?: number | null;
  question_text: string;
  marks: number;
  options: { id?: number | null; text: string; is_correct: boolean }[];
}

export interface AssignmentDraft {
  standard_id: number;
  section_id: number;
  subject_id: number;
  title: string;
  description: string;
  type: AssignmentType;
  submission_mode: SubmissionMode;
  start_date: string; // "YYYY-MM-DD HH:mm"
  end_date: string;
  total_marks: string;
  is_active: boolean;
  questions: QuestionDraft[];
}

// POST /teacher/assignments[/{id}] — add, or edit. A new file replaces the
// one there; `removeFile` takes it off when no new one is sent.
export const saveAssignment = async (
  draft: AssignmentDraft,
  opts: { id?: number; file?: PickedAttachment | null; removeFile?: boolean } = {},
): Promise<Assignment> => {
  const url = opts.id ? `/teacher/assignments/${opts.id}` : '/teacher/assignments';
  const fields: Record<string, string> = {
    standard_id: String(draft.standard_id),
    section_id: String(draft.section_id),
    subject_id: String(draft.subject_id),
    title: draft.title,
    description: draft.description,
    type: draft.type,
    submission_mode: draft.submission_mode,
    start_date: draft.start_date,
    end_date: draft.end_date,
    total_marks: draft.total_marks,
    is_active: draft.is_active ? '1' : '0',
    questions: JSON.stringify(draft.type === 'mcq' ? draft.questions : []),
  };
  if (opts.removeFile && !opts.file?.uri) fields.remove_file = '1';

  if (opts.file?.uri) {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', fileField(opts.file));
    const { data } = await apiClient.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return unwrap(data);
  }
  const { data } = await apiClient.post(url, fields);
  return unwrap(data);
};

export const assignmentErrorMessage = (e: any): string => {
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.message === 'Network Error') return 'Network Error. Please check your internet connection.';
  return e?.message || 'Something went wrong. Please try again.';
};

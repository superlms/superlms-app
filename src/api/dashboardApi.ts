import apiClient from './apiClient';

const unwrap = (data: any) => data?.data ?? data;

// ─── Shared shapes ─────────────────────────────────────────────────────────────
export interface DashExam {
  id: number;
  name: string;
  type: string | null;
  academic_year: string | null;
  date_range: string;
  status: 'upcoming' | 'ongoing' | 'completed' | string;
}

export interface DashNotice {
  id: number;
  title: string | null;
  type: string;
  time: string | null;
}

export interface DashHomework {
  id: number;
  title: string | null;
  subject_name: string | null;
  class?: string | null;
  date: string | null;
}

// ─── Student ───────────────────────────────────────────────────────────────────
export interface StudentDashboard {
  profile: {
    name: string | null;
    standard: string | null;
    section: string | null;
    roll_no: string | number | null;
    admission_no: string | null;
  };
  attendance: {
    month: string;
    total_days: number;
    working_days: number;
    present_days: number;
    absent_days: number;
    leave_days: number;
    present_percentage: number;
    week: { label: string; date: string; status: 'present' | 'absent' | 'holiday' | string }[];
  };
  performance: {
    overall_percentage: number;
    total_obtained: number;
    total_max: number;
    subject_wise: { subject_name: string | null; percentage: number }[];
    trend: { exam_name: string | null; percentage: number }[];
  };
  exams: { upcoming: DashExam[] };
  homework: { total: number; recent: DashHomework[] };
  notices: DashNotice[];
}

export const getStudentDashboard = async (): Promise<StudentDashboard> => {
  const { data } = await apiClient.get('/student/dashboard');
  return unwrap(data);
};

// ─── Teacher ───────────────────────────────────────────────────────────────────
export interface TeacherClassAttendance {
  class: string;
  present: number;
  total: number;
  percentage: number;
}

export interface TeacherDashboard {
  profile: { name: string | null; employee_id: string | null };
  today_classes: { subject: string; class: string; time: string | null; room: string | null }[];
  totals: {
    total_students: number;
    total_classes_today: number;
    homework_count: number;
    upcoming_exams: number;
  };
  class_attendance: {
    overall_percentage: number;
    by_class: TeacherClassAttendance[];
  };
  homework: { recent: DashHomework[] };
  exams: { upcoming: DashExam[] };
  notices: DashNotice[];
}

export const getTeacherDashboard = async (): Promise<TeacherDashboard> => {
  const { data } = await apiClient.get('/teacher/dashboard');
  return unwrap(data);
};

// ─── Error → friendly message ──────────────────────────────────────────────────
export const dashboardErrorMessage = (e: any): string => {
  const status = e?.response?.status;
  const serverMsg = e?.response?.data?.message;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 404) return serverMsg || 'Profile not found.';
  if (e?.message === 'Network Error' || !e?.response) {
    return 'No internet connection. Check your network and try again.';
  }
  if (status >= 500) return serverMsg || 'The server ran into a problem. Please try again.';
  return serverMsg || 'Something went wrong. Please try again.';
};

// Deterministic colour + emoji for a subject name (the dashboard payload carries
// no styling), so homework/subject rows keep their colourful look.
const PALETTE = [
  { color: '#4F46E5', icon: '📘' },
  { color: '#0EA5E9', icon: '📐' },
  { color: '#10B981', icon: '🧪' },
  { color: '#22C55E', icon: '🌿' },
  { color: '#D97706', icon: '📖' },
  { color: '#DC2626', icon: '🏛️' },
  { color: '#8B5CF6', icon: '🌍' },
  { color: '#EC4899', icon: '💻' },
];

export const subjectTheme = (name?: string | null): { color: string; icon: string } => {
  const str = String(name ?? '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
};

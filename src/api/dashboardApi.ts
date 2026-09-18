import apiClient from './apiClient';

const unwrap = (data: any) => data?.data ?? data;

// ─── Shared shapes ─────────────────────────────────────────────────────────────
export interface DashExam {
  id: number;
  name: string;
  type: string | null;
  academic_year: string | null;
  date_range: string;
  /** "2026-09-25" — newer servers only. */
  start_date?: string | null;
  end_date?: string | null;
  total_marks?: number | null;
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
  /** Student: whether they have marked it done. Teacher: how many students have. */
  done?: boolean | number;
  /** Teacher: the class's size, for "12 of 32 done". */
  students?: number;
}

/** One day as the Attendance screen reads it. */
export type DayStatus = 'present' | 'absent' | 'holiday' | 'not_marked' | 'upcoming' | string;

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
    holiday_days?: number;
    not_marked_days?: number;
    present_percentage: number;
    week: { label: string; date: string; status: DayStatus }[];
    /** This month and the five before it, oldest first. */
    history?: { month: string; working_days: number; present_days: number; percentage: number | null }[];
  };
  performance: {
    overall_percentage: number;
    total_obtained: number;
    total_max: number;
    /** The class's marks in the same exams, as a percentage. */
    class_average?: number | null;
    subject_wise: {
      subject_name: string | null;
      percentage: number;
      obtained?: number;
      max?: number;
      class_average?: number | null;
    }[];
    trend: { exam_name: string | null; percentage: number }[];
    /** Exam by exam, all subjects together — the last six, oldest first. */
    exams?: {
      exam_id: number;
      exam_name: string | null;
      date: string | null;
      obtained: number;
      max: number;
      percentage: number;
      subjects: number;
      class_average?: number | null;
    }[];
  };
  exams: { upcoming: DashExam[] };
  homework: { total: number; done?: number; recent: DashHomework[] };
  /** Today's periods from the class timetable. */
  today_classes?: { subject: string; teacher: string | null; time: string | null; end_time: string | null }[];
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
  absent?: number;
  /** Students marked today; 0 means the class hasn't been marked yet. */
  marked?: number;
  /** Today is a holiday for the class. */
  holiday?: boolean;
}

export interface TeacherWeekDay {
  date: string;
  label: string;
  present: number;
  marked: number;
  percentage: number | null;
  holiday: boolean;
}

export interface WatchStudent {
  name: string | null;
  class: string;
  roll_no: string | number | null;
  percentage: number;
  present_days: number;
  working_days: number;
}

export interface ClassPerformance {
  class: string;
  subject: string;
  exam_id: number;
  exam_name: string | null;
  date: string | null;
  average: number;
  highest: number;
  lowest: number;
  students: number;
  absent: number;
  passed?: number;
  /** Grade letter → how many were given it ("AB" for absent). */
  grades?: Record<string, number>;
  previous_exam?: string | null;
  previous_average?: number | null;
}

export interface TeacherDashboard {
  profile: { name: string | null; employee_id: string | null };
  today_classes: {
    subject: string;
    class: string;
    time: string | null;
    end_time?: string | null;
    room: string | null;
  }[];
  totals: {
    total_students: number;
    total_classes_today: number;
    homework_count: number;
    upcoming_exams: number;
  };
  class_attendance: {
    overall_percentage: number;
    present?: number;
    marked?: number;
    by_class: TeacherClassAttendance[];
    /** The last seven days across the teacher's classes, oldest first. */
    week?: TeacherWeekDay[];
    /** Students under 75% this month, lowest first (up to 8 of `total`). */
    watch?: { total: number; students: WatchStudent[] };
  };
  /** Each class and subject's latest exam with marks. */
  class_performance?: ClassPerformance[];
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

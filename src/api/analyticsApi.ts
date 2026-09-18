import apiClient from './apiClient';
import type { ClassPerformance, DayStatus, TeacherClassAttendance, TeacherWeekDay, WatchStudent } from './dashboardApi';

const unwrap = (data: any) => data?.data ?? data;

// ─── Shared ────────────────────────────────────────────────────────────────────
export interface GradeCount {
  grade: string;
  count: number;
}

export interface Timetable {
  periods: number;
  minutes: number;
  by_day: { day: string; periods: number; minutes: number }[];
  by_subject?: { name: string; periods: number }[];
  by_class?: { name: string; periods: number }[];
}

export interface Week {
  week: string;
  label: string;
  set: number;
  done?: number;
}

// ─── Student ───────────────────────────────────────────────────────────────────
export interface StudentAnalytics {
  class: string;
  attendance: {
    months: {
      month: string;
      present: number;
      absent: number;
      holiday: number;
      not_marked: number;
      working: number;
      percentage: number | null;
      class_average: number | null;
    }[];
    weekdays: { day: string; present: number; absent: number; percentage: number | null }[];
    this_month: { date: string; status: DayStatus }[];
    streak: number;
    overall: { present: number; working: number; percentage: number | null };
  };
  exams: {
    overall: {
      percentage: number | null;
      obtained: number;
      max: number;
      grade: string | null;
      remark: string | null;
      class_average: number | null;
      exams: number;
      papers: number;
      passed: number;
    } | null;
    exams: {
      exam_id: number;
      exam_name: string | null;
      date: string | null;
      obtained: number;
      max: number;
      percentage: number | null;
      grade: string | null;
      subjects: number;
      class_average: number | null;
    }[];
    subjects: {
      subject: string;
      obtained: number;
      max: number;
      percentage: number | null;
      grade: string | null;
      papers: number;
      class_average: number | null;
    }[];
    latest: {
      exam_id: number;
      exam_name: string | null;
      papers: {
        subject: string;
        obtained: number | null;
        max: number;
        percentage: number | null;
        absent: boolean;
        class_average: number | null;
        class_highest: number | null;
      }[];
    } | null;
    grades: GradeCount[];
    pass_percentage: number;
  };
  homework: {
    total: number;
    done: number;
    pending: number;
    percentage: number | null;
    by_subject: { subject: string; total: number; done: number }[];
    weeks: Week[];
  };
  quiz: {
    available: number;
    attempted: number;
    correct: number;
    accuracy: number | null;
    by_subject: { subject: string; attempted: number; correct: number; accuracy: number | null }[];
  };
  timetable: Timetable;
}

export const getStudentAnalytics = async (): Promise<StudentAnalytics> => {
  const { data } = await apiClient.get('/student/analytics');
  return unwrap(data);
};

// ─── Teacher ───────────────────────────────────────────────────────────────────
export interface MarksUploadItem {
  class: string;
  subject: string;
  students: number;
  marks: number;
  copies: number;
}

export interface TeacherAnalytics {
  attendance: {
    total_students: number;
    overall_percentage: number;
    present: number;
    marked: number;
    by_class: TeacherClassAttendance[];
    week: TeacherWeekDay[];
    watch: { total: number; students: WatchStudent[] };
    months: { month: string; percentage: number | null }[];
    month_by_class: {
      class: string;
      students: number;
      percentage: number | null;
      marked_days: number;
      school_days: number;
    }[];
  };
  my_attendance: {
    months: { month: string; present: number; absent: number; holiday: number; percentage: number | null }[];
    this_month: { month: string; present: number; absent: number; holiday: number; percentage: number | null } | null;
  };
  marks: {
    class_performance: ClassPerformance[];
    grades: GradeCount[];
    exams: { exam_id: number; exam_name: string | null; date: string | null; average: number; papers: number }[];
    upload: {
      exam_id: number;
      exam_name: string | null;
      items: MarksUploadItem[];
      done: number;
      total: number;
    } | null;
    pass_percentage: number;
  };
  homework: {
    total: number;
    this_week: number;
    completion: number | null;
    by_class: { class: string; set: number; students: number; done: number; percentage: number | null }[];
    weeks: Week[];
  };
  quiz: {
    questions: number;
    active: number;
    answers: number;
    students: number;
    accuracy: number | null;
    by_class: { class: string; questions: number; answers: number; accuracy: number | null }[];
  };
  timetable: Timetable;
}

export const getTeacherAnalytics = async (): Promise<TeacherAnalytics> => {
  const { data } = await apiClient.get('/teacher/analytics');
  return unwrap(data);
};

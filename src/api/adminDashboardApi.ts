import apiClient from './apiClient';
import type { DashExam, DashNotice, TeacherClassAttendance } from './dashboardApi';

/**
 * The admin app's Dashboard and Analytics: the whole school's attendance
 * (students and teachers), results, fees, homework and admissions.
 *
 *   GET /admin/dashboard          → the home
 *   GET /admin/analytics/school   → Analytics, tab by tab
 *
 * A day reads as the panel marks it (half day counts present, 3 or 4 is a
 * holiday, a Sunday is one whatever was recorded); percentages are whole
 * numbers, and null where nothing was marked.
 */

// ─── Shared shapes ─────────────────────────────────────────────────────────────
export interface AdminSchool {
  /** "2026-27" */
  session: string;
  students: number;
  teachers: number;
  classes: number;
  sections: number;
  subjects: number;
  /** Students to a teacher, rounded. */
  per_teacher: number | null;
}

export interface AdminDay {
  date: string;
  present: number;
  marked: number;
  percentage: number | null;
  holiday: boolean;
}

export interface AdminAttendanceToday {
  date: string;
  holiday: boolean;
  students: number;
  present: number;
  absent: number;
  marked: number;
  percentage: number | null;
  /** Classes with students and nobody marked yet, "5 A". */
  not_marked: string[];
}

export interface AdminStaffToday {
  date: string;
  holiday: boolean;
  present: number;
  half_day: number;
  absent: number;
  marked: number;
  not_marked: number;
  /** In (present or on a half day) out of those marked. */
  percentage: number | null;
}

export interface AdminStaffAway {
  name: string;
  status: 'absent' | 'half_day' | string;
}

export interface AdminMoney {
  amount: number;
  count: number;
}

export interface AdminFeeSummary {
  students: number;
  riders: number;
  academic_billable: number;
  transport_billable: number;
  total_billable: number;
  academic_collected: number;
  transport_collected: number;
  penalty_collected: number;
  total_collected: number;
  academic_due: number;
  transport_due: number;
  total_due: number;
  rate: number | null;
  fully_paid: number;
  with_dues: number;
}

export interface AdminFeePeriods {
  today: AdminMoney;
  yesterday: AdminMoney;
  this_week: AdminMoney;
  this_month: AdminMoney;
  last_month: AdminMoney;
}

export interface AdminClassResult {
  class: string;
  average: number;
  previous_average: number | null;
  highest: number;
  lowest: number;
  students: number;
  passed: number;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
export interface AdminHome {
  school: AdminSchool;
  attendance: {
    today: AdminAttendanceToday;
    /** The last school day before today that was marked. */
    previous: { date: string; percentage: number | null } | null;
    week: AdminDay[];
  };
  staff: {
    today: AdminStaffToday;
    absent: AdminStaffAway[];
    arrangements: { total: number; covered: number };
  };
  fees: {
    summary: AdminFeeSummary;
    periods: AdminFeePeriods;
    days: ({ date: string } & AdminMoney)[];
    /** QR payments waiting to be checked. */
    qr_pending: number;
  };
  results: {
    exam_id: number;
    exam_name: string | null;
    average: number;
    previous_exam: string | null;
    previous_average: number | null;
    students: number;
    passed: number;
    by_class: AdminClassResult[];
    pass_percentage: number;
  } | null;
  exams: DashExam[];
  admissions: {
    this_month: number;
    last_month: number;
    session_total: number;
    enquiries_pending: number;
  };
  notices: DashNotice[];
  activity: {
    kind: 'admission' | 'fee' | string;
    title: string;
    text: string;
    amount?: number;
    time: string | null;
  }[];
}

// ─── Analytics ─────────────────────────────────────────────────────────────────
export interface AdminAnalyticsData {
  school: AdminSchool;
  attendance: {
    today: AdminAttendanceToday;
    previous: { date: string; percentage: number | null } | null;
    by_class: TeacherClassAttendance[];
    week: AdminDay[];
    months: { month: string; present: number; absent: number; percentage: number | null }[];
    this_month: number | null;
    last_month: number | null;
    weekdays: { day: string; absent: number; percentage: number | null }[];
    month_by_class: {
      class: string;
      students: number;
      percentage: number | null;
      marked_days: number;
      school_days: number;
    }[];
    watch: {
      total: number;
      students: {
        name: string | null;
        class: string | null;
        roll_no: string | number | null;
        percentage: number;
        present_days: number;
        working_days: number;
      }[];
    };
  };
  staff: {
    total: number;
    today: AdminStaffToday;
    absent: AdminStaffAway[];
    not_marked: string[];
    week: AdminDay[];
    months: { month: string; percentage: number | null }[];
    month_by_teacher: {
      total: number;
      teachers: {
        name: string;
        present: number;
        half_day: number;
        absent: number;
        working: number;
        percentage: number | null;
      }[];
    };
    arrangements: { total: number; covered: number };
    workload: {
      periods: number;
      teachers: number;
      /** Teachers with no period on the timetable. */
      idle: number;
      by_teacher: { name: string; periods: number; minutes: number }[];
    };
  };
  results: {
    pass_percentage: number;
    exams: { exam_id: number; exam_name: string | null; date: string | null; average: number; papers: number }[];
    latest: {
      exam_id: number;
      exam_name: string | null;
      date: string | null;
      average: number;
      previous_exam: string | null;
      previous_average: number | null;
      students: number;
      passed: number;
      /** Papers marked absent. */
      absent: number;
      papers: number;
      by_class: AdminClassResult[];
      by_subject: { subject: string; average: number; highest: number; lowest: number; papers: number }[];
      grades: { grade: string; count: number }[];
      toppers: { name: string | null; class: string | null; percentage: number }[];
    } | null;
    /** How far marks are in for the exam under way. */
    upload: {
      exam_id: number;
      exam_name: string | null;
      done: number;
      total: number;
      by_class: { class: string; subjects: number; complete: number; marks: number; expected: number }[];
    } | null;
  };
  fees: {
    summary: AdminFeeSummary;
    periods: AdminFeePeriods;
    days: ({ date: string } & AdminMoney)[];
    months: ({ month: string } & AdminMoney)[];
    by_class: { class: string; students: number; billable: number; collected: number; due: number; rate: number | null }[];
    modes: { mode: string; amount: number; count: number; share: number | null }[];
    top_due: { name: string; admission_no: string | null; class: string; billable: number; collected: number; due: number }[];
    qr_pending: number;
    ledger: { credit: number; expense: number; balance: number };
  };
  homework: {
    total: number;
    this_week: number;
    last_week: number;
    teachers: number;
    completion: number | null;
    weeks: { week: string; label: string; set: number }[];
    by_class: { class: string; set: number; students: number; done: number; percentage: number | null }[];
    by_teacher: { name: string; set: number; percentage: number | null }[];
  };
  admissions: {
    students: number;
    this_month: number;
    last_month: number;
    session_total: number;
    months: { month: string; count: number }[];
    by_class: { class: string; students: number; sections: number; boys: number; girls: number; other: number }[];
    gender: { boys: number; girls: number; other: number };
    enquiries: {
      total: number;
      pending: number;
      admitted: number;
      other: number;
      recent: { id: number; name: string | null; class: string | null; date: string | null }[];
    };
  };
}

// A server that hasn't taken this update yet answers the old home: say so
// rather than draw an empty page.
const updating = () => ({
  response: { status: 503, data: { message: 'The school’s figures are being updated. Please try again in a minute.' } },
});

// GET /admin/dashboard — the admin home
export const getAdminHome = async (): Promise<AdminHome> => {
  const { data } = await apiClient.get('/admin/dashboard');
  const d = data?.data ?? data;
  if (!d?.attendance?.today) throw updating();
  return d;
};

// GET /admin/analytics/school — Analytics, tab by tab
export const getAdminAnalytics = async (): Promise<AdminAnalyticsData> => {
  const { data } = await apiClient.get('/admin/analytics/school');
  return data?.data ?? data;
};

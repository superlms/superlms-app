import apiClient from './apiClient';

/**
 * The web panel's Dashboard and Analytics, figure for figure: the server mounts
 * the panel's own Home and Analytics and sends what they hold, so the app shows
 * what the panel shows, in the panel's order.
 *
 *   GET  /admin/panel/home
 *   GET  /admin/panel/analytics      (class, section, admission_year, wa_* filters)
 *   POST /admin/panel/arrangement/:id  { teacher_id } — Operations' Assign
 */

// ─── Dashboard ─────────────────────────────────────────────────────────────────
export interface PanelTrendDay {
  date: string;
  /** "25 Sep" */
  label: string;
  day: string;
  student_present: number;
  student_absent: number;
  student_half: number;
  student_total: number;
  student_pct: number;
  teacher_present: number;
  teacher_absent: number;
  teacher_half: number;
  teacher_total: number;
  teacher_pct: number;
}

export interface PanelWeekDay {
  date: string;
  /** "Sat" */
  day: string;
  student_present: number;
  student_absent: number;
  teacher_present: number;
  teacher_absent: number;
}

export interface PanelExamPoint {
  exam: string;
  /** The name cut to 16 characters, for the axis. */
  label: string;
  /** "14 Oct 26" */
  date: string;
  avg: number;
  pass_pct: number;
  passed: number;
  papers: number;
  students: number;
}

export interface PanelEvent {
  title: string;
  description: string | null;
  /** "27 Oct" */
  formatted_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  /** blue · green · red · purple · orange · indigo · gray */
  color: string;
  location: string | null;
}

export interface PanelHome {
  /** "Saturday, 24 Oct 2026" */
  date: string;
  overview: {
    students: number;
    active_students: number;
    teachers: number;
    active_teachers: number;
    classes: number;
    subjects: number;
  };
  today: {
    student_pct: number;
    students_present: number;
    teacher_pct: number;
    teachers_present: number;
    fee_today: number;
    collection_pct: number;
    total_fee: number;
  };
  attendance_trend: {
    days: PanelTrendDay[];
    /** Today's figures, under each chart. */
    pick: (PanelTrendDay & { date_label: string }) | null;
  };
  fee: {
    range_label: string;
    range_total: number;
    labels: string[];
    data: number[];
    collected: number;
    pending: number;
    expected: number;
    today: number;
    progress: number;
  };
  /** Today first. */
  week: PanelWeekDay[];
  exam: {
    trend: PanelExamPoint[];
    avg: number;
    delta: number;
    latest: PanelExamPoint | null;
  };
  events: PanelEvent[];
  queries: { students: number; teachers: number; website: number };
  rating: {
    average: number;
    total: number;
    latest: { rating: number; feedback: string | null; date: string } | null;
  };
}

// ─── Analytics ─────────────────────────────────────────────────────────────────
export interface PanelRanker {
  rank: number;
  name: string;
  class: string;
  section: string;
  photo: string | null;
  score: number;
  obtained: number;
  max: number;
}

export interface PanelBars {
  labels: string[];
  collected: number[];
  remaining: number[];
}

export interface PanelWhatsApp {
  period: string;
  label: string;
  periods: { value: string; label: string }[];
  switches: { key: string; label: string; on: boolean }[];
  /** "₹0.66" */
  rate: string;
  tiles: { label: string; value: string; sub: string }[];
  daily: {
    labels: string[];
    kinds: { key: string; label: string; data: number[] }[];
    total: number[];
    /** "0.5" a day */
    avg: string;
  };
  delivery: { key: string; label: string; count: number; share: number }[];
  busiest: { label: string; count: number } | null;
  feature: string;
  status: string;
  shown: number;
  messages: {
    count: number;
    rows: {
      id: number;
      date: string | null;
      time: string | null;
      feature: string;
      label: string;
      name: string | null;
      phone: string;
      status: string;
      error: string | null;
      /** "₹0.66", "Free" or "Not charged" */
      charge: string;
      charged: boolean;
    }[];
  };
}

export interface PanelAnalytics {
  date: string;
  /** "24 Oct 2026" */
  today_label: string;
  stats: { totalStudents: number; activeStudents: number; presentToday: number; absentToday: number; newAdmissions: number };
  kpis: {
    student_rate: number;
    student_delta: number;
    student_marked: boolean;
    teacher_rate: number;
    collect_rate: number;
    avg_daily: number;
    academic_fee: number;
    transport_fee: number;
    last_year_dues: number;
    unpaid_students: number;
    new_admissions: number;
  };
  attendance: {
    daily_trend: {
      labels: string[];
      student: (number | null)[];
      teacher: (number | null)[];
      studentPresent: number[];
      studentAbsent: number[];
      teacherPresent: number[];
      teacherAbsent: number[];
    };
    split: { present: number; absent: number; presentPct: number; absentPct: number };
    monthly: {
      from: string;
      labels: string[];
      student: (number | null)[];
      teacher: (number | null)[];
    };
    class_rank: { name: string; pct: number }[];
  };
  performance: {
    standards: { id: number; name: string }[];
    sections: { id: number; name: string }[];
    class: number | null;
    section: number | null;
    top: PanelRanker[];
    bottom: PanelRanker[];
  };
  admissions: {
    years: number[];
    year: number;
    total: number;
    trend: { labels: string[]; data: number[]; dates: number };
  };
  enquiries: {
    stats: { total: number; responded: number; pending: number; rate: number; student: number; teacher: number; website: number };
    latest: { name: string; source: string; tab: 'student' | 'teacher' | 'website'; time: string; status: string }[];
  };
  fee: {
    stats: { totalFee: number; collected: number; remaining: number; transportFee: number; academicFee: number; lastYearDues: number };
    by_class: PanelBars;
    rate_by_class: { name: string; pct: number }[];
    transport: { expected: number; collected: number; remaining: number; rate: number; riders: number; routes: number };
    transport_class: PanelBars;
    transport_route: PanelBars;
  };
  whatsapp: PanelWhatsApp | null;
  operations: {
    arrangements: {
      id: number;
      class: string;
      section: string;
      absent_teacher: string;
      time: string;
      substitute_teacher_id: number | null;
      status: 'assigned' | 'pending' | string;
    }[];
    available_teachers: { id: number; name: string | null }[];
  };
}

export interface PanelAnalyticsFilters {
  class?: number | null;
  section?: number | null;
  admission_year?: number | null;
  wa_period?: string;
  wa_feature?: string;
  wa_status?: string;
  wa_shown?: number;
}

// A server that hasn't taken this update yet has no such page: say so rather
// than "not found".
const notYet = (e: any) => {
  if (e?.response?.status === 404) {
    e.response.data = { message: 'The school’s figures are being updated. Please try again in a minute.' };
  }
  return e;
};

// GET /admin/panel/home — the panel's Dashboard
export const getPanelHome = async (): Promise<PanelHome> => {
  try {
    const { data } = await apiClient.get('/admin/panel/home');
    return data?.data ?? data;
  } catch (e) {
    throw notYet(e);
  }
};

// GET /admin/panel/analytics — the panel's Analytics, with its filters
export const getPanelAnalytics = async (filters: PanelAnalyticsFilters = {}): Promise<PanelAnalytics> => {
  const params: Record<string, string | number> = {};
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') params[k] = v as any;
  });
  try {
    const { data } = await apiClient.get('/admin/panel/analytics', { params });
    return data?.data ?? data;
  } catch (e) {
    throw notYet(e);
  }
};

// POST /admin/panel/arrangement/:id — a substitute for the absent teacher's period
export const assignPanelArrangement = async (id: number, teacherId: number) => {
  const { data } = await apiClient.post(`/admin/panel/arrangement/${id}`, { teacher_id: teacherId });
  return data?.data ?? data;
};

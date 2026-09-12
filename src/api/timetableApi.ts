import apiClient from './apiClient';
import { DAYS } from '../screens/timetable/timetableData';
import type { Day } from '../screens/timetable/timetableData';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface TimetableSubstitute {
  substitute_teacher_id: number;
  substitute_teacher_name: string;
  reason: string | null;
}

export interface TimetablePeriod {
  id: number;
  subject: string;
  subject_id: number | null;
  teacher: string;
  teacher_id: number | null;
  standard: string;
  standard_id: number | null;
  section: string;
  section_id: number | null;
  day_of_week: number; // 1 = Monday … 7 = Sunday (ISO)
  day_name: string;
  start_time: string | null;
  end_time: string | null;
  time_slot: string | null;
  has_substitute: boolean;
  substitute_details: TimetableSubstitute | null;
  is_active: boolean;
}

export interface TimetableDayGroup {
  day_of_week: number;
  day_name: string;
  total_classes: number;
  timetable: TimetablePeriod[];
}

export interface TimetableResponse {
  type: string;
  total_classes: number;
  timetable_by_day: TimetableDayGroup[];
  // student-only
  standard?: string;
  section?: string;
  // teacher-only
  teacher_name?: string;
}

// GET /time-table/student — weekly timetable for the logged-in student's class
export const getStudentTimetable = async (): Promise<TimetableResponse> => {
  const { data } = await apiClient.get('/time-table/student');
  return data?.data ?? data;
};

// POST /time-table — weekly timetable for the logged-in teacher (grouped by day)
export const getTeacherTimetable = async (): Promise<TimetableResponse> => {
  const { data } = await apiClient.post('/time-table', { type: 'week' });
  return data?.data ?? data;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Group the API's day buckets into a Mon–Sat map the screens can index directly.
export const buildDayMap = (
  groups: TimetableDayGroup[] | undefined,
): Record<Day, TimetablePeriod[]> => {
  const map = {} as Record<Day, TimetablePeriod[]>;
  DAYS.forEach(d => {
    map[d] = [];
  });
  (groups ?? []).forEach(g => {
    const day = DAYS[g.day_of_week - 1]; // ISO 1=Mon … 6=Sat
    if (day) map[day] = g.timetable ?? [];
  });
  return map;
};

// "08:00:00" / "08:00" → "08:00 AM"
export const fmtTime = (t?: string | null): string => {
  if (!t) return '';
  const parts = t.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] ?? '00';
  if (Number.isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
};

export const timetableErrorMessage = (e: any): string => {
  const status = e?.response?.status;
  const serverMsg: string | undefined = e?.response?.data?.message;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 404) {
    // Never surface raw "route could not be found" / technical 404s to users.
    if (serverMsg && !/route|not be found/i.test(serverMsg)) return serverMsg;
    return 'Timetable is not available right now. Please try again in a moment.';
  }
  if (e?.message === 'Network Error' || !e?.response) {
    return 'No internet connection. Check your network and try again.';
  }
  if (status >= 500) {
    return serverMsg || 'The server ran into a problem. Please try again shortly.';
  }
  return serverMsg || 'Unable to load the timetable. Please try again.';
};

import apiClient from './apiClient';

// ─── Self attendance (student & teacher share this, role-aware on the server) ──
// not_marked = a past/today date with no record; upcoming = future date in the month.
export type MyAttendanceStatus =
  | 'present'
  | 'absent'
  | 'holiday'
  | 'not_marked'
  | 'upcoming';

export interface MyAttendanceDay {
  date: string; // YYYY-MM-DD
  day: number;
  status: MyAttendanceStatus;
}

export interface MyAttendanceSummary {
  total_days: number;
  working_days: number;
  present_days: number;
  absent_days: number;
  holiday_days?: number;
  not_marked_days?: number;
  present_percentage: number;
}

export interface MyAttendance {
  month: string; // YYYY-MM
  role: string;
  days: MyAttendanceDay[];
  summary: MyAttendanceSummary;
}

// GET /attendance/my?month=YYYY-MM — self view for the logged-in student or teacher
export const getMyAttendance = async (month: string): Promise<MyAttendance> => {
  const { data } = await apiClient.get('/attendance/my', { params: { month } });
  return data?.data ?? data;
};

// ─── Teacher: mark attendance ──────────────────────────────────────────────────
export interface AttendanceStudent {
  student_id: number;
  user_id: number;
  roll_no: string | number | null;
  full_name: string;
  photo: string | null;
  standard_id: number;
  section_id: number | null;
  standard_name: string | null;
  section_name: string | null;
  attendance: {
    status: string; // present | absent | late | half_day | holiday | not_marked
    db_status: number | null;
    remarks: string | null;
  };
}

export interface AttendanceClass {
  assignment_id: number;
  class_info: {
    standard_id: number;
    standard_name: string | null;
    section_id: number | null;
    section_name: string | null;
    class_display: string;
  };
  total_students: number;
  students: AttendanceStudent[];
}

export interface StudentsForAttendance {
  teacher_info: { teacher_id: number; name: string; employee_id: string | null };
  date: string;
  classes: AttendanceClass[];
  summary: {
    total_classes: number;
    total_students: number;
    attendance_date: string;
  };
}

// POST /attendance/get-student-for-attendance — teacher's classes + students for a date
export const getStudentsForAttendance = async (
  date: string,
): Promise<StudentsForAttendance> => {
  const { data } = await apiClient.post('/attendance/get-student-for-attendance', {
    date,
  });
  return data?.data ?? data;
};

export interface SubmitAttendanceItem {
  student_detail_id: number;
  status: number; // status code: 0 = absent, 1 = present, 4 = holiday
  remarks?: string | null;
}

// POST /attendance — bulk submit/update attendance for a date
export const submitAttendance = async (
  attendance_date: string,
  attendances: SubmitAttendanceItem[],
): Promise<any> => {
  const { data } = await apiClient.post('/attendance', {
    attendance_date,
    attendances,
  });
  return data?.data ?? data;
};

// POST /attendance/mark-holiday — teacher marks a whole class+section holiday for a date
export interface MarkHolidayResult {
  date: string;
  standard_id: number;
  section_id: number | null;
  marked_students: number;
}

export const markHoliday = async (
  date: string,
  standard_id: number,
  section_id: number | null,
): Promise<MarkHolidayResult> => {
  const { data } = await apiClient.post('/attendance/mark-holiday', {
    date,
    standard_id,
    section_id,
  });
  return data?.data ?? data;
};

// ─── Shared error → message helper ─────────────────────────────────────────────
export const attendanceErrorMessage = (e: any): string => {
  const status = e?.response?.status;
  const serverMsg = e?.response?.data?.message;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return serverMsg || 'You are not allowed to do that.';
  if (status === 404) return serverMsg || 'No data found.';
  if (e?.message === 'Network Error' || !e?.response) {
    return 'No internet connection. Check your network and try again.';
  }
  if (status >= 500) {
    return serverMsg || 'The server ran into a problem. Please try again shortly.';
  }
  return serverMsg || 'Something went wrong. Please try again.';
};

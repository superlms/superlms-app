import apiClient from './apiClient';

// Attendance module. Mirrors app/Livewire/Admin/Attendance.php over /admin/attendance.

const unwrap = (data: any) => data?.data ?? data;

export type AttStatus = 'present' | 'absent' | 'half_day' | 'holiday';
export type RecordStatus = AttStatus | 'not_marked' | 'off';

export interface AttClass {
  id: number;
  name: string;
  sections: { id: number; name: string }[];
}
export interface AttTeacher { id: number; name: string; email?: string; image?: string | null }
export interface AttStudent { id: number; name: string; roll_no?: string | number | null; image?: string | null }

export interface AttendanceLookups {
  classes: AttClass[];
  teachers: AttTeacher[];
}

export interface MarkTeacherRow {
  teacher_detail_id: number;
  name: string;
  image: string | null;
  status: AttStatus;
  remark: string;
}
export interface MarkStudentRow {
  student_detail_id: number;
  user_id: number | null;
  name: string;
  roll_no?: string | number | null;
  image: string | null;
  status: AttStatus;
  remark: string;
}

export interface ByDateRow {
  name: string;
  roll_no?: string | number | null;
  image: string | null;
  status: RecordStatus;
  remark: string;
}
export interface Tally {
  present: number;
  absent: number;
  half_day: number;
  holiday: number;
  not_marked: number;
  total: number;
}

export interface CalendarCell {
  day: number;
  date: string;
  status: RecordStatus;
}
export interface MonthCalendar {
  month: string;
  weeks: (CalendarCell | null)[][];
  totals: {
    total_days: number;
    working_days: number;
    present_days: number;
    absent_days: number;
    half_days: number;
    holidays: number;
    percent: number;
  };
}
export interface YearlySummary {
  year: number;
  months: {
    label: string;
    present: number;
    absent: number;
    half_day: number;
    holiday: number;
    working: number;
    percent: number;
  }[];
  totals: { present: number; absent: number; half_day: number; holiday: number; working: number; percent: number };
}

export interface ClassTeacherAssignment {
  id: number;
  teacher_id: number;
  teacher_name: string;
  teacher_image: string | null;
  standard_id: number;
  section_id: number | null;
  standard: string;
  section: string | null;
}

// ── Lookups ────────────────────────────────────────────────────────────────
export const getAttendanceLookups = async (): Promise<AttendanceLookups> => {
  const { data } = await apiClient.get('/admin/attendance/lookups');
  return unwrap(data);
};

export const getSectionStudents = async (standard_id: number, section_id: number): Promise<AttStudent[]> => {
  const { data } = await apiClient.get('/admin/attendance/students', { params: { standard_id, section_id } });
  return unwrap(data)?.students ?? [];
};

// ── Teacher ──────────────────────────────────────────────────────────────
export const getTeacherMarkList = async (date: string): Promise<{ date: string; rows: MarkTeacherRow[] }> => {
  const { data } = await apiClient.get('/admin/attendance/teacher/mark', { params: { date } });
  return unwrap(data);
};

export const submitTeacherAttendance = async (p: {
  date: string;
  marks: { teacher_detail_id: number; status: AttStatus; remark?: string }[];
}) => {
  const { data } = await apiClient.post('/admin/attendance/teacher/mark', p);
  return unwrap(data);
};

export const getTeacherByDate = async (date: string, status = ''): Promise<{ date: string; rows: ByDateRow[]; stats: Tally }> => {
  const { data } = await apiClient.get('/admin/attendance/teacher/by-date', { params: { date, status: status || undefined } });
  return unwrap(data);
};

export const getTeacherCalendar = async (p: { teacher_id: number; month?: string; year?: number }): Promise<{ type: 'monthly' | 'yearly'; calendar?: MonthCalendar; yearly?: YearlySummary }> => {
  const { data } = await apiClient.get('/admin/attendance/teacher/calendar', { params: p });
  return unwrap(data);
};

// ── Student ──────────────────────────────────────────────────────────────
export const getStudentMarkList = async (standard_id: number, section_id: number, date: string): Promise<{ date: string; rows: MarkStudentRow[] }> => {
  const { data } = await apiClient.get('/admin/attendance/student/mark', { params: { standard_id, section_id, date } });
  return unwrap(data);
};

export const submitStudentAttendance = async (p: {
  standard_id: number;
  section_id: number;
  date: string;
  marks: { student_detail_id: number; user_id?: number | null; status: AttStatus; remark?: string }[];
}) => {
  const { data } = await apiClient.post('/admin/attendance/student/mark', p);
  return unwrap(data);
};

export const getStudentByDate = async (standard_id: number, section_id: number, date: string, status = ''): Promise<{ date: string; rows: ByDateRow[]; stats: Tally }> => {
  const { data } = await apiClient.get('/admin/attendance/student/by-date', { params: { standard_id, section_id, date, status: status || undefined } });
  return unwrap(data);
};

export const getStudentCalendar = async (p: { student_id: number; month?: string; year?: number }): Promise<{ type: 'monthly' | 'yearly'; calendar?: MonthCalendar; yearly?: YearlySummary }> => {
  const { data } = await apiClient.get('/admin/attendance/student/calendar', { params: p });
  return unwrap(data);
};

// ── Class teachers ─────────────────────────────────────────────────────────
export const getClassTeachers = async (p: {
  mode: 'by_class' | 'by_teacher';
  standard_id?: number | null;
  section_id?: number | null;
  teacher_id?: number | null;
}): Promise<ClassTeacherAssignment[]> => {
  const { data } = await apiClient.get('/admin/attendance/class-teachers', { params: p });
  return unwrap(data)?.assignments ?? [];
};

export const saveClassTeacher = async (p: {
  id?: number | null;
  teacher_detail_id: number;
  standard_id: number;
  section_id?: number | null;
}) => {
  const { data } = await apiClient.post('/admin/attendance/class-teachers', p);
  return unwrap(data);
};

export const deleteClassTeacher = async (id: number) => {
  await apiClient.delete(`/admin/attendance/class-teachers/${id}`);
};

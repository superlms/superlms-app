import apiClient from './apiClient';

// Attendance module. Mirrors app/Livewire/Admin/Attendance.php over /admin/attendance,
// asking with v=2 for the panel's rules as they are now: a day starts blank
// (Sunday on Holiday), a blank row saves nothing, an unmarked Sunday reads as a
// holiday, and a person's months are the panel's month cards (April → March).

const unwrap = (data: any) => data?.data ?? data;
const V = { v: 2 };

export type AttStatus = 'present' | 'absent' | 'half_day' | 'holiday';
/** '' is a row left unmarked. */
export type MarkStatus = AttStatus | '';
export type RecordStatus = AttStatus | 'not_marked';

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

export interface MarkRow {
  id: number;
  name: string;
  sub: string;
  image: string | null;
  status: MarkStatus;
  remark: string;
}
export interface MarkDay {
  date: string;
  rows: MarkRow[];
  /** The day was already submitted — saving updates it. */
  existing: boolean;
}

export interface DayRecord {
  id: number;
  name: string;
  email?: string;
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
export interface DayRecords {
  date: string;
  rows: DayRecord[];
  stats: Tally;
}

export interface MonthGrid {
  month: string;
  title: string;
  teachers: {
    id: number;
    name: string;
    image: string | null;
    totals: Record<RecordStatus, number>;
  }[];
  rows: {
    date: string;
    label: string;
    dow: string;
    sunday: boolean;
    today: boolean;
    /** teacher id → status; null for a day still to come */
    cells: Record<string, RecordStatus | null>;
  }[];
}

export interface CardCounts {
  present: number;
  absent: number;
  half_day: number;
  holiday: number;
  not_marked: number;
  working: number;
}
export interface MonthCard {
  key: string;
  label: string;
  /** Blank cells before the 1st, in a Sunday-first week. */
  lead: number;
  cells: { day: number; date: string; status: RecordStatus | null; in_period: boolean }[];
  counts: CardCounts;
  pct: number;
}
export interface PersonCards {
  person: string;
  title: string;
  counts: CardCounts & { percent: number };
  months: MonthCard[];
}

export interface ClassTeacherAssignment {
  id: number;
  teacher_id: number;
  teacher_name: string;
  teacher_email?: string;
  teacher_image: string | null;
  standard_id: number;
  section_id: number | null;
  standard: string;
  section: string | null;
}
export interface ClassTeachers {
  assignments: ClassTeacherAssignment[];
  /** Every assignment in the school, whatever the filter. */
  taken: { id: number; teacher_id: number }[];
}

export interface SavedDay {
  title: string;
  message: string;
  updated: boolean;
}

const savedDay = (data: any): SavedDay => ({
  title: data?.data?.title ?? 'Attendance saved',
  message: data?.message ?? '',
  updated: !!data?.data?.updated,
});

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
export const getTeacherDay = async (date: string): Promise<MarkDay> => {
  const { data } = await apiClient.get('/admin/attendance/teacher/mark', { params: { date, ...V } });
  const d = unwrap(data);
  return {
    date: d.date,
    existing: !!d.existing,
    rows: (d.rows ?? []).map((r: any) => ({
      id: r.teacher_detail_id,
      name: r.name,
      sub: r.email ?? '',
      image: r.image ?? null,
      status: r.status ?? '',
      remark: r.remark ?? '',
    })),
  };
};

export const saveTeacherDay = async (p: {
  date: string;
  holiday?: boolean;
  marks: { id: number; status: MarkStatus; remark: string }[];
}): Promise<SavedDay> => {
  const { data } = await apiClient.post('/admin/attendance/teacher/mark', {
    ...V,
    date: p.date,
    holiday: p.holiday ? 1 : 0,
    marks: p.marks.map(m => ({ teacher_detail_id: m.id, status: m.status, remark: m.remark })),
  });
  return savedDay(data);
};

export const getTeacherRecords = async (date: string, status = ''): Promise<DayRecords> => {
  const { data } = await apiClient.get('/admin/attendance/teacher/by-date', {
    params: { date, status: status || undefined, ...V },
  });
  return unwrap(data);
};

export const getTeacherMonthGrid = async (month: string, teacher_id?: number | null): Promise<MonthGrid> => {
  const { data } = await apiClient.get('/admin/attendance/teacher/month-grid', {
    params: { month, teacher_id: teacher_id || undefined },
  });
  return unwrap(data);
};

// ── Student ──────────────────────────────────────────────────────────────
export const getStudentDay = async (standard_id: number, section_id: number, date: string): Promise<MarkDay> => {
  const { data } = await apiClient.get('/admin/attendance/student/mark', {
    params: { standard_id, section_id, date, ...V },
  });
  const d = unwrap(data);
  return {
    date: d.date,
    existing: !!d.existing,
    rows: (d.rows ?? []).map((r: any) => ({
      id: r.student_detail_id,
      name: r.name,
      sub: r.roll_no ? `Roll no. ${r.roll_no}` : r.email ?? '',
      image: r.image ?? null,
      status: r.status ?? '',
      remark: r.remark ?? '',
    })),
  };
};

export const saveStudentDay = async (p: {
  standard_id: number;
  section_id: number;
  date: string;
  holiday?: boolean;
  marks: { id: number; status: MarkStatus; remark: string }[];
}): Promise<SavedDay> => {
  const { data } = await apiClient.post('/admin/attendance/student/mark', {
    ...V,
    standard_id: p.standard_id,
    section_id: p.section_id,
    date: p.date,
    holiday: p.holiday ? 1 : 0,
    marks: p.marks.map(m => ({ student_detail_id: m.id, status: m.status, remark: m.remark })),
  });
  return savedDay(data);
};

export const getStudentRecords = async (standard_id: number, section_id: number, date: string): Promise<DayRecords> => {
  const { data } = await apiClient.get('/admin/attendance/student/by-date', {
    params: { standard_id, section_id, date, ...V },
  });
  return unwrap(data);
};

// ── A person's months ──────────────────────────────────────────────────────
export const getPersonCards = async (
  who: 'teacher' | 'student',
  id: number,
  period: { month: string } | { year: string },
): Promise<PersonCards> => {
  const { data } = await apiClient.get(`/admin/attendance/${who}/calendar`, {
    params: { [who === 'teacher' ? 'teacher_id' : 'student_id']: id, ...period, ...V },
  });
  return unwrap(data);
};

// ── Class teachers ─────────────────────────────────────────────────────────
export const getClassTeachers = async (p: {
  mode: 'by_class' | 'by_teacher';
  standard_id?: number | null;
  section_id?: number | null;
  teacher_id?: number | null;
}): Promise<ClassTeachers> => {
  const { data } = await apiClient.get('/admin/attendance/class-teachers', {
    params: {
      mode: p.mode,
      standard_id: p.standard_id || undefined,
      section_id: p.section_id || undefined,
      teacher_id: p.teacher_id || undefined,
    },
  });
  const d = unwrap(data);
  return { assignments: d?.assignments ?? [], taken: d?.taken ?? [] };
};

export const saveClassTeacher = async (p: {
  id?: number | null;
  teacher_detail_id: number;
  standard_id: number;
  section_id?: number | null;
}): Promise<string> => {
  const { data } = await apiClient.post('/admin/attendance/class-teachers', p);
  return data?.message ?? (p.id ? 'Assignment updated.' : 'Class teacher assigned.');
};

export const deleteClassTeacher = async (id: number) => {
  await apiClient.delete(`/admin/attendance/class-teachers/${id}`);
};

import apiClient from './apiClient';
import constant from '../utils/constant';

// Timetable module. Mirrors app/Livewire/Admin/TimeTable.php over /admin/timetable.

const unwrap = (data: any) => data?.data ?? data;

export interface TtClass {
  id: number;
  name: string;
  sections: { id: number; name: string }[];
}
export interface TtTeacher { id: number; name: string }

export interface TimetableLookups {
  classes: TtClass[];
  teachers: TtTeacher[];
  days: Record<string, string>;
}

export interface TimetableStats {
  schedules: number;
  teachers: number;
  classes: number;
  subjects: number;
}

export interface SubjectGroup {
  subject: string;
  start_time: string;
  end_time: string;
  days: number[];
  teachers: { teacher_name: string; days: number[] }[];
}
export interface SectionCard {
  standard_id: number;
  section_id: number | null;
  standard: string;
  section: string;
  subject_groups: SubjectGroup[];
}

export interface BuilderRow {
  subject_id: number;
  subject_name: string;
  start_time: string;
  end_time: string;
  day_teachers: Record<string, number | null>;
}

export const getTimetableLookups = async (): Promise<TimetableLookups> => {
  const { data } = await apiClient.get('/admin/timetable/lookups');
  return unwrap(data);
};

export const getTimetableStats = async (): Promise<TimetableStats> => {
  const { data } = await apiClient.get('/admin/timetable/stats');
  return unwrap(data);
};

export const getTimetable = async (p: {
  view: 'class' | 'teacher';
  standard_id?: number | null;
  section_id?: number | null;
  teacher_id?: number | null;
  days?: number[];
}): Promise<{ view: string; cards: SectionCard[]; day_names: Record<string, string> }> => {
  const { data } = await apiClient.get('/admin/timetable', { params: p });
  return unwrap(data);
};

export const getTimetableBuilder = async (
  standard_id: number,
  section_id: number,
): Promise<{ is_edit: boolean; rows: BuilderRow[]; days: Record<string, string> }> => {
  const { data } = await apiClient.get('/admin/timetable/builder', { params: { standard_id, section_id } });
  return unwrap(data);
};

export const saveTimetable = async (p: {
  standard_id: number;
  section_id: number;
  is_edit: boolean;
  rows: BuilderRow[];
}): Promise<{ created: number }> => {
  const { data } = await apiClient.post('/admin/timetable', p);
  return unwrap(data);
};

export const deleteTimetable = async (standard_id: number, section_id: number) => {
  await apiClient.delete('/admin/timetable', { data: { standard_id, section_id } });
};

// ─── The app's Timetable (class → section → week), and the panel's row form ──
// Added alongside the endpoints above, which older builds still use.

export interface TtSectionState {
  id: number;
  name: string;
  has_timetable: boolean;
  /** Saved entries — one per day a subject runs. */
  entries: number;
  /** Rows as the panel's card counts them: one per subject · time slot. */
  subjects: number;
}

export interface TtOverview {
  /** The panel's Total Classes, Total Sections, Timetable Created, Remaining. */
  stats: { classes: number; sections: number; created: number; remaining: number };
  classes: { id: number; name: string; sections: TtSectionState[] }[];
  /** The panel's Teacher View: active teachers, with their periods a week. */
  teachers?: { id: number; name: string; image?: string | null; periods: number }[];
}

export interface TtEntry {
  id: number;
  /** 1 = Monday … 6 = Saturday */
  day: number;
  start_time: string; // HH:mm
  end_time: string;
  subject_id: number;
  subject: string;
  teacher_id: number;
  teacher: string;
  teacher_image?: string | null;
}

export interface TtSectionWeek {
  standard: { id: number; name: string };
  section: { id: number; name: string };
  subjects: number;
  entries: TtEntry[];
}

/** One form row: a subject at a time slot, taught by one teacher on the days it runs. */
export interface TtFormRow {
  subject_id: number;
  subject_name: string;
  start_time: string; // HH:mm
  end_time: string;
  teacher_id: number | null;
  days: number[];
}

/** Where a teacher already is, outside the section being edited. */
export interface TtBusy {
  teacher_id: number;
  day: number;
  start_time: string;
  end_time: string;
  where: string;
}

export interface TtForm {
  is_edit: boolean;
  standard: { id: number; name: string };
  section: { id: number; name: string };
  subjects: { id: number; name: string }[];
  rows: TtFormRow[];
  teachers: { id: number; name: string; image?: string | null }[];
  busy: TtBusy[];
}

export const getTimetableOverview = async (): Promise<TtOverview> => {
  const { data } = await apiClient.get('/admin/timetable/overview');
  return unwrap(data);
};

export const getSectionTimetable = async (standard_id: number, section_id: number): Promise<TtSectionWeek> => {
  const { data } = await apiClient.get('/admin/timetable/section', { params: { standard_id, section_id } });
  return unwrap(data);
};

export const getTimetableForm = async (standard_id: number, section_id: number): Promise<TtForm> => {
  const { data } = await apiClient.get('/admin/timetable/form', { params: { standard_id, section_id } });
  return unwrap(data);
};

export const saveTimetableSchedule = async (p: {
  standard_id: number;
  section_id: number;
  is_edit: boolean;
  rows: TtFormRow[];
}): Promise<{ created: number; is_edit: boolean; message?: string }> => {
  const { data } = await apiClient.post('/admin/timetable/schedule', p);
  return { ...unwrap(data), message: data?.message };
};

/** The panel's Download: the week as a grid, A4 landscape. */
export const timetablePdfUrl = (standard_id: number, section_id: number) =>
  `${constant.API_BASE_URL}/admin/timetable/pdf?standard_id=${standard_id}&section_id=${section_id}`;

/** The panel's Teacher View Download: a teacher's week as a grid. */
export const teacherTimetablePdfUrl = (teacher_id: number) =>
  `${constant.API_BASE_URL}/admin/timetable/teacher-pdf?teacher_id=${teacher_id}`;

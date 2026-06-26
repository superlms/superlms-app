import apiClient from './apiClient';

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

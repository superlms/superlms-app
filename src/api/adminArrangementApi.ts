import apiClient from './apiClient';

// Arrangement module. Mirrors app/Livewire/Admin/Arrangement.php over
// /admin/arrangement.

const unwrap = (data: any) => data?.data ?? data;

export interface ArrangementStats {
  total_teachers: number;
  absent: number;
  available: number;
  arrangements: number;
}

export interface ArrangementSlot {
  slot_id: number;
  subject: string;
  class: string;
  section?: string | null;
  start_time: string;
  end_time: string;
  arrangement: {
    id: number;
    substitute_name: string;
    reason?: string | null;
    /** The substitute's teacher id (absent from an older server). */
    substitute_id?: number;
  } | null;
  available_substitutes: { id: number; name: string }[];
  // The panel's view, from a newer server: which period of the school's day
  // this is (P5), and for an arranged slot who it could be changed to.
  period?: number;
  edit_substitutes?: { id: number; name: string }[];
}

export interface ArrangementTeacher {
  teacher_id: number;
  teacher_name: string;
  slots: ArrangementSlot[];
}

export interface ArrangementResult {
  date: string;
  day_name: string;
  stats: ArrangementStats;
  classes: { id: number; name: string }[];
  teachers: ArrangementTeacher[];
}

export const getArrangements = async (date?: string, standard_id?: number): Promise<ArrangementResult> => {
  const params: any = {};
  if (date) params.date = date;
  if (standard_id) params.standard_id = standard_id;
  const { data } = await apiClient.get('/admin/arrangement', { params });
  return unwrap(data);
};

export const assignArrangement = async (p: {
  date: string;
  slot_id: number;
  substitute_id: number;
  reason: string;
}): Promise<{ id: number }> => {
  const { data } = await apiClient.post('/admin/arrangement', p);
  return unwrap(data);
};

export const deleteArrangement = async (id: number) => {
  await apiClient.delete(`/admin/arrangement/${id}`);
};

/**
 * The day as the panel lists it: every absent teacher, one with no periods
 * that day (or in the class filtered to) too.
 */
export const getArrangementDay = async (date: string, standard_id?: number | null): Promise<ArrangementResult> => {
  const { data } = await apiClient.get('/admin/arrangement', {
    params: { date, standard_id: standard_id || undefined, all: 1 },
  });
  return unwrap(data);
};

/** The panel's Edit: another substitute, or another remark, for an arranged slot. */
export const updateArrangement = async (
  id: number,
  p: { substitute_id: number; reason: string },
): Promise<{ id: number }> => {
  const { data } = await apiClient.post(`/admin/arrangement/${id}`, p);
  return unwrap(data);
};

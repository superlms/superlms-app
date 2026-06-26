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
  arrangement: { id: number; substitute_name: string; reason?: string | null } | null;
  available_substitutes: { id: number; name: string }[];
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

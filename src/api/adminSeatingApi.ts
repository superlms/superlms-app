import apiClient from './apiClient';
import constant from '../utils/constant';

// ─── Seating Plan ─────────────────────────────────────────────────────────────
// The web panel's Exam Seating Management over /admin/seating: its three tabs,
// Seating Plans (the seat finder and Generate), Rooms and Datesheet.

const unwrap = (data: any) => data?.data ?? data;

export interface SeatingOverview {
  rooms: number;
  plans: number;
  datesheets: number;
}

export const getSeatingOverview = async (): Promise<SeatingOverview> => {
  const { data } = await apiClient.get('/admin/seating/overview');
  return unwrap(data);
};

export interface SeatingExam {
  id: number;
  exam_name: string;
  academic_year?: string | null;
}
export interface SeatingClass {
  id: number;
  name: string;
}
export interface SeatingSection {
  id: number;
  name: string;
  standard_id: number;
}
export interface SeatingLookups {
  exams: SeatingExam[];
  standards: SeatingClass[];
  sections: SeatingSection[];
}

export const getSeatingLookups = async (): Promise<SeatingLookups> => {
  const { data } = await apiClient.get('/admin/seating/lookups');
  const d = unwrap(data);
  return { exams: d?.exams ?? [], standards: d?.standards ?? [], sections: d?.sections ?? [] };
};

// ── Seating Plans: the seat finder ───────────────────────────────────────────
export type FinderMode = 'room' | 'class';

/** One generated session (one date and shift) as the finder lists it. */
export interface SeatingSession {
  plan_id: number;
  name: string;
  status: 'draft' | 'published' | string;
  date: string | null; // YYYY-MM-DD
  session: string; // "Shift 1"
  /** The session's clock time (by room), or "—". */
  time: string;
  /** The class's own paper (by class), or the session's subjects. */
  subject: string;
  students: number;
  conflicts: number;
  classes: string[];
  rooms: string[];
}

export interface SeatingRoomOption {
  id: number;
  room_name: string;
  building?: string | null;
}

export const getSeatingFinder = async (p: {
  mode: FinderMode;
  exam_id?: number | null;
  room_id?: number | null;
  standard_id?: number | null;
  section_id?: number | null;
}): Promise<{ ready: boolean; has_plans: boolean; room_options: SeatingRoomOption[]; sessions: SeatingSession[] }> => {
  const params: Record<string, any> = { mode: p.mode };
  if (p.exam_id) params.exam_id = p.exam_id;
  if (p.room_id) params.room_id = p.room_id;
  if (p.standard_id) params.standard_id = p.standard_id;
  if (p.section_id) params.section_id = p.section_id;
  const { data } = await apiClient.get('/admin/seating/finder', { params });
  const d = unwrap(data);
  return {
    ready: !!d?.ready,
    has_plans: !!d?.has_plans,
    room_options: d?.room_options ?? [],
    sessions: d?.sessions ?? [],
  };
};

export interface SeatingPlanRoom {
  id: number;
  room_name: string;
  building?: string | null;
  filled: number;
  capacity: number;
}

export interface SeatingPlanDetail {
  id: number;
  name: string;
  exam_name: string | null;
  date: string | null;
  session: string;
  status: string;
  notes: string | null;
  total_students: number;
  total_seats: number;
  conflicts: number;
  rooms: SeatingPlanRoom[];
}

export const getSeatingPlan = async (id: number): Promise<SeatingPlanDetail> => {
  const { data } = await apiClient.get(`/admin/seating/plans/${id}`);
  return unwrap(data);
};

export const publishSeatingPlan = async (id: number): Promise<string> => {
  const { data } = await apiClient.post(`/admin/seating/plans/${id}/publish`);
  return data?.message ?? 'Plan published.';
};

export const deleteSeatingPlan = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/seating/plans/${id}`);
};

/** The panel's seating list for a session, narrowed as the finder shows it. */
export const seatingListPdfUrl = (
  planId: number,
  q: { room?: number | null; standard?: number | null; section?: number | null; subject?: string | null },
) => {
  const parts = Object.entries(q)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 0)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return `${constant.API_BASE_URL}/admin/seating/plans/${planId}/list-pdf${parts.length ? `?${parts.join('&')}` : ''}`;
};

/** The panel's Room PDF: one room's chart for a session. */
export const seatingRoomPdfUrl = (planId: number, roomId: number) =>
  `${constant.API_BASE_URL}/admin/seating/plans/${planId}/rooms/${roomId}/pdf`;

// ── Generate Plan ────────────────────────────────────────────────────────────
export interface GenerateOptions {
  datesheet_standard_ids: number[];
  suggested_name: string | null;
  standards: SeatingClass[];
  rooms: { id: number; room_name: string; building?: string | null; capacity: number }[];
}

export const getGenerateOptions = async (exam_id?: number | null): Promise<GenerateOptions> => {
  const { data } = await apiClient.get('/admin/seating/generate/options', { params: exam_id ? { exam_id } : {} });
  const d = unwrap(data);
  return {
    datesheet_standard_ids: d?.datesheet_standard_ids ?? [],
    suggested_name: d?.suggested_name ?? null,
    standards: d?.standards ?? [],
    rooms: d?.rooms ?? [],
  };
};

export const generateSeatingPlan = async (p: {
  exam_id: number;
  name: string;
  standard_ids: number[];
  room_ids: number[];
}): Promise<{ message: string; created: number; first_plan_id: number | null; exam_id: number }> => {
  const { data } = await apiClient.post('/admin/seating/generate', p);
  return { ...unwrap(data), message: data?.message ?? '' };
};

// ── Rooms ────────────────────────────────────────────────────────────────────
export interface SeatingRoom {
  id: number;
  room_name: string;
  building: string | null;
  rows: number;
  columns: number;
  /** Candidates one desk seats. */
  seat_capacity: number;
  /** rows × columns × seats per desk. */
  capacity: number;
  is_active: boolean;
  notes: string | null;
}

export const getSeatingRooms = async (): Promise<SeatingRoom[]> => {
  const { data } = await apiClient.get('/admin/seating/rooms');
  const d = unwrap(data);
  return Array.isArray(d) ? d : [];
};

export interface RoomPayload {
  room_name: string;
  building: string;
  rows: number;
  columns: number;
  seat_capacity: number;
  is_active: boolean;
  notes: string;
}

export const saveSeatingRoom = async (id: number | null, p: RoomPayload): Promise<{ room: SeatingRoom; message: string }> => {
  const body = { ...p, is_active: p.is_active ? 1 : 0 };
  const { data } = id
    ? await apiClient.post(`/admin/seating/rooms/${id}`, body)
    : await apiClient.post('/admin/seating/rooms', body);
  return { room: unwrap(data), message: data?.message ?? '' };
};

export const deleteSeatingRoom = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/seating/rooms/${id}`);
};

// ── Datesheet ────────────────────────────────────────────────────────────────
export interface DatesheetPaper {
  id?: number;
  subject_id: number;
  subject_name: string;
  exam_date: string | null; // YYYY-MM-DD
  start_time: string | null; // HH:mm
  end_time: string | null; // HH:mm
  shift: number;
}

export interface AdminDatesheet {
  id: number;
  exam_id: number;
  exam_name: string | null;
  standard_id: number;
  standard_name: string | null;
  section_id: number | null;
  section_name: string | null;
  /** A sheet for the whole class, which each of its sections inherits. */
  class_wide: boolean;
  papers: DatesheetPaper[];
}

export const getDatesheet = async (p: {
  exam_id?: number | null;
  standard_id?: number | null;
  section_id?: number | null;
  subject_id?: number | null;
}): Promise<{ datesheet: AdminDatesheet | null; subjects: { id: number; name: string }[]; total: number }> => {
  const params: Record<string, any> = {};
  Object.entries(p).forEach(([k, v]) => {
    if (v) params[k] = v;
  });
  const { data } = await apiClient.get('/admin/seating/datesheet', { params });
  const d = unwrap(data);
  return { datesheet: d?.datesheet ?? null, subjects: d?.subjects ?? [], total: d?.total ?? 0 };
};

/** A row of the datesheet form: one subject and its paper, if it has one. */
export interface DatesheetFormRow {
  subject_id: number;
  name: string;
  exam_date: string | null;
  start_time: string | null;
  end_time: string | null;
  shift: number;
}

export const getDatesheetForm = async (p: {
  datesheet_id?: number | null;
  standard_id?: number | null;
  section_id?: number | null;
}): Promise<{ exam_id: number | null; standard_id: number | null; section_id: number | null; papers: DatesheetFormRow[] }> => {
  const params: Record<string, any> = {};
  Object.entries(p).forEach(([k, v]) => {
    if (v) params[k] = v;
  });
  const { data } = await apiClient.get('/admin/seating/datesheet/form', { params });
  const d = unwrap(data);
  return {
    exam_id: d?.exam_id ?? null,
    standard_id: d?.standard_id ?? null,
    section_id: d?.section_id ?? null,
    papers: d?.papers ?? [],
  };
};

export const saveDatesheet = async (p: {
  datesheet_id?: number | null;
  exam_id: number;
  standard_id: number;
  section_id?: number | null;
  papers: DatesheetFormRow[];
}): Promise<{ message: string; datesheet_id: number }> => {
  const { data } = await apiClient.post('/admin/seating/datesheet', {
    ...p,
    papers: p.papers.map(r => ({
      subject_id: r.subject_id,
      exam_date: r.exam_date || null,
      start_time: r.start_time || null,
      end_time: r.end_time || null,
      shift: r.shift || 1,
    })),
  });
  return { ...unwrap(data), message: data?.message ?? '' };
};

export const deleteDatesheet = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/seating/datesheet/${id}`);
};

/** The panel's Print page as a PDF — one subject's paper alone when asked. */
export const datesheetPdfUrl = (id: number, q: { subject?: number | null; section?: number | null }) => {
  const parts = Object.entries(q)
    .filter(([, v]) => !!v)
    .map(([k, v]) => `${k}=${v}`);
  return `${constant.API_BASE_URL}/admin/seating/datesheet/${id}/pdf${parts.length ? `?${parts.join('&')}` : ''}`;
};

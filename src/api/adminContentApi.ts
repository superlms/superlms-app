import apiClient from './apiClient';
import { PickedFile } from './adminProfileApi';

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

const filePart = (f: PickedFile, fallbackName: string, fallbackType: string) =>
  ({ uri: f.uri, type: f.type || fallbackType, name: f.name || fallbackName } as any);

// ─── Announcements ────────────────────────────────────────────────────────────
// Mirrors the admin panel's Announcement screen over /admin/announcements.
export type AnnouncementType = 'all' | 'user' | 'teacher';

export interface AdminAnnouncement {
  id: number;
  type: AnnouncementType;
  /** The class a student announcement is aimed at; null = every class. */
  standard_id?: number | null;
  standard_name?: string | null;
  announcement_name: string;
  announcement_content: string;
  image_url?: string | null;
  pdf_url?: string | null;
  creator_name?: string;
  created_at?: string;
}

export interface AnnouncementStats {
  total: number;
  this_month: number;
  last_month?: number;
}

export interface ClassOption {
  id: number;
  name: string;
}

/**
 * The school's announcements, newest first. `date` (YYYY-MM-DD) is one day's
 * and wins over `days`, as on the panel. The school's classes come with them.
 */
export const getAdminAnnouncements = async (
  opts: { type?: AnnouncementType; days?: number; date?: string } = {},
): Promise<{ announcements: AdminAnnouncement[]; stats: AnnouncementStats; standards: ClassOption[] }> => {
  const params: any = {};
  if (opts.type) params.type = opts.type;
  if (opts.date) params.date = opts.date;
  else if (opts.days) params.days = opts.days;
  const { data } = await apiClient.get('/admin/announcements', { params });
  const d = unwrap(data);
  return { announcements: d?.announcements ?? [], stats: d?.stats ?? { total: 0, this_month: 0 }, standards: d?.standards ?? [] };
};

export interface AnnouncementPayload {
  announcement_name: string;
  announcement_content: string;
  type: AnnouncementType;
  /** Students only: one class, or null for all of them. */
  standard_id?: number | null;
  file?: PickedFile | null;
  /** Take the image / PDF already on it off (edit only). */
  remove_image?: boolean;
  remove_pdf?: boolean;
}

const announcementForm = (a: AnnouncementPayload) => {
  const form = new FormData();
  form.append('announcement_name', a.announcement_name);
  form.append('announcement_content', a.announcement_content);
  form.append('type', a.type);
  if (a.type === 'user' && a.standard_id) form.append('standard_id', String(a.standard_id));
  if (a.remove_image) form.append('remove_image', '1');
  if (a.remove_pdf) form.append('remove_pdf', '1');
  if (a.file) {
    const isPdf = (a.file.type || '').includes('pdf') || (a.file.name || '').toLowerCase().endsWith('.pdf');
    form.append('file', filePart(a.file, isPdf ? 'announcement.pdf' : 'announcement.jpg', isPdf ? 'application/pdf' : 'image/jpeg'));
  }
  return form;
};

export const createAnnouncement = async (a: AnnouncementPayload): Promise<AdminAnnouncement> => {
  const { data } = await apiClient.post('/admin/announcements', announcementForm(a), MULTIPART);
  return unwrap(data);
};

export const updateAnnouncement = async (id: number, a: AnnouncementPayload): Promise<AdminAnnouncement> => {
  const { data } = await apiClient.post(`/admin/announcements/${id}`, announcementForm(a), MULTIPART);
  return unwrap(data);
};

export const deleteAnnouncement = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/announcements/${id}`);
};

// ─── Calendar events ──────────────────────────────────────────────────────────
// Mirrors the admin panel's School Calendar (TimeTableCalendar + EventForm).
export type EventType = 'class' | 'exam' | 'meeting' | 'event' | 'holiday';

/** One event as the admin calendar lists and shows it. */
export interface AdminEvent {
  id: number;
  title: string;
  description: string | null;
  date: string; // YYYY-MM-DD
  start_time: string | null; // HH:mm
  end_time: string | null; // HH:mm
  is_all_day: boolean;
  event_type: EventType | string;
  color: string;
  attachment: string | null;
  location: string | null;
  standard: string | null;
  section: string | null;
  subject: string | null;
  teacher: string | null;
  creator_name: string | null;
  /** Its day has passed: it can be deleted but no longer edited. */
  is_completed: boolean;
}

export interface CalendarStats {
  today: number;
  this_week: number;
  current_month: number;
  this_year: number;
  total: number;
}

/** A month's events and the panel's counts (today, this week, the month, this year). */
export const getAdminCalendarMonth = async (
  month: string, // YYYY-MM
): Promise<{ events: AdminEvent[]; stats: CalendarStats }> => {
  const { data } = await apiClient.get('/admin/calendar/month', { params: { month } });
  const d = unwrap(data);
  return { events: d?.events ?? [], stats: d?.stats };
};

export interface YearMonth {
  month: number; // 1–12
  name: string;
  total: number;
  /** How many events fall on each day that has any, by YYYY-MM-DD. */
  days: Record<string, number>;
}

export const getAdminCalendarYear = async (year: number): Promise<YearMonth[]> => {
  const { data } = await apiClient.get('/admin/calendar/year', { params: { year } });
  return unwrap(data)?.months ?? [];
};

export interface EventPayload {
  title: string;
  description?: string | null;
  date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:mm
  end_time?: string | null; // HH:mm
  is_all_day?: boolean;
  event_type: EventType;
  color?: string | null;
  /** An image or PDF of up to 1 MB; it replaces the one there. */
  attachment?: PickedFile | null;
}

const eventForm = (p: EventPayload) => {
  const form = new FormData();
  form.append('title', p.title);
  if (p.description) form.append('description', p.description);
  form.append('date', p.date);
  form.append('is_all_day', p.is_all_day ? '1' : '0');
  if (!p.is_all_day) {
    if (p.start_time) form.append('start_time', p.start_time);
    if (p.end_time) form.append('end_time', p.end_time);
  }
  form.append('event_type', p.event_type);
  if (p.color) form.append('color', p.color);
  if (p.attachment) {
    const isPdf = (p.attachment.type || '').includes('pdf') || (p.attachment.name || '').toLowerCase().endsWith('.pdf');
    form.append('attachment', filePart(p.attachment, isPdf ? 'event.pdf' : 'event.jpg', isPdf ? 'application/pdf' : 'image/jpeg'));
  }
  return form;
};

export const createEvent = async (p: EventPayload): Promise<{ id: number }> => {
  const { data } = await apiClient.post('/admin/calendar/events', eventForm(p), MULTIPART);
  return unwrap(data);
};

export const updateEvent = async (id: number, p: EventPayload): Promise<{ id: number }> => {
  const { data } = await apiClient.post(`/admin/calendar/events/${id}`, eventForm(p), MULTIPART);
  return unwrap(data);
};

export const deleteEvent = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/calendar/events/${id}`);
};

// ─── Enquiries ────────────────────────────────────────────────────────────────
export type EnquiryTab = 'teacher' | 'student';

export interface AdminEnquiry {
  id: number;
  topic: string;
  query: string;
  image_url?: string | null;
  admin_text?: string | null;
  replied: boolean;
  user_name: string;
  user_email?: string | null;
  created_at?: string;
}

export interface EnquiryStats {
  total: number;
  pending: number;
  replied: number;
}

export const getAdminEnquiries = async (opts: {
  tab: EnquiryTab;
  search?: string;
  days?: number;
  status?: 'pending' | 'replied';
}): Promise<{
  tab: EnquiryTab;
  enquiries: AdminEnquiry[];
  stats: EnquiryStats;
  tab_totals: { teacher: number; student: number };
}> => {
  const params: any = { tab: opts.tab };
  if (opts.search) params.search = opts.search;
  if (opts.days) params.days = opts.days;
  if (opts.status) params.status = opts.status;
  const { data } = await apiClient.get('/admin/enquiries', { params });
  return unwrap(data);
};

export const replyEnquiry = async (tab: EnquiryTab, id: number, admin_text: string): Promise<AdminEnquiry> => {
  const { data } = await apiClient.post(`/admin/enquiries/${tab}/${id}/reply`, { admin_text });
  return unwrap(data);
};

export const deleteEnquiry = async (tab: EnquiryTab, id: number): Promise<void> => {
  await apiClient.delete(`/admin/enquiries/${tab}/${id}`);
};

import apiClient from './apiClient';
import { PickedFile } from './adminProfileApi';

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

const filePart = (f: PickedFile, fallbackName: string, fallbackType: string) =>
  ({ uri: f.uri, type: f.type || fallbackType, name: f.name || fallbackName } as any);

// ─── Announcements ────────────────────────────────────────────────────────────
export type AnnouncementType = 'all' | 'user' | 'teacher';

export interface AdminAnnouncement {
  id: number;
  type: AnnouncementType;
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
}

export const getAdminAnnouncements = async (
  type?: AnnouncementType,
  days?: number,
): Promise<{ announcements: AdminAnnouncement[]; stats: AnnouncementStats }> => {
  const params: any = {};
  if (type) params.type = type;
  if (days) params.days = days;
  const { data } = await apiClient.get('/admin/announcements', { params });
  return unwrap(data);
};

const announcementForm = (a: {
  announcement_name: string;
  announcement_content: string;
  type: AnnouncementType;
  file?: PickedFile | null;
}) => {
  const form = new FormData();
  form.append('announcement_name', a.announcement_name);
  form.append('announcement_content', a.announcement_content);
  form.append('type', a.type);
  if (a.file) {
    const isPdf = (a.file.type || '').includes('pdf') || (a.file.name || '').toLowerCase().endsWith('.pdf');
    form.append('file', filePart(a.file, isPdf ? 'announcement.pdf' : 'announcement.jpg', isPdf ? 'application/pdf' : 'image/jpeg'));
  }
  return form;
};

export const createAnnouncement = async (a: {
  announcement_name: string;
  announcement_content: string;
  type: AnnouncementType;
  file?: PickedFile | null;
}): Promise<AdminAnnouncement> => {
  const { data } = await apiClient.post('/admin/announcements', announcementForm(a), MULTIPART);
  return unwrap(data);
};

export const updateAnnouncement = async (
  id: number,
  a: { announcement_name: string; announcement_content: string; type: AnnouncementType; file?: PickedFile | null },
): Promise<AdminAnnouncement> => {
  const { data } = await apiClient.post(`/admin/announcements/${id}`, announcementForm(a), MULTIPART);
  return unwrap(data);
};

export const deleteAnnouncement = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/announcements/${id}`);
};

// ─── Calendar events ──────────────────────────────────────────────────────────
export type EventType = 'class' | 'exam' | 'meeting' | 'event' | 'holiday';

export interface EventPayload {
  title: string;
  description?: string | null;
  date: string; // YYYY-MM-DD
  start_time?: string | null; // HH:mm
  end_time?: string | null; // HH:mm
  is_all_day?: boolean;
  event_type: EventType;
  color?: string | null;
}

export const createEvent = async (p: EventPayload): Promise<{ id: number }> => {
  const { data } = await apiClient.post('/admin/calendar/events', p);
  return unwrap(data);
};

export const updateEvent = async (id: number, p: EventPayload): Promise<{ id: number }> => {
  const { data } = await apiClient.put(`/admin/calendar/events/${id}`, p);
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

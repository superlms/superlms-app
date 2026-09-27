import apiClient from './apiClient';
import { PickedFile } from './adminProfileApi';

// ─── Contact Admin ────────────────────────────────────────────────────────────
// The web panel's Contact Admin: the school's messages to the Super Admin,
// over /admin/contact-super-admin.

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

/** One message, with the Super Admin's reply once there is one. */
export interface SuperAdminContact {
  id: number;
  topic: string | null;
  admin_query: string | null;
  /** The school's attachment — an image or a PDF. */
  image_url: string | null;
  image_is_pdf: boolean;
  replied: boolean;
  super_admin_text: string | null;
  super_admin_attachment: string | null;
  super_admin_attachment_is_pdf: boolean;
  /** When the reply was last saved. */
  replied_at: string | null;
  user_name: string | null;
  user_email: string | null;
  organization: string | null;
  created_at: string | null;
}

export interface SuperAdminContactStats {
  total: number;
  pending: number;
  replied: number;
}

export const getSuperAdminContacts = async (opts: {
  days?: number;
  status?: 'pending' | 'replied';
}): Promise<{ contacts: SuperAdminContact[]; stats: SuperAdminContactStats }> => {
  const params: Record<string, any> = {};
  if (opts.days) params.days = opts.days;
  if (opts.status) params.status = opts.status;
  const { data } = await apiClient.get('/admin/contact-super-admin', { params });
  const d = unwrap(data);
  return {
    contacts: Array.isArray(d?.contacts) ? d.contacts : [],
    stats: d?.stats ?? { total: 0, pending: 0, replied: 0 },
  };
};

export interface SuperAdminContactPayload {
  topic: string;
  admin_query: string;
  /** A new attachment; on an edit it replaces the one there. */
  file?: PickedFile | null;
}

const contactForm = (p: SuperAdminContactPayload) => {
  const form = new FormData();
  form.append('topic', p.topic);
  form.append('admin_query', p.admin_query);
  if (p.file) {
    const isPdf = (p.file.type || '').includes('pdf') || (p.file.name || '').toLowerCase().endsWith('.pdf');
    form.append('image', {
      uri: p.file.uri,
      type: p.file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
      name: p.file.name || (isPdf ? 'attachment.pdf' : 'attachment.jpg'),
    } as any);
  }
  return form;
};

export const sendSuperAdminContact = async (p: SuperAdminContactPayload): Promise<SuperAdminContact> => {
  const { data } = await apiClient.post('/admin/contact-super-admin', contactForm(p), MULTIPART);
  return unwrap(data);
};

export const updateSuperAdminContact = async (id: number, p: SuperAdminContactPayload): Promise<SuperAdminContact> => {
  const { data } = await apiClient.post(`/admin/contact-super-admin/${id}`, contactForm(p), MULTIPART);
  return unwrap(data);
};

export const deleteSuperAdminContact = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/contact-super-admin/${id}`);
};

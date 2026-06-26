import apiClient from './apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface AdminProfileUser {
  id: number | string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
}

export interface AdminProfileOrg {
  id: number;
  name: string;
  logo?: string | null;
  school_code?: string | null;
}

export interface CustomSection {
  title: string;
  description: string;
}

export interface SchoolInfoData {
  about_school?: string | null;
  website_info?: string | null;
  website_url?: string | null;
  school_email?: string | null;
  school_mobile?: string | null;
  school_address?: string | null;
  school_document_text?: string | null;
  usm_vision?: string | null;
  usm_mission?: string | null;
  usm_values?: string | null;
  usm_goals?: string | null;
  custom_sections?: CustomSection[];
}

export interface ManagementMember {
  id: number;
  name: string;
  designation: string;
  photo_path?: string | null;
}

export interface SchoolDocument {
  id: number;
  title: string;
  file_path: string;
  file_type?: string | null;
}

export interface AdminProfile {
  user: AdminProfileUser;
  organization: AdminProfileOrg | null;
  school_info: SchoolInfoData;
  management_team: ManagementMember[];
  documents: SchoolDocument[];
}

// An asset picked from the device (image-picker / document-picker shaped).
export interface PickedFile {
  uri: string;
  type?: string | null;
  name?: string | null;
}

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

const filePart = (f: PickedFile, fallbackName: string, fallbackType: string) =>
  ({ uri: f.uri, type: f.type || fallbackType, name: f.name || fallbackName } as any);

// ─── Calls ──────────────────────────────────────────────────────────────────
export const getAdminProfile = async (): Promise<AdminProfile> => {
  const { data } = await apiClient.get('/admin/profile');
  return unwrap(data);
};

export const updateSchoolInfo = async (payload: SchoolInfoData): Promise<AdminProfile> => {
  const { data } = await apiClient.put('/admin/profile/school-info', payload);
  return unwrap(data);
};

export const updateAdminLogo = async (photo: PickedFile): Promise<{ logo: string }> => {
  const form = new FormData();
  form.append('photo', filePart(photo, 'logo.jpg', 'image/jpeg'));
  const { data } = await apiClient.post('/admin/profile/logo', form, MULTIPART);
  return unwrap(data);
};

export const addMember = async (m: {
  name: string;
  designation: string;
  photo?: PickedFile | null;
}): Promise<ManagementMember> => {
  const form = new FormData();
  form.append('name', m.name);
  form.append('designation', m.designation);
  if (m.photo) form.append('photo', filePart(m.photo, 'member.jpg', 'image/jpeg'));
  const { data } = await apiClient.post('/admin/profile/members', form, MULTIPART);
  return unwrap(data);
};

export const updateMember = async (
  id: number,
  m: { name: string; designation: string; photo?: PickedFile | null },
): Promise<ManagementMember> => {
  const form = new FormData();
  form.append('name', m.name);
  form.append('designation', m.designation);
  if (m.photo) form.append('photo', filePart(m.photo, 'member.jpg', 'image/jpeg'));
  const { data } = await apiClient.post(`/admin/profile/members/${id}`, form, MULTIPART);
  return unwrap(data);
};

export const deleteMember = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/profile/members/${id}`);
};

export const addDocument = async (d: { title: string; file: PickedFile }): Promise<SchoolDocument> => {
  const form = new FormData();
  form.append('title', d.title);
  form.append('file', filePart(d.file, 'document.pdf', 'application/pdf'));
  const { data } = await apiClient.post('/admin/profile/documents', form, MULTIPART);
  return unwrap(data);
};

export const deleteDocument = async (id: number): Promise<void> => {
  await apiClient.delete(`/admin/profile/documents/${id}`);
};

export const updateAdminPassword = async (p: {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}): Promise<void> => {
  await apiClient.post('/admin/profile/password', p);
};

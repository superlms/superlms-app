import apiClient from './apiClient';
import { PickedFile } from './adminProfileApi';

// Standards module — Classes, Sections, Subjects. Mirrors the web admin
// app/Livewire/Admin/Standard.php over the /admin/* API.

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

const filePart = (f: PickedFile, fallbackName: string) =>
  ({ uri: f.uri, type: f.type || 'image/jpeg', name: f.name || fallbackName } as any);

// ─── Types ──────────────────────────────────────────────────────────────────
export interface AdminClass {
  id: number;
  name: string;
  code: string;
  board?: string | null;
  order?: number | null;
  is_active: boolean;
  sections_count?: number | null;
  subjects_count?: number | null;
}

export interface AdminSection {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  standard_id: number;
  standard_name?: string | null;
  is_active: boolean;
  subjects_count?: number | null;
}

export interface AdminSubject {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_active: boolean;
  image_url?: string | null;
  detail_image_url?: string | null;
  standard_id?: number | null;
  standard_name?: string | null;
  is_mandatory?: boolean | null;
  section_ids: number[];
  sections: string;
}

export interface StandardStats {
  classes: number;
  sections: number;
  subjects: number;
}

export interface LookupClass {
  id: number;
  name: string;
  code: string;
  board?: string | null;
  sections: { id: number; name: string; code: string }[];
}

// ─── Lookups ──────────────────────────────────────────────────────────────────
export const getAcademicLookups = async (): Promise<{ classes: LookupClass[]; board: string }> => {
  const { data } = await apiClient.get('/admin/academic-lookups');
  return unwrap(data);
};

// ─── Classes ──────────────────────────────────────────────────────────────────
export const getClasses = async (
  search?: string,
  status?: 'active' | 'inactive',
): Promise<{ standards: AdminClass[]; stats: StandardStats }> => {
  const params: any = {};
  if (search) params.search = search;
  if (status) params.status = status;
  const { data } = await apiClient.get('/admin/standards', { params });
  return unwrap(data);
};

export const createClass = async (p: { name: string; code: string; order?: number; is_active?: boolean }) => {
  const { data } = await apiClient.post('/admin/standards', p);
  return unwrap(data);
};

export const updateClass = async (id: number, p: { name: string; code: string; order?: number; is_active?: boolean }) => {
  const { data } = await apiClient.put(`/admin/standards/${id}`, p);
  return unwrap(data);
};

export const deleteClass = async (id: number) => {
  await apiClient.delete(`/admin/standards/${id}`);
};

// ─── Sections ─────────────────────────────────────────────────────────────────
export const getSections = async (opts: {
  standard_id?: number;
  search?: string;
  status?: 'active' | 'inactive';
}): Promise<{ sections: AdminSection[] }> => {
  const { data } = await apiClient.get('/admin/sections', { params: opts });
  return unwrap(data);
};

export const createSection = async (p: {
  name: string;
  code: string;
  description?: string;
  standard_id: number;
  is_active?: boolean;
}) => {
  const { data } = await apiClient.post('/admin/sections', p);
  return unwrap(data);
};

export const updateSection = async (id: number, p: {
  name: string;
  code: string;
  description?: string;
  standard_id: number;
  is_active?: boolean;
}) => {
  const { data } = await apiClient.put(`/admin/sections/${id}`, p);
  return unwrap(data);
};

export const deleteSection = async (id: number) => {
  await apiClient.delete(`/admin/sections/${id}`);
};

// ─── Subjects ─────────────────────────────────────────────────────────────────
export const getSubjects = async (opts: {
  section_id?: number;
  standard_id?: number;
  search?: string;
  status?: 'active' | 'inactive';
}): Promise<{ subjects: AdminSubject[] }> => {
  const { data } = await apiClient.get('/admin/subjects', { params: opts });
  return unwrap(data);
};

export interface SubjectPayload {
  name: string;
  code: string;
  description?: string;
  standard_id: number;
  section_ids: number[];
  is_mandatory?: boolean;
  is_active?: boolean;
  image?: PickedFile | null;
  detail_image?: PickedFile | null;
}

const subjectForm = (p: SubjectPayload) => {
  const form = new FormData();
  form.append('name', p.name);
  form.append('code', p.code);
  if (p.description) form.append('description', p.description);
  form.append('standard_id', String(p.standard_id));
  p.section_ids.forEach(id => form.append('section_ids[]', String(id)));
  form.append('is_mandatory', p.is_mandatory ? '1' : '0');
  form.append('is_active', p.is_active === false ? '0' : '1');
  if (p.image) form.append('image', filePart(p.image, 'subject.jpg'));
  if (p.detail_image) form.append('detail_image', filePart(p.detail_image, 'subject-detail.jpg'));
  return form;
};

export const createSubject = async (p: SubjectPayload) => {
  const { data } = await apiClient.post('/admin/subjects', subjectForm(p), MULTIPART);
  return unwrap(data);
};

export const updateSubject = async (id: number, p: SubjectPayload) => {
  const { data } = await apiClient.post(`/admin/subjects/${id}`, subjectForm(p), MULTIPART);
  return unwrap(data);
};

export const deleteSubject = async (id: number) => {
  await apiClient.delete(`/admin/subjects/${id}`);
};

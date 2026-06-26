import apiClient from './apiClient';
import { PickedFile } from './adminProfileApi';
import { Pagination } from './adminStudentApi';

// Teachers module. Mirrors app/Livewire/Admin/Teacher.php over /admin/teachers.

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };
const filePart = (f: PickedFile) =>
  ({ uri: f.uri, type: f.type || 'image/jpeg', name: f.name || 'teacher.jpg' } as any);

export interface TeacherRow {
  id: number;
  user_id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  employee_id?: string | null;
  qualification?: string | null;
  image?: string | null;
  is_active: boolean;
}

export interface TeacherStats {
  total: number;
  active: number;
  inactive: number;
  last_month: number;
}

export interface TeacherDetail extends TeacherRow {
  dob?: string | null;
  date_of_joining?: string | null;
  address?: string | null;
  state?: string | null;
  city?: string | null;
  pincode?: string | null;
  emergency_contact?: string | null;
  assignments: { class?: string | null; section?: string | null }[];
}

export interface TeacherFilters {
  search?: string;
  gender?: string;
  status?: '0' | '1';
  class?: number | string;
  section?: number | string;
  page?: number;
  per_page?: number;
}

export const getTeachers = async (
  filters: TeacherFilters = {},
): Promise<{ teachers: TeacherRow[]; pagination: Pagination; stats: TeacherStats }> => {
  const { data } = await apiClient.get('/admin/teachers', { params: filters });
  return unwrap(data);
};

export const getTeacher = async (id: number): Promise<TeacherDetail> => {
  const { data } = await apiClient.get(`/admin/teachers/${id}`);
  return unwrap(data);
};

export interface TeacherPayload {
  name: string;
  email: string;
  mobile: string;
  dob: string;
  gender: string;
  employee_id: string;
  date_of_joining: string;
  qualification: string;
  address: string;
  pincode: string;
  emergency_contact: string;
  state?: string;
  city?: string;
  is_active?: boolean;
  image?: PickedFile | null;
}

const teacherForm = (p: TeacherPayload) => {
  const form = new FormData();
  const append = (k: string, v: any) => {
    if (v === undefined || v === null || v === '') return;
    form.append(k, String(v));
  };
  append('name', p.name);
  append('email', p.email);
  append('mobile', p.mobile);
  append('dob', p.dob);
  append('gender', p.gender);
  append('employee_id', p.employee_id);
  append('date_of_joining', p.date_of_joining);
  append('qualification', p.qualification);
  append('address', p.address);
  append('pincode', p.pincode);
  append('emergency_contact', p.emergency_contact);
  append('state', p.state);
  append('city', p.city);
  form.append('is_active', p.is_active ? '1' : '0');
  if (p.image) form.append('image', filePart(p.image));
  return form;
};

export const createTeacher = async (p: TeacherPayload): Promise<TeacherRow> => {
  const { data } = await apiClient.post('/admin/teachers', teacherForm(p), MULTIPART);
  return unwrap(data);
};

export const updateTeacher = async (id: number, p: TeacherPayload): Promise<TeacherRow> => {
  const { data } = await apiClient.post(`/admin/teachers/${id}`, teacherForm(p), MULTIPART);
  return unwrap(data);
};

export const deleteTeacher = async (id: number) => {
  await apiClient.delete(`/admin/teachers/${id}`);
};

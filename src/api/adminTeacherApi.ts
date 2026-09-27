import apiClient from './apiClient';
import constant from '../utils/constant';
import { PickedFile } from './adminProfileApi';
import { Pagination } from './adminStudentApi';
import { authHeader, downloadFile } from './pdfDownload';

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
  /** What they sign in with — an email may be shared, this is theirs alone. */
  username?: string | null;
  phone?: string | null;
  gender?: string | null;
  employee_id?: string | null;
  qualification?: string | null;
  image?: string | null;
  is_active: boolean;
  /** YYYY-MM-DD. On the list's rows from the server that sends it. */
  date_of_joining?: string | null;
  /** The class (and section) they are class teacher of, as the panel's list shows. */
  class_teacher?: { class?: string | null; section?: string | null }[];
}

export interface TeacherStats {
  total: number;
  active: number;
  inactive: number;
  last_month: number;
  /** The panel's "This Year": joined since the academic year began in March. */
  this_year?: number;
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
  username: string;
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
  append('username', p.username);
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

export interface UsernameCheck {
  username: string;
  available: boolean;
  /** What is wrong with it, in words — empty when it is free and well formed. */
  problems: string[];
  /** The rules every username follows. */
  rules: string[];
  /** Free usernames near a taken one, or one made from the name. */
  suggestions: string[];
}

/** Whether a username is free, for the form to say while it is typed. */
export const checkTeacherUsername = async (params: {
  username?: string;
  name?: string;
  ignore_user_id?: number;
}): Promise<UsernameCheck> => {
  const { data } = await apiClient.get('/admin/teachers/username-check', { params });
  return unwrap(data);
};

export const deleteTeacher = async (id: number) => {
  await apiClient.delete(`/admin/teachers/${id}`);
};

export interface TeacherLookups {
  /** In class order, for the Class filter. */
  classes: { id: number; name: string }[];
  sections: { id: number; name: string; standard_id: number }[];
  /** For the form's State. */
  states: string[];
  /** The asked state's cities, for the form's City. */
  cities: string[];
}

/** What the panel's Teachers page picks from; with a state, its cities too. */
export const getTeacherLookups = async (state?: string): Promise<TeacherLookups> => {
  const { data } = await apiClient.get('/admin/teachers/lookups', { params: state ? { state } : {} });
  return unwrap(data);
};

/** A new photo for the teacher (up to 1 MB), leaving the rest of them as they are. */
export const setTeacherPhoto = async (id: number, image: PickedFile): Promise<string | null> => {
  const form = new FormData();
  form.append('image', filePart(image));
  const { data } = await apiClient.post(`/admin/teachers/${id}/photo`, form, MULTIPART);
  return unwrap(data)?.image ?? null;
};

/** Takes the teacher's photo off. */
export const removeTeacherPhoto = async (id: number): Promise<void> => {
  await apiClient.post(`/admin/teachers/${id}/photo`, { remove: 1 });
};

/**
 * The panel's Export: every teacher as an Excel sheet or a PDF of record
 * cards, saved to the phone's Downloads. Returns the file name.
 */
export const exportTeachers = async (p: { format: 'xlsx' | 'pdf'; fileName: string }): Promise<string> => {
  const name = `${p.fileName}.${p.format}`;
  try {
    await downloadFile(`${constant.API_BASE_URL}/admin/teachers/export?format=${p.format}`, name, {
      ...(await authHeader()),
      Accept: '*/*',
    });
  } catch (e: any) {
    if (String(e?.message ?? '').includes('422')) throw new Error('No teachers to export.');
    throw e;
  }
  return name;
};

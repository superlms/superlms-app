import apiClient from './apiClient';
import constant from '../utils/constant';
import { PickedFile } from './adminProfileApi';
import { authHeader, downloadFile } from './pdfDownload';
import type { CropRect } from '../components/PhotoCropper';

// Students module. Mirrors app/Livewire/Admin/Student.php over /admin/students.

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };
const filePart = (f: PickedFile) =>
  ({ uri: f.uri, type: f.type || 'image/jpeg', name: f.name || 'student.jpg' } as any);

export interface StudentRow {
  id: number;
  user_id: number;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  admission_no?: string | null;
  roll_no?: string | null;
  standard_id?: number | null;
  class?: string | null;
  section_id?: number | null;
  section?: string | null;
  image?: string | null;
  is_active: boolean;
  /**
   * The circle the lists show of the photo (Profile), as fractions of the
   * upright photo — none set (or set on an earlier photo): null.
   */
  photo_circle?: { x: number; y: number; w: number; h: number } | null;
}

export interface StudentStats {
  total: number;
  this_year: number;
  last_month: number;
  active: number;
}

export interface Pagination {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export interface StudentDetail extends StudentRow {
  dob?: string | null;
  religion?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  date_of_admission?: string | null;
  board?: string | null;
  aadhar_no?: string | null;
  appar_id?: string | null;
  registration_number?: string | null;
  local_address?: string | null;
  permanent_address?: string | null;
  state?: string | null;
  city?: string | null;
  pincode?: string | null;
  transportation_required: boolean;
  route_id?: number | null;
  route_name?: string | null;
}

export interface StudentFilters {
  search?: string;
  class?: number | string;
  section?: number | string;
  gender?: string;
  status?: '0' | '1';
  sort?: 'name_asc' | 'admission_no' | 'roll_no';
  page?: number;
  per_page?: number;
}

export const getStudents = async (
  filters: StudentFilters = {},
): Promise<{ students: StudentRow[]; pagination: Pagination; stats: StudentStats }> => {
  const { data } = await apiClient.get('/admin/students', { params: filters });
  return unwrap(data);
};

export const getStudent = async (id: number): Promise<StudentDetail> => {
  const { data } = await apiClient.get(`/admin/students/${id}`);
  return unwrap(data);
};

export interface StudentLookups {
  /** students — how many the class has (newer servers). */
  classes: { id: number; name: string; code: string; board?: string | null; students?: number }[];
  sections: { id: number; name: string; code: string; standard_id: number; students?: number }[];
  routes: { id: number; route_name: string; monthly_fee?: number }[];
}

export const getStudentLookups = async (standard_id?: number): Promise<StudentLookups> => {
  const params: any = {};
  if (standard_id) params.standard_id = standard_id;
  const { data } = await apiClient.get('/admin/students/lookups', { params });
  return unwrap(data);
};

export interface StudentPayload {
  name: string;
  email: string;
  mobile: string;
  dob: string;
  gender: string;
  standard_id: number;
  section_id: number;
  father_name: string;
  mother_name?: string;
  date_of_admission?: string;
  aadhar_no?: string;
  pincode?: string;
  religion?: string;
  local_address?: string;
  permanent_address?: string;
  state?: string;
  city?: string;
  appar_id?: string;
  registration_number?: string;
  is_active?: boolean;
  transportation_required?: boolean;
  route_id?: number | null;
  image?: PickedFile | null;
  /**
   * This Add Student form's own mark (newClientRef), the same however often
   * it is sent: the server hands back the student it already added for it
   * rather than adding them again.
   */
  client_ref?: string;
  /**
   * The square framed in PhotoCropper (the class teacher's form): the server
   * cuts the photo sent — or, with none sent, the saved one — to it.
   */
  crop?: CropRect | null;
}

/** A fresh mark for one Add Student form. */
export const newClientRef = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;

/** The multipart body both the admin's and the class teacher's form send. */
export const studentForm = (p: StudentPayload) => {
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
  append('standard_id', p.standard_id);
  append('section_id', p.section_id);
  append('father_name', p.father_name);
  append('mother_name', p.mother_name);
  append('date_of_admission', p.date_of_admission);
  append('aadhar_no', p.aadhar_no);
  append('pincode', p.pincode);
  append('religion', p.religion);
  append('local_address', p.local_address);
  append('permanent_address', p.permanent_address);
  append('state', p.state);
  append('city', p.city);
  append('appar_id', p.appar_id);
  append('registration_number', p.registration_number);
  form.append('is_active', p.is_active ? '1' : '0');
  form.append('transportation_required', p.transportation_required ? '1' : '0');
  if (p.transportation_required && p.route_id) append('route_id', p.route_id);
  if (p.image) form.append('image', filePart(p.image));
  append('client_ref', p.client_ref);
  if (p.crop) {
    form.append('crop_x', p.crop.x.toFixed(6));
    form.append('crop_y', p.crop.y.toFixed(6));
    form.append('crop_w', p.crop.w.toFixed(6));
    form.append('crop_h', p.crop.h.toFixed(6));
  }
  return form;
};

/**
 * Adding a student, a photo and all, can take longer than other calls on a
 * slow network; given up on too soon, the student was often saved while the
 * phone said it was not.
 */
export const ADD_STUDENT_TIMEOUT = 60000;

export const createStudent = async (p: StudentPayload): Promise<StudentRow> => {
  const { data } = await apiClient.post('/admin/students', studentForm(p), { ...MULTIPART, timeout: ADD_STUDENT_TIMEOUT });
  return unwrap(data);
};

export const updateStudent = async (id: number, p: StudentPayload): Promise<StudentRow> => {
  const { data } = await apiClient.post(`/admin/students/${id}`, studentForm(p), MULTIPART);
  return unwrap(data);
};

/** A new photo for the student, leaving the rest of them as they are. */
export const setStudentPhoto = async (id: number, image: PickedFile): Promise<string | null> => {
  const form = new FormData();
  form.append('image', filePart(image));
  const { data } = await apiClient.post(`/admin/students/${id}/photo`, form, MULTIPART);
  return unwrap(data)?.image ?? null;
};

/** Takes the student's photo off. */
export const removeStudentPhoto = async (id: number): Promise<void> => {
  await apiClient.post(`/admin/students/${id}/photo`, { remove: 1 });
};

export const deleteStudent = async (id: number) => {
  await apiClient.delete(`/admin/students/${id}`);
};

/**
 * The panel's Export: the whole school, or one class (and one section of it),
 * as an Excel sheet or a PDF, saved to the phone's Downloads. Returns the file
 * name. A selection with nobody in it throws "No students to export".
 */
export const exportStudents = async (p: {
  format: 'xlsx' | 'pdf';
  classId?: number | null;
  sectionId?: number | null;
  fileName: string;
}): Promise<string> => {
  const query = [
    `format=${p.format}`,
    p.classId ? `class_id=${p.classId}` : '',
    p.classId && p.sectionId ? `section_id=${p.sectionId}` : '',
  ].filter(Boolean).join('&');
  const name = `${p.fileName}.${p.format}`;
  try {
    await downloadFile(`${constant.API_BASE_URL}/admin/students/export?${query}`, name, {
      ...(await authHeader()),
      Accept: '*/*',
    });
  } catch (e: any) {
    const msg = String(e?.message ?? '');
    if (msg.includes('422')) throw new Error('No students to export for this choice.');
    if (msg.includes('404')) throw new Error('That class is no longer there.');
    throw e;
  }
  return name;
};

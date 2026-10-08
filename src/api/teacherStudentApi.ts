import apiClient from './apiClient';
import type { CropRect } from '../components/PhotoCropper';
import {
  ADD_STUDENT_TIMEOUT,
  Pagination,
  StudentDetail,
  StudentFilters,
  StudentLookups,
  StudentPayload,
  StudentRow,
  StudentStats,
  newClientRef,
  studentForm,
} from './adminStudentApi';

/**
 * A class teacher's own students — the admin panel's Students module over
 * /teacher/students, which the server narrows to the class and section the
 * teacher is class teacher of. The shapes are the admin ones, so the fields
 * and the form are the same.
 */

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

export { newClientRef };

export type {
  Pagination,
  StudentDetail,
  StudentFilters,
  StudentLookups,
  StudentPayload,
  StudentRow,
  StudentStats,
};

/** A class this teacher is class teacher of. */
export interface TeacherClass {
  standard_id: number;
  class: string | null;
  /** Null when the whole class is theirs, not one section of it. */
  section_id: number | null;
  section: string | null;
}

// GET /teacher/students/classes — what they are class teacher of.
export const getMyClasses = async (): Promise<TeacherClass[]> => {
  const { data } = await apiClient.get('/teacher/students/classes');
  return unwrap(data)?.classes ?? [];
};

// GET /teacher/students/lookups — their classes, those sections, the routes.
export const getStudentLookups = async (standard_id?: number): Promise<StudentLookups> => {
  const { data } = await apiClient.get('/teacher/students/lookups', {
    params: standard_id ? { standard_id } : {},
  });
  return unwrap(data);
};

export const getStudents = async (
  filters: StudentFilters = {},
): Promise<{ students: StudentRow[]; pagination: Pagination; stats: StudentStats }> => {
  const { data } = await apiClient.get('/teacher/students', { params: filters });
  return unwrap(data);
};

export const getStudent = async (id: number): Promise<StudentDetail> => {
  const { data } = await apiClient.get(`/teacher/students/${id}`);
  return unwrap(data);
};

export const createStudent = async (p: StudentPayload): Promise<StudentRow> => {
  const { data } = await apiClient.post('/teacher/students', studentForm(p), { ...MULTIPART, timeout: ADD_STUDENT_TIMEOUT });
  return unwrap(data);
};

export const updateStudent = async (id: number, p: StudentPayload): Promise<StudentRow> => {
  const { data } = await apiClient.post(`/teacher/students/${id}`, studentForm(p), MULTIPART);
  return unwrap(data);
};

export const deleteStudent = async (id: number) => {
  await apiClient.delete(`/teacher/students/${id}`);
};

/**
 * The student's saved photo cut to the part kept in the photo editor (from
 * the list's large photo, Save). Returns the new photo's address.
 */
export const cropStudentPhoto = async (id: number, crop: CropRect): Promise<string | null> => {
  const form = new FormData();
  form.append('crop_x', crop.x.toFixed(6));
  form.append('crop_y', crop.y.toFixed(6));
  form.append('crop_w', crop.w.toFixed(6));
  form.append('crop_h', crop.h.toFixed(6));
  const { data } = await apiClient.post(`/teacher/students/${id}/photo`, form, MULTIPART);
  return unwrap(data)?.image ?? null;
};

/**
 * The circle the lists show of the student's photo (Profile on the list's
 * large photo); the photo itself is left as it is. Returns the circle saved.
 */
export const setStudentPhotoCircle = async (id: number, circle: CropRect): Promise<CropRect | null> => {
  const { data } = await apiClient.post(`/teacher/students/${id}/photo-circle`, {
    circle_x: Number(circle.x.toFixed(6)),
    circle_y: Number(circle.y.toFixed(6)),
    circle_w: Number(circle.w.toFixed(6)),
    circle_h: Number(circle.h.toFixed(6)),
  });
  return unwrap(data)?.photo_circle ?? null;
};

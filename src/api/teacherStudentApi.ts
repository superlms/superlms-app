import apiClient from './apiClient';
import {
  Pagination,
  StudentDetail,
  StudentFilters,
  StudentLookups,
  StudentPayload,
  StudentRow,
  StudentStats,
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
  const { data } = await apiClient.post('/teacher/students', studentForm(p), MULTIPART);
  return unwrap(data);
};

export const updateStudent = async (id: number, p: StudentPayload): Promise<StudentRow> => {
  const { data } = await apiClient.post(`/teacher/students/${id}`, studentForm(p), MULTIPART);
  return unwrap(data);
};

export const deleteStudent = async (id: number) => {
  await apiClient.delete(`/teacher/students/${id}`);
};

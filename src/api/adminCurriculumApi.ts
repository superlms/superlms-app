import apiClient from './apiClient';

// Shared curriculum lookups used by the Syllabus, Content and Quiz screens.
// Classes + their sections come from /admin/academic-lookups (adminStandardApi).

const unwrap = (data: any) => data?.data ?? data;

export interface CurriculumSubject {
  id: number;
  name: string;
  code?: string;
}

export const getCurriculumSubjects = async (
  standard_id: number,
  section_id?: number | null,
): Promise<CurriculumSubject[]> => {
  const params: any = { standard_id };
  if (section_id) params.section_id = section_id;
  const { data } = await apiClient.get('/admin/curriculum/subjects', { params });
  return unwrap(data).subjects ?? [];
};

export interface CurriculumChapter {
  id: number;
  name: string;
  order?: number;
  topics: { id: number; name: string }[];
}

export const getCurriculumChapters = async (subject_id: number): Promise<CurriculumChapter[]> => {
  const { data } = await apiClient.get('/admin/curriculum/chapters', { params: { subject_id } });
  return unwrap(data).chapters ?? [];
};

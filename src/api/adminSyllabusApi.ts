import apiClient from './apiClient';

// Syllabus module. Mirrors app/Livewire/Admin/Syllabus.php over /admin/syllabus.

const unwrap = (data: any) => data?.data ?? data;

export interface SyllabusStats {
  standards: number;
  subjects: number;
  chapters: number;
  topics: number;
}

export interface SyllabusTopic {
  id: number;
  name: string;
}

export interface SyllabusChapter {
  id: number;
  name: string;
  description?: string | null;
  order?: number;
  topics: SyllabusTopic[];
}

export const getSyllabusStats = async (): Promise<SyllabusStats> => {
  const { data } = await apiClient.get('/admin/syllabus/stats');
  return unwrap(data);
};

export const getSyllabus = async (p: {
  standard_id: number;
  section_id?: number | null;
  subject_id: number;
  search?: string;
}): Promise<SyllabusChapter[]> => {
  const { data } = await apiClient.get('/admin/syllabus', { params: p });
  return unwrap(data).chapters ?? [];
};

export const createChapters = async (p: {
  standard_id: number;
  section_id?: number | null;
  subject_id: number;
  chapters: { name: string; description?: string; order?: number }[];
}) => {
  const { data } = await apiClient.post('/admin/syllabus/chapters', p);
  return unwrap(data);
};

export const updateChapter = async (id: number, p: { name: string; description?: string; order?: number }) => {
  const { data } = await apiClient.put(`/admin/syllabus/chapters/${id}`, p);
  return unwrap(data);
};

export const deleteChapter = async (id: number) => {
  await apiClient.delete(`/admin/syllabus/chapters/${id}`);
};

export const createTopics = async (p: { chapter_id: number; topics: { name: string }[] }) => {
  const { data } = await apiClient.post('/admin/syllabus/topics', p);
  return unwrap(data);
};

export const updateTopic = async (id: number, name: string) => {
  const { data } = await apiClient.put(`/admin/syllabus/topics/${id}`, { name });
  return unwrap(data);
};

export const deleteTopic = async (id: number) => {
  await apiClient.delete(`/admin/syllabus/topics/${id}`);
};

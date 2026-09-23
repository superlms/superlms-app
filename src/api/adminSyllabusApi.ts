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

// ── The panel's own reads and saves ─────────────────────────────────────────
// The Syllabus screen reads the outline as the panel's list does, and its
// chapter and topic managers save their rows as one set, as the panel's do.

export interface OutlineTopic {
  id: number;
  name: string;
  order: number;
}

export interface OutlineChapter {
  id: number;
  name: string;
  description?: string | null;
  order: number;
  topics: OutlineTopic[];
}

export interface SyllabusOutline {
  subject: { id: number; name: string; image?: string | null } | null;
  chapters: OutlineChapter[];
  stats: SyllabusStats;
}

/** The picked subject (one the class or section is taught) with every chapter it has. */
export const getSyllabusOutline = async (p: {
  standard_id?: number | null;
  section_id?: number | null;
  subject_id?: number | null;
}): Promise<SyllabusOutline> => {
  const params: Record<string, number> = {};
  if (p.standard_id) params.standard_id = p.standard_id;
  if (p.section_id) params.section_id = p.section_id;
  if (p.subject_id) params.subject_id = p.subject_id;
  const { data } = await apiClient.get('/admin/syllabus/outline', { params });
  return unwrap(data);
};

export interface SetRow {
  /** null for a new row. */
  id: number | null;
  name: string;
  order: number;
}

/** The chapter manager's Save: removed ones go with their topics, the rest are renamed or added. */
export const saveChapterSet = async (p: {
  standard_id: number;
  section_id?: number | null;
  subject_id: number;
  rows: SetRow[];
  deleted_ids: number[];
}): Promise<string> => {
  const { data } = await apiClient.post('/admin/syllabus/chapters/set', p);
  return data?.message ?? 'Chapters saved!';
};

/** The topic manager's Save for one chapter. */
export const saveTopicSet = async (p: { chapter_id: number; rows: SetRow[]; deleted_ids: number[] }): Promise<string> => {
  const { data } = await apiClient.post('/admin/syllabus/topics/set', p);
  return data?.message ?? 'Topics saved!';
};

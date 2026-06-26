import apiClient from './apiClient';
import { PickedFile } from './adminProfileApi';

// Content module. Mirrors app/Livewire/Admin/Content.php over /admin/content.

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };
const filePart = (f: PickedFile, fallback: string, type: string) =>
  ({ uri: f.uri, type: f.type || type, name: f.name || fallback } as any);

export type ContentType = 'text' | 'url' | 'image' | 'pdf' | 'all';

export interface ContentData {
  text?: string | null;
  url?: string | null;
  image?: string | null;
  pdf?: string | null;
}

export interface ContentTopic {
  id: number;
  name: string;
  has_content: boolean;
  content: ContentData;
}

export interface ContentChapter {
  id: number;
  name: string;
  has_content: boolean;
  content: ContentData;
  topics: ContentTopic[];
}

export interface ContentStats {
  chapters: number;
  topics: number;
  with_content: number;
}

export const getContentStats = async (): Promise<ContentStats> => {
  const { data } = await apiClient.get('/admin/content/stats');
  return unwrap(data);
};

export const getContent = async (p: {
  standard_id: number;
  section_id?: number | null;
  subject_id: number;
}): Promise<ContentChapter[]> => {
  const { data } = await apiClient.get('/admin/content', { params: p });
  return unwrap(data).chapters ?? [];
};

export const saveContent = async (p: {
  target_type: 'chapter' | 'topic';
  target_id: number;
  content_type: ContentType;
  text?: string;
  url?: string;
  image?: PickedFile | null;
  pdf?: PickedFile | null;
}) => {
  const form = new FormData();
  form.append('target_type', p.target_type);
  form.append('target_id', String(p.target_id));
  form.append('content_type', p.content_type);
  if (p.text) form.append('text', p.text);
  if (p.url) form.append('url', p.url);
  if (p.image) form.append('image', filePart(p.image, 'content.jpg', 'image/jpeg'));
  if (p.pdf) form.append('pdf', filePart(p.pdf, 'content.pdf', 'application/pdf'));
  const { data } = await apiClient.post('/admin/content', form, MULTIPART);
  return unwrap(data);
};

export const clearContent = async (type: 'chapter' | 'topic', id: number) => {
  await apiClient.delete(`/admin/content/${type}/${id}`);
};

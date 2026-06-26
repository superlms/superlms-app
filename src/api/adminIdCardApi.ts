import apiClient from './apiClient';
import { Pagination } from './adminStudentApi';

// ID Card module. Mirrors app/Livewire/Admin/IdCard.php over /admin/id-cards.

const unwrap = (data: any) => data?.data ?? data;

export type CardType = 'student' | 'teacher' | 'employee';

export interface IdCardRow {
  id: number;
  card_number: string;
  name?: string | null;
  subtitle?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  status: string;
}

export interface IdCardAnalytics {
  total: number;
  issued: number;
  remaining: number;
}

export interface IdCardListResult {
  type: CardType;
  cards: IdCardRow[];
  pagination: Pagination;
  analytics: IdCardAnalytics;
  standards: { id: number; name: string }[];
  sections: { id: number; name: string }[];
}

export interface IdCardFilters {
  type: CardType;
  search?: string;
  standard?: number | string;
  section?: number | string;
  status?: 'active' | 'inactive';
  page?: number;
  per_page?: number;
}

export const getIdCards = async (filters: IdCardFilters): Promise<IdCardListResult> => {
  const { data } = await apiClient.get('/admin/id-cards', { params: filters });
  return unwrap(data);
};

// Flattened card view payload from IdCardService::cardViewData.
export interface IdCardView {
  type: CardType;
  school: { name: string; logo?: string | null; address?: string | null; website?: string | null; email?: string | null; phone?: string | null };
  card_number: string;
  issue_date: string;
  expiry_date: string;
  status: string;
  qr_code?: string | null; // data-URI
  photo?: string | null;
  name: string;
  subtitle: string;
  front_rows: Record<string, string>;
  back_mode: string;
  transport?: Record<string, string> | null;
}

export const getIdCard = async (type: CardType, id: number): Promise<IdCardView> => {
  const { data } = await apiClient.get(`/admin/id-cards/${type}/${id}`);
  return unwrap(data);
};

export const generateIdCards = async (p: {
  type: CardType;
  expiry_date: string;
  standard_ids?: number[];
}): Promise<{ generated: number; errors: string[] }> => {
  const { data } = await apiClient.post('/admin/id-cards/generate', p);
  return unwrap(data);
};

export const updateIdCard = async (
  type: CardType,
  id: number,
  p: { expiry_date: string; status: 'active' | 'inactive' },
) => {
  const { data } = await apiClient.put(`/admin/id-cards/${type}/${id}`, p);
  return unwrap(data);
};

export const deleteIdCard = async (type: CardType, id: number) => {
  await apiClient.delete(`/admin/id-cards/${type}/${id}`);
};

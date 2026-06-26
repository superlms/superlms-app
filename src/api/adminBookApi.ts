import apiClient from './apiClient';
import { PickedFile } from './adminProfileApi';
import { Pagination } from './adminStudentApi';

// Book (library) module. Mirrors app/Livewire/Admin/Book.php over /admin/books.

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };
const filePart = (f: PickedFile, fallback: string, type: string) =>
  ({ uri: f.uri, type: f.type || type, name: f.name || fallback } as any);

export interface BookRow {
  id: number;
  title: string;
  standard_id: number;
  class?: string | null;
  section_id?: number | null;
  section?: string | null;
  subject_id: number;
  subject?: string | null;
  book_logo?: string | null;
  pdf_file?: string | null;
  is_active: boolean;
}

export interface BookStats {
  total: number;
  active: number;
  inactive: number;
  with_pdf: number;
}

export interface BookFilters {
  standard_id?: number;
  section_id?: number;
  subject_id?: number;
  search?: string;
  status?: '0' | '1';
  page?: number;
  per_page?: number;
}

export const getBooks = async (
  filters: BookFilters = {},
): Promise<{ books: BookRow[]; pagination: Pagination | null; stats: BookStats; classes: { id: number; name: string }[] }> => {
  const { data } = await apiClient.get('/admin/books', { params: filters });
  return unwrap(data);
};

export const getBookOptions = async (
  standard_id: number,
  section_id?: number | null,
): Promise<{ sections: { id: number; name: string }[]; subjects: { id: number; name: string }[] }> => {
  const params: any = { standard_id };
  if (section_id) params.section_id = section_id;
  const { data } = await apiClient.get('/admin/books/options', { params });
  return unwrap(data);
};

export interface BookPayload {
  title: string;
  standard_id: number;
  section_id?: number | null;
  subject_id: number;
  is_active?: boolean;
  book_logo?: PickedFile | null;
  pdf_file?: PickedFile | null;
}

const bookForm = (p: BookPayload) => {
  const form = new FormData();
  form.append('title', p.title);
  form.append('standard_id', String(p.standard_id));
  if (p.section_id) form.append('section_id', String(p.section_id));
  form.append('subject_id', String(p.subject_id));
  form.append('is_active', p.is_active === false ? '0' : '1');
  if (p.book_logo) form.append('book_logo', filePart(p.book_logo, 'cover.jpg', 'image/jpeg'));
  if (p.pdf_file) form.append('pdf_file', filePart(p.pdf_file, 'book.pdf', 'application/pdf'));
  return form;
};

export const createBook = async (p: BookPayload): Promise<BookRow> => {
  const { data } = await apiClient.post('/admin/books', bookForm(p), MULTIPART);
  return unwrap(data);
};

export const updateBook = async (id: number, p: BookPayload): Promise<BookRow> => {
  const { data } = await apiClient.post(`/admin/books/${id}`, bookForm(p), MULTIPART);
  return unwrap(data);
};

export const deleteBook = async (id: number) => {
  await apiClient.delete(`/admin/books/${id}`);
};

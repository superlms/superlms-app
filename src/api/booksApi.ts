import apiClient from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────
// Mirror of /api/v1/books payload — see BookController::formatBook on backend.
// The API auto-scopes by Sanctum token:
//   • student → books for their class + section
//   • teacher → books for the (class, subject) pairs they teach (via timetable)

export interface ApiBookRef {
  id: number;
  name: string;
}

// Subject ref additionally carries the subject icon image (full S3 URL).
export interface ApiBookSubjectRef extends ApiBookRef {
  image?: string | null;
}

export interface ApiBook {
  id: number;
  title: string;
  cover_url: string | null;
  logo_url:  string | null; // back-compat alias of cover_url
  pdf_url:   string | null;
  standard:  ApiBookRef | null;
  section:   ApiBookRef | null;
  subject:   ApiBookSubjectRef | null;
}

export interface BooksPageMeta {
  current_page: number;
  per_page:     number;
  total:        number;
  last_page:    number;
}

export interface GetBooksParams {
  per_page?:    number;
  standard_id?: number;
  section_id?:  number;
  subject_id?:  number;
  search?:      string;
}

export const getBooks = async (
  params: GetBooksParams = {},
): Promise<{ items: ApiBook[]; meta: BooksPageMeta | null }> => {
  const { data } = await apiClient.get('/books', { params });

  // The endpoint may respond in several shapes; normalise to an array so the
  // screen never crashes on .map:
  //   • plain array                              → [...]
  //   • { data: [...] }                          → data:[...]
  //   • { data: { data: [...], current_page } }  → Laravel paginator
  //   • { data: { items: [...], pagination } }   → this API's paginated()
  const raw = data?.data ?? data;
  const items: ApiBook[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.data)
    ? raw.data
    : [];

  const metaSrc =
    raw?.pagination ??
    data?.meta ??
    (raw && !Array.isArray(raw) && raw.current_page != null ? raw : null);
  const meta: BooksPageMeta | null = metaSrc
    ? {
        current_page: Number(metaSrc.current_page ?? 1),
        per_page:     Number(metaSrc.per_page ?? items.length),
        total:        Number(metaSrc.total ?? items.length),
        last_page:    Number(metaSrc.last_page ?? 1),
      }
    : null;

  console.log('[getBooks] count:', items.length);
  return { items, meta };
};

export const getBook = async (id: number): Promise<ApiBook | null> => {
  const { data } = await apiClient.get(`/books/${id}`);
  return (data?.data ?? null) as ApiBook | null;
};

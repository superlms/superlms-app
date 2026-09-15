import { getStudentContactList, getTeacherContactList } from '../../api/contactApi';
import type { Query } from './queryTypes';

/**
 * A user's queries as Queries and View Query both load them, and what their
 * skeletons draw from before anything has loaded.
 */

// Calculate days ago from date string
const calculateDaysAgo = (dateString: string): number => {
  const createdDate = new Date(dateString);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - createdDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// "Today" or "3d ago"
export const queryTimeLabel = (q: Query) => (q.daysAgo === 0 ? 'Today' : `${q.daysAgo}d ago`);

// Map API response to Query format
export const toQuery = (apiItem: any): Query => {
  let status: 'Pending' | 'In Progress' | 'Resolved' = 'Pending';
  if (apiItem.admin_text && apiItem.admin_text !== null) {
    status = 'Resolved';
  } else if (apiItem.admin_reply === 1 || apiItem.admin_reply === true) {
    status = 'Resolved';
  } else if (apiItem.admin_reply === 2) {
    status = 'In Progress';
  }

  // The API stores the uploaded file in image_url — it may be an image or a PDF
  const fileUrl: string | null = apiItem.image_url ?? null;
  const isPdf = !!fileUrl && /\.pdf(\?|$)/i.test(fileUrl);
  const fileName = fileUrl
    ? decodeURIComponent(fileUrl.split('/').pop() ?? '') || 'Attachment'
    : null;

  return {
    id: apiItem.id,
    subject: apiItem.topic,
    // Students store the body in `student_query`, teachers in `teacher_query`.
    message: apiItem.student_query ?? apiItem.teacher_query ?? '',
    status,
    created_at: apiItem.created_at,
    daysAgo: calculateDaysAgo(apiItem.created_at),
    attachmentName: fileName,
    attachmentUrl: isPdf ? null : fileUrl,
    pdfUrl: apiItem.pdf_url ?? apiItem.pdf ?? (isPdf ? fileUrl : null),
    admin_reply: apiItem.admin_text,
    replied_at: apiItem.updated_at,
  };
};

/** The signed-in student's or teacher's queries. */
export const fetchQueries = async (role: string): Promise<Query[]> => {
  const apiResponse = role === 'teacher' ? await getTeacherContactList() : await getStudentContactList();
  const dataArray = Array.isArray(apiResponse)
    ? apiResponse
    : Array.isArray(apiResponse?.data)
      ? apiResponse.data
      : [];
  return dataArray.map(toQuery);
};

export const queryErrorMessage = (err: any): string => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.message === 'Network Error') return 'Network Error. Please check your internet connection.';
  return err?.message || 'Failed to load queries. Please check your internet connection.';
};

// ── Skeletons ────────────────────────────────────────────────────────────────
// What the list keeps for its next first load: each row's own words, no files
// or replies.
export const queriesToKeep = (queries: Query[]): Query[] =>
  queries.map(q => ({
    id: q.id,
    subject: q.subject,
    message: (q.message ?? '').slice(0, 160),
    status: q.status,
    created_at: q.created_at,
    daysAgo: q.daysAgo,
  }));

const sample = (id: number, subject: string, message: string, status: Query['status'], days: number): Query => ({
  id,
  subject,
  message,
  status,
  created_at: new Date(Date.now() - days * 86400000).toISOString(),
  daysAgo: days,
});

// Ordinary queries, for a list never loaded on this phone.
const SAMPLE_QUERIES: Query[] = [
  sample(-1, 'Fee receipt for September', 'I paid the fee online but have not received the receipt yet.', 'Pending', 2),
  sample(-2, 'Leave for a family function', 'Please grant leave on Friday and Saturday for a family function.', 'Resolved', 5),
  sample(-3, 'Bus timing', 'The school bus has been reaching our stop late this week.', 'Resolved', 9),
];

/**
 * The queries a loading list is drawn from: what is on screen once it has
 * loaded; before that, what it held last time on this phone (none included),
 * or a few sample ones.
 */
export const queriesToDraw = (loaded: boolean, queries: Query[], last: Query[] | null | undefined): Query[] =>
  loaded
    ? queries
    : Array.isArray(last)
      ? last.map(q => ({ ...q, daysAgo: calculateDaysAgo(q.created_at) }))
      : SAMPLE_QUERIES;

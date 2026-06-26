// queryTypes.ts
export type Query = {
  id: string | number;
  subject: string;
  message: string;
  status: 'Pending' | 'In Progress' | 'Resolved';
  created_at: string;
  daysAgo: number;
  attachmentName?: string | null;
  attachmentUrl?: string | null;
  pdfUrl?: string | null;
  admin_reply?: string | null;
  replied_at?: string | null;
};

export const STATUS_META = {
  'Pending': { color: '#F59E0B', bg: '#FEF3C7' },
  'In Progress': { color: '#0EA5E9', bg: '#E0F2FE' },
  'Resolved': { color: '#10B981', bg: '#D1FAE5' },
};
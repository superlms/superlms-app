// announcementData.ts
import moment from 'moment';

export type Announcement = {
  id: string;
  title: string;
  content: string;
  date: string;
  daysAgo: number;
  isNew: boolean;
  tag: 'All' | 'Student' | 'Teacher' | 'Admin';
  hasImage: boolean;
  hasPdf: boolean;
  imageUrl?: string;
  pdfUrl?: string;
  creatorName?: string;
  creatorEmail?: string;
  creatorAvatar?: string;
};

export type FilterKey = 'Today' | '7 Days' | '15 Days' | '30 Days';

export const FILTERS = [
  { label: 'Today' as FilterKey, days: 0 },
  { label: '7 Days' as FilterKey, days: 7 },
  { label: '15 Days' as FilterKey, days: 15 },
  { label: '30 Days' as FilterKey, days: 30 },
];

export const TAG_META = {
  All: { color: '#6366F1', bgColor: '#EEF2FF', label: 'All' },
  Student: { color: '#10B981', bgColor: '#ECFDF5', label: 'Student' },
  Teacher: { color: '#F59E0B', bgColor: '#FFFBEB', label: 'Teacher' },
  Admin: { color: '#EF4444', bgColor: '#FEF2F2', label: 'Admin' },
};

export const mapApiItem = (apiItem: any): Announcement => {
  // Whole calendar days since it was posted: 0 = today, 1 = yesterday. (Rounding
  // the raw gap up counted anything posted today as a day old, so the "Today"
  // window never showed it.)
  const diffDays = Math.max(
    0,
    moment().startOf('day').diff(moment(apiItem.created_at).startOf('day'), 'days'),
  );
  
  // Map the type from API to tag
  let tag: Announcement['tag'] = 'All';
  if (apiItem.type === 'user') tag = 'Student';
  if (apiItem.type === 'teacher') tag = 'Teacher';
  if (apiItem.type === 'admin') tag = 'Admin';
  
  return {
    id: String(apiItem.id),
    title: apiItem.announcement_name || 'No Title',
    content: apiItem.announcement_content || '',
    date: apiItem.created_at,
    daysAgo: diffDays,
    isNew: diffDays <= 3,
    tag: tag,
    hasImage: !!apiItem.announcement_image,
    hasPdf: !!apiItem.announcement_pdf,
    imageUrl: apiItem.announcement_image,
    pdfUrl: apiItem.announcement_pdf,
    creatorName: apiItem.creator_name,
    creatorEmail: apiItem.creator_email,
    creatorAvatar: apiItem.creator_avatar,
  };
};

export type AnnouncementApiResponse = {
  success: boolean;
  status_code: number;
  message: string;
  data: any[];
};
// ─────────────────────────────────────────────────────────────────────────────
//  Notification catalog
//
//  This is the single place that defines every *kind* of notification the app
//  can raise. Later, when you say "this notification should fire here", we just
//  add/adjust an entry here and call `notify({ type, ... })` from that spot.
//
//  Each entry maps a `type` → its visual category + (optional) default title/body
//  templates. Categories drive the icon/colour shown in the banner and inbox.
// ─────────────────────────────────────────────────────────────────────────────

export type NotifCategory =
  | 'Exam'
  | 'Marks'
  | 'Attendance'
  | 'Fee'
  | 'Announcement'
  | 'Homework'
  | 'Leave'
  | 'General';

// Icon (Ionicons) + colours per category — shared by the inbox list and banner.
export const CATEGORY_CONFIG: Record<
  NotifCategory,
  { icon: string; color: string; bg: string }
> = {
  Exam: { icon: 'document-text-outline', color: '#4F46E5', bg: '#E0E7FF' },
  Marks: { icon: 'ribbon-outline', color: '#9333EA', bg: '#F3E8FF' },
  Attendance: { icon: 'calendar-outline', color: '#16A34A', bg: '#DCFCE7' },
  Fee: { icon: 'card-outline', color: '#D97706', bg: '#FEF3C7' },
  Announcement: { icon: 'megaphone-outline', color: '#0EA5E9', bg: '#E0F2FE' },
  Homework: { icon: 'book-outline', color: '#7C3AED', bg: '#EDE9FE' },
  Leave: { icon: 'person-remove-outline', color: '#DC2626', bg: '#FEE2E2' },
  General: { icon: 'notifications-outline', color: '#2563EB', bg: '#DBEAFE' },
};

// Payload passed alongside a notification — used for deep-linking later
// (e.g. open a specific exam / homework when the user taps the notification).
export interface NotifData {
  screen?: string; // route name to open on tap
  params?: Record<string, any>;
  [key: string]: any;
}

export interface CatalogEntry {
  category: NotifCategory;
  // Optional default templates; the caller can always override title/body.
  buildTitle?: (data?: NotifData) => string;
  buildBody?: (data?: NotifData) => string;
}

// Known notification types. Add to this list as new triggers are defined.
// `(string & {})` keeps autocomplete for known keys while still allowing
// ad-hoc types during development.
export type NotificationType =
  | 'exam_scheduled'
  | 'result_published'
  | 'marks_uploaded'
  | 'copy_uploaded'
  | 'attendance_marked'
  | 'attendance_low'
  | 'fee_due'
  | 'fee_paid'
  | 'homework_assigned'
  | 'homework_graded'
  | 'announcement'
  | 'leave_request'
  | 'leave_approved'
  | 'general'
  | (string & {});

export const CATALOG: Record<string, CatalogEntry> = {
  exam_scheduled: {
    category: 'Exam',
    buildTitle: () => 'Exam Schedule Released',
    buildBody: d => d?.examName ? `${d.examName} timetable has been published.` : 'A new exam timetable has been published.',
  },
  result_published: {
    category: 'Exam',
    buildTitle: () => 'Result Published',
    buildBody: d => d?.examName ? `Your ${d.examName} result is now available.` : 'Your result has been published.',
  },
  marks_uploaded: {
    category: 'Marks',
    buildTitle: () => 'Marks Uploaded',
    buildBody: d => d?.subject ? `Your ${d.subject} marks have been uploaded.` : 'Your marks have been uploaded.',
  },
  copy_uploaded: {
    category: 'Marks',
    buildTitle: () => 'Exam Copy Available',
    buildBody: d => d?.subject ? `Your ${d.subject} answer copy is available to view.` : 'Your answer copy is available to view.',
  },
  attendance_marked: {
    category: 'Attendance',
    buildTitle: () => 'Attendance Marked',
    buildBody: d => d?.status ? `Your attendance has been marked as ${d.status}.` : 'Your attendance has been marked.',
  },
  attendance_low: {
    category: 'Attendance',
    buildTitle: () => 'Low Attendance Warning',
    buildBody: () => 'Your attendance has dropped below the required limit.',
  },
  fee_due: {
    category: 'Fee',
    buildTitle: () => 'Fee Payment Reminder',
    buildBody: d => d?.amount ? `A fee of ${d.amount} is due. Please pay on time.` : 'A fee payment is due. Please pay on time.',
  },
  fee_paid: {
    category: 'Fee',
    buildTitle: () => 'Payment Successful',
    buildBody: d => d?.amount ? `Your payment of ${d.amount} was received.` : 'Your payment was received successfully.',
  },
  homework_assigned: {
    category: 'Homework',
    buildTitle: () => 'New Homework Assigned',
    buildBody: d => d?.subject ? `New ${d.subject} homework has been assigned.` : 'New homework has been assigned.',
  },
  homework_graded: {
    category: 'Homework',
    buildTitle: () => 'Homework Graded',
    buildBody: () => 'Your homework has been graded. Check the feedback.',
  },
  announcement: {
    category: 'Announcement',
    buildTitle: () => 'New Announcement',
    buildBody: d => d?.text ?? 'A new announcement has been posted.',
  },
  leave_request: {
    category: 'Leave',
    buildTitle: () => 'Leave Request',
    buildBody: d => d?.studentName ? `${d.studentName} has applied for leave.` : 'A new leave request needs your action.',
  },
  leave_approved: {
    category: 'Leave',
    buildTitle: () => 'Leave Approved',
    buildBody: () => 'Your leave request has been approved.',
  },
  general: {
    category: 'General',
  },
};

export const entryFor = (type: string): CatalogEntry =>
  CATALOG[type] ?? CATALOG.general;

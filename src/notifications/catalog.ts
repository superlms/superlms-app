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
  | 'Timetable'
  | 'Subjects'
  | 'Profile'
  | 'Contact School'
  | 'Transport'
  | 'General';

// Icon (Ionicons) + colours per category — shared by the inbox list and banner.
//
// The icons are deliberately the same glyphs the drawer already uses for those
// parts of the app, so a notification is recognisable as "the homework one" or
// "the fees one" before its title is read. The colours are kept for the native
// banner; the inbox draws the icons plainly.
export const CATEGORY_CONFIG: Record<
  NotifCategory,
  { icon: string; color: string; bg: string }
> = {
  Exam: { icon: 'school-outline', color: '#4F46E5', bg: '#E0E7FF' },
  Marks: { icon: 'ribbon-outline', color: '#9333EA', bg: '#F3E8FF' },
  Attendance: { icon: 'clipboard-outline', color: '#16A34A', bg: '#DCFCE7' },
  Fee: { icon: 'cash-outline', color: '#D97706', bg: '#FEF3C7' },
  Announcement: { icon: 'megaphone-outline', color: '#0EA5E9', bg: '#E0F2FE' },
  Homework: { icon: 'create-outline', color: '#7C3AED', bg: '#EDE9FE' },
  Leave: { icon: 'person-remove-outline', color: '#DC2626', bg: '#FEE2E2' },
  Timetable: { icon: 'time-outline', color: '#0D9488', bg: '#CCFBF1' },
  Subjects: { icon: 'albums-outline', color: '#4F46E5', bg: '#E0E7FF' },
  Profile: { icon: 'person-outline', color: '#2563EB', bg: '#DBEAFE' },
  'Contact School': { icon: 'call-outline', color: '#0EA5E9', bg: '#E0F2FE' },
  Transport: { icon: 'bus-outline', color: '#D97706', bg: '#FEF3C7' },
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
  | 'promo'
  | 'chat_message'
  | 'profile_updated'
  | 'timetable_changed'
  | 'subject_assigned'
  | 'chapter_updated'
  | 'exam_updated'
  | 'datesheet_issued'
  | 'exam_syllabus_updated'
  | 'query_replied'
  | 'fee_overdue'
  | 'transport_updated'
  | 'syllabus_updated'
  | 'admit_card_issued'
  | 'seating_published'
  | 'report_card_issued'
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
  promo: {
    category: 'Announcement',
  },
  // A student or teacher sent a chat message; the push carries their name and words.
  chat_message: {
    category: 'General',
    buildTitle: () => 'New message',
    buildBody: () => 'You have a new chat message.',
  },

  // ── A teacher's pushes ─────────────────────────────────────────────────────
  // The backend sends each one's title and a body with what changed; these are
  // only what shows if it ever doesn't.
  profile_updated: {
    category: 'Profile',
    buildTitle: () => 'Profile Updated',
    buildBody: () => 'The school updated your profile.',
  },
  timetable_changed: {
    category: 'Timetable',
    buildTitle: () => 'Timetable Changed',
    buildBody: () => 'Your timetable has changed.',
  },
  subject_assigned: {
    category: 'Subjects',
    buildTitle: () => 'New Subject Assigned',
    buildBody: () => 'A new subject has been assigned to you.',
  },
  chapter_updated: {
    category: 'Subjects',
    buildTitle: () => 'Chapters Updated',
    buildBody: () => 'The school changed the chapters of your subject.',
  },
  exam_updated: {
    category: 'Exam',
    buildTitle: () => 'Exam Updated',
    buildBody: () => 'An exam has been updated.',
  },
  datesheet_issued: {
    category: 'Exam',
    buildTitle: () => 'Date Sheet Issued',
    buildBody: () => 'A date sheet has been issued.',
  },
  exam_syllabus_updated: {
    category: 'Exam',
    buildTitle: () => 'Exam Syllabus Updated',
    buildBody: () => 'An exam syllabus has changed.',
  },
  query_replied: {
    category: 'Contact School',
    buildTitle: () => 'Reply from School',
    buildBody: () => 'The school replied to your query.',
  },

  // ── A student's pushes ─────────────────────────────────────────────────────
  // As with the teacher's, the backend sends the title and a body with the
  // details; these show only if it ever doesn't.
  fee_overdue: {
    category: 'Fee',
    buildTitle: () => 'Fee Overdue',
    buildBody: () => 'An installment of your fee is overdue. Please pay it as soon as possible.',
  },
  transport_updated: {
    category: 'Transport',
    buildTitle: () => 'Bus Timing Changed',
    buildBody: () => 'Your bus timings have changed.',
  },
  syllabus_updated: {
    category: 'Subjects',
    buildTitle: () => 'Syllabus Updated',
    buildBody: () => 'Your syllabus has changed.',
  },
  admit_card_issued: {
    category: 'Exam',
    buildTitle: () => 'Admit Card Issued',
    buildBody: () => 'Your admit card has been issued.',
  },
  seating_published: {
    category: 'Exam',
    buildTitle: () => 'Seating Plan Published',
    buildBody: () => 'Your exam seat is ready.',
  },
  report_card_issued: {
    category: 'Exam',
    buildTitle: () => 'Report Card Issued',
    buildBody: () => 'Your report card has been issued.',
  },
};

export const entryFor = (type: string): CatalogEntry =>
  CATALOG[type] ?? CATALOG.general;

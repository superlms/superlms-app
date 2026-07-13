// Admin modules — mirror the web admin sidebar order (config/menu.php → 'admin').
// Shared by the dashboard grid and the Quick Links screen so both stay in sync.
//
// `perm` is the web admin route name that grants this module (config/menu.php
// → 'admin' → 'link'). It's how a sub-admin's granted functionalities — sent by
// the login API as those same route names — are matched to the tiles they may
// see. Modules without a `perm` are structural and always visible.
export interface AdminModule {
  key: string;
  label: string;
  icon: string;
  color: string;
  perm?: string;
}

export const ADMIN_MODULES: AdminModule[] = [
  { key: 'quick-links', label: 'Quick Links', icon: 'link', color: '#6366F1', perm: 'admin.quick-links' },
  { key: 'dashboard', label: 'Dashboard', icon: 'home', color: '#22C55E', perm: 'admin.home' },
  { key: 'analytics', label: 'Analytics', icon: 'bar-chart', color: '#0EA5E9', perm: 'admin.analytics' },
  { key: 'standard', label: 'Standard', icon: 'book', color: '#F59E0B', perm: 'admin.standard' },
  { key: 'students', label: 'Students', icon: 'people', color: '#EC4899', perm: 'admin.student' },
  { key: 'teachers', label: 'Teachers', icon: 'person', color: '#8B5CF6', perm: 'admin.teacher' },
  { key: 'fees', label: 'Fees', icon: 'cash', color: '#14B8A6', perm: 'admin.fee' },
  { key: 'ledger', label: 'Ledger', icon: 'calculator', color: '#EF4444', perm: 'admin.ledger' },
  { key: 'payroll', label: 'Payroll', icon: 'wallet', color: '#3B82F6', perm: 'admin.payroll' },
  { key: 'credit', label: 'Credit', icon: 'card', color: '#10B981', perm: 'admin.credit' },
  { key: 'attendance', label: 'Attendance', icon: 'checkbox', color: '#F97316', perm: 'admin.attendance' },
  { key: 'transport', label: 'Transportation', icon: 'bus', color: '#6366F1', perm: 'admin.transport' },
  { key: 'homework', label: 'Homework', icon: 'create', color: '#22C55E', perm: 'admin.homework' },
  { key: 'timetable', label: 'Time Table', icon: 'calendar', color: '#0EA5E9', perm: 'admin.timetable' },
  { key: 'arrangement', label: 'Arrangement', icon: 'grid', color: '#F59E0B', perm: 'admin.arrangement' },
  { key: 'announcement', label: 'Announcement', icon: 'megaphone', color: '#EC4899', perm: 'admin.announcement' },
  { key: 'calender', label: 'Calender', icon: 'calendar-outline', color: '#8B5CF6', perm: 'admin.calender' },
  { key: 'syllabus', label: 'Syllabus', icon: 'library', color: '#14B8A6', perm: 'admin.syllabus' },
  { key: 'content', label: 'Content', icon: 'document', color: '#EF4444', perm: 'admin.content' },
  { key: 'quiz', label: 'Quiz', icon: 'help-circle', color: '#3B82F6', perm: 'admin.quiz' },
  { key: 'book', label: 'Book', icon: 'book', color: '#10B981', perm: 'admin.book' },
  { key: 'enquiries', label: 'Enquiries', icon: 'chatbubble-ellipses', color: '#F97316', perm: 'admin.enqueries' },
  { key: 'id-card', label: 'ID Card', icon: 'card', color: '#6366F1', perm: 'admin.id-card' },
  { key: 'exam', label: 'Exam', icon: 'document-text', color: '#22C55E', perm: 'admin.add-exam' },
  { key: 'admit-card', label: 'Admit Card', icon: 'ticket', color: '#0EA5E9', perm: 'admin.admit-card' },
  { key: 'seating-plan', label: 'Seating Plan', icon: 'apps', color: '#F59E0B', perm: 'admin.seating-plan' },
  { key: 'performance', label: 'Performance', icon: 'trending-up', color: '#EC4899', perm: 'admin.performance' },
  { key: 'exam-copy', label: 'Exam Copy', icon: 'document-text', color: '#8B5CF6', perm: 'admin.exam-copy' },
  { key: 'report-card', label: 'Report Card', icon: 'documents', color: '#14B8A6', perm: 'admin.report-card' },
  { key: 'tc-certificate', label: 'TC & Certificate', icon: 'ribbon', color: '#EF4444', perm: 'admin.tc-certificate' },
  { key: 'more', label: 'More', icon: 'grid', color: '#64748B', perm: 'admin.more' },
];

// ─── Permission gating ───────────────────────────────────────────────────────
// A full school admin's permissions arrive as the ['*'] wildcard. Legacy
// sessions (saved before the API sent permissions) have `undefined` — we treat
// those as full access so existing admins aren't locked out after upgrading.
export const hasAllAccess = (perms?: string[] | null): boolean =>
  !Array.isArray(perms) || perms.includes('*');

// True if the given module should be visible for the supplied permissions.
export const canAccessAdminModule = (
  m: Pick<AdminModule, 'perm'>,
  perms?: string[] | null,
): boolean =>
  hasAllAccess(perms) || (!!m.perm && perms!.includes(m.perm));

// The admin modules a user with these permissions may see, in sidebar order.
export const visibleAdminModules = (perms?: string[] | null): AdminModule[] =>
  ADMIN_MODULES.filter(m => canAccessAdminModule(m, perms));

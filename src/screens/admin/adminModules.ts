// Admin modules — mirror the web admin sidebar order (config/menu.php → 'admin').
// Shared by the dashboard grid and the Quick Links screen so both stay in sync.
export interface AdminModule {
  key: string;
  label: string;
  icon: string;
  color: string;
}

export const ADMIN_MODULES: AdminModule[] = [
  { key: 'quick-links', label: 'Quick Links', icon: 'link', color: '#6366F1' },
  { key: 'dashboard', label: 'Dashboard', icon: 'home', color: '#22C55E' },
  { key: 'analytics', label: 'Analytics', icon: 'bar-chart', color: '#0EA5E9' },
  { key: 'standard', label: 'Standard', icon: 'book', color: '#F59E0B' },
  { key: 'students', label: 'Students', icon: 'people', color: '#EC4899' },
  { key: 'teachers', label: 'Teachers', icon: 'person', color: '#8B5CF6' },
  { key: 'fees', label: 'Fees', icon: 'cash', color: '#14B8A6' },
  { key: 'ledger', label: 'Ledger', icon: 'calculator', color: '#EF4444' },
  { key: 'payroll', label: 'Payroll', icon: 'wallet', color: '#3B82F6' },
  { key: 'credit', label: 'Credit', icon: 'card', color: '#10B981' },
  { key: 'attendance', label: 'Attendance', icon: 'checkbox', color: '#F97316' },
  { key: 'transport', label: 'Transportation', icon: 'bus', color: '#6366F1' },
  { key: 'homework', label: 'Homework', icon: 'create', color: '#22C55E' },
  { key: 'timetable', label: 'Time Table', icon: 'calendar', color: '#0EA5E9' },
  { key: 'arrangement', label: 'Arrangement', icon: 'grid', color: '#F59E0B' },
  { key: 'announcement', label: 'Announcement', icon: 'megaphone', color: '#EC4899' },
  { key: 'calender', label: 'Calender', icon: 'calendar-outline', color: '#8B5CF6' },
  { key: 'syllabus', label: 'Syllabus', icon: 'library', color: '#14B8A6' },
  { key: 'content', label: 'Content', icon: 'document', color: '#EF4444' },
  { key: 'quiz', label: 'Quiz', icon: 'help-circle', color: '#3B82F6' },
  { key: 'book', label: 'Book', icon: 'book', color: '#10B981' },
  { key: 'enquiries', label: 'Enquiries', icon: 'chatbubble-ellipses', color: '#F97316' },
  { key: 'id-card', label: 'ID Card', icon: 'card', color: '#6366F1' },
  { key: 'exam', label: 'Exam', icon: 'document-text', color: '#22C55E' },
  { key: 'admit-card', label: 'Admit Card', icon: 'ticket', color: '#0EA5E9' },
  { key: 'seating-plan', label: 'Seating Plan', icon: 'apps', color: '#F59E0B' },
  { key: 'performance', label: 'Performance', icon: 'trending-up', color: '#EC4899' },
  { key: 'exam-copy', label: 'Exam Copy', icon: 'document-text', color: '#8B5CF6' },
  { key: 'report-card', label: 'Report Card', icon: 'documents', color: '#14B8A6' },
  { key: 'tc-certificate', label: 'TC & Certificate', icon: 'ribbon', color: '#EF4444' },
  { key: 'more', label: 'More', icon: 'grid', color: '#64748B' },
];

import { AppAlert } from '../components/AppDialog';
import type { AdminModule } from '../screens/admin/adminModules';

/**
 * Where each admin module opens in the app. Students, Teachers, Attendance and
 * Fees are bottom tabs (inside the drawer's "PanelHome"), so they open there
 * and the tab bar stays; the rest are sidebar screens. A module with no entry
 * here isn't in the app yet.
 */
type Target = { route: string; params?: object };

const tab = (screen: string): Target => ({ route: 'PanelHome', params: { screen } });

export const ADMIN_MODULE_TARGETS: Record<string, Target> = {
  dashboard: tab('Dashboard'),
  analytics: { route: 'AdminAnalytics' },
  standard: { route: 'AdminStandard' },
  students: tab('Students'),
  teachers: tab('Teachers'),
  fees: tab('Fees'),
  attendance: tab('Attendance'),
  transport: { route: 'AdminTransport' },
  homework: { route: 'AdminHomework' },
  timetable: { route: 'AdminTimetable' },
  arrangement: { route: 'AdminArrangement' },
  announcement: { route: 'AdminAnnouncement' },
  calender: { route: 'AdminCalendar' },
  syllabus: { route: 'AdminSyllabus' },
  content: { route: 'AdminContent' },
  quiz: { route: 'AdminQuiz' },
  book: { route: 'AdminBook' },
  enquiries: { route: 'AdminEnquiries' },
  'id-card': { route: 'AdminIdCard' },
  lists: { route: 'AdminLists' },
  exam: { route: 'AdminExam' },
  'admit-card': { route: 'AdminAdmitCard' },
  performance: { route: 'AdminPerformance' },
  'exam-copy': { route: 'AdminExamCopy' },
  'report-card': { route: 'AdminReportCard' },
  'tc-certificate': { route: 'AdminTcCertificate' },
  more: { route: 'AdminMore' },
};

/** Opens a module from anywhere inside the admin drawer. */
export const openAdminModule = (
  navigation: any,
  module: Pick<AdminModule, 'key' | 'label'>,
) => {
  const target = ADMIN_MODULE_TARGETS[module.key];
  if (target) {
    navigation.navigate(target.route, target.params);
    return;
  }
  AppAlert.alert(module.label, 'This module is coming soon to the admin app.');
};

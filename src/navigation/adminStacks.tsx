import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Students
import AdminStudentsScreen from '../screens/admin/AdminStudentsScreen';
import AdminStudentSectionsScreen from '../screens/admin/AdminStudentSectionsScreen';
import AdminStudentsListScreen from '../screens/admin/AdminStudentsListScreen';
import AdminStudentDetailScreen from '../screens/admin/AdminStudentDetailScreen';
import AdminStudentFormScreen from '../screens/admin/AdminStudentFormScreen';
import FeeImageScreen from '../screens/fees/FeeImageScreen';
// Teachers
import AdminTeachersScreen from '../screens/admin/AdminTeachersScreen';
import AdminTeacherDetailScreen from '../screens/admin/AdminTeacherDetailScreen';
import AdminTeacherFormScreen from '../screens/admin/AdminTeacherFormScreen';
// Attendance
import AdminAttendanceScreen from '../screens/admin/AdminAttendanceScreen';
import AdminTeacherAttendanceScreen from '../screens/admin/AdminTeacherAttendanceScreen';
import AdminStudentAttendanceScreen from '../screens/admin/AdminStudentAttendanceScreen';
import AdminAttendanceMarkScreen from '../screens/admin/AdminAttendanceMarkScreen';
import AdminClassTeachersScreen from '../screens/admin/AdminClassTeachersScreen';
import AdminClassTeacherFormScreen from '../screens/admin/AdminClassTeacherFormScreen';
// Standard (classes / sections / subjects)
import AdminStandardScreen from '../screens/admin/AdminStandardScreen';
import AdminStandardDetailScreen from '../screens/admin/AdminStandardDetailScreen';
import AdminStandardFormScreen from '../screens/admin/AdminStandardFormScreen';
// Announcement
import AdminAnnouncementScreen from '../screens/admin/AdminAnnouncementScreen';
import AdminAnnouncementDetailScreen from '../screens/admin/AdminAnnouncementDetailScreen';
import AdminAnnouncementFormScreen from '../screens/admin/AdminAnnouncementFormScreen';
// Calendar
import AdminCalendarScreen from '../screens/admin/AdminCalendarScreen';
import AdminCalendarDetailScreen from '../screens/admin/AdminCalendarDetailScreen';
import AdminCalendarFormScreen from '../screens/admin/AdminCalendarFormScreen';
import AdminCalendarYearScreen from '../screens/admin/AdminCalendarYearScreen';
// Transportation
import AdminTransportScreen from '../screens/admin/AdminTransportScreen';
import AdminTransportRoutesScreen from '../screens/admin/AdminTransportRoutesScreen';
import AdminTransportRouteScreen from '../screens/admin/AdminTransportRouteScreen';
import AdminTransportRouteFormScreen from '../screens/admin/AdminTransportRouteFormScreen';
import AdminTransportDriversScreen from '../screens/admin/AdminTransportDriversScreen';
import AdminTransportDriverScreen from '../screens/admin/AdminTransportDriverScreen';
import AdminTransportDriverFormScreen from '../screens/admin/AdminTransportDriverFormScreen';
import AdminTransportStudentsScreen from '../screens/admin/AdminTransportStudentsScreen';
import AdminTransportStudentFeeScreen from '../screens/admin/AdminTransportStudentFeeScreen';
import AdminTransportMonthsScreen from '../screens/admin/AdminTransportMonthsScreen';
import TransportReceiptScreen from '../screens/transport/TransportReceiptScreen';
import AdminLedgerScreen from '../screens/admin/AdminLedgerScreen';
import AdminLedgerFormScreen from '../screens/admin/AdminLedgerFormScreen';
import AdminPayrollScreen from '../screens/admin/AdminPayrollScreen';
import AdminPayrollEmployeesScreen from '../screens/admin/AdminPayrollEmployeesScreen';
import AdminPayrollEmployeeScreen from '../screens/admin/AdminPayrollEmployeeScreen';
import AdminPayrollEmployeeFormScreen from '../screens/admin/AdminPayrollEmployeeFormScreen';
import AdminPayrollAttendanceScreen from '../screens/admin/AdminPayrollAttendanceScreen';
import AdminPayrollCalendarScreen from '../screens/admin/AdminPayrollCalendarScreen';
import AdminPayrollSalaryScreen from '../screens/admin/AdminPayrollSalaryScreen';
import AdminPayrollPayScreen from '../screens/admin/AdminPayrollPayScreen';
import AdminPayrollPaymentsScreen from '../screens/admin/AdminPayrollPaymentsScreen';
// Fees
import AdminFeesScreen from '../screens/admin/AdminFeesScreen';
import AdminFeeStudentsScreen from '../screens/admin/AdminFeeStudentsScreen';
import AdminFeeStudentScreen from '../screens/admin/AdminFeeStudentScreen';
import AdminFeeCollectScreen from '../screens/admin/AdminFeeCollectScreen';
import AdminFeePaymentsScreen from '../screens/admin/AdminFeePaymentsScreen';
import AdminFeeAnalyticsScreen from '../screens/admin/AdminFeeAnalyticsScreen';
import AdminFeeQrScreen from '../screens/admin/AdminFeeQrScreen';
import AdminFeeQrReviewScreen from '../screens/admin/AdminFeeQrReviewScreen';
// Enquiries
import AdminEnquiriesScreen from '../screens/admin/AdminEnquiriesScreen';
import AdminEnquiryDetailScreen from '../screens/admin/AdminEnquiryDetailScreen';
import AdminEnquiryReplyScreen from '../screens/admin/AdminEnquiryReplyScreen';
// Syllabus
import AdminSyllabusScreen from '../screens/admin/AdminSyllabusScreen';
import AdminSyllabusChapterFormScreen from '../screens/admin/AdminSyllabusChapterFormScreen';
import AdminSyllabusTopicFormScreen from '../screens/admin/AdminSyllabusTopicFormScreen';
// Content
import AdminContentScreen from '../screens/admin/AdminContentScreen';
import AdminContentFormScreen from '../screens/admin/AdminContentFormScreen';
// Quiz
import AdminQuizScreen from '../screens/admin/AdminQuizScreen';
import AdminQuizFormScreen from '../screens/admin/AdminQuizFormScreen';
// Book
import AdminBookScreen from '../screens/admin/AdminBookScreen';
import AdminBookFormScreen from '../screens/admin/AdminBookFormScreen';
// More
import AdminMoreScreen from '../screens/admin/AdminMoreScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminUserDetailScreen from '../screens/admin/AdminUserDetailScreen';
import AdminAdmissionsScreen from '../screens/admin/AdminAdmissionsScreen';
import AdminAdmissionDetailScreen from '../screens/admin/AdminAdmissionDetailScreen';
import AdminListsScreen from '../screens/admin/AdminListsScreen';
import AdminRateLmsScreen from '../screens/admin/AdminRateLmsScreen';
// Exam
import AdminExamScreen from '../screens/admin/AdminExamScreen';
import AdminExamFormScreen from '../screens/admin/AdminExamFormScreen';
import AdminExamSyllabusFormScreen from '../screens/admin/AdminExamSyllabusFormScreen';
// ID Card
import AdminIdCardScreen from '../screens/admin/AdminIdCardScreen';
import AdminIdCardGenerateScreen from '../screens/admin/AdminIdCardGenerateScreen';
import AdminIdCardEditScreen from '../screens/admin/AdminIdCardEditScreen';
import AdminIdCardViewScreen from '../screens/admin/AdminIdCardViewScreen';
// Performance & Exam Copy
import AdminPerformanceScreen from '../screens/admin/AdminPerformanceScreen';
import AdminExamCopyScreen from '../screens/admin/AdminExamCopyScreen';
import AdminExamCopyDetailScreen from '../screens/admin/AdminExamCopyDetailScreen';

// Each admin section that has list → detail → form/reply screens gets its own
// native stack. This gives correct, isolated back navigation (a "Back" inside a
// flow stays within that flow instead of wandering across the shared drawer
// history). The drawer registers each stack under the section's route name.
const Stack = createNativeStackNavigator();
const opts = { headerShown: false } as const;

export const AdminStudentsStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminStudentsHome" component={AdminStudentsScreen} />
    <Stack.Screen name="AdminStudentSections" component={AdminStudentSectionsScreen} />
    <Stack.Screen name="AdminStudentsList" component={AdminStudentsListScreen} />
    <Stack.Screen name="AdminStudentDetail" component={AdminStudentDetailScreen} />
    <Stack.Screen name="AdminStudentForm" component={AdminStudentFormScreen} />
    {/* A student's photo, large, to pinch or double-tap to zoom */}
    <Stack.Screen name="AdminStudentPhoto" component={FeeImageScreen} />
  </Stack.Navigator>
);

export const AdminTeachersStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminTeachersHome" component={AdminTeachersScreen} />
    <Stack.Screen name="AdminTeacherDetail" component={AdminTeacherDetailScreen} />
    <Stack.Screen name="AdminTeacherForm" component={AdminTeacherFormScreen} />
  </Stack.Navigator>
);

export const AdminAttendanceStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminAttendanceHome" component={AdminAttendanceScreen} />
    <Stack.Screen name="AdminTeacherAttendance" component={AdminTeacherAttendanceScreen} />
    <Stack.Screen name="AdminStudentAttendance" component={AdminStudentAttendanceScreen} />
    <Stack.Screen name="AdminAttendanceMark" component={AdminAttendanceMarkScreen} />
    <Stack.Screen name="AdminClassTeachers" component={AdminClassTeachersScreen} />
    <Stack.Screen name="AdminClassTeacherForm" component={AdminClassTeacherFormScreen} />
  </Stack.Navigator>
);

export const AdminStandardStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminStandardHome" component={AdminStandardScreen} />
    <Stack.Screen name="AdminStandardDetail" component={AdminStandardDetailScreen} />
    <Stack.Screen name="AdminStandardForm" component={AdminStandardFormScreen} />
  </Stack.Navigator>
);

export const AdminAnnouncementStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminAnnouncementHome" component={AdminAnnouncementScreen} />
    <Stack.Screen name="AdminAnnouncementDetail" component={AdminAnnouncementDetailScreen} />
    <Stack.Screen name="AdminAnnouncementForm" component={AdminAnnouncementFormScreen} />
  </Stack.Navigator>
);

export const AdminCalendarStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminCalendarHome" component={AdminCalendarScreen} />
    <Stack.Screen name="AdminCalendarDetail" component={AdminCalendarDetailScreen} />
    <Stack.Screen name="AdminCalendarForm" component={AdminCalendarFormScreen} />
    <Stack.Screen name="AdminCalendarYear" component={AdminCalendarYearScreen} />
  </Stack.Navigator>
);

export const AdminTransportStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminTransportHome" component={AdminTransportScreen} />
    <Stack.Screen name="AdminTransportRoutes" component={AdminTransportRoutesScreen} />
    <Stack.Screen name="AdminTransportRoute" component={AdminTransportRouteScreen} />
    <Stack.Screen name="AdminTransportRouteForm" component={AdminTransportRouteFormScreen} />
    <Stack.Screen name="AdminTransportDrivers" component={AdminTransportDriversScreen} />
    <Stack.Screen name="AdminTransportDriver" component={AdminTransportDriverScreen} />
    <Stack.Screen name="AdminTransportDriverForm" component={AdminTransportDriverFormScreen} />
    {/* Transport Students and Fee Summary are one page, told apart by name */}
    <Stack.Screen name="AdminTransportStudents" component={AdminTransportStudentsScreen} />
    <Stack.Screen name="AdminTransportFees" component={AdminTransportStudentsScreen} />
    <Stack.Screen name="AdminTransportStudentFee" component={AdminTransportStudentFeeScreen} />
    <Stack.Screen name="AdminTransportMonths" component={AdminTransportMonthsScreen} />
    <Stack.Screen name="AdminTransportReceipt" component={TransportReceiptScreen} />
  </Stack.Navigator>
);

export const AdminLedgerStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminLedgerHome" component={AdminLedgerScreen} />
    <Stack.Screen name="AdminLedgerForm" component={AdminLedgerFormScreen} />
    {/* The statement PDF, in the receipt viewer */}
    <Stack.Screen name="AdminLedgerStatement" component={TransportReceiptScreen} />
  </Stack.Navigator>
);

export const AdminPayrollStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminPayrollHome" component={AdminPayrollScreen} />
    <Stack.Screen name="AdminPayrollEmployees" component={AdminPayrollEmployeesScreen} />
    <Stack.Screen name="AdminPayrollEmployee" component={AdminPayrollEmployeeScreen} />
    <Stack.Screen name="AdminPayrollEmployeeForm" component={AdminPayrollEmployeeFormScreen} />
    <Stack.Screen name="AdminPayrollAttendance" component={AdminPayrollAttendanceScreen} />
    <Stack.Screen name="AdminPayrollCalendar" component={AdminPayrollCalendarScreen} />
    <Stack.Screen name="AdminPayrollSalary" component={AdminPayrollSalaryScreen} />
    <Stack.Screen name="AdminPayrollPay" component={AdminPayrollPayScreen} />
    <Stack.Screen name="AdminPayrollPayments" component={AdminPayrollPaymentsScreen} />
  </Stack.Navigator>
);

export const AdminFeesStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminFeesHome" component={AdminFeesScreen} />
    <Stack.Screen name="AdminFeeStudents" component={AdminFeeStudentsScreen} />
    <Stack.Screen name="AdminFeeStudent" component={AdminFeeStudentScreen} />
    <Stack.Screen name="AdminFeeCollect" component={AdminFeeCollectScreen} />
    <Stack.Screen name="AdminFeePayments" component={AdminFeePaymentsScreen} />
    <Stack.Screen name="AdminFeeAnalytics" component={AdminFeeAnalyticsScreen} />
    <Stack.Screen name="AdminFeeQr" component={AdminFeeQrScreen} />
    <Stack.Screen name="AdminFeeQrReview" component={AdminFeeQrReviewScreen} />
  </Stack.Navigator>
);

export const AdminEnquiriesStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminEnquiriesHome" component={AdminEnquiriesScreen} />
    <Stack.Screen name="AdminEnquiryDetail" component={AdminEnquiryDetailScreen} />
    <Stack.Screen name="AdminEnquiryReply" component={AdminEnquiryReplyScreen} />
  </Stack.Navigator>
);

export const AdminSyllabusStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminSyllabusHome" component={AdminSyllabusScreen} />
    <Stack.Screen name="AdminSyllabusChapterForm" component={AdminSyllabusChapterFormScreen} />
    <Stack.Screen name="AdminSyllabusTopicForm" component={AdminSyllabusTopicFormScreen} />
  </Stack.Navigator>
);

export const AdminContentStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminContentHome" component={AdminContentScreen} />
    <Stack.Screen name="AdminContentForm" component={AdminContentFormScreen} />
  </Stack.Navigator>
);

export const AdminQuizStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminQuizHome" component={AdminQuizScreen} />
    <Stack.Screen name="AdminQuizForm" component={AdminQuizFormScreen} />
  </Stack.Navigator>
);

export const AdminBookStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminBookHome" component={AdminBookScreen} />
    <Stack.Screen name="AdminBookForm" component={AdminBookFormScreen} />
  </Stack.Navigator>
);

export const AdminMoreStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminMoreHome" component={AdminMoreScreen} />
    <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
    <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
    <Stack.Screen name="AdminAdmissions" component={AdminAdmissionsScreen} />
    <Stack.Screen name="AdminAdmissionDetail" component={AdminAdmissionDetailScreen} />
    <Stack.Screen name="AdminLists" component={AdminListsScreen} />
    <Stack.Screen name="AdminRateLms" component={AdminRateLmsScreen} />
  </Stack.Navigator>
);

export const AdminExamStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminExamHome" component={AdminExamScreen} />
    <Stack.Screen name="AdminExamForm" component={AdminExamFormScreen} />
    <Stack.Screen name="AdminExamSyllabusForm" component={AdminExamSyllabusFormScreen} />
  </Stack.Navigator>
);

export const AdminIdCardStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminIdCardHome" component={AdminIdCardScreen} />
    <Stack.Screen name="AdminIdCardGenerate" component={AdminIdCardGenerateScreen} />
    <Stack.Screen name="AdminIdCardEdit" component={AdminIdCardEditScreen} />
    <Stack.Screen name="AdminIdCardView" component={AdminIdCardViewScreen} />
  </Stack.Navigator>
);

export const AdminPerformanceStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminPerformanceHome" component={AdminPerformanceScreen} />
  </Stack.Navigator>
);

export const AdminExamCopyStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminExamCopyHome" component={AdminExamCopyScreen} />
    <Stack.Screen name="AdminExamCopyDetail" component={AdminExamCopyDetailScreen} />
  </Stack.Navigator>
);

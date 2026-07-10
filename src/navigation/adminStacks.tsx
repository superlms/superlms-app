import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Students
import AdminStudentsScreen from '../screens/admin/AdminStudentsScreen';
import AdminStudentDetailScreen from '../screens/admin/AdminStudentDetailScreen';
import AdminStudentFormScreen from '../screens/admin/AdminStudentFormScreen';
// Teachers
import AdminTeachersScreen from '../screens/admin/AdminTeachersScreen';
import AdminTeacherDetailScreen from '../screens/admin/AdminTeacherDetailScreen';
import AdminTeacherFormScreen from '../screens/admin/AdminTeacherFormScreen';
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
import AdminCalendarMonthScreen from '../screens/admin/AdminCalendarMonthScreen';
import AdminCalendarDayScreen from '../screens/admin/AdminCalendarDayScreen';
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
    <Stack.Screen name="AdminStudentDetail" component={AdminStudentDetailScreen} />
    <Stack.Screen name="AdminStudentForm" component={AdminStudentFormScreen} />
  </Stack.Navigator>
);

export const AdminTeachersStack = () => (
  <Stack.Navigator screenOptions={opts}>
    <Stack.Screen name="AdminTeachersHome" component={AdminTeachersScreen} />
    <Stack.Screen name="AdminTeacherDetail" component={AdminTeacherDetailScreen} />
    <Stack.Screen name="AdminTeacherForm" component={AdminTeacherFormScreen} />
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
    <Stack.Screen name="AdminCalendarMonth" component={AdminCalendarMonthScreen} />
    <Stack.Screen name="AdminCalendarDay" component={AdminCalendarDayScreen} />
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

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

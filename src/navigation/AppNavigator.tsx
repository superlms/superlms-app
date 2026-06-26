import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DrawerNavigator from './DrawerNavigator';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import SplashScreen from '../screens/splash/SplashScreen';
import AboutAppScreen from '../screens/more/AboutAppScreen';
import SchoolInfoScreen from '../screens/more/SchoolInfoScreen';
import RulesRegulationsScreen from '../screens/more/RulesRegulationsScreen';
import TermsConditionsScreen from '../screens/more/TermsConditionsScreen';
import PrivacyPolicyScreen from '../screens/more/PrivacyPolicyScreen';
import TermsOfUseScreen from '../screens/more/TermsOfUseScreen';
import StudentProfileScreen from '../screens/profile/StudentProfileScreen';
import TeacherProfileScreen from '../screens/profile/TeacherProfileScreen';
import ViewAnnouncementScreen from '../screens/announcement/ViewAnnouncementScreen';
import ViewEventScreen from '../screens/calendar/ViewEventScreen';
import ContactSchoolScreen from '../screens/contactSchool/ContactSchoolScreen';
import ViewQueryScreen from '../screens/contactSchool/ViewQueryScreen';
import ChatsScreen from '../screens/chats/ChatsScreen';
import ChatsListScreen from '../screens/chats/ChatsListScreen';
import InstructorProfileScreen from '../screens/instructor/InstructorProfileScreen';
import SubjectDetailsScreen from '../screens/subjects/SubjectDetailsScreen';
import ViewContentScreen from '../screens/content/ViewContentScreen';
import EditTopicContentScreen from '../screens/content/EditTopicContentScreen';
import ChangePasswordScreen from '../screens/setting/ChangePasswordScreen';
import ExamsScreen from '../screens/exam/ExamsScreen';
import TeacherExamsScreen from '../screens/exam/TeacherExamsScreen';
import ExamDetailScreen from '../screens/exam/ExamDetailScreen';
import AdmitCardScreen from '../screens/exam/AdmitCardScreen';
import SeatingPlanScreen from '../screens/exam/SeatingPlanScreen';
import ExamCopyScreen from '../screens/exam/ExamCopyScreen';
import ReportCardScreen from '../screens/exam/ReportCardScreen';
import UploadCopyScreen from '../screens/teacherUpload/UploadCopyScreen';
import UploadMarksScreen from '../screens/teacherUpload/UploadMarksScreen';
import ManageEntriesScreen from '../screens/teacherUpload/ManageEntriesScreen';
import AddHomeworkScreen from '../screens/homework/AddHomeworkScreen';
import ManageSyllabusScreen from '../screens/syllabus/ManageSyllabusScreen';
import ManageQuizScreen from '../screens/quiz/ManageQuizScreen';
import AttemptQuizScreen from '../screens/quiz/AttemptQuizScreen';
import NotificationScreen from '../screens/notification/NotificationScreen';
import BookReaderScreen from '../screens/books/BookReaderScreen';
import PayAmountScreen from '../screens/fees/PayAmountScreen';
import TransportPayScreen from '../screens/fees/TransportPayScreen';
import AdminProfileScreen from '../screens/admin/AdminProfileScreen';
import PanelDrawerNavigator from './PanelDrawerNavigator';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="Splash"
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      {/* Onboarding */}
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />

      {/* Auth Flow — single global login (role auto-detected from credentials) */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

      {/* Profile */}
      <Stack.Screen name="StudentProfile" component={StudentProfileScreen} />
      <Stack.Screen name="TeacherProfile" component={TeacherProfileScreen} />

      {/* More */}
      <Stack.Screen name="AboutAppMore" component={AboutAppScreen} />
      <Stack.Screen name="SchoolInfoMore" component={SchoolInfoScreen} />
      <Stack.Screen
        name="RulesRegulationsMore"
        component={RulesRegulationsScreen}
      />
      <Stack.Screen
        name="TermsConditionsMore"
        component={TermsConditionsScreen}
      />
      <Stack.Screen name="PrivacyPolicyMore" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsOfUseMore" component={TermsOfUseScreen} />

      {/* Announcement */}
      <Stack.Screen
        name="ViewAnnouncement"
        component={ViewAnnouncementScreen}
      />

      {/* Calendar */}
      <Stack.Screen name="ViewEvent" component={ViewEventScreen} />

      {/* Contact School */}
      <Stack.Screen name="NewQuery" component={ContactSchoolScreen} />
      <Stack.Screen name="ViewQuery" component={ViewQueryScreen} />

      {/* Chats */}
      <Stack.Screen name="ChatsList" component={ChatsListScreen} />
      <Stack.Screen name="UserChats" component={ChatsScreen} />

      {/* Instructor */}
      <Stack.Screen name="InstructorProfile" component={InstructorProfileScreen} />

      {/* Subjects */}
      <Stack.Screen name="SubjectDetails" component={SubjectDetailsScreen} />

      {/* Study Content */}
      <Stack.Screen name="ViewContent" component={ViewContentScreen} />
      <Stack.Screen name="EditTopicContent" component={EditTopicContentScreen} />

      {/* Settings */}
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />

      {/* Exam */}
      <Stack.Screen name="ExamsScreen" component={ExamsScreen} />
      <Stack.Screen name="TeacherExamsScreen" component={TeacherExamsScreen} />
      <Stack.Screen name="ExamDetail" component={ExamDetailScreen} />
      <Stack.Screen name="AdmitCardScreen" component={AdmitCardScreen} />
      <Stack.Screen name="SeatingPlanScreen" component={SeatingPlanScreen} />
      <Stack.Screen name="ExamCopyScreen" component={ExamCopyScreen} />
      <Stack.Screen name="ReportCardScreen" component={ReportCardScreen} />
      <Stack.Screen name="UploadCopyScreen" component={UploadCopyScreen} />
      <Stack.Screen name="UploadMarksScreen" component={UploadMarksScreen} />
      <Stack.Screen name="ManageEntries" component={ManageEntriesScreen} />
      <Stack.Screen name="AddHomework" component={AddHomeworkScreen} />
      <Stack.Screen name="ManageSyllabus" component={ManageSyllabusScreen} />

      {/* Quiz */}
      <Stack.Screen name="ManageQuiz" component={ManageQuizScreen} />
      <Stack.Screen name="AttemptQuiz" component={AttemptQuizScreen} />

      {/* Notifications */}
      <Stack.Screen name="Notifications" component={NotificationScreen} />

      {/* In-app PDF reader (books) */}
      <Stack.Screen name="BookReader" component={BookReaderScreen} />

      {/* Fee payment */}
      <Stack.Screen name="PayAmount" component={PayAmountScreen} />
      <Stack.Screen name="TransportPay" component={TransportPayScreen} />

      {/* School Admin (Phase 0) — dashboard + slide-out sidebar */}
      <Stack.Screen
        name="AdminDashboard"
        component={PanelDrawerNavigator}
        initialParams={{ panel: 'admin' }}
      />
      <Stack.Screen name="AdminProfile" component={AdminProfileScreen} />

      {/* Accounts (Phase 0) — dashboard + slide-out sidebar */}
      <Stack.Screen
        name="AccountsDashboard"
        component={PanelDrawerNavigator}
        initialParams={{ panel: 'accounts' }}
      />

      {/* Main App Flow */}
      <Stack.Screen name="DrawerRoot" component={DrawerNavigator} />
    </Stack.Navigator>
  );
};

export default AppNavigator;

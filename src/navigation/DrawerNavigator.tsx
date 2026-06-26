import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  activateAccount,
  getActiveAccount,
  getActiveAccountId,
  removeAccount,
} from '../utils/accountStore';
import { revokeAccountToken } from '../api/switchAccountApi';
import TabNavigator from './TabNavigator';
import SettingsScreen from '../screens/setting/SettingsScreen';
import { theme, onThemeChange } from '../utils/theme';
import VectorIcon from '../components/VectorIcon';
import MoreScreen from '../screens/more/MoreScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import AnnouncementScreen from '../screens/announcement/AnnouncementScreen';
import PastQueriesScreen from '../screens/contactSchool/PastQueriesScreen';
import BooksScreen from '../screens/books/BooksScreen';
import InstructorScreen from '../screens/instructor/InstructorScreen';
import AttendanceScreen from '../screens/attendance/AttendanceScreen';
import FeesScreen from '../screens/fees/FeesScreen';
import ChatsListScreen from '../screens/chats/ChatsListScreen';
import TransportScreen from '../screens/transport/TransportScreen';
import TeacherSyllabusScreen from '../screens/syllabus/TeacherSyllabusScreen';
import StudentSyllabusScreen from '../screens/syllabus/StudentSyllabusScreen';
import SubjectsScreen from '../screens/subjects/SubjectsScreen';
import StudentTimetableScreen from '../screens/timetable/StudentTimetableScreen';
import TeacherTImetableScreen from '../screens/timetable/TeacherTImetableScreen';
import ExamMainScreen from '../screens/exam/ExamMainScreen';
import TeacherQuizScreen from '../screens/quiz/TeacherQuizScreen';
import StudentQuizScreen from '../screens/quiz/StudentQuizScreen';
import StudentHomeworkScreen from '../screens/homework/StudentHomeworkScreen';
import TeacherHomeworkScreen from '../screens/homework/TeacherHomeworkScreen';
import TeacherContentScreen from '../screens/content/TeacherContentScreen';
import StudentContentScreen from '../screens/content/StudentContentScreen';
import markAttendanceScreen from '../screens/markAttendance/markAttendanceScreen';
import TeacherExamsScreen from '../screens/exam/TeacherExamsScreen';
import PerformanceScreen from '../screens/performance/PerformanceScreen';
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen';
import IDCardScreen from '../screens/idCard/IDCardScreen';
import UploadCopyScreen from '../screens/teacherUpload/UploadCopyScreen';
import UploadMarksScreen from '../screens/teacherUpload/UploadMarksScreen';

const Drawer = createDrawerNavigator();

type DrawerRole = 'student' | 'teacher';

type MenuItem = {
  name: string;
  label: string;
  icon: string;
  iconSet?: string;
  params?: Record<string, string>;
  nestedRoute?: string;
};

const DrawerNavigator = ({ route }: any) => {
  const role: DrawerRole =
    route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  const menuItems: MenuItem[] = useMemo(() => {
    const studentMenuItems: MenuItem[] = [
      { name: 'MainTabs', label: 'Dashboard', icon: 'grid-outline' },
      { name: 'Analytics', label: 'Analytics', icon: 'analytics-outline' },
      { name: 'Fees', label: 'Fees', icon: 'cash-outline' },
      {
        name: 'Announcement',
        label: 'Announcement',
        icon: 'megaphone-outline',
      },
      { name: 'Calendar', label: 'Calendar', icon: 'calendar-outline' },
      { name: 'Transport', label: 'Transport', icon: 'bus-outline' },
      { name: 'Homework', label: 'Homework', icon: 'create-outline' },
      { name: 'Timetable', label: 'Timetable', icon: 'time-outline' },
      { name: 'Attendance', label: 'Attendance', icon: 'clipboard-outline' },
      {
        name: 'Subjects',
        label: 'Subjects',
        icon: 'albums-outline',
      },
      { name: 'Syllabus', label: 'Syllabus', icon: 'document-text-outline' },
      { name: 'Content', label: 'Content', icon: 'folder-outline' },
      { name: 'Quiz', label: 'Quiz', icon: 'help-circle-outline' },
      {
        name: 'Book',
        label: 'Book',
        icon: 'book-outline',
      },
      { name: 'Instructor', label: 'Instructor', icon: 'person-outline' },
      { name: 'IDCard', label: 'ID Card', icon: 'id-card-outline' },
      { name: 'Chats', label: 'Chats', icon: 'chatbubbles-outline' },
      { name: 'Exams', label: 'Exams', icon: 'school-outline' },
      {
        name: 'Performance',
        label: 'Performance',
        icon: 'speedometer-outline',
      },
      { name: 'ContactSchool', label: 'Contact School', icon: 'call-outline' },
      { name: 'Settings', label: 'Settings', icon: 'settings-outline' },
      { name: 'More', label: 'More', icon: 'ellipsis-horizontal-outline' },
    ];

    const teacherMenuItems: MenuItem[] = [
      { name: 'MainTabs', label: 'Dashboard', icon: 'grid-outline' },
      { name: 'Analytics', label: 'Analytics', icon: 'analytics-outline' },
      {
        name: 'Announcement',
        label: 'Announcement',
        icon: 'megaphone-outline',
      },
      { name: 'Calendar', label: 'Calendar', icon: 'calendar-outline' },
      { name: 'Homework', label: 'Homework', icon: 'create-outline' },
      { name: 'Timetable', label: 'Timetable', icon: 'time-outline' },
      {
        name: 'MarkAttendance',
        label: 'Mark Attendance',
        icon: 'checkbox-outline',
      },
      { name: 'Attendance', label: 'Attendance', icon: 'clipboard-outline' },
      {
        name: 'Subjects',
        label: 'Subjects',
        icon: 'albums-outline',
      },
      { name: 'Syllabus', label: 'Syllabus', icon: 'document-text-outline' },
      { name: 'Content', label: 'Content', icon: 'folder-outline' },
      { name: 'Quiz', label: 'Quiz', icon: 'help-circle-outline' },
      {
        name: 'Book',
        label: 'Book',
        icon: 'book-outline',
      },
      { name: 'IDCard', label: 'ID Card', icon: 'id-card-outline' },
      { name: 'Chats', label: 'Chats', icon: 'chatbubbles-outline' },
      { name: 'Exams', label: 'Exams', icon: 'school-outline' },
      {
        name: 'UploadMarks',
        label: 'Upload Marks',
        icon: 'cloud-upload-outline',
      },
      {
        name: 'UploadCopy',
        label: 'Upload Copy',
        icon: 'document-attach-outline',
      },
      { name: 'ContactSchool', label: 'Contact School', icon: 'call-outline' },
      { name: 'Settings', label: 'Settings', icon: 'settings-outline' },
      { name: 'More', label: 'More', icon: 'ellipsis-horizontal-outline' },
    ];

    return role === 'teacher' ? teacherMenuItems : studentMenuItems;
  }, [role]);

  const CustomDrawer = (props: any) => {
    const { navigation, state } = props;
    const [logoutVisible, setLogoutVisible] = useState(false);
    const [org, setOrg] = useState<{ name?: string; logo?: string | null } | null>(null);

    useEffect(() => {
      getActiveAccount()
        .then(a => setOrg(a?.organization ?? null))
        .catch(() => setOrg(null));
    }, []);

    const doLogout = async () => {
      setLogoutVisible(false);
      const parentNav = navigation.getParent?.();
      const rootNav = parentNav ?? navigation;

      // Only the current account logs out. If the switcher still holds other
      // signed-in accounts, promote one of them and open its dashboard
      // instead of dropping the user back to the select-user screen.
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          try {
            await revokeAccountToken(token); // best-effort
          } catch (e) {
            console.log('[Logout] Token revoke failed:', e);
          }
        }

        const activeId = await getActiveAccountId();
        const remaining =
          activeId != null ? await removeAccount(activeId) : [];
        const next = remaining[0];

        if (next) {
          await activateAccount(next.user_id);
          console.log('[Logout] Switched to account:', next.user_id);
          rootNav.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [
                { name: 'DrawerRoot', params: { userRole: next.user_type } },
              ],
            }),
          );
          return;
        }

        await AsyncStorage.multiRemove([
          'auth_token',
          'user_data',
          'user_role',
          'switch_accounts',
          'switch_active_user_id',
        ]);
        console.log('[Logout] Storage cleared');
      } catch (e) {
        console.log('[Logout] Error:', e);
      }

      rootNav.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        }),
      );
    };

    return (
      <>
        <DrawerContentScrollView
          {...props}
          contentContainerStyle={{ paddingTop: 0, paddingBottom: 0 }}
        >
          <View style={styles.header}>
              {org?.logo ? (
                <Image source={{ uri: org.logo }} style={styles.logoImage} />
              ) : (
                <VectorIcon
                  iconSet="Ionicons"
                  iconName="school"
                  size={56}
                  color={theme.colors.primary}
                />
              )}
            </View>
            <View style={styles.headerDivider} />

            <View style={styles.menu}>
              {menuItems.map((item, index) => {
                const isActive = state.routeNames[state.index] === item.name;

                return (
                  <View key={index}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() =>
                        navigation.navigate(item.name, item.params)
                      }
                      style={[
                        styles.menuItem,
                        {
                          backgroundColor: isActive
                            ? theme.colors.primaryLight
                            : 'transparent',
                        },
                      ]}
                    >
                      <VectorIcon
                        iconSet={item.iconSet || 'Ionicons'}
                        iconName={item.icon}
                        size={20}
                        color={
                          isActive
                            ? theme.colors.primary
                            : theme.colors.textPrimary
                        }
                      />
                      <Text
                        style={[
                          styles.menuText,
                          {
                            color: isActive
                              ? theme.colors.primary
                              : theme.colors.textPrimary,
                            fontWeight: isActive ? '600' : '400',
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                    {index !== menuItems.length - 1 && (
                      <View style={styles.divider} />
                    )}
                  </View>
                );
              })}
            </View>

          <View style={styles.logoutContainer}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={() => setLogoutVisible(true)}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName="log-out-outline"
                size={20}
                color={theme.colors.danger}
              />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </DrawerContentScrollView>

        <Modal
          transparent
          visible={logoutVisible}
          animationType="fade"
          onRequestClose={() => setLogoutVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconWrap}>
                <VectorIcon
                  iconSet="Ionicons"
                  iconName="log-out-outline"
                  size={28}
                  color={theme.colors.danger}
                />
              </View>

              <Text style={styles.modalTitle}>Logout</Text>
              <Text style={styles.modalDesc}>
                Are you sure you want to sign out of your account?
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                  activeOpacity={0.85}
                  onPress={() => setLogoutVisible(false)}
                >
                  <Text style={[styles.modalBtnText, styles.modalBtnGhostText]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnDanger]}
                  activeOpacity={0.9}
                  onPress={doLogout}
                >
                  <Text
                    style={[styles.modalBtnText, styles.modalBtnDangerText]}
                  >
                    Logout
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  };

  return (
    <Drawer.Navigator
      drawerContent={props => <CustomDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: theme.colors.surface,
          width: '70%',
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
        },
        drawerType: 'front',
      }}
    >
      <Drawer.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ title: 'Home' }}
        initialParams={{ userRole: role }}
      />
      <Drawer.Screen
        name="Analytics"
        component={AnalyticsScreen}
        initialParams={{ userRole: role }}
      />
      <Drawer.Screen
        name="Fees"
        component={FeesScreen}
        initialParams={{ title: 'Fees' }}
      />
      <Drawer.Screen
        name="Announcement"
        component={AnnouncementScreen}
        initialParams={{ title: 'Announcement' }}
      />
      <Drawer.Screen
        name="Calendar"
        component={CalendarScreen}
        initialParams={{ title: 'Calendar' }}
      />
      <Drawer.Screen
        name="Transport"
        component={TransportScreen}
        initialParams={{ title: 'Transport' }}
      />
      <Drawer.Screen
        name="Homework"
        component={
          role === 'teacher' ? TeacherHomeworkScreen : StudentHomeworkScreen
        }
        initialParams={{ title: 'Homework' }}
      />
      <Drawer.Screen
        name="Timetable"
        component={
          role === 'teacher' ? TeacherTImetableScreen : StudentTimetableScreen
        }
        initialParams={{ title: 'Timetable' }}
      />
      <Drawer.Screen
        name="MarkAttendance"
        component={markAttendanceScreen}
        initialParams={{ title: 'Mark Attendance' }}
      />
      <Drawer.Screen
        name="Attendance"
        component={AttendanceScreen}
        initialParams={{ title: 'Attendance' }}
      />
      <Drawer.Screen
        name="Subjects"
        component={SubjectsScreen}
        initialParams={{ title: 'Subjects' }}
      />
      <Drawer.Screen
        name="Syllabus"
        component={
          role === 'teacher' ? TeacherSyllabusScreen : StudentSyllabusScreen
        }
        initialParams={{ title: 'Syllabus' }}
      />
      <Drawer.Screen
        name="Content"
        component={
          role === 'teacher' ? TeacherContentScreen : StudentContentScreen
        }
        initialParams={{ title: 'Content' }}
      />
      <Drawer.Screen
        name="Quiz"
        component={role === 'teacher' ? TeacherQuizScreen : StudentQuizScreen}
        initialParams={{ title: 'Quiz' }}
      />
      <Drawer.Screen
        name="Book"
        component={BooksScreen}
        initialParams={{ title: 'Book', userRole: role }}
      />
      <Drawer.Screen
        name="Instructor"
        component={InstructorScreen}
        initialParams={{ title: 'Instructor' }}
      />
      <Drawer.Screen
        name="IDCard"
        component={IDCardScreen}
        initialParams={{ title: 'ID Card', userRole: role }}
      />
      <Drawer.Screen
        name="Chats"
        component={ChatsListScreen}
        initialParams={{ userRole: role }}
      />
      <Drawer.Screen
        name="Exams"
        component={role === 'teacher' ? TeacherExamsScreen : ExamMainScreen}
        initialParams={{ title: 'Exams' }}
      />
      <Drawer.Screen
        name="UploadMarks"
        component={UploadMarksScreen}
        initialParams={{ title: 'Upload Marks' }}
      />
      <Drawer.Screen
        name="UploadCopy"
        component={UploadCopyScreen}
        initialParams={{ title: 'Upload Copy' }}
      />
      <Drawer.Screen
        name="Performance"
        component={PerformanceScreen}
        initialParams={{ title: 'Performance' }}
      />
      <Drawer.Screen name="ContactSchool" component={PastQueriesScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen name="More" component={MoreScreen} />
    </Drawer.Navigator>
  );
};

export default DrawerNavigator;

const __mk_styles = () => StyleSheet.create({
  header: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  headerDivider: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.border,
  },
  logoImage: {
    width: 220,
    height: 104,
    resizeMode: 'contain',
  },
  userName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: theme.spacing.sm,
  },
  menu: {
    marginTop: theme.spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 12,
    marginBottom: 6,
    borderRadius: theme.radius.sm,
  },
  menuText: {
    marginLeft: 20,
    fontSize: 15,
  },
  logoutContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  logoutText: {
    marginLeft: 15,
    fontSize: 14,
    color: theme.colors.danger,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.full,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  modalDesc: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalBtnGhost: {
    backgroundColor: theme.colors.border,
  },
  modalBtnGhostText: {
    color: theme.colors.textPrimary,
  },
  modalBtnDanger: {
    backgroundColor: theme.colors.danger,
  },
  modalBtnDangerText: {
    color: theme.colors.white,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
    // opacity: 0.5,
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });

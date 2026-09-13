import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { BlurView } from '@react-native-community/blur';
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
  // For a glyph that reads small at the usual 20 (the "More" dots).
  iconSize?: number;
  params?: Record<string, string>;
  nestedRoute?: string;
};

// ── Menu ─────────────────────────────────────────────────────────────────────
// One plain list in the order it has always had, with a line between every
// item.
const ITEM = {
  dashboard: { name: 'MainTabs', label: 'Dashboard', icon: 'grid-outline' },
  analytics: { name: 'Analytics', label: 'Analytics', icon: 'analytics-outline' },
  fees: { name: 'Fees', label: 'Fees', icon: 'cash-outline' },
  announcement: { name: 'Announcement', label: 'Announcements', icon: 'megaphone-outline' },
  calendar: { name: 'Calendar', label: 'Calendar', icon: 'calendar-outline' },
  transport: { name: 'Transport', label: 'Transport', icon: 'bus-outline' },
  homework: { name: 'Homework', label: 'Homework', icon: 'create-outline' },
  timetable: { name: 'Timetable', label: 'Timetable', icon: 'time-outline' },
  markAttendance: { name: 'MarkAttendance', label: 'Mark Attendance', icon: 'checkbox-outline' },
  attendance: { name: 'Attendance', label: 'Attendance', icon: 'clipboard-outline' },
  subjects: { name: 'Subjects', label: 'Subjects', icon: 'albums-outline' },
  syllabus: { name: 'Syllabus', label: 'Syllabus', icon: 'document-text-outline' },
  content: { name: 'Content', label: 'Content', icon: 'folder-outline' },
  quiz: { name: 'Quiz', label: 'Quiz', icon: 'help-circle-outline' },
  books: { name: 'Book', label: 'Books', icon: 'book-outline' },
  instructor: { name: 'Instructor', label: 'Instructors', icon: 'person-outline' },
  idCard: { name: 'IDCard', label: 'ID Card', icon: 'id-card-outline' },
  chats: { name: 'Chats', label: 'Chats', icon: 'chatbubbles-outline' },
  exams: { name: 'Exams', label: 'Exams', icon: 'school-outline' },
  performance: { name: 'Performance', label: 'Performance', icon: 'speedometer-outline' },
  uploadMarks: { name: 'UploadMarks', label: 'Upload Marks', icon: 'cloud-upload-outline' },
  uploadCopy: { name: 'UploadCopy', label: 'Upload Copy', icon: 'document-attach-outline' },
  contact: { name: 'ContactSchool', label: 'Contact School', icon: 'call-outline' },
  settings: { name: 'Settings', label: 'Settings', icon: 'settings-outline' },
  more: { name: 'More', label: 'More', icon: 'ellipsis-horizontal-outline', iconSize: 26 },
} satisfies Record<string, MenuItem>;

const STUDENT_MENU: MenuItem[] = [
  ITEM.dashboard,
  ITEM.analytics,
  ITEM.fees,
  ITEM.announcement,
  ITEM.calendar,
  ITEM.transport,
  ITEM.homework,
  ITEM.timetable,
  ITEM.attendance,
  ITEM.subjects,
  ITEM.syllabus,
  ITEM.content,
  ITEM.quiz,
  ITEM.books,
  ITEM.instructor,
  ITEM.idCard,
  ITEM.chats,
  ITEM.exams,
  ITEM.performance,
  ITEM.contact,
  ITEM.settings,
  ITEM.more,
];

const TEACHER_MENU: MenuItem[] = [
  ITEM.dashboard,
  ITEM.analytics,
  ITEM.announcement,
  ITEM.calendar,
  ITEM.homework,
  ITEM.timetable,
  ITEM.markAttendance,
  ITEM.attendance,
  ITEM.subjects,
  ITEM.syllabus,
  ITEM.content,
  ITEM.quiz,
  ITEM.books,
  ITEM.idCard,
  ITEM.chats,
  ITEM.exams,
  ITEM.uploadMarks,
  ITEM.uploadCopy,
  ITEM.contact,
  ITEM.settings,
  ITEM.more,
];

const DrawerNavigator = ({ route }: any) => {
  const role: DrawerRole =
    route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  const menuItems: MenuItem[] = useMemo(
    () => (role === 'teacher' ? TEACHER_MENU : STUDENT_MENU),
    [role],
  );

  const CustomDrawer = (props: any) => {
    const { navigation, state } = props;
    const [logoutVisible, setLogoutVisible] = useState(false);

    // Logout dialog: the blurred backdrop and the card fade in together on our
    // own animation (after the first frame), so nothing pops in before the popup.
    const logoutAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (!logoutVisible) return;
      logoutAnim.setValue(0);
      const frame = requestAnimationFrame(() => {
        Animated.timing(logoutAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      });
      return () => cancelAnimationFrame(frame);
    }, [logoutVisible, logoutAnim]);

    const closeLogout = () => {
      Animated.timing(logoutAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => setLogoutVisible(false));
    };
    const [org, setOrg] = useState<{ name?: string; logo?: string | null } | null>(null);
    const [logoBroken, setLogoBroken] = useState(false);

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

    const activeRoute = state.routeNames[state.index];

    return (
      <>
        <DrawerContentScrollView
          {...props}
          contentContainerStyle={styles.drawerScroll}
        >
          {/* The school */}
          <View style={styles.header}>
            {org?.logo && !logoBroken ? (
              <Image
                source={{ uri: org.logo }}
                style={styles.logoImage}
                onError={() => setLogoBroken(true)}
              />
            ) : (
              <View style={styles.schoolRow}>
                <VectorIcon iconSet="Ionicons" iconName="school-outline" size={22} color={theme.colors.textSecondary} />
                <Text style={styles.schoolName} numberOfLines={2}>
                  {org?.name || 'School'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.headerDivider} />

          <View style={styles.menu}>
            {menuItems.map((item, i) => {
              const isActive = activeRoute === item.name;
              return (
                <View key={item.name}>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={() => navigation.navigate(item.name, item.params)}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                  >
                    <VectorIcon
                      iconSet={item.iconSet || 'Ionicons'}
                      iconName={item.icon}
                      size={item.iconSize ?? 20}
                      color={isActive ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                  {/* A line between every item, so each one reads as its own row */}
                  {i < menuItems.length - 1 && <View style={styles.itemDivider} />}
                </View>
              );
            })}
          </View>

          <View style={styles.logoutContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.6}
              onPress={() => setLogoutVisible(true)}
            >
              <VectorIcon iconSet="Ionicons" iconName="log-out-outline" size={20} color={theme.colors.danger} />
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </DrawerContentScrollView>

        <Modal
          transparent
          visible={logoutVisible}
          animationType="none"
          statusBarTranslucent
          onRequestClose={closeLogout}
        >
          <View style={styles.modalOverlay}>
            {/* Blur everything behind the popup, with a light tint for contrast */}
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { opacity: logoutAnim }]}
            >
              <BlurView
                style={StyleSheet.absoluteFill}
                blurType="light"
                blurAmount={10}
                reducedTransparencyFallbackColor="rgba(0,0,0,0.35)"
              />
              <View style={[StyleSheet.absoluteFill, styles.modalTint]} />
            </Animated.View>

            <Animated.View
              style={[
                styles.modalCard,
                {
                  opacity: logoutAnim,
                  transform: [
                    {
                      scale: logoutAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.modalTitle}>Log out?</Text>
              <Text style={styles.modalDesc}>
                Are you sure you want to log out of this account on this device?
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                  activeOpacity={0.7}
                  onPress={closeLogout}
                >
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnDanger]}
                  activeOpacity={0.85}
                  onPress={doLogout}
                >
                  <Text style={styles.modalBtnDangerText}>Log out</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
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
          backgroundColor: theme.colors.card,
          width: '74%',
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
  drawerScroll: { paddingTop: 0, paddingBottom: 16 },

  // The school
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  logoImage: {
    width: 170,
    height: 64,
    resizeMode: 'contain',
  },
  schoolRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  schoolName: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  headerDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },

  // Menu
  menu: { paddingTop: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginHorizontal: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: theme.radius.sm,
  },
  menuItemActive: { backgroundColor: theme.colors.background },
  itemDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 20,
  },
  menuText: { fontSize: 15, color: theme.colors.textPrimary },
  menuTextActive: { color: theme.colors.primary, fontWeight: '600' },

  // Log out
  logoutContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 12,
    paddingTop: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '500', color: theme.colors.danger },

  // Log out dialog
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalTint: {
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
  },
  modalCard: {
    width: '100%',
    // A little narrower than the screen allows, so it reads as a small prompt.
    maxWidth: 300,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  modalDesc: { marginTop: 8, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhost: { borderWidth: 1, borderColor: theme.colors.border },
  modalBtnGhostText: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  modalBtnDanger: { backgroundColor: theme.colors.danger },
  modalBtnDangerText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });

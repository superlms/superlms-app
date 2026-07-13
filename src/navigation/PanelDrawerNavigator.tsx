import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import { CommonActions } from '@react-navigation/native';
import { theme, onThemeChange } from '../utils/theme';
import VectorIcon from '../components/VectorIcon';
import AdminTabNavigator from './AdminTabNavigator';
import AdminAnalyticsScreen from '../screens/admin/AdminAnalyticsScreen';
import AdminTimetableScreen from '../screens/admin/AdminTimetableScreen';
import AdminArrangementScreen from '../screens/admin/AdminArrangementScreen';
import AdminHomeworkScreen from '../screens/admin/AdminHomeworkScreen';
import AdminAttendanceScreen from '../screens/admin/AdminAttendanceScreen';
import AdminTransportScreen from '../screens/admin/AdminTransportScreen';
import AdminCreditScreen from '../screens/admin/AdminCreditScreen';
import AdminAdmitCardScreen from '../screens/admin/AdminAdmitCardScreen';
import AdminReportCardScreen from '../screens/admin/AdminReportCardScreen';
import AdminTcCertificateScreen from '../screens/admin/AdminTcCertificateScreen';
import {
  AdminStudentsStack,
  AdminTeachersStack,
  AdminStandardStack,
  AdminAnnouncementStack,
  AdminCalendarStack,
  AdminEnquiriesStack,
  AdminSyllabusStack,
  AdminContentStack,
  AdminQuizStack,
  AdminBookStack,
  AdminMoreStack,
  AdminExamStack,
  AdminIdCardStack,
  AdminPerformanceStack,
  AdminExamCopyStack,
} from './adminStacks';
import AccountsDashboardScreen from '../screens/accounts/AccountsDashboardScreen';
import { AdminUser, AccountsUser, getStoredUser, logout } from '../api/authApi';
import { hasAllAccess } from '../screens/admin/adminModules';

const Drawer = createDrawerNavigator();

type Panel = 'admin' | 'accounts';

// `route` set → the menu item opens a real screen. Otherwise it's a shell entry
// that shows a "coming soon" notice (those modules arrive in later phases).
// `perm` is the web admin route name that grants the module (config/menu.php);
// items without one (Dashboard, Profile) are structural and always shown.
type MenuItem = { label: string; icon: string; route?: string; perm?: string };

// Mirrors the web admin sidebar order (config/menu.php → 'admin').
const ADMIN_MENU: MenuItem[] = [
  { label: 'Dashboard', icon: 'grid-outline', route: 'PanelHome' },
  { label: 'Analytics', icon: 'analytics-outline', route: 'AdminAnalytics', perm: 'admin.analytics' },
  { label: 'Standard', icon: 'book-outline', route: 'AdminStandard', perm: 'admin.standard' },
  { label: 'Students', icon: 'people-outline', route: 'AdminStudents', perm: 'admin.student' },
  { label: 'Teachers', icon: 'person-outline', route: 'AdminTeachers', perm: 'admin.teacher' },
  { label: 'Fees', icon: 'cash-outline', perm: 'admin.fee' },
  { label: 'Ledger', icon: 'calculator-outline', perm: 'admin.ledger' },
  { label: 'Payroll', icon: 'wallet-outline', perm: 'admin.payroll' },
  { label: 'Credit', icon: 'card-outline', route: 'AdminCredit', perm: 'admin.credit' },
  { label: 'Attendance', icon: 'clipboard-outline', route: 'AdminAttendance', perm: 'admin.attendance' },
  { label: 'Transportation', icon: 'bus-outline', route: 'AdminTransport', perm: 'admin.transport' },
  { label: 'Homework', icon: 'create-outline', route: 'AdminHomework', perm: 'admin.homework' },
  { label: 'Time Table', icon: 'time-outline', route: 'AdminTimetable', perm: 'admin.timetable' },
  { label: 'Arrangement', icon: 'grid-outline', route: 'AdminArrangement', perm: 'admin.arrangement' },
  { label: 'Announcement', icon: 'megaphone-outline', route: 'AdminAnnouncement', perm: 'admin.announcement' },
  { label: 'Calender', icon: 'calendar-outline', route: 'AdminCalendar', perm: 'admin.calender' },
  { label: 'Syllabus', icon: 'document-text-outline', route: 'AdminSyllabus', perm: 'admin.syllabus' },
  { label: 'Content', icon: 'folder-outline', route: 'AdminContent', perm: 'admin.content' },
  { label: 'Quiz', icon: 'help-circle-outline', route: 'AdminQuiz', perm: 'admin.quiz' },
  { label: 'Book', icon: 'book-outline', route: 'AdminBook', perm: 'admin.book' },
  { label: 'Enquiries', icon: 'chatbubbles-outline', route: 'AdminEnquiries', perm: 'admin.enqueries' },
  { label: 'ID Card', icon: 'id-card-outline', route: 'AdminIdCard', perm: 'admin.id-card' },
  { label: 'Exam', icon: 'school-outline', route: 'AdminExam', perm: 'admin.add-exam' },
  { label: 'Admit Card', icon: 'ticket-outline', route: 'AdminAdmitCard', perm: 'admin.admit-card' },
  { label: 'Seating Plan', icon: 'apps-outline', perm: 'admin.seating-plan' },
  { label: 'Performance', icon: 'speedometer-outline', route: 'AdminPerformance', perm: 'admin.performance' },
  { label: 'Exam Copy', icon: 'document-attach-outline', route: 'AdminExamCopy', perm: 'admin.exam-copy' },
  { label: 'Report Card', icon: 'documents-outline', route: 'AdminReportCard', perm: 'admin.report-card' },
  { label: 'TC & Certificate', icon: 'ribbon-outline', route: 'AdminTcCertificate', perm: 'admin.tc-certificate' },
  { label: 'Profile', icon: 'person-circle-outline', route: 'AdminProfile' },
  { label: 'More', icon: 'ellipsis-horizontal-outline', route: 'AdminMore', perm: 'admin.more' },
];

// Mirrors the web accounts sidebar order (config/menu.php → 'accounts').
const ACCOUNTS_MENU: MenuItem[] = [
  { label: 'Dashboard', icon: 'grid-outline', route: 'PanelHome' },
  { label: 'Payroll', icon: 'wallet-outline' },
  { label: 'Credit', icon: 'card-outline' },
  { label: 'Admissions', icon: 'person-add-outline' },
  { label: 'Fee Submission', icon: 'cash-outline' },
  { label: 'View Fee', icon: 'eye-outline' },
  { label: 'Fee Structure', icon: 'list-outline' },
  { label: 'Payments', icon: 'card-outline' },
  { label: 'Penalties', icon: 'alert-circle-outline' },
  { label: 'Fee Cycles', icon: 'refresh-outline' },
  { label: 'Attendance', icon: 'clipboard-outline' },
  { label: 'Transport', icon: 'bus-outline' },
  { label: 'Calendar', icon: 'calendar-outline' },
  { label: 'ID Card', icon: 'id-card-outline' },
  { label: 'Admit Card', icon: 'ticket-outline' },
  { label: 'Report Card', icon: 'documents-outline' },
  { label: 'TC & Certificates', icon: 'ribbon-outline' },
];

const PanelDrawerNavigator = ({ route }: any) => {
  const panel: Panel = route?.params?.panel === 'accounts' ? 'accounts' : 'admin';
  const menuItems = useMemo(
    () => (panel === 'accounts' ? ACCOUNTS_MENU : ADMIN_MENU),
    [panel],
  );

  const CustomDrawer = (props: any) => {
    const { navigation, state } = props;
    const [logoutVisible, setLogoutVisible] = useState(false);
    const [org, setOrg] = useState<{ name?: string; logo?: string | null } | null>(
      null,
    );
    const [permissions, setPermissions] = useState<string[] | undefined>(undefined);

    useEffect(() => {
      getStoredUser()
        .then(u => {
          const admin = u as AdminUser | AccountsUser | null;
          setOrg(admin?.organization ?? null);
          setPermissions((admin as AdminUser | null)?.permissions);
        })
        .catch(() => {
          setOrg(null);
          setPermissions(undefined);
        });
    }, []);

    // On the admin panel a sub-admin sees only the functionalities the school
    // granted them on the web (structural items without a `perm` always show);
    // a full admin (['*']) and the accounts panel keep the full menu.
    const visibleItems = useMemo(() => {
      if (panel !== 'admin' || hasAllAccess(permissions)) {
        return menuItems;
      }
      return menuItems.filter(
        item => !item.perm || permissions!.includes(item.perm),
      );
    }, [permissions]);

    const onItemPress = (item: MenuItem) => {
      if (item.route) {
        navigation.navigate(item.route);
        return;
      }
      navigation.closeDrawer();
      Alert.alert(
        item.label,
        `This module is coming soon to the ${panel} app.`,
      );
    };

    const doLogout = async () => {
      setLogoutVisible(false);
      const rootNav = navigation.getParent?.() ?? navigation;
      try {
        await logout();
      } catch (e) {
        console.log('[Panel logout] Error:', e);
      }
      rootNav.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }),
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
            {!!org?.name && (
              <Text style={styles.orgName} numberOfLines={2}>
                {org.name}
              </Text>
            )}
            <Text style={styles.panelTag}>
              {panel === 'accounts' ? 'Accounts Panel' : 'School Panel'}
            </Text>
          </View>
          <View style={styles.headerDivider} />

          <View style={styles.menu}>
            {visibleItems.map((item, index) => {
              const isActive =
                !!item.route && state.routeNames[state.index] === item.route;

              return (
                <View key={index}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => onItemPress(item)}
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
                      iconSet="Ionicons"
                      iconName={item.icon}
                      size={20}
                      color={
                        isActive ? theme.colors.primary : theme.colors.textPrimary
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
                  {index !== visibleItems.length - 1 && (
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
                  <Text style={[styles.modalBtnText, styles.modalBtnDangerText]}>
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
        name="PanelHome"
        component={panel === 'accounts' ? AccountsDashboardScreen : AdminTabNavigator}
      />
      {panel === 'admin' && <Drawer.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminAnnouncement" component={AdminAnnouncementStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminCalendar" component={AdminCalendarStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminEnquiries" component={AdminEnquiriesStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminStandard" component={AdminStandardStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminStudents" component={AdminStudentsStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminTeachers" component={AdminTeachersStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminIdCard" component={AdminIdCardStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminExam" component={AdminExamStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminPerformance" component={AdminPerformanceStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminExamCopy" component={AdminExamCopyStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminSyllabus" component={AdminSyllabusStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminContent" component={AdminContentStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminQuiz" component={AdminQuizStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminBook" component={AdminBookStack} />}
      {panel === 'admin' && <Drawer.Screen name="AdminTimetable" component={AdminTimetableScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminArrangement" component={AdminArrangementScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminHomework" component={AdminHomeworkScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminAttendance" component={AdminAttendanceScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminTransport" component={AdminTransportScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminCredit" component={AdminCreditScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminAdmitCard" component={AdminAdmitCardScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminReportCard" component={AdminReportCardScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminTcCertificate" component={AdminTcCertificateScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminMore" component={AdminMoreStack} />}
    </Drawer.Navigator>
  );
};

export default PanelDrawerNavigator;

const __mk_styles = () =>
  StyleSheet.create({
    header: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
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
    orgName: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    panelTag: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
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
    },
  });

// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => {
  styles = __mk_styles();
});

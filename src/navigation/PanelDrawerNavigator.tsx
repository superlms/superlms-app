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
import AdminAnnouncementScreen from '../screens/admin/AdminAnnouncementScreen';
import AdminCalendarScreen from '../screens/admin/AdminCalendarScreen';
import AdminEnquiriesScreen from '../screens/admin/AdminEnquiriesScreen';
import AdminStandardScreen from '../screens/admin/AdminStandardScreen';
import AdminStudentsScreen from '../screens/admin/AdminStudentsScreen';
import AdminTeachersScreen from '../screens/admin/AdminTeachersScreen';
import AdminIdCardScreen from '../screens/admin/AdminIdCardScreen';
import AdminExamScreen from '../screens/admin/AdminExamScreen';
import AdminSyllabusScreen from '../screens/admin/AdminSyllabusScreen';
import AdminContentScreen from '../screens/admin/AdminContentScreen';
import AdminQuizScreen from '../screens/admin/AdminQuizScreen';
import AdminBookScreen from '../screens/admin/AdminBookScreen';
import AdminTimetableScreen from '../screens/admin/AdminTimetableScreen';
import AdminArrangementScreen from '../screens/admin/AdminArrangementScreen';
import AccountsDashboardScreen from '../screens/accounts/AccountsDashboardScreen';
import { AdminUser, AccountsUser, getStoredUser, logout } from '../api/authApi';

const Drawer = createDrawerNavigator();

type Panel = 'admin' | 'accounts';

// `route` set → the menu item opens a real screen. Otherwise it's a shell entry
// that shows a "coming soon" notice (those modules arrive in later phases).
type MenuItem = { label: string; icon: string; route?: string };

// Mirrors the web admin sidebar order (config/menu.php → 'admin').
const ADMIN_MENU: MenuItem[] = [
  { label: 'Dashboard', icon: 'grid-outline', route: 'PanelHome' },
  { label: 'Analytics', icon: 'analytics-outline' },
  { label: 'Standard', icon: 'book-outline', route: 'AdminStandard' },
  { label: 'Students', icon: 'people-outline', route: 'AdminStudents' },
  { label: 'Teachers', icon: 'person-outline', route: 'AdminTeachers' },
  { label: 'Fees', icon: 'cash-outline' },
  { label: 'Ledger', icon: 'calculator-outline' },
  { label: 'Payroll', icon: 'wallet-outline' },
  { label: 'Credit', icon: 'card-outline' },
  { label: 'Attendance', icon: 'clipboard-outline' },
  { label: 'Transportation', icon: 'bus-outline' },
  { label: 'Homework', icon: 'create-outline' },
  { label: 'Time Table', icon: 'time-outline', route: 'AdminTimetable' },
  { label: 'Arrangement', icon: 'grid-outline', route: 'AdminArrangement' },
  { label: 'Announcement', icon: 'megaphone-outline', route: 'AdminAnnouncement' },
  { label: 'Calender', icon: 'calendar-outline', route: 'AdminCalendar' },
  { label: 'Syllabus', icon: 'document-text-outline', route: 'AdminSyllabus' },
  { label: 'Content', icon: 'folder-outline', route: 'AdminContent' },
  { label: 'Quiz', icon: 'help-circle-outline', route: 'AdminQuiz' },
  { label: 'Book', icon: 'book-outline', route: 'AdminBook' },
  { label: 'Enquiries', icon: 'chatbubbles-outline', route: 'AdminEnquiries' },
  { label: 'ID Card', icon: 'id-card-outline', route: 'AdminIdCard' },
  { label: 'Exam', icon: 'school-outline', route: 'AdminExam' },
  { label: 'Admit Card', icon: 'ticket-outline' },
  { label: 'Seating Plan', icon: 'apps-outline' },
  { label: 'Performance', icon: 'speedometer-outline' },
  { label: 'Exam Copy', icon: 'document-attach-outline' },
  { label: 'Report Card', icon: 'documents-outline' },
  { label: 'TC & Certificate', icon: 'ribbon-outline' },
  { label: 'More', icon: 'ellipsis-horizontal-outline' },
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

    useEffect(() => {
      getStoredUser()
        .then(u => setOrg((u as AdminUser | AccountsUser | null)?.organization ?? null))
        .catch(() => setOrg(null));
    }, []);

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
            {menuItems.map((item, index) => {
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
      {panel === 'admin' && <Drawer.Screen name="AdminAnnouncement" component={AdminAnnouncementScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminCalendar" component={AdminCalendarScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminEnquiries" component={AdminEnquiriesScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminStandard" component={AdminStandardScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminStudents" component={AdminStudentsScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminTeachers" component={AdminTeachersScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminIdCard" component={AdminIdCardScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminExam" component={AdminExamScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminSyllabus" component={AdminSyllabusScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminContent" component={AdminContentScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminQuiz" component={AdminQuizScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminBook" component={AdminBookScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminTimetable" component={AdminTimetableScreen} />}
      {panel === 'admin' && <Drawer.Screen name="AdminArrangement" component={AdminArrangementScreen} />}
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

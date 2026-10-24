import React, { useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
} from '@react-navigation/drawer';
import { AppDialog } from '../components/AppDialog';
import { theme, onThemeChange } from '../utils/theme';
import VectorIcon from '../components/VectorIcon';
import { DrawerShadeBridge } from './drawerShade';
import AdminTabNavigator from './AdminTabNavigator';
import { ADMIN_MODULE_TARGETS, openAdminModule } from './adminRoutes';
import AdminAnalyticsScreen from '../screens/admin/AdminAnalyticsScreen';
import AdminCreditScreen from '../screens/admin/AdminCreditScreen';
import AdminListsScreen from '../screens/admin/AdminListsScreen';
import AdminAssistantScreen from '../screens/admin/AdminAssistantScreen';
import SettingsScreen from '../screens/setting/SettingsScreen';
import {
  AdminStandardStack,
  AdminAnnouncementStack,
  AdminCalendarStack,
  AdminTransportStack,
  AdminLedgerStack,
  AdminPayrollStack,
  AdminEnquiriesStack,
  AdminSyllabusStack,
  AdminContentStack,
  AdminQuizStack,
  AdminBookStack,
  AdminMoreStack,
  AdminExamStack,
  AdminIdCardStack,
  AdminAdmitCardStack,
  AdminPerformanceStack,
  AdminExamCopyStack,
  AdminTimetableStack,
  AdminTcCertificateStack,
  AdminHomeworkStack,
  AdminArrangementStack,
  AdminReportCardStack,
  AdminSeatingStack,
} from './adminStacks';
import { logoutCurrentAccount } from '../utils/logoutAccount';
import { useAdminProfile } from '../screens/admin/useAdminProfile';
import { visibleAdminModules } from '../screens/admin/adminModules';

const Drawer = createDrawerNavigator();

// The sidebar's outline glyph for each module.
const MENU_ICONS: Record<string, string> = {
  dashboard: 'home-outline',
  analytics: 'analytics-outline',
  standard: 'book-outline',
  students: 'people-outline',
  teachers: 'person-outline',
  fees: 'cash-outline',
  ledger: 'calculator-outline',
  payroll: 'wallet-outline',
  attendance: 'clipboard-outline',
  transport: 'bus-outline',
  homework: 'create-outline',
  timetable: 'time-outline',
  arrangement: 'grid-outline',
  announcement: 'megaphone-outline',
  calender: 'calendar-outline',
  syllabus: 'library-outline',
  content: 'folder-outline',
  quiz: 'help-circle-outline',
  book: 'book-outline',
  enquiries: 'chatbubble-ellipses-outline',
  'id-card': 'id-card-outline',
  lists: 'list-outline',
  exam: 'school-outline',
  'admit-card': 'ticket-outline',
  'seating-plan': 'apps-outline',
  performance: 'trending-up-outline',
  'exam-copy': 'document-text-outline',
  'report-card': 'documents-outline',
  'tc-certificate': 'ribbon-outline',
  more: 'ellipsis-horizontal-outline',
};

// The screen or tab a sidebar row stands for, to mark it as the one open.
const activeKey = (state: any): string | null => {
  const route = state.routes[state.index];
  if (route?.name === 'PanelHome') {
    const tabs = route.state;
    const tab = tabs ? tabs.routes[tabs.index ?? 0]?.name : 'Dashboard';
    return (
      Object.keys(ADMIN_MODULE_TARGETS).find(
        key => (ADMIN_MODULE_TARGETS[key].params as any)?.screen === tab,
      ) ?? null
    );
  }
  if (route?.name === 'AdminSettings') {
    return 'settings';
  }
  return (
    Object.keys(ADMIN_MODULE_TARGETS).find(
      key => !ADMIN_MODULE_TARGETS[key].params && ADMIN_MODULE_TARGETS[key].route === route?.name,
    ) ?? null
  );
};

/**
 * The school admin's sidebar: the web admin panel's — the school's logo and
 * name, then every module under "Dashboard" in the web's order, as far as this
 * admin may use them, with Settings above More as in the student app — drawn
 * like the student and teacher sidebar, with a line between rows and Log out at
 * the foot. (Profile is under More.)
 */
const AdminDrawerNavigator = () => {
  const CustomDrawer = (props: any) => {
    const { navigation, state } = props;
    const [logoutVisible, setLogoutVisible] = useState(false);
    const [logoBroken, setLogoBroken] = useState(false);
    const profile = useAdminProfile();
    const org = profile?.organization ?? null;
    const permissions = profile?.permissions;

    // A sub-admin sees only what the school granted them on the web; Home is
    // where the app opens, so it always shows.
    const items = useMemo(() => {
      const visible = visibleAdminModules(permissions);
      return visible.some(m => m.key === 'dashboard')
        ? visible
        : [
            { key: 'dashboard', label: 'Home', icon: 'home', color: '' },
            ...visible,
          ];
    }, [permissions]);

    const closeLogout = () => setLogoutVisible(false);

    const doLogout = async () => {
      setLogoutVisible(false);
      // Only this account logs out; another signed in on the phone opens next.
      await logoutCurrentAccount(navigation.getParent?.() ?? navigation);
    };

    const current = activeKey(state);

    const rows = items.map(m => ({
      key: m.key,
      label: m.label,
      icon: MENU_ICONS[m.key] ?? 'ellipse-outline',
      onPress: () => openAdminModule(navigation, m),
    }));
    // Settings (notifications, biometric unlock, password), just above More.
    const moreAt = rows.findIndex(r => r.key === 'more');
    rows.splice(moreAt < 0 ? rows.length : moreAt, 0, {
      key: 'settings',
      label: 'Settings',
      icon: 'settings-outline',
      onPress: () => navigation.navigate('AdminSettings'),
    });

    return (
      <>
        {/* Carries the open sidebar's shade over the status and navigation bars */}
        <DrawerShadeBridge widthFraction={0.74} />
        <DrawerContentScrollView
          {...props}
          contentContainerStyle={styles.drawerScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* The school, as at the top of the web sidebar */}
          <View style={styles.school}>
            {org?.logo && !logoBroken ? (
              <Image
                source={{ uri: org.logo }}
                onError={() => setLogoBroken(true)}
                style={styles.schoolLogo}
              />
            ) : (
              <View style={styles.schoolMark}>
                <VectorIcon iconSet="Ionicons" iconName="school-outline" size={30} color={theme.colors.primary} />
              </View>
            )}
            {!!org?.name && (
              <Text style={styles.schoolName} numberOfLines={2}>
                {org.name}
              </Text>
            )}
          </View>
          <View style={styles.schoolDivider} />

          <Text style={styles.sectionTitle}>Dashboard</Text>

          <View style={styles.menu}>
            {rows.map((item, i) => {
              const isActive = current === item.key;
              return (
                <View key={item.key}>
                  <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={item.onPress}
                    style={[styles.menuItem, isActive && styles.menuItemActive]}
                  >
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName={item.icon}
                      size={20}
                      color={isActive ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                  {/* A line between every item, so each one reads as its own row */}
                  {i < rows.length - 1 && <View style={styles.itemDivider} />}
                </View>
              );
            })}
          </View>

          <View style={styles.itemDivider} />
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

        <AppDialog
          visible={logoutVisible}
          title="Log out?"
          message="Are you sure you want to log out of this account on this device?"
          actions={[
            { text: 'Cancel', style: 'cancel', onPress: closeLogout },
            { text: 'Log out', style: 'destructive', onPress: doLogout },
          ]}
          onRequestClose={closeLogout}
          onBackdropPress={closeLogout}
        />
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
      <Drawer.Screen name="PanelHome" component={AdminTabNavigator} />
      <Drawer.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} />
      <Drawer.Screen name="AdminStandard" component={AdminStandardStack} />
      <Drawer.Screen name="AdminTransport" component={AdminTransportStack} />
      <Drawer.Screen name="AdminLedger" component={AdminLedgerStack} />
      <Drawer.Screen name="AdminPayroll" component={AdminPayrollStack} />
      <Drawer.Screen name="AdminHomework" component={AdminHomeworkStack} />
      <Drawer.Screen name="AdminTimetable" component={AdminTimetableStack} />
      <Drawer.Screen name="AdminArrangement" component={AdminArrangementStack} />
      <Drawer.Screen name="AdminAnnouncement" component={AdminAnnouncementStack} />
      <Drawer.Screen name="AdminCalendar" component={AdminCalendarStack} />
      <Drawer.Screen name="AdminSyllabus" component={AdminSyllabusStack} />
      <Drawer.Screen name="AdminContent" component={AdminContentStack} />
      <Drawer.Screen name="AdminQuiz" component={AdminQuizStack} />
      <Drawer.Screen name="AdminBook" component={AdminBookStack} />
      <Drawer.Screen name="AdminEnquiries" component={AdminEnquiriesStack} />
      <Drawer.Screen name="AdminIdCard" component={AdminIdCardStack} />
      <Drawer.Screen name="AdminLists" component={AdminListsScreen} />
      <Drawer.Screen name="AdminExam" component={AdminExamStack} />
      <Drawer.Screen name="AdminAdmitCard" component={AdminAdmitCardStack} />
      <Drawer.Screen name="AdminPerformance" component={AdminPerformanceStack} />
      <Drawer.Screen name="AdminExamCopy" component={AdminExamCopyStack} />
      <Drawer.Screen name="AdminReportCard" component={AdminReportCardStack} />
      <Drawer.Screen name="AdminTcCertificate" component={AdminTcCertificateStack} />
      <Drawer.Screen name="AdminSeating" component={AdminSeatingStack} />
      <Drawer.Screen name="AdminCredit" component={AdminCreditScreen} />
      <Drawer.Screen name="AdminSettings" component={SettingsScreen} />
      <Drawer.Screen name="AdminMore" component={AdminMoreStack} />
      {/* Super Assist, from the dashboard's button */}
      <Drawer.Screen name="AdminAssistant" component={AdminAssistantScreen} />
    </Drawer.Navigator>
  );
};

export default AdminDrawerNavigator;

const __mk_styles = () => StyleSheet.create({
  drawerScroll: { paddingTop: 0, paddingBottom: 16 },

  // The school
  school: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  schoolLogo: { width: 72, height: 72, resizeMode: 'contain' },
  schoolMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolName: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  schoolDivider: { height: 1, backgroundColor: theme.colors.border },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 2,
    marginHorizontal: 22,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },

  // Menu
  menu: { paddingTop: 6 },
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
  logoutContainer: { paddingTop: 8 },
  logoutText: { fontSize: 15, fontWeight: '500', color: theme.colors.danger },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => {
  styles = __mk_styles();
});

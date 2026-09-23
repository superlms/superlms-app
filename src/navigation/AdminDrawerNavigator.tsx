import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { BlurView } from '@react-native-community/blur';
import { theme, onThemeChange } from '../utils/theme';
import VectorIcon from '../components/VectorIcon';
import { DrawerShadeBridge } from './drawerShade';
import AdminTabNavigator from './AdminTabNavigator';
import { ADMIN_MODULE_TARGETS, openAdminModule } from './adminRoutes';
import AdminAnalyticsScreen from '../screens/admin/AdminAnalyticsScreen';
import AdminTimetableScreen from '../screens/admin/AdminTimetableScreen';
import AdminArrangementScreen from '../screens/admin/AdminArrangementScreen';
import AdminHomeworkScreen from '../screens/admin/AdminHomeworkScreen';
import AdminCreditScreen from '../screens/admin/AdminCreditScreen';
import AdminAdmitCardScreen from '../screens/admin/AdminAdmitCardScreen';
import AdminReportCardScreen from '../screens/admin/AdminReportCardScreen';
import AdminTcCertificateScreen from '../screens/admin/AdminTcCertificateScreen';
import AdminListsScreen from '../screens/admin/AdminListsScreen';
import AdminAssistantScreen from '../screens/admin/AdminAssistantScreen';
import SettingsScreen from '../screens/setting/SettingsScreen';
import {
  AdminStandardStack,
  AdminAnnouncementStack,
  AdminCalendarStack,
  AdminTransportStack,
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

    // Log out dialog: the blurred backdrop and the card fade in together.
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
      <Drawer.Screen name="PanelHome" component={AdminTabNavigator} />
      <Drawer.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} />
      <Drawer.Screen name="AdminStandard" component={AdminStandardStack} />
      <Drawer.Screen name="AdminTransport" component={AdminTransportStack} />
      <Drawer.Screen name="AdminHomework" component={AdminHomeworkScreen} />
      <Drawer.Screen name="AdminTimetable" component={AdminTimetableScreen} />
      <Drawer.Screen name="AdminArrangement" component={AdminArrangementScreen} />
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
      <Drawer.Screen name="AdminAdmitCard" component={AdminAdmitCardScreen} />
      <Drawer.Screen name="AdminPerformance" component={AdminPerformanceStack} />
      <Drawer.Screen name="AdminExamCopy" component={AdminExamCopyStack} />
      <Drawer.Screen name="AdminReportCard" component={AdminReportCardScreen} />
      <Drawer.Screen name="AdminTcCertificate" component={AdminTcCertificateScreen} />
      <Drawer.Screen name="AdminCredit" component={AdminCreditScreen} />
      <Drawer.Screen name="AdminSettings" component={SettingsScreen} />
      <Drawer.Screen name="AdminMore" component={AdminMoreStack} />
      {/* LMS Assist, from the dashboard's button */}
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

  // Log out dialog
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalTint: { backgroundColor: 'rgba(15, 23, 42, 0.2)' },
  modalCard: {
    width: '100%',
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
onThemeChange(() => {
  styles = __mk_styles();
});

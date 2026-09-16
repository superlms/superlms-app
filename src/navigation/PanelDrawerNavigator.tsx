import React, { useEffect, useState } from 'react';
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
import { CommonActions } from '@react-navigation/native';
import { theme, onThemeChange } from '../utils/theme';
import VectorIcon from '../components/VectorIcon';
import { DrawerShadeBridge } from './drawerShade';
import { AppDialog, AppAlert } from '../components/AppDialog';
import AccountsDashboardScreen from '../screens/accounts/AccountsDashboardScreen';
import { AccountsUser, getStoredUser, logout } from '../api/authApi';

const Drawer = createDrawerNavigator();

// `route` set → the menu item opens a real screen. Otherwise it's a shell entry
// that shows a "coming soon" notice (those modules arrive in later phases).
type MenuItem = { label: string; icon: string; route?: string };

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

/**
 * The accounts panel's dashboard and sidebar. (The school admin panel has its
 * own, AdminDrawerNavigator.)
 */
const PanelDrawerNavigator = () => {
  const panel = 'accounts';
  const menuItems = ACCOUNTS_MENU;

  const CustomDrawer = (props: any) => {
    const { navigation, state } = props;
    const [logoutVisible, setLogoutVisible] = useState(false);
    const [org, setOrg] = useState<{ name?: string; logo?: string | null } | null>(
      null,
    );

    useEffect(() => {
      getStoredUser()
        .then(u => setOrg((u as AccountsUser | null)?.organization ?? null))
        .catch(() => setOrg(null));
    }, []);

    const visibleItems = menuItems;

    const onItemPress = (item: MenuItem) => {
      if (item.route) {
        navigation.navigate(item.route);
        return;
      }
      navigation.closeDrawer();
      AppAlert.alert(
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
        {/* Carries the open sidebar's shade over the status and navigation bars */}
        <DrawerShadeBridge widthFraction={0.7} />
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
            <Text style={styles.panelTag}>Accounts Panel</Text>
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

        <AppDialog
          visible={logoutVisible}
          title="Log out?"
          message="Are you sure you want to log out of this account on this device?"
          actions={[
            { text: 'Cancel', style: 'cancel', onPress: () => setLogoutVisible(false) },
            { text: 'Log out', style: 'destructive', onPress: doLogout },
          ]}
          onRequestClose={() => setLogoutVisible(false)}
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
          backgroundColor: theme.colors.surface,
          width: '70%',
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
        },
        drawerType: 'front',
      }}
    >
      <Drawer.Screen name="PanelHome" component={AccountsDashboardScreen} />
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

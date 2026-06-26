import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import VectorIcon from '../components/VectorIcon';
import { theme, onThemeChange } from '../utils/theme';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminQuickLinksScreen from '../screens/admin/AdminQuickLinksScreen';
import AdminComingSoonScreen from '../screens/admin/AdminComingSoonScreen';

const Tab = createBottomTabNavigator();

const NoRippleButton = (props: any) => <TouchableOpacity {...props} activeOpacity={1} />;

// Center "FAB" button for the Quick Links tab — same treatment as the student app.
const QuickLinkButton = ({ children, onPress }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.quickLinkWrapper}>
    <View style={styles.quickLinkRing}>
      <View style={styles.quickLinkInner}>{children}</View>
    </View>
  </TouchableOpacity>
);

const AdminTabNavigator = () => {
  return (
    <Tab.Navigator
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 70,
          paddingTop: 6,
        },
        tabBarItemStyle: { alignItems: 'center', justifyContent: 'center' },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarButton: props =>
          route.name === 'QuickLinks' ? (
            <QuickLinkButton {...props} />
          ) : (
            <NoRippleButton {...props} />
          ),
        tabBarIcon: ({ color, focused }) => {
          let iconName;
          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'Chats':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'QuickLinks':
              iconName = focused ? 'flash' : 'flash-outline';
              break;
            case 'Attendance':
              iconName = focused ? 'checkbox' : 'checkbox-outline';
              break;
            case 'Fees':
              iconName = focused ? 'card' : 'card-outline';
              break;
            default:
              iconName = 'ellipse';
          }
          const iconColor = route.name === 'QuickLinks' ? theme.colors.surface : color;
          const iconSize = route.name === 'QuickLinks' ? 26 : 22;
          return (
            <VectorIcon
              iconSet="Ionicons"
              iconName={iconName}
              size={iconSize}
              color={iconColor}
              style={route.name === 'QuickLinks' ? { marginTop: 1 } : undefined}
            />
          );
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen
        name="Chats"
        component={AdminComingSoonScreen}
        initialParams={{ title: 'Chats', icon: 'chatbubbles-outline' }}
      />
      <Tab.Screen
        name="QuickLinks"
        component={AdminQuickLinksScreen}
        options={{ tabBarLabel: '' }}
      />
      <Tab.Screen
        name="Attendance"
        component={AdminComingSoonScreen}
        initialParams={{ title: 'Attendance', icon: 'checkbox-outline' }}
      />
      <Tab.Screen
        name="Fees"
        component={AdminComingSoonScreen}
        initialParams={{ title: 'Fees', icon: 'card-outline' }}
      />
    </Tab.Navigator>
  );
};

export default AdminTabNavigator;

const __mk_styles = () =>
  StyleSheet.create({
    quickLinkWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    quickLinkRing: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      bottom: 26,
    },
    quickLinkInner: {
      width: 62,
      height: 62,
      borderRadius: 31,
      paddingVertical: 16,
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.surface,
    },
  });

// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => {
  styles = __mk_styles();
});

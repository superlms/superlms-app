import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity } from 'react-native';
import VectorIcon from '../components/VectorIcon';
import { theme } from '../utils/theme';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminAttendanceScreen from '../screens/admin/AdminAttendanceScreen';
import AdminComingSoonScreen from '../screens/admin/AdminComingSoonScreen';
import { AdminStudentsStack, AdminTeachersStack } from './adminStacks';
import { AdminUser, getStoredUser } from '../api/authApi';
import { canAccessAdminModule } from '../screens/admin/adminModules';

const Tab = createBottomTabNavigator();

const NoRippleButton = (props: any) => <TouchableOpacity {...props} activeOpacity={1} />;

const ICONS: Record<string, [string, string]> = {
  Dashboard: ['grid', 'grid-outline'],
  Students: ['people', 'people-outline'],
  Teachers: ['person', 'person-outline'],
  Attendance: ['clipboard', 'clipboard-outline'],
  Fees: ['card', 'card-outline'],
};

// The web route that grants each tab (a sub-admin sees only theirs).
const TAB_PERMS: Record<string, string> = {
  Students: 'admin.student',
  Teachers: 'admin.teacher',
  Attendance: 'admin.attendance',
  Fees: 'admin.fee',
};

/**
 * The admin's bottom bar, drawn like the student and teacher one: Dashboard,
 * Students, Teachers, Attendance and Fees.
 */
const AdminTabNavigator = () => {
  const [permissions, setPermissions] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    getStoredUser()
      .then(u => setPermissions((u as AdminUser | null)?.permissions))
      .catch(() => setPermissions(undefined));
  }, []);

  const allowed = (name: string) =>
    canAccessAdminModule({ perm: TAB_PERMS[name] }, permissions);

  return (
    <Tab.Navigator
      // The root SafeAreaView already pads the bottom inset; without this the
      // tab bar adds it again and doubles the gap.
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
        tabBarButton: props => <NoRippleButton {...props} />,
        tabBarIcon: ({ color, focused }) => {
          const [active, idle] = ICONS[route.name] ?? ['ellipse', 'ellipse'];
          return (
            <VectorIcon iconSet="Ionicons" iconName={focused ? active : idle} size={22} color={color} />
          );
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      {allowed('Students') && <Tab.Screen name="Students" component={AdminStudentsStack} />}
      {allowed('Teachers') && <Tab.Screen name="Teachers" component={AdminTeachersStack} />}
      {allowed('Attendance') && <Tab.Screen name="Attendance" component={AdminAttendanceScreen} />}
      {allowed('Fees') && (
        <Tab.Screen
          name="Fees"
          component={AdminComingSoonScreen}
          initialParams={{ title: 'Fees', icon: 'card-outline' }}
        />
      )}
    </Tab.Navigator>
  );
};

export default AdminTabNavigator;

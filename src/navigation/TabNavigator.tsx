import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import VectorIcon from '../components/VectorIcon';
import { theme, onThemeChange } from '../utils/theme';

import StudentHomeScreen from '../screens/home/student/StudentHomeScreen';
import TeacherHomeScreen from '../screens/home/teacher/TeacherHomeScreen';
import TeacherHomeworkScreen from '../screens/homework/TeacherHomeworkScreen';
import StudentHomeworkScreen from '../screens/homework/StudentHomeworkScreen';
import markAttendanceScreen from '../screens/markAttendance/markAttendanceScreen';
import FeesScreen from '../screens/fees/FeesScreen';
import { SUBJECTS } from '../screens/subjects/subjectsData';
import SubjectsScreen from '../screens/subjects/SubjectsScreen';
import QuickLinksScreen from '../screens/home/QuickLinksScreen';

const Tab = createBottomTabNavigator();

const NoRippleButton = (props: any) => {
  return <TouchableOpacity {...props} activeOpacity={1} />;
};

const QuickLinkButton = ({ children, onPress }: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={styles.quickLinkWrapper}
    >
      <View style={styles.quickLinkRing}>
        <View style={styles.quickLinkInner}>{children}</View>
      </View>
    </TouchableOpacity>
  );
};

type TabRole = 'student' | 'teacher';

const TabNavigator = ({ route }: any) => {
  const role: TabRole =
    route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  const lastTabName = role === 'teacher' ? 'MarkAttendance' : 'Fees';
  const DashboardComponent =
    role === 'teacher' ? TeacherHomeScreen : StudentHomeScreen;

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

        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
        },

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
            case 'Subjects':
              iconName = focused ? 'albums' : 'albums-outline';
              break;
            case 'QuickLinks':
              iconName = focused ? 'flash' : 'flash-outline';
              break;
            case 'Homework':
              iconName = focused ? 'create' : 'create-outline';
              break;
            case 'Fees':
              iconName = focused ? 'card' : 'card-outline';
              break;
            case 'MarkAttendance':
              iconName = focused ? 'checkbox' : 'checkbox-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          const iconColor =
            route.name === 'QuickLinks' ? theme.colors.surface : color;

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

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardComponent} />
      <Tab.Screen name="Subjects" component={SubjectsScreen} />

      <Tab.Screen
        name="QuickLinks"
        component={QuickLinksScreen}
        initialParams={{ userRole: role }}
        options={{ tabBarLabel: '' }}
      />

      <Tab.Screen
        name="Homework"
        component={
          role === 'teacher' ? TeacherHomeworkScreen : StudentHomeworkScreen
        }
      />
      <Tab.Screen
        name={lastTabName}
        component={role === 'teacher' ? markAttendanceScreen : FeesScreen}
        options={{
          tabBarLabel: role === 'teacher' ? 'Attendance' : 'Fees',
        }}
        initialParams={
          role === 'teacher' ? { title: 'Mark Attendance' } : undefined
        }
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;

const __mk_styles = () => StyleSheet.create({
  quickLinkWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
onThemeChange(() => { styles = __mk_styles(); });

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity } from 'react-native';
import VectorIcon from '../components/VectorIcon';
import { theme } from '../utils/theme';

import StudentHomeScreen from '../screens/home/student/StudentHomeScreen';
import TeacherHomeScreen from '../screens/home/teacher/TeacherHomeScreen';
import TeacherHomeworkScreen from '../screens/homework/TeacherHomeworkScreen';
import StudentHomeworkScreen from '../screens/homework/StudentHomeworkScreen';
import markAttendanceScreen from '../screens/markAttendance/markAttendanceScreen';
import FeesScreen from '../screens/fees/FeesScreen';
import SubjectsScreen from '../screens/subjects/SubjectsScreen';
import TeacherTImetableScreen from '../screens/timetable/TeacherTImetableScreen';
import AttendanceScreen from '../screens/attendance/AttendanceScreen';

const Tab = createBottomTabNavigator();

const NoRippleButton = (props: any) => {
  return <TouchableOpacity {...props} activeOpacity={1} />;
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

        tabBarButton: props => <NoRippleButton {...props} />,

        tabBarIcon: ({ color, focused }) => {
          let iconName;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'Subjects':
              iconName = focused ? 'albums' : 'albums-outline';
              break;
            case 'Timetable':
              iconName = focused ? 'time' : 'time-outline';
              break;
            case 'Attendance':
              iconName = focused ? 'clipboard' : 'clipboard-outline';
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

          return <VectorIcon iconSet="Ionicons" iconName={iconName} size={22} color={color} />;
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

      {/* The middle tab: a teacher's timetable, a student's attendance */}
      {role === 'teacher' ? (
        <Tab.Screen
          name="Timetable"
          component={TeacherTImetableScreen}
          initialParams={{ title: 'Timetable' }}
        />
      ) : (
        <Tab.Screen
          name="Attendance"
          component={AttendanceScreen}
          initialParams={{ title: 'Attendance' }}
        />
      )}

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

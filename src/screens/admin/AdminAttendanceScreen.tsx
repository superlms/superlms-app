import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { TITLE } from './adminAttendanceUi';

/**
 * Attendance — the panel's three tabs as three plain rows, the way the Exams
 * hub lists its pages: Teacher Attendance, Student Attendance and Class
 * Teachers, each opening its own page.
 */

const ENTRIES = [
  {
    title: 'Teacher Attendance',
    sub: 'Mark it, and see it by date, month or teacher',
    icon: 'person-outline',
    route: 'AdminTeacherAttendance',
  },
  {
    title: 'Student Attendance',
    sub: 'Mark a class, and see it by date or student',
    icon: 'people-outline',
    route: 'AdminStudentAttendance',
  },
  {
    title: 'Class Teachers',
    sub: 'Who is class teacher of which class',
    icon: 'school-outline',
    route: 'AdminClassTeachers',
  },
];

const AdminAttendanceScreen = ({ navigation }: any) => (
  <View style={s.root}>
    <DocHeader
      title={TITLE}
      onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
    />

    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      {ENTRIES.map((item, i) => (
        <TouchableOpacity key={item.title} style={s.row} activeOpacity={0.6} onPress={() => navigation.navigate(item.route)}>
          <View style={s.rowIcon}>
            <VectorIcon iconSet="Ionicons" iconName={item.icon} size={20} color={theme.colors.textSecondary} />
          </View>
          <View style={[s.rowMain, i < ENTRIES.length - 1 && s.rowDivider]}>
            <View style={s.rowText}>
              <Text style={s.rowTitle}>{item.title}</Text>
              <Text style={s.rowSub} numberOfLines={1}>
                {item.sub}
              </Text>
            </View>
            <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

export default AdminAttendanceScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingTop: 4, paddingBottom: 40 },

  // Entries — plain icon, title and line, with an inset hairline
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 20 },
  rowIcon: { width: 22, alignItems: 'center' },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingRight: 20,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

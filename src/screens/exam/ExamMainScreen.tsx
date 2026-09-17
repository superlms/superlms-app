import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';

/**
 * The "Exams" hub — the way into everything exam-related, one plain row each.
 * Students and teachers each have their own set of rows.
 */

const TITLE = 'Exams';

export interface HubEntry {
  title: string;
  sub: string;
  icon: string;
  route: string;
  params?: Record<string, any>;
}

const STUDENT_ENTRIES: HubEntry[] = [
  {
    title: 'Exams',
    sub: 'Upcoming, ongoing and completed exams',
    icon: 'calendar-outline',
    route: 'ExamsScreen',
  },
  {
    title: 'Exam Syllabus',
    sub: 'What each exam covers',
    icon: 'book-outline',
    route: 'ExamSyllabus',
  },
  {
    title: 'Date Sheet',
    sub: 'Which paper is on which day',
    icon: 'calendar-number-outline',
    route: 'DateSheet',
  },
  {
    title: 'Admit Card',
    sub: 'Download your admit card',
    icon: 'card-outline',
    route: 'AdmitCardScreen',
  },
  {
    title: 'Seating Plan',
    sub: 'Your room and seat for each paper',
    icon: 'grid-outline',
    route: 'SeatingPlanScreen',
  },
  {
    title: 'Exam Copy',
    sub: 'Your evaluated answer sheets',
    icon: 'document-text-outline',
    route: 'ExamCopyScreen',
  },
  {
    title: 'Report Card',
    sub: 'Your results and performance report',
    icon: 'stats-chart-outline',
    route: 'ReportCardScreen',
  },
];

export const ExamHub = ({ navigation, entries }: { navigation: any; entries: HubEntry[] }) => (
  <View style={s.root}>
    <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      {entries.map((item, i) => (
        <TouchableOpacity
          key={item.title}
          style={s.row}
          activeOpacity={0.6}
          onPress={() => navigation.navigate(item.route, item.params)}
        >
          <View style={s.rowIcon}>
            <VectorIcon iconSet="Ionicons" iconName={item.icon} size={20} color={theme.colors.textSecondary} />
          </View>
          <View style={[s.rowMain, i < entries.length - 1 && s.rowDivider]}>
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

const ExamMainScreen = ({ navigation }: any) => <ExamHub navigation={navigation} entries={STUDENT_ENTRIES} />;

export default ExamMainScreen;

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

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';

/**
 * Exams — the panel's three tabs as three plain rows, the way the student's
 * Exams hub lists its pages: the exams themselves, what each covers, and the
 * question papers, each opening its own page.
 */

const TITLE = 'Exams';

const ENTRIES = [
  {
    title: 'Exams',
    sub: 'Add, publish and edit the school’s exams',
    icon: 'calendar-outline',
    route: 'AdminExamList',
  },
  {
    title: 'Exam Syllabus',
    sub: 'The chapters each exam covers',
    icon: 'book-outline',
    route: 'AdminExamSyllabus',
  },
  {
    title: 'Exam Papers',
    sub: 'Question papers for each exam, class and subject',
    icon: 'document-text-outline',
    route: 'AdminExamPapers',
  },
];

const AdminExamScreen = ({ navigation }: any) => (
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

export default AdminExamScreen;

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

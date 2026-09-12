import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { getExams } from '../../api/examApi';
import type { Exam } from './examData';
import { examWhen, shortRange, sortExams } from './examUi';

/**
 * Student "Exams" hub — the way into everything exam-related, with the exam
 * that matters right now underneath.
 */

const TITLE = 'Exams';

const ENTRIES = [
  {
    title: 'Exams',
    sub: 'Upcoming, ongoing and completed exams',
    icon: 'calendar-outline',
    route: 'ExamsScreen',
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

const ExamMainScreen = ({ navigation }: any) => {
  // The exam under way, or else the next one coming. Best effort: when the list
  // cannot be fetched the hub simply goes without it.
  const [next, setNext] = useState<Exam | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await getExams();
      setNext(sortExams(list).find(e => e.status !== 'Completed') ?? null);
    } catch (e: any) {
      console.log('[getExams] Error:', e?.response?.status, e?.message);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  const live = next?.status === 'Ongoing';

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {ENTRIES.map((item, i) => (
          <TouchableOpacity
            key={item.route}
            style={s.row}
            activeOpacity={0.6}
            onPress={() => navigation.navigate(item.route)}
          >
            <View style={s.rowIcon}>
              <VectorIcon
                iconSet="Ionicons"
                iconName={item.icon}
                size={20}
                color={theme.colors.textSecondary}
              />
            </View>
            <View style={[s.rowMain, i < ENTRIES.length - 1 && s.rowDivider]}>
              <View style={s.rowText}>
                <Text style={s.rowTitle}>{item.title}</Text>
                <Text style={s.rowSub} numberOfLines={1}>
                  {item.sub}
                </Text>
              </View>
              <VectorIcon
                iconSet="Ionicons"
                iconName="chevron-forward"
                size={16}
                color={theme.colors.textMuted}
              />
            </View>
          </TouchableOpacity>
        ))}

        {/* The exam that matters right now */}
        {!!next && (
          <>
            <View style={s.divider} />
            <TouchableOpacity
              style={s.next}
              activeOpacity={0.6}
              onPress={() => navigation.navigate('ExamDetail', { examId: next.id, exam: next })}
            >
              <Text style={[s.kicker, live && s.accent]}>{live ? 'ONGOING' : 'UP NEXT'}</Text>
              <View style={s.nextLine}>
                <View style={s.rowText}>
                  <Text style={s.nextName} numberOfLines={1}>
                    {next.name}
                  </Text>
                  <Text style={s.nextWhen}>
                    {[shortRange(next), examWhen(next)].filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
                <VectorIcon
                  iconSet="Ionicons"
                  iconName="chevron-forward"
                  size={16}
                  color={theme.colors.textMuted}
                />
              </View>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

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

  divider: { height: 1, backgroundColor: theme.colors.divider, marginTop: 8 },

  // Up next
  next: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted },
  accent: { color: theme.colors.primary },
  nextLine: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  nextName: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary },
  nextWhen: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

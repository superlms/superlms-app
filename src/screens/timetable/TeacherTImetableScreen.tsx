import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import type { Day } from './timetableData';
import { DaySelector, PeriodRow, currentPeriodId, dateForDay, defaultDay, schoolToday } from './timetableUi';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  getTeacherTimetable,
  buildDayMap,
  timetableErrorMessage,
  type TimetablePeriod,
} from '../../api/timetableApi';

const TITLE = 'Timetable';

const TeacherTimetableScreen = ({ navigation }: any) => {
  const [selectedDay, setSelectedDay] = useState<Day>(defaultDay());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayMap, setDayMap] = useState<Record<Day, TimetablePeriod[]> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTeacherTimetable();
      setDayMap(buildDayMap(res?.timetable_by_day));
    } catch (e: any) {
      console.log('[getTeacherTimetable] ❌', e?.response?.status, e?.message);
      setError(timetableErrorMessage(e));
      setDayMap(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  const periods = useMemo(() => dayMap?.[selectedDay] ?? [], [dayMap, selectedDay]);
  const liveId = currentPeriodId(periods, selectedDay === schoolToday());

  // Which class it is for, and whether someone else is covering it.
  const classFor = (p: TimetablePeriod) =>
    [
      [p.standard, p.section].filter(Boolean).join(' – '),
      p.has_substitute ? 'Arranged' : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <DaySelector selected={selectedDay} onSelect={setSelectedDay} />
      <View style={s.fullDivider} />

      {loading && !refreshing ? (
        <View style={s.list}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[s.skeletonRow, i < 4 && s.rowDivider]}>
              <Skeleton width={56} height={13} />
              <View style={s.skeletonBody}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="35%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.list, periods.length === 0 && s.listEmpty]}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {periods.length === 0 ? (
            <DocNoData
              icon="time-outline"
              title="No classes"
              subtitle={`You are not teaching on ${selectedDay}.`}
            />
          ) : (
            <>
              <View style={s.dayHead}>
                <Text style={s.dayTitle}>{dateForDay(selectedDay).format('dddd, D MMMM')}</Text>
                <Text style={s.dayCount}>
                  {periods.length} {periods.length === 1 ? 'class' : 'classes'}
                </Text>
              </View>
              {periods.map((p, i) => (
                <PeriodRow
                  key={p.id}
                  period={p}
                  meta={classFor(p)}
                  isNow={p.id === liveId}
                  isLast={i === periods.length - 1}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default TeacherTimetableScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  dayHead: { paddingTop: 14, paddingBottom: 6 },
  dayTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  dayCount: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },

  // Loading
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  skeletonBody: { flex: 1, gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

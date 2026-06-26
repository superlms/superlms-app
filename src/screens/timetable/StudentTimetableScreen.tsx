import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { DAYS } from './timetableData';
import type { Day } from './timetableData';
import {
  getStudentTimetable,
  buildDayMap,
  subjectVisual,
  fmtTime,
  timetableErrorMessage,
  type TimetablePeriod,
} from '../../api/timetableApi';

// ─── Period Row ───────────────────────────────────────────────────────────────
const PeriodRow = ({
  period,
  isLast,
}: {
  period: TimetablePeriod;
  isLast: boolean;
}) => {
  const v = subjectVisual(period.subject);
  const teacherName = period.has_substitute
    ? period.substitute_details?.substitute_teacher_name ?? period.teacher
    : period.teacher;

  return (
    <View style={[s.periodRow, !isLast && s.rowBorder]}>
      <View style={[s.periodIcon, { backgroundColor: v.bg }]}>
        <Text style={s.periodEmoji}>{v.icon}</Text>
      </View>

      <View style={s.periodInfo}>
        <Text style={s.periodSubject}>{period.subject}</Text>
        <View style={s.metaRow}>
          <VectorIcon
            iconSet="Ionicons"
            iconName="person-outline"
            size={11}
            color={theme.colors.textMuted}
          />
          <Text style={s.periodMeta}>{teacherName}</Text>
          {period.has_substitute && (
            <View style={s.subChip}>
              <Text style={s.subChipText}>Substitute</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[s.timeBadge, { backgroundColor: v.color + '18' }]}>
        <Text style={[s.timeBadgeText, { color: v.color }]}>
          {fmtTime(period.start_time)}
        </Text>
        <Text style={[s.timeBadgeSub, { color: v.color }]}>
          {fmtTime(period.end_time)}
        </Text>
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const StudentTimetableScreen = ({ navigation }: any) => {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
  }) as Day;
  const defaultDay: Day = DAYS.includes(today as Day)
    ? (today as Day)
    : 'Monday';
  const [selectedDay, setSelectedDay] = useState<Day>(defaultDay);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayMap, setDayMap] = useState<Record<Day, TimetablePeriod[]> | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentTimetable();
      setDayMap(buildDayMap(res?.timetable_by_day));
    } catch (e: any) {
      console.log('[getStudentTimetable] Error:', e?.response?.status, e?.message);
      setError(timetableErrorMessage(e));
      setDayMap(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  const periods = useMemo(() => dayMap?.[selectedDay] ?? [], [dayMap, selectedDay]);

  return (
    <View style={s.root}>
      <Header title="Timetable" onBackPress={() => navigation.goBack()} />

      {/* ── Day selector ── */}
      <View style={s.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
        >
          {DAYS.map(day => {
            const active = selectedDay === day;
            return (
              <TouchableOpacity
                key={day}
                style={[s.filterBtn, active && s.filterBtnActive]}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.8}
              >
                <Text style={[s.filterText, active && s.filterTextActive]}>
                  {day.slice(0, 3)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}>
          <ScreenSkeleton variant="list" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <View style={s.stateIconWrap}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="cloud-offline-outline"
              size={30}
              color={theme.colors.danger}
            />
          </View>
          <Text style={s.stateTitle}>Couldn't load timetable</Text>
          <Text style={s.stateText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.85}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="refresh"
              size={15}
              color={theme.colors.primary}
            />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* ── Single day card ── */}
          <View style={s.card}>
            <View style={[s.accentBar, { backgroundColor: theme.colors.primary }]} />
            <View style={s.cardInner}>
              <View style={s.cardTop}>
                <View style={s.iconWrap}>
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="calendar-outline"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{selectedDay}</Text>
                  <Text style={s.cardSubtitle}>
                    {periods.length} period{periods.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              <View style={s.divider} />

              {periods.length === 0 ? (
                <View style={s.empty}>
                  <Text style={{ fontSize: 40 }}>🎉</Text>
                  <Text style={s.emptyTitle}>No Classes</Text>
                  <Text style={s.emptySub}>Nothing scheduled for {selectedDay}.</Text>
                </View>
              ) : (
                periods.map((period, i) => (
                  <PeriodRow
                    key={period.id}
                    period={period}
                    isLast={i === periods.length - 1}
                  />
                ))
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default StudentTimetableScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: 32 },

  // States
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: 10,
  },
  stateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stateTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  stateText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  // Substitute chip
  subChip: {
    backgroundColor: '#FEF3C7',
    borderRadius: theme.radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 4,
  },
  subChipText: { fontSize: 9, fontWeight: '700', color: '#D97706' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  emptySub: { fontSize: 13, color: theme.colors.textMuted },

  // Day selector (exam-style filter chips)
  filterWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  filterRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: 8,
    alignItems: 'center',
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  filterBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterTextActive: { color: '#fff' },

  // Card (transport template)
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: theme.spacing.md },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginTop: 12,
  },

  // Period row
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  periodIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodEmoji: { fontSize: 18 },
  periodInfo: { flex: 1, gap: 3 },
  periodSubject: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaDot: { fontSize: 12, color: theme.colors.textMuted },
  periodMeta: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  timeBadge: {
    alignItems: 'center',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 76,
  },
  timeBadgeText: { fontSize: 11, fontWeight: '800' },
  timeBadgeSub: { fontSize: 10, fontWeight: '600', opacity: 0.7, marginTop: 1 },

  // Break row
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  breakEmoji: { fontSize: 13 },
  breakText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  breakTime: { fontSize: 11, color: theme.colors.textMuted },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

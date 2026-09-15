import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import { CommonActions } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { FullDivider } from '../calendar/calendarUi';
import { getMyAttendance } from '../../api/attendanceApi';

/**
 * The academic year so far: one percentage, the totals, then each month with
 * its bar — a month opens onto its attendance on the Attendance screen.
 *
 * A screen of its own on the stack rather than a Modal: an Android Modal is
 * its own window, and the status bar changed colour whenever it opened.
 */

const TITLE = 'Attendance Analytics';

// The academic year's months so far, newest first. It starts in April, so the
// last is April.
const sessionMonthKeys = (): string[] => {
  const now = moment();
  const startYear = now.month() >= 3 ? now.year() : now.year() - 1;
  const start = moment({ year: startYear, month: 3, day: 1 });
  const count = now.diff(start, 'months') + 1;
  return Array.from({ length: count }, (_, i) => now.clone().subtract(i, 'month').format('YYYY-MM'));
};

// Same banding as the performance screen.
const bandFor = (pct: number): string => {
  if (pct >= 90) return 'Outstanding';
  if (pct >= 75) return 'Excellent';
  if (pct >= 60) return 'Good';
  if (pct >= 45) return 'Average';
  return 'Needs improvement';
};

// Below three quarters is the point at which a month is worth looking at.
const LOW = 75;

const Bar = ({ pct, low }: { pct: number; low: boolean }) => (
  <View style={s.barBg}>
    <View
      style={[
        s.barFill,
        { width: `${Math.max(2, Math.min(pct, 100))}%` as any },
        low && s.barFillLow,
      ]}
    />
  </View>
);

interface MonthAnalytics {
  key: string;
  label: string;
  workDays: number;
  presentDays: number;
  absentDays: number;
  holidayDays: number;
  pct: number;
  /** The month's first day marked present or absent, if any. */
  firstMarked: string | null;
}

// ── Loading ──────────────────────────────────────────────────────────────────
// The page line for line: the year's percentage, its line and the from–to
// dates, the four totals, then a row per month — its name and percentage, bar,
// counts and arrow.
const AnalyticsSkeleton = ({ months, range }: { months: number; range: boolean }) => {
  const n = Math.max(months, 1);
  return (
    <View>
      <View style={[s.head, s.skHead]}>
        <Skeleton width={130} height={11} />
        <Skeleton width={96} height={40} />
        <Skeleton width="62%" height={13} />
        {range && <Skeleton width="52%" height={13} />}
      </View>

      <FullDivider />

      <View style={s.body}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[s.infoRow, i < 3 && s.infoRowBorder]}>
            <View style={s.fill}>
              <Skeleton width="38%" height={13} />
            </View>
            <Skeleton width={28} height={13} />
          </View>
        ))}
      </View>

      <FullDivider />

      <View style={s.section}>
        <View style={s.skSectionTitle}>
          <Skeleton width={110} height={13} />
        </View>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={[s.monthRow, i < n - 1 && s.monthDivider]}>
            <View style={[s.monthBody, s.skMonthBody]}>
              <View style={s.monthLine}>
                <View style={s.fill}>
                  <Skeleton width={70} height={14} />
                </View>
                <Skeleton width={34} height={14} />
              </View>
              <Skeleton width="70%" height={4} radius={2} />
              <Skeleton width="58%" height={12} />
            </View>
            <Skeleton width={10} height={14} />
          </View>
        ))}
      </View>
    </View>
  );
};

const AttendanceAnalyticsScreen = ({ navigation, route }: any) => {
  // The Attendance screen this came from, told which month was tapped.
  const returnKey: string | undefined = route?.params?.returnKey;

  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<MonthAnalytics[]>([]);

  const load = useCallback(async () => {
    const keys = sessionMonthKeys();
    const results = await Promise.all(keys.map(k => getMyAttendance(k).catch(() => null)));
    setMonths(
      results.map((r, idx) => {
        const key = keys[idx];
        const sum = r?.summary;
        const holidayDays = r ? r.days.filter(d => d.status === 'holiday').length : 0;
        const workDays = sum?.working_days ?? 0;
        const presentDays = sum?.present_days ?? 0;
        const absentDays = sum?.absent_days ?? 0;
        // Holidays don't count — Sundays come back as holidays unmarked.
        const firstMarked =
          r?.days
            .filter(d => d.status === 'present' || d.status === 'absent')
            .map(d => d.date)
            .sort()[0] ?? null;
        return {
          key,
          label: moment(key, 'YYYY-MM').format('MMM YYYY'),
          workDays,
          presentDays,
          absentDays,
          holidayDays,
          pct: workDays > 0 ? Math.round((presentDays / workDays) * 100) : 0,
          firstMarked,
        };
      }),
    );
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // The skeleton stands in while a pull to refresh runs.
  const { refreshing, onRefresh } = useRefresh(load);

  // A month tapped: back to Attendance, showing that month.
  const openMonth = (key: string) => {
    if (returnKey) {
      navigation.dispatch({ ...CommonActions.setParams({ month: key, monthAt: Date.now() }), source: returnKey });
    }
    navigation.goBack();
  };

  const overall = months.reduce(
    (acc, m) => ({
      workDays: acc.workDays + m.workDays,
      presentDays: acc.presentDays + m.presentDays,
      absentDays: acc.absentDays + m.absentDays,
      holidayDays: acc.holidayDays + m.holidayDays,
    }),
    { workDays: 0, presentDays: 0, absentDays: 0, holidayDays: 0 },
  );
  const overallPct =
    overall.workDays > 0 ? Math.round((overall.presentDays / overall.workDays) * 100) : 0;

  const rows: [string, string][] = [
    ['Working days', String(overall.workDays)],
    ['Present', String(overall.presentDays)],
    ['Absent', String(overall.absentDays)],
    ['Holiday', String(overall.holidayDays)],
  ];

  // A month the year has not reached yet has nothing to say.
  const recorded = months.filter(m => m.workDays > 0);

  // The span the figures cover: from the first day attendance was marked this
  // year, up to today.
  const firstMarked = months
    .map(m => m.firstMarked)
    .filter((d): d is string => !!d)
    .sort()[0];

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      {loading || refreshing ? (
        // A row per month there was, or per month of the year before the first load.
        <AnalyticsSkeleton
          months={months.length > 0 ? recorded.length : sessionMonthKeys().length}
          range={months.length === 0 || !!firstMarked}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* The year so far, in one number */}
          <View style={s.head}>
            <Text style={s.kicker}>THIS ACADEMIC YEAR</Text>
            <Text style={s.pct}>{overallPct}%</Text>
            <Text style={s.band}>
              {bandFor(overallPct)} · {overall.presentDays} of {overall.workDays} working days
            </Text>
            {!!firstMarked && (
              <Text style={s.range}>
                From <Text style={s.rangeDate}>{moment(firstMarked).format('D MMM YYYY')}</Text> to{' '}
                <Text style={s.rangeDate}>{moment().format('D MMM YYYY')}</Text>
              </Text>
            )}
          </View>

          <FullDivider />

          <View style={s.body}>
            {rows.map(([label, value], i) => (
              <View key={label} style={[s.infoRow, i < rows.length - 1 && s.infoRowBorder]}>
                <Text style={s.infoLabel}>{label}</Text>
                <Text style={s.infoValue}>{value}</Text>
              </View>
            ))}
          </View>

          <FullDivider />

          {/* Month by month — each opens onto that month's attendance */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Month by month</Text>

            {recorded.length === 0 ? (
              <DocNoData
                icon="clipboard-outline"
                title="Nothing recorded yet"
                subtitle="Months appear here once attendance has been marked."
              />
            ) : (
              recorded.map((m, i) => {
                const low = m.pct < LOW;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[s.monthRow, i < recorded.length - 1 && s.monthDivider]}
                    activeOpacity={0.6}
                    onPress={() => openMonth(m.key)}
                  >
                    <View style={s.monthBody}>
                      <View style={s.monthLine}>
                        <Text style={s.monthLabel}>{m.label}</Text>
                        <Text style={[s.monthPct, low && s.monthPctLow]}>{m.pct}%</Text>
                      </View>
                      <Bar pct={m.pct} low={low} />
                      <Text style={s.monthMeta}>
                        {m.presentDays} present · {m.absentDays} absent · {m.workDays} working
                      </Text>
                    </View>
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName="chevron-forward"
                      size={14}
                      color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default AttendanceAnalyticsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  scroll: { paddingBottom: 40 },

  // Head
  head: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted },
  pct: {
    fontSize: 40,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    lineHeight: 48,
    marginTop: 4,
  },
  band: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  range: { fontSize: 13, color: theme.colors.textMuted, marginTop: 8 },
  rangeDate: { fontWeight: '600', color: theme.colors.textPrimary },

  // Totals
  body: { paddingHorizontal: 20, paddingTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  infoLabel: { flex: 1, fontSize: 14, color: theme.colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },

  // Month by month — rows on dividers, each with its arrow
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  monthDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  monthBody: { flex: 1, gap: 7 },
  monthLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthLabel: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  monthPct: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  monthPctLow: { color: theme.colors.danger },
  monthMeta: { fontSize: 12, color: theme.colors.textMuted },

  // The bar runs across part of the row, not all of it.
  barBg: {
    width: '70%',
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: theme.colors.primary },
  barFillLow: { backgroundColor: theme.colors.danger },

  // Loading
  skHead: { gap: 8 },
  skSectionTitle: { marginBottom: 6 },
  skMonthBody: { gap: 9 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

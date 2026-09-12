import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { FullDivider } from '../calendar/calendarUi';
import { getMyAttendance } from '../../api/attendanceApi';

const TITLE = 'Attendance Analytics';

// The analytics view aggregates the current academic year, which starts in April.

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
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

const AttendanceAnalyticsModal = ({ visible, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState<MonthAnalytics[]>([]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        // The academic year starts in April. List its months newest first, so
        // the last row is April.
        const now = moment();
        const academicStartYear = now.month() >= 3 ? now.year() : now.year() - 1;
        const academicStart = moment({ year: academicStartYear, month: 3, day: 1 });
        const monthsCount = now.diff(academicStart, 'months') + 1;
        const keys = Array.from({ length: monthsCount }, (_, i) =>
          now.clone().subtract(i, 'month').format('YYYY-MM'),
        );
        const results = await Promise.all(keys.map(k => getMyAttendance(k).catch(() => null)));
        if (!active) return;

        setMonths(
          results.map((r, idx) => {
            const key = keys[idx];
            const sum = r?.summary;
            const holidayDays = r ? r.days.filter(d => d.status === 'holiday').length : 0;
            const workDays = sum?.working_days ?? 0;
            const presentDays = sum?.present_days ?? 0;
            const absentDays = sum?.absent_days ?? 0;
            return {
              key,
              label: moment(key, 'YYYY-MM').format('MMM YYYY'),
              workDays,
              presentDays,
              absentDays,
              holidayDays,
              pct: workDays > 0 ? Math.round((presentDays / workDays) * 100) : 0,
            };
          }),
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible]);

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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={onClose} />

        {loading && months.length === 0 ? (
          <View style={s.loading}>
            <Skeleton width="45%" height={40} />
            <Skeleton width="65%" height={14} />
            <View style={s.loadingRows}>
              {[0, 1, 2, 3, 4].map(i => (
                <Skeleton key={i} width="100%" height={14} />
              ))}
            </View>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            {/* The year so far, in one number */}
            <View style={s.head}>
              <Text style={s.kicker}>THIS ACADEMIC YEAR</Text>
              <Text style={s.pct}>{overallPct}%</Text>
              <Text style={s.band}>
                {bandFor(overallPct)} · {overall.presentDays} of {overall.workDays} working days
              </Text>
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

            {/* Month by month */}
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
                    <View
                      key={m.key}
                      style={[s.monthRow, i < recorded.length - 1 && s.infoRowBorder]}
                    >
                      <View style={s.monthLine}>
                        <Text style={s.monthLabel}>{m.label}</Text>
                        <Text style={[s.monthPct, low && s.monthPctLow]}>{m.pct}%</Text>
                      </View>
                      <Bar pct={m.pct} low={low} />
                      <Text style={s.monthMeta}>
                        {m.presentDays} present · {m.absentDays} absent · {m.workDays} working
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

export default AttendanceAnalyticsModal;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
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

  // Totals
  body: { paddingHorizontal: 20, paddingTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  infoLabel: { flex: 1, fontSize: 14, color: theme.colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },

  // Month by month
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 },
  monthRow: { paddingVertical: 13, gap: 7 },
  monthLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthLabel: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  monthPct: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  monthPctLow: { color: theme.colors.danger },
  monthMeta: { fontSize: 12, color: theme.colors.textMuted },

  barBg: { height: 4, borderRadius: 2, backgroundColor: theme.colors.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: theme.colors.primary },
  barFillLow: { backgroundColor: theme.colors.danger },

  // Loading
  loading: { paddingHorizontal: 20, paddingTop: 24, gap: 10 },
  loadingRows: { marginTop: 26, gap: 16 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

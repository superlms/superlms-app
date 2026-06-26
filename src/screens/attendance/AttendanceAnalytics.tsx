import React, { useEffect, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { STATUS_META } from './attendanceTypes';
import { getMyAttendance } from '../../api/attendanceApi';

// The analytics view aggregates the current academic year, which starts in April.

// Same banding as the performance screen
const getAttendanceLabel = (pct: number) => {
  if (pct >= 90)
    return { label: 'Outstanding', color: '#16A34A', bg: '#DCFCE7', icon: 'trophy' };
  if (pct >= 75)
    return { label: 'Excellent', color: '#0EA5E9', bg: '#E0F2FE', icon: 'star' };
  if (pct >= 60)
    return { label: 'Good', color: '#4F46E5', bg: '#E0E7FF', icon: 'thumbs-up' };
  if (pct >= 45)
    return { label: 'Average', color: '#D97706', bg: '#FEF3C7', icon: 'trending-up' };
  return {
    label: 'Needs Improvement',
    color: '#DC2626',
    bg: '#FEE2E2',
    icon: 'alert-circle',
  };
};

const ProgressBar = ({ pct, color }: { pct: number; color: string }) => (
  <View style={s.barBg}>
    <View
      style={[
        s.barFill,
        { width: `${Math.min(pct, 100)}%` as any, backgroundColor: color },
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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        // Academic year starts in April. List the current academic year's months
        // newest-first, so the bottom-most card is April.
        const now = moment();
        const academicStartYear = now.month() >= 3 ? now.year() : now.year() - 1;
        const academicStart = moment({ year: academicStartYear, month: 3, day: 1 });
        const monthsCount = now.diff(academicStart, 'months') + 1;
        const keys = Array.from({ length: monthsCount }, (_, i) =>
          now.clone().subtract(i, 'month').format('YYYY-MM'),
        );
        const results = await Promise.all(
          keys.map(k => getMyAttendance(k).catch(() => null)),
        );
        if (!active) return;
        const ms: MonthAnalytics[] = results.map((r, idx) => {
          const key = keys[idx];
          const s = r?.summary;
          const holidayDays = r ? r.days.filter(d => d.status === 'holiday').length : 0;
          const workDays = s?.working_days ?? 0;
          const presentDays = s?.present_days ?? 0;
          const absentDays = s?.absent_days ?? 0;
          const pct = workDays > 0 ? Math.round((presentDays / workDays) * 100) : 0;
          return {
            key,
            label: moment(key, 'YYYY-MM').format('MMMM YYYY'),
            workDays,
            presentDays,
            absentDays,
            holidayDays,
            pct,
          };
        });
        setMonths(ms);
        setExpandedKey(ms[0]?.key ?? null);
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
    overall.workDays > 0
      ? Math.round((overall.presentDays / overall.workDays) * 100)
      : 0;
  const overallPerf = getAttendanceLabel(overallPct);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <Header title="Attendance Analytics" onBackPress={onClose} />

        {loading && months.length === 0 ? (
          <View style={s.loadingBox}>
            <ScreenSkeleton variant="dashboard" />
          </View>
        ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.container}
        >
          {/* ── Overall Summary Card ── */}
          <View style={s.summaryCard}>
            <View
              style={[s.summaryAccent, { backgroundColor: overallPerf.color }]}
            />
            <View style={s.summaryInner}>
              <View style={s.summaryTop}>
                <View>
                  <Text style={s.summaryTitle}>Overall Attendance</Text>
                  <Text style={s.summarySubtitle}>
                    {months.length} months · {overall.workDays} working days
                  </Text>
                </View>
                <View
                  style={[s.summaryIconBadge, { backgroundColor: overallPerf.bg }]}
                >
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName={overallPerf.icon}
                    size={20}
                    color={overallPerf.color}
                  />
                </View>
              </View>

              <View style={s.circleRow}>
                <View style={[s.circle, { borderColor: overallPerf.color }]}>
                  <Text style={[s.circlePercent, { color: overallPerf.color }]}>
                    {overallPct}%
                  </Text>
                  <Text style={s.circleLabel}>Present</Text>
                </View>
                <View style={s.summaryStats}>
                  <View style={s.statItem}>
                    <Text
                      style={[s.statValue, { color: STATUS_META.present.color }]}
                    >
                      {overall.presentDays}
                    </Text>
                    <Text style={s.statLabel}>Present</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.statItem}>
                    <Text
                      style={[s.statValue, { color: STATUS_META.absent.color }]}
                    >
                      {overall.absentDays}
                    </Text>
                    <Text style={s.statLabel}>Absent</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.statItem}>
                    <Text
                      style={[s.statValue, { color: STATUS_META.holiday.color }]}
                    >
                      {overall.holidayDays}
                    </Text>
                    <Text style={s.statLabel}>Holiday</Text>
                  </View>
                </View>
              </View>

              <View style={[s.perfBadge, { backgroundColor: overallPerf.bg }]}>
                <VectorIcon
                  iconSet="Ionicons"
                  iconName={overallPerf.icon}
                  size={15}
                  color={overallPerf.color}
                />
                <Text style={[s.perfBadgeText, { color: overallPerf.color }]}>
                  {overallPerf.label}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Month-wise Breakdown ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Month-wise Breakdown</Text>
            {months.map(m => {
              const perf = getAttendanceLabel(m.pct);
              const isExpanded = expandedKey === m.key;
              const statusRows = [
                {
                  label: 'Present',
                  value: m.presentDays,
                  pct:
                    m.workDays > 0 ? (m.presentDays / m.workDays) * 100 : 0,
                  color: STATUS_META.present.color,
                },
                {
                  label: 'Absent',
                  value: m.absentDays,
                  pct: m.workDays > 0 ? (m.absentDays / m.workDays) * 100 : 0,
                  color: STATUS_META.absent.color,
                },
                {
                  label: 'Holiday',
                  value: m.holidayDays,
                  pct: m.workDays > 0 ? (m.holidayDays / m.workDays) * 100 : 0,
                  color: STATUS_META.holiday.color,
                },
              ];

              return (
                <View key={m.key} style={s.monthCard}>
                  <TouchableOpacity
                    style={s.monthHeader}
                    onPress={() => setExpandedKey(isExpanded ? null : m.key)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.monthIconWrap, { backgroundColor: perf.bg }]}>
                      <VectorIcon
                        iconSet="Ionicons"
                        iconName={perf.icon}
                        size={18}
                        color={perf.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.monthName}>{m.label}</Text>
                      <Text style={s.monthMeta}>
                        {m.workDays} working days · {m.holidayDays} holidays
                      </Text>
                    </View>
                    <View style={s.monthHeaderRight}>
                      <Text style={[s.monthPct, { color: perf.color }]}>
                        {m.pct}%
                      </Text>
                      <Text style={s.monthMarks}>
                        {m.presentDays}/{m.workDays}
                      </Text>
                      <VectorIcon
                        iconSet="Ionicons"
                        iconName={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={theme.colors.textMuted}
                      />
                    </View>
                  </TouchableOpacity>

                  <View style={s.monthBarRow}>
                    <ProgressBar pct={m.pct} color={perf.color} />
                  </View>

                  {isExpanded && (
                    <View style={s.statusList}>
                      {statusRows.map(row => (
                        <View key={row.label} style={s.statusRow}>
                          <View
                            style={[s.statusDot, { backgroundColor: row.color }]}
                          />
                          <View style={{ flex: 1, gap: 4 }}>
                            <View style={s.statusTopRow}>
                              <Text style={s.statusName}>{row.label}</Text>
                              <View style={s.statusRight}>
                                <Text style={s.statusDays}>
                                  {row.value} day{row.value !== 1 ? 's' : ''}
                                </Text>
                                <Text
                                  style={[s.statusPct, { color: row.color }]}
                                >
                                  {Math.round(row.pct)}%
                                </Text>
                              </View>
                            </View>
                            <ProgressBar pct={row.pct} color={row.color} />
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
        )}
      </View>
    </Modal>
  );
};

export default AttendanceAnalyticsModal;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: 16, paddingBottom: 30 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Progress bar
  barBg: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },

  // Summary card
  summaryCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  summaryAccent: { height: 5 },
  summaryInner: { padding: theme.spacing.lg, gap: 14 },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  summarySubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  summaryIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  circleRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  circle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePercent: { fontSize: 22, fontWeight: '800' },
  circleLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },

  summaryStats: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: theme.colors.textMuted },
  statDivider: { width: 1, height: 30, backgroundColor: theme.colors.border },

  perfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  perfBadgeText: { fontSize: 13, fontWeight: '700' },

  // Sections
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },

  // Month card (exam-wise breakdown style)
  monthCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: 10,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: theme.spacing.md,
  },
  monthIconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  monthMeta: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  monthHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthPct: { fontSize: 15, fontWeight: '800' },
  monthMarks: { fontSize: 11, color: theme.colors.textSecondary },
  monthBarRow: { paddingHorizontal: theme.spacing.md, paddingBottom: 10 },

  // Status breakdown rows
  statusList: { paddingBottom: 6 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  statusTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  statusRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDays: { fontSize: 12, color: theme.colors.textSecondary },
  statusPct: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

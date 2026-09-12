import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { LEGEND, STATUS_META, type AttendanceStatus } from './attendanceTypes';
import { WEEK_LABELS, chunkWeeks } from '../calendar/calendarTypes';
import { CELL, DAY, FullDivider, MonthBar } from '../calendar/calendarUi';
import MonthYearPicker from '../calendar/MonthYearPicker';
import AttendanceAnalyticsModal from './AttendanceAnalytics';
import { DocHeader } from '../more/docUi';
import {
  getMyAttendance,
  attendanceErrorMessage,
  type MyAttendance,
  type MyAttendanceStatus,
} from '../../api/attendanceApi';

const TITLE = 'Attendance';

// ── The month, with each day wearing its status ──────────────────────────────
// Weeks start on Monday. A recorded day carries a soft tint behind its number;
// today is ringed, and the day being read is filled in the accent colour.
const AttendanceGrid = ({
  month,
  statusFor,
  selected,
  onSelectDate,
}: {
  month: moment.Moment;
  statusFor: (iso: string) => AttendanceStatus;
  selected: string | null;
  onSelectDate: (iso: string) => void;
}) => {
  const today = moment().format('YYYY-MM-DD');

  const weeks = useMemo(() => {
    const start = month.clone().startOf('month');
    const end = month.clone().endOf('month');
    const offset = (start.day() + 6) % 7;
    const days: (string | null)[] = Array(offset).fill(null);
    for (let d = start.clone(); d.isSameOrBefore(end); d.add(1, 'day')) {
      days.push(d.format('YYYY-MM-DD'));
    }
    while (days.length % 7 !== 0) days.push(null);
    return chunkWeeks(days);
  }, [month]);

  return (
    <View>
      <View style={s.weekRow}>
        {WEEK_LABELS.map((l, i) => (
          <View key={i} style={s.cell}>
            <Text style={s.weekLabel}>{l}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={s.weekRow}>
          {week.map((iso, di) => {
            if (!iso) return <View key={`e${wi}${di}`} style={s.cell} />;

            const status = statusFor(iso);
            const meta = STATUS_META[status];
            const isToday = iso === today;
            const isSelected = iso === selected;

            return (
              <TouchableOpacity
                key={iso}
                style={s.cell}
                activeOpacity={0.6}
                onPress={() => onSelectDate(iso)}
              >
                <View
                  style={[
                    s.dayInner,
                    !!meta.fill && { backgroundColor: meta.fill },
                    isToday && s.dayToday,
                    isSelected && s.daySelected,
                  ]}
                >
                  <Text
                    style={[
                      s.dayNum,
                      { color: meta.ink },
                      status === 'present' && s.dayNumMarked,
                      isSelected && s.dayNumSelected,
                    ]}
                  >
                    {moment(iso).date()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const AttendanceScreen = () => {
  const [currentMonth, setCurrentMonth] = useState(moment());
  const [pickerVisible, setPickerVisible] = useState(false);
  const [analyticsVisible, setAnalyticsVisible] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<MyAttendance | null>(null);

  const monthKey = currentMonth.format('YYYY-MM');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResp(await getMyAttendance(monthKey));
    } catch (e: any) {
      console.log('[getMyAttendance] ❌', e?.response?.status, e?.message);
      setError(attendanceErrorMessage(e));
      setResp(null);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  // date → status, for a quick lookup from the grid.
  const statusByDate = useMemo(() => {
    const map: Record<string, MyAttendanceStatus> = {};
    resp?.days?.forEach(d => {
      map[d.date] = d.status;
    });
    return map;
  }, [resp]);

  // Sundays are always a holiday, whatever was recorded against them.
  const statusFor = useCallback(
    (iso: string): AttendanceStatus => {
      if (moment(iso, 'YYYY-MM-DD').day() === 0) return 'holiday';
      return (statusByDate[iso] ?? 'not_marked') as AttendanceStatus;
    },
    [statusByDate],
  );

  const summary = resp?.summary;
  const presentDays = summary?.present_days ?? 0;
  const absentDays = summary?.absent_days ?? 0;
  const workDays = summary?.working_days ?? 0;
  const holidayDays =
    summary?.holiday_days ?? Math.max(0, (summary?.total_days ?? 0) - workDays);
  const presentPct = summary ? Number(summary.present_percentage ?? 0).toFixed(1) : '0.0';

  const rows: [string, string][] = [
    ['Working days', String(workDays)],
    ['Present', String(presentDays)],
    ['Absent', String(absentDays)],
    ['Holiday', String(holidayDays)],
  ];

  // Only explain the tints that are actually on the grid this month — a legend
  // entry for a status nobody has is just noise.
  const legend = useMemo(() => {
    const present = new Set<AttendanceStatus>();
    const days = currentMonth.daysInMonth();
    for (let d = 1; d <= days; d++) {
      present.add(statusFor(`${monthKey}-${String(d).padStart(2, '0')}`));
    }
    return LEGEND.filter(k => present.has(k));
  }, [currentMonth, monthKey, statusFor]);

  // Paging to another month drops a selection that no longer belongs to it.
  const shiftMonth = (delta: number) => {
    setSelected(null);
    setCurrentMonth(m => m.clone().add(delta, 'month'));
  };

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        rightIcon="stats-chart-outline"
        onRightPress={() => setAnalyticsVisible(true)}
      />

      <MonthBar
        label={currentMonth.format('MMMM YYYY')}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        onPressLabel={() => setPickerVisible(true)}
      />
      <FullDivider />

      {loading && !refreshing ? (
        <View style={s.loading}>
          <Skeleton width="100%" height={250} radius={12} />
          <View style={s.loadingRows}>
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} width="100%" height={14} />
            ))}
          </View>
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
          contentContainerStyle={s.scroll}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={s.grid}>
            <AttendanceGrid
              month={currentMonth}
              statusFor={statusFor}
              selected={selected}
              onSelectDate={iso => setSelected(prev => (prev === iso ? null : iso))}
            />
          </View>

          {/* The day being read, or what the tints mean */}
          {selected ? (
            <Text style={s.readout}>
              {moment(selected).format('dddd, D MMMM')} ·{' '}
              <Text style={s.readoutStatus}>{STATUS_META[statusFor(selected)].label}</Text>
            </Text>
          ) : (
            <View style={s.legend}>
              {legend.map(k => (
                <View key={k} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: STATUS_META[k].ink }]} />
                  <Text style={s.legendText}>{STATUS_META[k].label}</Text>
                </View>
              ))}
            </View>
          )}

          <FullDivider />

          {/* The month in numbers */}
          <View style={s.body}>
            <View style={s.pctRow}>
              <Text style={s.pct}>{presentPct}%</Text>
              <Text style={s.pctCaption}>present this month</Text>
            </View>

            {rows.map(([label, value], i) => (
              <View key={label} style={[s.infoRow, i < rows.length - 1 && s.infoRowBorder]}>
                <Text style={s.infoLabel}>{label}</Text>
                <Text style={s.infoValue}>{value}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <MonthYearPicker
        visible={pickerVisible}
        current={currentMonth}
        onClose={() => setPickerVisible(false)}
        onSelect={m => {
          setSelected(null);
          setCurrentMonth(m);
        }}
      />

      <AttendanceAnalyticsModal
        visible={analyticsVisible}
        onClose={() => setAnalyticsVisible(false)}
      />
    </View>
  );
};

export default AttendanceScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },

  // Grid
  grid: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  weekRow: { flexDirection: 'row' },
  cell: { width: CELL, alignItems: 'center', paddingVertical: 3 },
  weekLabel: { fontSize: 11, fontWeight: '500', color: theme.colors.textMuted, paddingVertical: 6 },
  dayInner: {
    width: DAY,
    height: DAY,
    borderRadius: DAY / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayToday: { borderColor: theme.colors.primary },
  daySelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayNum: { fontSize: 14 },
  dayNumMarked: { fontWeight: '500' },
  dayNumSelected: { color: theme.colors.white, fontWeight: '600' },

  // What the tints mean, or the day being read
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 12, color: theme.colors.textMuted },
  readout: { paddingHorizontal: 20, paddingBottom: 18, fontSize: 13, color: theme.colors.textSecondary },
  readoutStatus: { fontWeight: '600', color: theme.colors.textPrimary },

  // The month in numbers
  body: { paddingHorizontal: 20, paddingTop: 18 },
  pctRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  pct: { fontSize: 30, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 36 },
  pctCaption: { fontSize: 13, color: theme.colors.textMuted },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  infoLabel: { flex: 1, fontSize: 14, color: theme.colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },

  // Loading
  loading: { paddingHorizontal: 20, paddingTop: 16 },
  loadingRows: { marginTop: 26, gap: 16 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

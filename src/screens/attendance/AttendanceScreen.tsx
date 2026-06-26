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
import moment from 'moment';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { STATUS_META } from './attendanceTypes';
import type { AttendanceStatus } from './attendanceTypes';
import MonthYearPicker from '../calendar/MonthYearPicker';
import AttendanceAnalyticsModal from './AttendanceAnalytics';
import {
  getMyAttendance,
  attendanceErrorMessage,
  type MyAttendance,
  type MyAttendanceStatus,
} from '../../api/attendanceApi';

const AttendanceScreen = () => {
  const [currentMonth, setCurrentMonth] = useState(moment());
  const [pickerVisible, setPickerVisible] = useState(false);
  const [analyticsVisible, setAnalyticsVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<MyAttendance | null>(null);

  const monthKey = currentMonth.format('YYYY-MM');
  const today = moment().format('YYYY-MM-DD');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getMyAttendance(monthKey);
      setResp(r);
    } catch (e: any) {
      console.log('[getMyAttendance] Error:', e?.response?.status, e?.message);
      setError(attendanceErrorMessage(e));
      setResp(null);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  // Map fetched days (YYYY-MM-DD → status) for quick lookup
  const statusByDate = useMemo(() => {
    const map: Record<string, MyAttendanceStatus> = {};
    resp?.days?.forEach(d => {
      map[d.date] = d.status;
    });
    return map;
  }, [resp]);

  const days = useMemo(() => {
    const totalDays = currentMonth.daysInMonth();
    return Array.from({ length: totalDays }, (_, i) => {
      const d = i + 1;
      const iso = `${monthKey}-${String(d).padStart(2, '0')}`;
      const m = moment(iso, 'YYYY-MM-DD');
      // Sundays are always holidays, regardless of any recorded status.
      const isSunday = m.day() === 0;
      const status = (
        isSunday ? 'holiday' : statusByDate[iso] ?? null
      ) as AttendanceStatus | null;
      return {
        serial: d,
        date: m.format('DD MMM'),
        day: m.format('ddd'),
        isToday: iso === today,
        status,
      };
    });
  }, [monthKey, currentMonth, today, statusByDate]);

  const summary = resp?.summary;
  const presentDays = summary?.present_days ?? 0;
  const absentDays = summary?.absent_days ?? 0;
  const workDays = summary?.working_days ?? 0;
  const holidayDays =
    summary?.holiday_days ?? Math.max(0, (summary?.total_days ?? 0) - workDays);
  const presentPct = summary
    ? Number(summary.present_percentage ?? 0).toFixed(1)
    : '0.0';

  return (
    <View style={s.root}>
      <Header title="Attendance" />

      {/* ── Month selector ── */}
      <View style={s.monthBar}>
        <TouchableOpacity
          style={s.monthArrow}
          onPress={() => setCurrentMonth(m => m.clone().subtract(1, 'month'))}
          activeOpacity={0.7}
        >
          <VectorIcon
            iconSet="Ionicons"
            iconName="chevron-back"
            size={18}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.monthLabelBtn}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.8}
        >
          <VectorIcon
            iconSet="Ionicons"
            iconName="calendar-outline"
            size={15}
            color={theme.colors.primary}
          />
          <Text style={s.monthLabelText}>
            {currentMonth.format('MMMM YYYY')}
          </Text>
          <VectorIcon
            iconSet="Ionicons"
            iconName="chevron-down"
            size={14}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.monthArrow}
          onPress={() => setCurrentMonth(m => m.clone().add(1, 'month'))}
          activeOpacity={0.7}
        >
          <VectorIcon
            iconSet="Ionicons"
            iconName="chevron-forward"
            size={18}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.analyticsBtn}
          onPress={() => setAnalyticsVisible(true)}
          activeOpacity={0.8}
        >
          <VectorIcon
            iconSet="Ionicons"
            iconName="stats-chart"
            size={16}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ScreenSkeleton variant="dashboard" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <View style={[s.stateIconWrap, { backgroundColor: '#FEE2E2' }]}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="cloud-offline-outline"
              size={32}
              color={theme.colors.danger}
            />
          </View>
          <Text style={s.stateTitle}>Couldn't load attendance</Text>
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
          {/* ── Single month card ── */}
          <View style={s.card}>
            <View style={[s.accentBar, { backgroundColor: theme.colors.primary }]} />
            <View style={s.cardInner}>
              <View style={s.cardTop}>
                <View style={s.iconWrap}>
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="clipboard-outline"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>
                    {currentMonth.format('MMMM YYYY')}
                  </Text>
                  <Text style={s.cardSubtitle}>
                    {workDays} working days · {presentDays} present
                  </Text>
                </View>
                <View style={s.pctBadge}>
                  <Text style={s.pctBadgeText}>{presentPct}%</Text>
                </View>
              </View>

            {/* Table header */}
            <View style={[s.tableRow, s.tableHead]}>
              <Text style={[s.tableHeadText, s.colSerial]}>#</Text>
              <Text style={[s.tableHeadText, s.colDate]}>Date</Text>
              <Text style={[s.tableHeadText, s.colDay]}>Day</Text>
              <Text style={[s.tableHeadText, s.colStatus]}>Status</Text>
            </View>

            {/* Day rows */}
            {days.map((row, i) => {
              // Future days in the month render as a plain dash.
              const isDash = !row.status || row.status === 'upcoming';
              const sc = isDash ? null : STATUS_META[row.status as AttendanceStatus];
              return (
                <View
                  key={row.serial}
                  style={[
                    s.tableRow,
                    i < days.length - 1 && s.rowBorder,
                    row.isToday && s.todayRow,
                  ]}
                >
                  <Text style={[s.serialText, s.colSerial]}>{row.serial}</Text>
                  <Text style={[s.dateText, s.colDate]}>{row.date}</Text>
                  <Text style={[s.dayText, s.colDay]}>{row.day}</Text>
                  <View style={[s.colStatusBox, s.colStatus]}>
                    {sc ? (
                      <View style={[s.badge, { backgroundColor: sc.bg }]}>
                        <View
                          style={[s.badgeDot, { backgroundColor: sc.color }]}
                        />
                        <Text style={[s.badgeText, { color: sc.color }]}>
                          {sc.label}
                        </Text>
                      </View>
                    ) : (
                      <Text style={s.noDataText}>–</Text>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Footer totals */}
            <View style={s.tableFooter}>
              <View style={s.footerItem}>
                <View
                  style={[
                    s.footerDot,
                    { backgroundColor: STATUS_META.present.color },
                  ]}
                />
                <Text style={s.footerLabel}>Present</Text>
                <Text style={s.footerValue}>{presentDays}</Text>
              </View>
              <View style={s.footerDivider} />
              <View style={s.footerItem}>
                <View
                  style={[
                    s.footerDot,
                    { backgroundColor: STATUS_META.absent.color },
                  ]}
                />
                <Text style={s.footerLabel}>Absent</Text>
                <Text style={s.footerValue}>{absentDays}</Text>
              </View>
              <View style={s.footerDivider} />
              <View style={s.footerItem}>
                <View
                  style={[
                    s.footerDot,
                    { backgroundColor: STATUS_META.holiday.color },
                  ]}
                />
                <Text style={s.footerLabel}>Holiday</Text>
                <Text style={s.footerValue}>{holidayDays}</Text>
              </View>
            </View>
          </View>
          </View>
        </ScrollView>
      )}

      <MonthYearPicker
        visible={pickerVisible}
        current={currentMonth}
        onClose={() => setPickerVisible(false)}
        onSelect={m => setCurrentMonth(m)}
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
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
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

  // Month selector bar
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  monthArrow: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
  },
  monthLabelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  monthLabelText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  analyticsBtn: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card (timetable template)
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

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
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
  pctBadge: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pctBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  // Table
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  tableHead: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    marginBottom: 2,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  todayRow: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.sm,
  },
  tableHeadText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  colSerial: { width: 28 },
  colDate: { flex: 1 },
  colDay: { flex: 1 },
  colStatus: { flex: 1.4, textAlign: 'right' },
  colStatusBox: { alignItems: 'flex-end' },
  serialText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  dayText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  noDataText: { fontSize: 12, color: theme.colors.textMuted },

  // Status badge (exam style)
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Footer totals
  tableFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  footerDot: { width: 7, height: 7, borderRadius: 4 },
  footerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  footerValue: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  footerDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.border,
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

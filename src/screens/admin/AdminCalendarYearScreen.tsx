import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { YearMonth, getAdminCalendarYear } from '../../api/adminContentApi';
import { FullDivider, MonthBar } from '../calendar/calendarUi';
import { WEEK_LABELS, chunkWeeks } from '../calendar/calendarTypes';
import { BODY, INK, QUIET } from '../notification/inboxUi';
import { DocHeader } from '../more/docUi';

/**
 * The year at a glance, as the admin panel's Yearly view has it: every month
 * with how many events it holds, and its days with a dot under each one that
 * has any. A month opens the calendar on it. The month grids are the Calendar's
 * own — weeks from Monday, today in the accent colour — only smaller.
 */

const TITLE = 'Calendar';
const GAP = 16;

// One month, small: its name and total, the weekday letters and its days.
const MiniMonth = ({
  year,
  data,
  width,
  onPress,
}: {
  year: number;
  data: YearMonth;
  width: number;
  onPress: () => void;
}) => {
  const cell = Math.floor(width / 7);
  const today = moment().format('YYYY-MM-DD');

  const weeks = useMemo(() => {
    const start = moment({ year, month: data.month - 1, date: 1 });
    const offset = (start.day() + 6) % 7;
    const days: (string | null)[] = Array(offset).fill(null);
    for (let d = start.clone(); d.month() === data.month - 1; d.add(1, 'day')) {
      days.push(d.format('YYYY-MM-DD'));
    }
    while (days.length % 7 !== 0) days.push(null);
    return chunkWeeks(days);
  }, [year, data.month]);

  return (
    <TouchableOpacity style={[s.month, { width }]} activeOpacity={0.6} onPress={onPress}>
      <View style={s.monthHead}>
        <Text style={s.monthName}>{data.name}</Text>
        <Text style={[s.monthCount, data.total > 0 && s.monthCountOn]}>
          {data.total} {data.total === 1 ? 'event' : 'events'}
        </Text>
      </View>
      <View style={s.weekRow}>
        {WEEK_LABELS.map((l, i) => (
          <View key={i} style={[s.cell, { width: cell }]}>
            <Text style={s.weekLabel}>{l}</Text>
          </View>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={s.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={`e${di}`} style={[s.cell, { width: cell }]} />;
            const has = (data.days?.[day] ?? 0) > 0;
            const isToday = day === today;
            const isSunday = moment(day).day() === 0;
            return (
              <View key={day} style={[s.cell, { width: cell }]}>
                <Text style={[s.dayNum, isSunday && s.dayNumSunday, isToday && s.dayNumToday]}>
                  {moment(day).date()}
                </Text>
                <View style={[s.dot, has && s.dotOn]} />
              </View>
            );
          })}
        </View>
      ))}
    </TouchableOpacity>
  );
};

// The twelve months' outlines while the year loads.
const YearSkeleton = ({ width }: { width: number }) => (
  <View style={s.gridWrap}>
    {Array.from({ length: 12 }, (_, i) => (
      <View key={i} style={[s.month, { width }]}>
        <View style={s.monthHead}>
          <Skeleton width={70} height={13} />
          <Skeleton width={46} height={10} />
        </View>
        <Skeleton width={width} height={118} radius={8} />
      </View>
    ))}
  </View>
);

const AdminCalendarYearScreen = ({ navigation, route }: any) => {
  const { width } = useWindowDimensions();
  const colW = Math.floor((width - 40 - GAP) / 2);

  const [year, setYear] = useState<number>(route?.params?.year ?? moment().year());
  const [months, setMonths] = useState<YearMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMonths(await getAdminCalendarYear(year));
    } catch (e) {
      setError(apiErr(e, 'Could not load the year.'));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const { refreshing, onRefresh } = useRefresh(load);

  const total = months.reduce((sum, m) => sum + (m.total || 0), 0);

  // A month opens the calendar on it.
  const openMonth = (m: number) =>
    navigation.popTo('AdminCalendarHome', { month: `${year}-${String(m).padStart(2, '0')}` });

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <MonthBar label={String(year)} onPrev={() => setYear(y => y - 1)} onNext={() => setYear(y => y + 1)} />
      {loading ? (
        <View style={s.skStats}>
          <Skeleton width={120} height={10} />
        </View>
      ) : (
        !error && (
          <Text style={s.stats}>
            {total} {total === 1 ? 'event' : 'events'} in {year}
          </Text>
        )
      )}
      <FullDivider />

      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <YearSkeleton width={colW} />
        </ScrollView>
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
          <View style={s.gridWrap}>
            {months.map(m => (
              <MiniMonth key={m.month} year={year} data={m} width={colW} onPress={() => openMonth(m.month)} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default AdminCalendarYearScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  stats: { paddingHorizontal: 20, paddingBottom: 12, fontSize: 12, color: QUIET },
  skStats: { height: 16, paddingHorizontal: 20, marginBottom: 12, justifyContent: 'center' },

  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22 },

  // One month
  month: {},
  monthHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  monthName: { fontSize: 14, fontWeight: '600', color: INK },
  monthCount: { fontSize: 11, color: QUIET },
  monthCountOn: { color: theme.colors.primary, fontWeight: '600' },
  weekRow: { flexDirection: 'row' },
  cell: { alignItems: 'center', paddingVertical: 2 },
  weekLabel: { fontSize: 9, fontWeight: '500', color: theme.colors.textMuted, paddingVertical: 3 },
  dayNum: { fontSize: 11, color: theme.colors.textPrimary },
  dayNumSunday: { color: theme.colors.textMuted },
  dayNumToday: { color: theme.colors.primary, fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 1.5, marginTop: 1, backgroundColor: 'transparent' },
  dotOn: { backgroundColor: theme.colors.primary },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: BODY, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

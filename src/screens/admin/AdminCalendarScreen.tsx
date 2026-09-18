import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AdminEvent, CalendarStats, getAdminCalendarMonth } from '../../api/adminContentApi';
import MonthYearPicker from '../calendar/MonthYearPicker';
import { CELL, DAY, FullDivider, MonthBar, MonthGrid } from '../calendar/calendarUi';
import { BODY, INK, QUIET, InboxRow, InboxRowSkeleton } from '../notification/inboxUi';
import { DocHeader } from '../more/docUi';
import { EVENT_TYPES, rowTiming, typeIcon, typeLabel } from './adminCalendarUi';

/**
 * The school's calendar, drawn as a student's Calendar is — the month bar, the
 * month's grid with a dot under each day that has events, the chosen day with
 * its events as rows and tabs for their kind — with what the admin panel's
 * School Calendar adds: its counts (today, this week, the month in view, this
 * year) under the month, the month's upcoming and completed events under the
 * day, the year at a glance from the header, and + to add an event on the
 * chosen day. A row opens the event, to edit or delete.
 */

const TITLE = 'Calendar';

type TabKey = 'all' | string;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  ...EVENT_TYPES.map(t => ({ key: t.key as TabKey, label: t.label })),
];

// ── Loading ──────────────────────────────────────────────────────────────────
// The month as it will be drawn — the weekday letters, a number in every day
// that exists, the chosen day's circle — then the day heading and a few rows.
const CalendarSkeleton = ({ month, selected }: { month: moment.Moment; selected: string }) => {
  const first = month.clone().startOf('month');
  const offset = (first.day() + 6) % 7; // weeks start Monday
  const days = month.daysInMonth();
  const cells = Math.ceil((offset + days) / 7) * 7;

  return (
    <View>
      <View style={s.grid}>
        <View style={s.skWeekRow}>
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} style={s.skCell}>
              <View style={s.skWeekLabel}>
                <Skeleton width={9} height={9} />
              </View>
            </View>
          ))}
        </View>
        {Array.from({ length: cells / 7 }, (_, w) => (
          <View key={w} style={s.skWeekRow}>
            {Array.from({ length: 7 }, (__, d) => {
              const n = w * 7 + d - offset + 1;
              const exists = n >= 1 && n <= days;
              const date = exists ? first.clone().add(n - 1, 'day').format('YYYY-MM-DD') : '';
              return (
                <View key={d} style={s.skCell}>
                  <View style={s.skDayCircle}>
                    {exists &&
                      (date === selected ? (
                        <Skeleton width={DAY} height={DAY} radius={DAY / 2} />
                      ) : (
                        <Skeleton width={n < 10 ? 9 : 17} height={12} />
                      ))}
                  </View>
                  <View style={s.skDot} />
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <FullDivider />

      <View style={s.skDayHead}>
        <Skeleton width={150} height={14} />
        <Skeleton width={46} height={10} />
      </View>
      <View style={s.skTabs}>
        {[18, 34, 34, 52, 38, 48].map((w, i) => (
          <View key={i} style={s.skTab}>
            <Skeleton width={w} height={11} />
          </View>
        ))}
      </View>
      <FullDivider />
      <View style={s.list}>
        {[0, 1, 2].map(i => (
          <InboxRowSkeleton key={i} index={i} isLast={i === 2} metaWidth={90} />
        ))}
      </View>
    </View>
  );
};

/** A heading over a run of the month's events: "Upcoming in September · 3". */
const ListHead = ({ title, count }: { title: string; count: number }) => (
  <View style={s.dayHead}>
    <Text style={s.dayTitle}>{title}</Text>
    <Text style={s.dayCount}>
      {count} {count === 1 ? 'event' : 'events'}
    </Text>
  </View>
);

const AdminCalendarScreen = ({ navigation, route }: any) => {
  const today = moment().format('YYYY-MM-DD');
  const [month, setMonth] = useState(moment().startOf('month'));
  const [selectedDate, setSelectedDate] = useState(today);
  const [tab, setTab] = useState<TabKey>('all');
  const [pickerVisible, setPickerVisible] = useState(false);

  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [stats, setStats] = useState<CalendarStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthKey = month.format('YYYY-MM');

  // A month at a time, with the panel's counts.
  const load = useCallback(
    async (showSkeleton = true) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const res = await getAdminCalendarMonth(monthKey);
        setEvents(res.events);
        setStats(res.stats ?? null);
      } catch (e) {
        setError(apiErr(e, 'Could not load the calendar.'));
      } finally {
        setLoading(false);
      }
    },
    [monthKey],
  );

  // A month loads with the skeleton: on opening, and whenever it changes.
  useEffect(() => {
    load(true);
  }, [load]);

  // Coming back (from an event or the form) refreshes quietly; the first
  // focus is the mount, already loading above.
  const focusedOnce = useRef(false);
  useFocusLoad(() => {
    if (!focusedOnce.current) {
      focusedOnce.current = true;
      return;
    }
    load(false);
  });

  const { refreshing, onRefresh } = useRefresh(() => load(true));

  // A day with events selects that day's tab from All again.
  const selectDate = (date: string) => {
    setSelectedDate(date);
    setTab('all');
  };

  // Moving to a month selects today when it is this month, else its first day.
  const goToMonth = useCallback(
    (m: moment.Moment) => {
      const start = m.clone().startOf('month');
      setMonth(start);
      setSelectedDate(start.isSame(moment(), 'month') ? today : start.format('YYYY-MM-DD'));
      setTab('all');
    },
    [today],
  );

  // A month picked on the year's page opens here.
  const pickedMonth: string | undefined = route?.params?.month;
  useEffect(() => {
    if (pickedMonth) {
      goToMonth(moment(pickedMonth, 'YYYY-MM'));
      navigation.setParams({ month: undefined });
    }
  }, [pickedMonth, goToMonth, navigation]);

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, AdminEvent[]> = {};
    events.forEach(e => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });
    return grouped;
  }, [events]);

  const marked = useMemo(() => {
    const map: Record<string, boolean> = {};
    Object.keys(eventsByDate).forEach(d => {
      map[d] = true;
    });
    return map;
  }, [eventsByDate]);

  const dayEvents = eventsByDate[selectedDate] ?? [];
  const shown = tab === 'all' ? dayEvents : dayEvents.filter(e => e.event_type === tab);

  // The month's events from today on, and those whose day has passed — newest first.
  const upcoming = useMemo(() => events.filter(e => e.date >= today), [events, today]);
  const completed = useMemo(
    () =>
      events
        .filter(e => e.date < today)
        .sort((a, b) => (a.date === b.date ? (b.start_time ?? '').localeCompare(a.start_time ?? '') : b.date.localeCompare(a.date))),
    [events, today],
  );

  const open = (e: AdminEvent) => navigation.navigate('AdminCalendarDetail', { item: e });
  const addOn = (date: string) => navigation.navigate('AdminCalendarForm', { date });

  const statsLine = stats
    ? `Today ${stats.today} · This week ${stats.this_week} · This month ${stats.current_month} · This year ${stats.this_year}`
    : '';

  const monthName = month.format('MMMM');

  // A run of the month's events, the day and time on each row.
  const monthRows = (list: AdminEvent[]) =>
    list.map((e, i) => (
      <InboxRow
        key={e.id}
        icon={typeIcon(e.event_type)}
        title={e.title}
        body={e.description ?? undefined}
        kind={`${typeLabel(e.event_type)} · ${moment(e.date).format('ddd, D MMM')}`}
        time={rowTiming(e)}
        attachment={!!e.attachment}
        tinted
        isLast={i === list.length - 1}
        onPress={() => open(e)}
      />
    ));

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={
          <View style={s.headActions}>
            <HeaderIconButton
              icon="grid-outline"
              onPress={() => navigation.navigate('AdminCalendarYear', { year: month.year() })}
            />
            <HeaderIconButton icon="add" size={22} onPress={() => addOn(selectedDate)} />
          </View>
        }
      />

      <MonthBar
        label={month.format('MMMM YYYY')}
        onPrev={() => goToMonth(month.clone().subtract(1, 'month'))}
        onNext={() => goToMonth(month.clone().add(1, 'month'))}
        onPressLabel={() => setPickerVisible(true)}
      />
      {/* The panel's counts */}
      {loading && !stats ? (
        <View style={s.skStats}>
          <Skeleton width={260} height={10} />
        </View>
      ) : (
        !!statsLine && <Text style={s.stats}>{statsLine}</Text>
      )}
      <FullDivider />

      {loading ? (
        <CalendarSkeleton month={month} selected={selectedDate} />
      ) : error ? (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(true)} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Month grid */}
          <View style={s.grid}>
            <MonthGrid month={month} selected={selectedDate} marked={marked} onSelectDate={selectDate} />
          </View>

          <FullDivider />

          {/* The chosen day */}
          <View style={s.dayHead}>
            <Text style={s.dayTitle}>{moment(selectedDate).format('dddd, D MMMM')}</Text>
            {dayEvents.length > 0 && (
              <Text style={s.dayCount}>
                {shown.length} {shown.length === 1 ? 'event' : 'events'}
              </Text>
            )}
          </View>

          {dayEvents.length === 0 ? (
            <View style={s.noEventRow}>
              <Text style={s.noEvent}>No event</Text>
              <TouchableOpacity onPress={() => addOn(selectedDate)} hitSlop={8}>
                <Text style={s.linkText}>Add event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Kind of event */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.tabsBar}
                contentContainerStyle={s.tabs}
              >
                {TABS.map(t => {
                  const active = tab === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      activeOpacity={0.6}
                      onPress={() => setTab(t.key)}
                      style={[s.tab, active && s.tabActive]}
                    >
                      <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <FullDivider />

              <View style={s.list}>
                {shown.length === 0 ? (
                  <Text style={s.noneOfType}>
                    No {typeLabel(tab).toLowerCase()} on this date
                  </Text>
                ) : (
                  shown.map((e, i) => (
                    <InboxRow
                      key={e.id}
                      icon={typeIcon(e.event_type)}
                      title={e.title}
                      body={e.description ?? undefined}
                      kind={typeLabel(e.event_type)}
                      time={rowTiming(e)}
                      attachment={!!e.attachment}
                      tinted
                      isLast={i === shown.length - 1}
                      onPress={() => open(e)}
                    />
                  ))
                )}
              </View>
            </>
          )}

          {/* The month's upcoming events, then those already done */}
          <View style={s.monthBlock}>
            <FullDivider />
            <ListHead title={`Upcoming in ${monthName}`} count={upcoming.length} />
            <View style={s.list}>
              {upcoming.length === 0 ? (
                <Text style={s.noneOfType}>No upcoming events scheduled this month</Text>
              ) : (
                monthRows(upcoming)
              )}
            </View>
          </View>

          {completed.length > 0 && (
            <View style={s.monthBlock}>
              <FullDivider />
              <ListHead title={`Completed in ${monthName}`} count={completed.length} />
              <View style={s.list}>{monthRows(completed)}</View>
            </View>
          )}
        </ScrollView>
      )}

      <MonthYearPicker
        visible={pickerVisible}
        current={month}
        onClose={() => setPickerVisible(false)}
        onSelect={goToMonth}
      />
    </View>
  );
};

export default AdminCalendarScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scroll: { paddingBottom: 40 },

  // Counts under the month
  stats: { paddingHorizontal: 20, paddingBottom: 12, fontSize: 12, color: QUIET },

  grid: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },

  // Day heading, and the month's lists under it
  dayHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  dayTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: INK },
  dayCount: { fontSize: 12, color: QUIET },
  noEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
  },
  noEvent: { fontSize: 14, color: QUIET },
  monthBlock: { marginTop: 8 },

  // Kind tabs
  tabsBar: { flexGrow: 0 },
  tabs: { paddingHorizontal: 20, paddingTop: 14, gap: 18 },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: BODY },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },

  list: { paddingHorizontal: 20, paddingTop: 2 },
  noneOfType: { paddingVertical: 18, fontSize: 14, color: QUIET },

  // Skeleton, at the sizes of what it stands in for
  skStats: { height: 16, paddingHorizontal: 20, marginBottom: 12, justifyContent: 'center' },
  skWeekRow: { flexDirection: 'row' },
  skCell: { width: CELL, alignItems: 'center', paddingVertical: 3 },
  skWeekLabel: { height: 27, justifyContent: 'center' },
  skDayCircle: { width: DAY, height: DAY, alignItems: 'center', justifyContent: 'center' },
  skDot: { height: 7 },
  skDayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 39,
    paddingTop: 18,
    paddingHorizontal: 20,
  },
  skTabs: { flexDirection: 'row', gap: 18, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  skTab: { height: 18, justifyContent: 'center' },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: BODY, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

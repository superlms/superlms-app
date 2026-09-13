import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import { Skeleton } from '../../components/Skeleton';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { FILTERS } from './calendarTypes';
import type { FilterType, CalEvent } from './calendarTypes';
import MonthYearPicker from './MonthYearPicker';
import { CELL, DAY, MonthBar, MonthGrid, FullDivider } from './calendarUi';
import { BODY, INK, QUIET, InboxRow, InboxRowSkeleton } from '../notification/inboxUi';
import { DocHeader } from '../more/docUi';
import { getCalendarEvents, mapApiEventToCalEvent } from '../../api/calendarApi';

const TITLE = 'Calendar';

// Each kind of event leads its row with its own filled icon.
const TYPE_ICON: Record<CalEvent['type'], string> = {
  Holiday: 'sunny',
  Exam: 'school',
  Event: 'calendar',
  Assignment: 'document-text',
};

// ── Loading ──────────────────────────────────────────────────────────────────
// The month as it will be drawn — the weekday letters, a number in every day
// that exists (the blanks before the 1st and after the last stay blank), the day
// heading, the type tabs and a few event rows — each box at the size of what it
// stands in for, so nothing moves when the events land.
const TAB_W = [18, 50, 34, 38, 76]; // All, Holiday, Exam, Event, Assignment

const CalendarSkeleton = ({ month }: { month: moment.Moment }) => {
  const offset = (month.clone().startOf('month').day() + 6) % 7; // weeks start Monday
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
            {Array.from({ length: 7 }, (_, d) => {
              const i = w * 7 + d;
              const exists = i >= offset && i < offset + days;
              return (
                <View key={d} style={s.skCell}>
                  <View style={s.skDayCircle}>
                    {exists && <Skeleton width={i - offset + 1 < 10 ? 9 : 17} height={12} />}
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
        <Skeleton width={170} height={14} />
        <Skeleton width={46} height={10} />
      </View>

      <View style={s.skTabs}>
        {TAB_W.map((w, i) => (
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

const CalendarScreen = ({ navigation }: any) => {
  const today = moment().format('YYYY-MM-DD');
  const [currentMonth, setCurrentMonth] = useState(moment());
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [pickerVisible, setPickerVisible] = useState(false);

  const [allEvents, setAllEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Events are fetched a month at a time.
  const fetchEvents = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true);
    setError(null);

    const startDate = currentMonth.clone().startOf('month').format('YYYY-MM-DD');
    const endDate = currentMonth.clone().endOf('month').format('YYYY-MM-DD');

    try {
      const apiEvents = await getCalendarEvents(startDate, endDate, undefined, 100);
      setAllEvents(apiEvents.map(mapApiEventToCalEvent));
    } catch (err: any) {
      console.error('[CalendarScreen] Error fetching events:', err?.message);
      setError('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  // A month loads with the skeleton: on opening, and whenever the month changes
  // (it used to keep the first month's events, so other months showed none).
  useEffect(() => {
    fetchEvents(true);
  }, [fetchEvents]);

  // Coming back to the screen refreshes quietly; the first focus is the mount,
  // already loading above.
  const focusedOnce = useRef(false);
  useFocusLoad(() => {
    if (!focusedOnce.current) {
      focusedOnce.current = true;
      return;
    }
    fetchEvents(false);
  });

  // Pulling to refresh shows the skeleton again.
  const { refreshing, onRefresh } = useRefresh(() => fetchEvents(true));

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalEvent[]> = {};
    allEvents.forEach(e => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });
    return grouped;
  }, [allEvents]);

  // Which days carry a dot in the grid.
  const marked = useMemo(() => {
    const map: Record<string, boolean> = {};
    Object.keys(eventsByDate).forEach(date => {
      map[date] = eventsByDate[date].length > 0;
    });
    return map;
  }, [eventsByDate]);

  const dayEvents = useMemo(() => eventsByDate[selectedDate] ?? [], [eventsByDate, selectedDate]);

  const filteredEvents = useMemo(
    () => (activeFilter === 'All' ? dayEvents : dayEvents.filter(e => e.type === activeFilter)),
    [dayEvents, activeFilter],
  );

  // A new day starts from every kind of event again.
  const selectDate = (date: string) => {
    setSelectedDate(date);
    setActiveFilter('All');
  };

  // Moving to a month selects today when it is this month, else its first day.
  const goToMonth = (m: moment.Moment) => {
    setCurrentMonth(m);
    selectDate(m.isSame(moment(), 'month') ? today : m.clone().startOf('month').format('YYYY-MM-DD'));
  };

  const shiftMonth = (delta: number) => goToMonth(currentMonth.clone().add(delta, 'month'));

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} />

      <MonthBar
        label={currentMonth.format('MMMM YYYY')}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        onPressLabel={() => setPickerVisible(true)}
      />
      <FullDivider />

      {loading ? (
        <CalendarSkeleton month={currentMonth} />
      ) : error ? (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchEvents(true)} hitSlop={10}>
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
            <MonthGrid
              month={currentMonth}
              selected={selectedDate}
              marked={marked}
              onSelectDate={selectDate}
            />
          </View>

          <FullDivider />

          {/* The selected day */}
          <View style={s.dayHead}>
            <Text style={s.dayTitle}>{moment(selectedDate).format('dddd, D MMMM')}</Text>
            {dayEvents.length > 0 && (
              <Text style={s.dayCount}>
                {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
              </Text>
            )}
          </View>

          {dayEvents.length === 0 ? (
            // Nothing that day: say so under the date, with no type filter to pick
            <Text style={s.noEvent}>No event</Text>
          ) : (
            <>
              {/* Type filter */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                // A horizontal ScrollView grows to fill a column by default.
                style={s.tabsBar}
                contentContainerStyle={s.tabs}
              >
                {FILTERS.map(f => {
                  const active = activeFilter === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      activeOpacity={0.6}
                      onPress={() => setActiveFilter(f)}
                      style={[s.tab, active && s.tabActive]}
                    >
                      <Text style={[s.tabText, active && s.tabTextActive]}>{f}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Line between the day selector and what is on that day */}
              <FullDivider />

              {/* Events on that day, as rows like Announcements */}
              <View style={s.list}>
                {filteredEvents.length === 0 ? (
                  <Text style={s.noneOfType}>No {activeFilter.toLowerCase()} on this date</Text>
                ) : (
                  filteredEvents.map((event, i) => (
                    <InboxRow
                      key={event.id}
                      icon={TYPE_ICON[event.type] ?? 'calendar'}
                      title={event.title}
                      body={event.description}
                      kind={event.type}
                      time={event.time}
                      tinted
                      isLast={i === filteredEvents.length - 1}
                      onPress={() => navigation.navigate('ViewEvent', { event })}
                    />
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      <MonthYearPicker
        visible={pickerVisible}
        current={currentMonth}
        onClose={() => setPickerVisible(false)}
        onSelect={goToMonth}
      />
    </View>
  );
};

export default CalendarScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },

  grid: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },

  // Selected day heading
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
  noEvent: { paddingHorizontal: 20, paddingTop: 6, fontSize: 14, color: QUIET },

  // Type filter tabs
  tabsBar: { flexGrow: 0 },
  tabs: { paddingHorizontal: 20, paddingTop: 14, gap: 18 },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: BODY },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },

  list: { paddingHorizontal: 20, paddingTop: 2 },
  noneOfType: { paddingVertical: 18, fontSize: 14, color: QUIET },

  // Skeleton — the grid's cells (weekday label 11px + 6 padding; a day circle
  // plus its dot) and the heading and tab lines at their real heights
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

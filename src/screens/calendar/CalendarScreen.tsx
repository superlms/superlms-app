import React, { useState, useMemo, useCallback } from 'react';
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
import { MonthBar, MonthGrid, EventRow, FullDivider } from './calendarUi';
import { DocHeader, DocNoData } from '../more/docUi';
import { getCalendarEvents, mapApiEventToCalEvent } from '../../api/calendarApi';

const TITLE = 'Calendar';

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
  const fetchEvents = useCallback(async () => {
    setLoading(true);
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

  const { refreshing, onRefresh } = useRefresh(fetchEvents);

  useFocusLoad(fetchEvents);

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

  const filteredEvents = useMemo(() => {
    const dayEvents = eventsByDate[selectedDate] ?? [];
    if (activeFilter === 'All') return dayEvents;
    return dayEvents.filter(e => e.type === activeFilter);
  }, [eventsByDate, selectedDate, activeFilter]);

  // A month the user pages to always starts on its first day.
  const shiftMonth = (delta: number) =>
    setCurrentMonth(m => m.clone().add(delta, 'month'));

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

      {loading && !refreshing ? (
        <View style={s.loading}>
          <Skeleton width="100%" height={260} radius={12} />
          <View style={s.loadingRows}>
            {[0, 1, 2].map(i => (
              <View key={i} style={s.loadingRow}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="80%" height={12} />
              </View>
            ))}
          </View>
        </View>
      ) : error ? (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchEvents} hitSlop={10}>
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
              onSelectDate={setSelectedDate}
            />
          </View>

          <FullDivider />

          {/* The selected day */}
          <View style={s.dayHead}>
            <Text style={s.dayTitle}>{moment(selectedDate).format('dddd, D MMMM')}</Text>
            <Text style={s.dayCount}>
              {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
            </Text>
          </View>

          {/* Type filter — a plain tab strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
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

          {/* Events on that day */}
          <View style={s.list}>
            {filteredEvents.length === 0 ? (
              <DocNoData
                icon="calendar-outline"
                title="Nothing scheduled"
                subtitle="No events on this date."
              />
            ) : (
              filteredEvents.map((event, i) => (
                <EventRow
                  key={event.id}
                  title={event.title}
                  description={event.description}
                  time={event.time}
                  meta={event.type}
                  isLast={i === filteredEvents.length - 1}
                  onPress={() => navigation.navigate('ViewEvent', { event })}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}

      <MonthYearPicker
        visible={pickerVisible}
        current={currentMonth}
        onClose={() => setPickerVisible(false)}
        onSelect={m => setCurrentMonth(m)}
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
  dayHead: { paddingHorizontal: 20, paddingTop: 18 },
  dayTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  dayCount: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  // Type filter tabs
  tabs: { paddingHorizontal: 20, paddingTop: 12, gap: 18 },
  tab: { paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },

  list: { paddingHorizontal: 20, paddingTop: 2 },

  // Loading
  loading: { paddingHorizontal: 20, paddingTop: 16 },
  loadingRows: { marginTop: 24, gap: 18 },
  loadingRow: { gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

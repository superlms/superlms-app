import React, { useState, useMemo, useEffect, useCallback } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import { theme, onThemeChange } from '../../utils/theme';
import {
  FILTERS,
  TYPE_META,
  WEEK_LABELS,
  chunkWeeks,
  groupEventsByDate,
  getEventTypesForDate,
} from './calendarTypes';
import type { FilterType, CalEvent } from './calendarTypes';
import MonthYearPicker from './MonthYearPicker';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getCalendarEvents, mapApiEventToCalEvent } from '../../api/calendarApi';

const { width } = Dimensions.get('window');
// screen - scroll padding (2×20) - card inner padding (2×14) - card border (2×1)
const CELL_SIZE = Math.floor((width - 70) / 7);

const CalendarScreen = ({ navigation }: any) => {
  const today = moment().format('YYYY-MM-DD');
  const [currentMonth, setCurrentMonth] = useState(moment());
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [pickerVisible, setPickerVisible] = useState(false);

  // API states
  const [allEvents, setAllEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch events when month changes
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

  const eventsByDate = useMemo(() => groupEventsByDate(allEvents), [allEvents]);

  const eventDates = useMemo(() => {
    const map: Record<string, Exclude<FilterType, 'All'>[]> = {};
    Object.keys(eventsByDate).forEach(date => {
      map[date] = getEventTypesForDate(eventsByDate[date]);
    });
    return map;
  }, [eventsByDate]);

  const filteredEvents = useMemo(() => {
    const dayEvents = eventsByDate[selectedDate] || [];
    if (activeFilter === 'All') return dayEvents;
    return dayEvents.filter(e => e.type === activeFilter);
  }, [selectedDate, activeFilter, eventsByDate]);

  const totalEvents = useMemo(() => {
    const monthStr = currentMonth.format('YYYY-MM');
    return allEvents.filter(e => e.date.startsWith(monthStr)).length;
  }, [allEvents, currentMonth]);

  const weeks = useMemo(() => {
    const start = currentMonth.clone().startOf('month');
    const end = currentMonth.clone().endOf('month');
    const offset = (start.day() + 6) % 7;
    const days: (string | null)[] = Array(offset).fill(null);
    for (let d = start.clone(); d.isSameOrBefore(end); d.add(1, 'day'))
      days.push(d.format('YYYY-MM-DD'));
    while (days.length % 7 !== 0) days.push(null);
    return chunkWeeks(days);
  }, [currentMonth]);

  return (
    <View style={s.root}>
      <Header title="Calendar" />

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
      </View>

      {loading ? (
        <View style={s.centeredBox}>
          <ScreenSkeleton variant="list" />
          <Text style={s.loaderText}>Loading events...</Text>
        </View>
      ) : error ? (
        <View style={s.centeredBox}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchEvents}>
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
          {/* ── Calendar grid card ── */}
          <View style={s.card}>
            <View
              style={[s.accentBar, { backgroundColor: theme.colors.primary }]}
            />
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
                  <Text style={s.cardTitle}>
                    {currentMonth.format('MMMM YYYY')}
                  </Text>
                  <Text style={s.cardSubtitle}>
                    {totalEvents} event{totalEvents !== 1 ? 's' : ''} this month
                  </Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Week labels */}
              <View style={s.weekRow}>
                {WEEK_LABELS.map((l, i) => (
                  <View key={i} style={s.cell}>
                    <Text
                      style={[
                        s.weekLabel,
                        i === 5 && s.satLabel,
                        i === 6 && s.sunLabel,
                      ]}
                    >
                      {l}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Day grid */}
              {weeks.map((week, wi) => (
                <View key={wi} style={s.weekRow}>
                  {week.map((day, di) => {
                    if (!day) return <View key={`e${wi}${di}`} style={s.cell} />;
                    const isSelected = day === selectedDate;
                    const isToday = day === today;
                    const dots = eventDates[day] ?? [];
                    const dow = moment(day).day();
                    return (
                      <TouchableOpacity
                        key={day}
                        activeOpacity={0.75}
                        onPress={() => setSelectedDate(day)}
                        style={s.cell}
                      >
                        <View
                          style={[
                            s.dayInner,
                            isSelected && s.daySelected,
                            isToday && !isSelected && s.dayToday,
                          ]}
                        >
                          <Text
                            style={[
                              s.dayNum,
                              isSelected && s.dayNumSelected,
                              isToday && !isSelected && s.dayNumToday,
                              dow === 0 && !isSelected && s.sunNum,
                              dow === 6 && !isSelected && s.satNum,
                            ]}
                          >
                            {moment(day).date()}
                          </Text>
                        </View>
                        <View style={s.dotsRow}>
                          {dots.slice(0, 3).map((t, ti) => (
                            <View
                              key={ti}
                              style={[
                                s.dot,
                                { backgroundColor: TYPE_META[t].color },
                              ]}
                            />
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          {/* ── Events card ── */}
          <View style={s.card}>
            <View
              style={[s.accentBar, { backgroundColor: theme.colors.secondary }]}
            />
            <View style={s.cardInner}>
              <View style={s.cardTop}>
                <View style={s.iconWrap}>
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="list-outline"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>
                    {moment(selectedDate).format('dddd, D MMMM')}
                  </Text>
                  <Text style={s.cardSubtitle}>
                    {filteredEvents.length} event
                    {filteredEvents.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={s.countBadge}>
                  <Text style={s.countBadgeText}>{filteredEvents.length}</Text>
                </View>
              </View>

              {/* Filter chips */}
              <View style={s.filtersRow}>
                {FILTERS.map(f => {
                  const active = activeFilter === f;
                  const meta = f !== 'All' ? TYPE_META[f] : null;
                  const activeColor = meta?.color ?? theme.colors.primary;
                  return (
                    <TouchableOpacity
                      key={f}
                      activeOpacity={0.8}
                      onPress={() => setActiveFilter(f)}
                      style={[
                        s.chip,
                        active && {
                          backgroundColor: activeColor,
                          borderColor: activeColor,
                        },
                      ]}
                    >
                      {meta && (
                        <VectorIcon
                          iconSet={meta.iconSet as any}
                          iconName={meta.icon}
                          size={11}
                          color={active ? '#fff' : meta.color}
                        />
                      )}
                      <Text
                        style={[
                          s.chipText,
                          active && s.chipTextActive,
                          !active && meta && { color: meta.color },
                        ]}
                      >
                        {f}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.divider} />

              {/* Event rows or empty */}
              {filteredEvents.length === 0 ? (
                <View style={s.emptyBox}>
                  <View style={s.emptyIconRing}>
                    <VectorIcon
                      iconSet="FontAwesome6"
                      iconName="calendar-xmark"
                      size={28}
                      color={theme.colors.primary}
                    />
                  </View>
                  <Text style={s.emptyTitle}>Nothing here</Text>
                  <Text style={s.emptySubtitle}>
                    No events scheduled for this date
                  </Text>
                </View>
              ) : (
                filteredEvents.map((event, idx) => {
                  const meta = TYPE_META[event.type];
                  const isLast = idx === filteredEvents.length - 1;
                  return (
                    <TouchableOpacity
                      key={event.id}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('ViewEvent', { event })}
                      style={[s.eventRow, !isLast && s.rowBorder]}
                    >
                      <View style={[s.eventIcon, { backgroundColor: meta.bg }]}>
                        <VectorIcon
                          iconSet={meta.iconSet as any}
                          iconName={meta.icon}
                          size={15}
                          color={meta.color}
                        />
                      </View>
                      <View style={s.eventInfo}>
                        <View style={s.eventTitleRow}>
                          <Text style={s.eventTitle} numberOfLines={1}>
                            {event.title}
                          </Text>
                          <View
                            style={[s.typeBadge, { backgroundColor: meta.bg }]}
                          >
                            <Text
                              style={[s.typeBadgeText, { color: meta.color }]}
                            >
                              {event.type}
                            </Text>
                          </View>
                        </View>
                        {!!event.description && (
                          <Text style={s.eventDescription} numberOfLines={2}>
                            {event.description}
                          </Text>
                        )}
                        {!!event.time && (
                          <View style={s.timeRow}>
                            <VectorIcon
                              iconSet="Feather"
                              iconName="clock"
                              size={11}
                              color={theme.colors.textMuted}
                            />
                            <Text style={s.timeText}>{event.time}</Text>
                          </View>
                        )}
                      </View>
                      <VectorIcon
                        iconSet="Ionicons"
                        iconName="chevron-forward"
                        size={16}
                        color={theme.colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
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
    </View>
  );
};

export default CalendarScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: 32, gap: 14 },

  // Month selector bar (same as attendance)
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

  // Loader / error
  centeredBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: { fontSize: 14, color: theme.colors.textSecondary },
  errorText: {
    fontSize: 14,
    color: theme.colors.danger,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: theme.colors.white },

  // Card (shared template)
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
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 12,
  },

  // Calendar grid
  weekRow: { flexDirection: 'row', marginBottom: 2 },
  cell: { width: CELL_SIZE, alignItems: 'center', paddingVertical: 2 },
  weekLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    paddingVertical: 4,
  },
  satLabel: { color: '#D97706' },
  sunLabel: { color: '#DC2626' },

  dayInner: {
    width: CELL_SIZE - 8,
    height: CELL_SIZE - 8,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: theme.colors.primary },
  dayToday: { borderWidth: 1.5, borderColor: theme.colors.primary },
  dayNum: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  dayNumSelected: { color: theme.colors.white, fontWeight: '800' },
  dayNumToday: { color: theme.colors.primary, fontWeight: '800' },
  satNum: { color: '#D97706' },
  sunNum: { color: '#DC2626' },

  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    marginTop: 2,
    alignItems: 'center',
  },
  dot: { width: 5, height: 5, borderRadius: 99 },

  // Filter chips (exam style)
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: theme.radius.full,
    paddingHorizontal: 13,
    paddingVertical: 6,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  chipTextActive: { color: '#fff' },

  // Event rows
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  eventIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: { flex: 1, gap: 4 },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  typeBadge: {
    borderRadius: theme.radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  eventDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '500' },

  // Empty state
  emptyBox: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  emptyIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

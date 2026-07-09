import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ApiEvent, getCalendarEvents } from '../../api/calendarApi';
import { colorFor } from './AdminCalendarFormScreen';

const { width } = Dimensions.get('window');
const CELL = Math.floor((width - 70) / 7);
const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const AdminCalendarMonthScreen = ({ navigation }: any) => {
  const [month, setMonth] = useState(moment());
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const today = moment().format('YYYY-MM-DD');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = month.clone().startOf('month').format('YYYY-MM-DD');
      const end = month.clone().endOf('month').format('YYYY-MM-DD');
      setEvents(await getCalendarEvents(start, end, undefined, 200));
    } catch (e) {
      console.log('[AdminCalendarMonth]', apiErr(e, 'load failed'));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // date -> up to 3 distinct colors of events on that date
  const dotsByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    events.forEach(e => {
      const c = e.color || colorFor(e.event_type);
      const arr = map[e.date] ?? (map[e.date] = []);
      if (!arr.includes(c) && arr.length < 3) arr.push(c);
    });
    return map;
  }, [events]);

  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach(e => { map[e.date] = (map[e.date] ?? 0) + 1; });
    return map;
  }, [events]);

  const weeks = useMemo(() => {
    const start = month.clone().startOf('month');
    const end = month.clone().endOf('month');
    const offset = (start.day() + 6) % 7;
    const days: (string | null)[] = Array(offset).fill(null);
    for (let d = start.clone(); d.isSameOrBefore(end); d.add(1, 'day')) days.push(d.format('YYYY-MM-DD'));
    while (days.length % 7 !== 0) days.push(null);
    const out: (string | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [month]);

  const onDatePress = (date: string) => {
    if (!countByDate[date]) return; // only dates that have events
    navigation.navigate('AdminCalendarDay', { date });
  };

  const total = events.length;

  return (
    <View style={s.root}>
      <Header title="Calendar" onBackPress={() => navigation.goBack()} />

      <View style={s.monthBar}>
        <TouchableOpacity style={s.arrow} onPress={() => setMonth(m => m.clone().subtract(1, 'month'))} activeOpacity={0.7}>
          <VectorIcon iconSet="Ionicons" iconName="chevron-back" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <View style={s.monthLabelBtn}>
          <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={15} color={theme.colors.primary} />
          <Text style={s.monthLabelText}>{month.format('MMMM YYYY')}</Text>
        </View>
        <TouchableOpacity style={s.arrow} onPress={() => setMonth(m => m.clone().add(1, 'month'))} activeOpacity={0.7}>
          <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.card}>
            <View style={[s.accentBar, { backgroundColor: theme.colors.primary }]} />
            <View style={s.cardInner}>
              <View style={s.cardTop}>
                <View style={s.iconWrap}>
                  <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={20} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{month.format('MMMM YYYY')}</Text>
                  <Text style={s.cardSubtitle}>{total} event{total !== 1 ? 's' : ''} this month · tap a marked date</Text>
                </View>
              </View>

              <View style={s.divider} />

              <View style={s.weekRow}>
                {WEEK_LABELS.map((l, i) => (
                  <View key={i} style={s.cell}>
                    <Text style={[s.weekLabel, i === 5 && { color: '#D97706' }, i === 6 && { color: '#DC2626' }]}>{l}</Text>
                  </View>
                ))}
              </View>

              {weeks.map((week, wi) => (
                <View key={wi} style={s.weekRow}>
                  {week.map((day, di) => {
                    if (!day) return <View key={`e${wi}${di}`} style={s.cell} />;
                    const isToday = day === today;
                    const dots = dotsByDate[day] ?? [];
                    const dow = moment(day).day();
                    return (
                      <TouchableOpacity key={day} activeOpacity={0.75} onPress={() => onDatePress(day)} style={s.cell}>
                        <View style={[s.dayInner, isToday && s.dayToday]}>
                          <Text style={[s.dayNum, isToday && s.dayNumToday, dow === 0 && { color: '#DC2626' }, dow === 6 && { color: '#D97706' }]}>
                            {moment(day).date()}
                          </Text>
                        </View>
                        <View style={s.dotsRow}>
                          {dots.map((c, ti) => <View key={ti} style={[s.dot, { backgroundColor: c }]} />)}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
          <Text style={s.hint}>Dates with a coloured dot have events. Tap one to view them.</Text>
        </ScrollView>
      )}
    </View>
  );
};

export default AdminCalendarMonthScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  arrow: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card },
  monthLabelBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  monthLabelText: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },

  scroll: { padding: 16 },
  card: { backgroundColor: theme.colors.card, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden', elevation: 2 },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 12 },

  weekRow: { flexDirection: 'row', marginBottom: 2 },
  cell: { width: CELL, alignItems: 'center', paddingVertical: 2 },
  weekLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted, paddingVertical: 4 },
  dayInner: { width: CELL - 8, height: CELL - 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 1.5, borderColor: theme.colors.primary },
  dayNum: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  dayNumToday: { color: theme.colors.primary, fontWeight: '800' },
  dotsRow: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 99 },

  hint: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', marginTop: 14 },
});

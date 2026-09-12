import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ApiEvent, getCalendarEvents } from '../../api/calendarApi';
import { MonthBar, MonthGrid, FullDivider } from '../calendar/calendarUi';
import { DocHeader } from '../more/docUi';

const TITLE = 'Calendar';

const AdminCalendarMonthScreen = ({ navigation }: any) => {
  const [month, setMonth] = useState(moment());
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);

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

  const { refreshing, onRefresh } = useRefresh(load);

  const marked = useMemo(() => {
    const map: Record<string, boolean> = {};
    events.forEach(e => { map[e.date] = true; });
    return map;
  }, [events]);

  const total = events.length;

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <MonthBar
        label={month.format('MMMM YYYY')}
        onPrev={() => setMonth(m => m.clone().subtract(1, 'month'))}
        onNext={() => setMonth(m => m.clone().add(1, 'month'))}
      />
      <FullDivider />

      {loading && !refreshing ? (
        <View style={s.loading}>
          <Skeleton width="100%" height={260} radius={12} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <MonthGrid month={month} marked={marked} onSelectDate={date => navigation.navigate('AdminCalendarDay', { date })} onlyMarked />

          <Text style={s.hint}>
            {total} {total === 1 ? 'event' : 'events'} this month. Tap a date with a dot to see
            what is on.
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

export default AdminCalendarMonthScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  loading: { paddingHorizontal: 20, paddingTop: 16 },
  hint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 24,
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

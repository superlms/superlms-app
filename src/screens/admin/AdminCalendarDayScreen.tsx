import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ApiEvent, getCalendarEvents } from '../../api/calendarApi';
import { EventRow, capitalize, timingLabel } from '../calendar/calendarUi';
import { DocHeader, DocNoData } from '../more/docUi';

const AdminCalendarDayScreen = ({ navigation, route }: any) => {
  const date: string = route?.params?.date;
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await getCalendarEvents(date, date, undefined, 100));
    } catch (e) {
      console.log('[AdminCalendarDay]', apiErr(e, 'load failed'));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { refreshing, onRefresh } = useRefresh(load);

  return (
    <View style={s.root}>
      <DocHeader
        title={moment(date).format('ddd, D MMM YYYY')}
        onBackPress={() => navigation.goBack()}
      />

      {loading && !refreshing ? (
        <View style={s.list}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[s.skeletonRow, i < 2 && s.rowDivider]}>
              <Skeleton width="55%" height={14} />
              <Skeleton width="80%" height={12} />
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {events.length === 0 ? (
            <DocNoData
              icon="calendar-outline"
              title="Nothing scheduled"
              subtitle="No events on this date."
            />
          ) : (
            <>
              <Text style={s.count}>
                {events.length} {events.length === 1 ? 'event' : 'events'}
              </Text>
              {events.map((e, i) => (
                <EventRow
                  key={e.id}
                  title={e.title}
                  description={e.description}
                  time={timingLabel(e.is_all_day, e.start_time, e.end_time)}
                  meta={capitalize(e.event_type)}
                  isLast={i === events.length - 1}
                  onPress={() => navigation.navigate('AdminCalendarDetail', { item: e })}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default AdminCalendarDayScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  skeletonRow: { paddingVertical: 14, gap: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useState } from 'react';
import {
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
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ApiEvent, getCalendarEvents } from '../../api/calendarApi';
import {
  MonthBar,
  EventRow,
  FullDivider,
  capitalize,
  timingLabel,
} from '../calendar/calendarUi';
import { DocNoData } from '../more/docUi';

const TITLE = 'Calendar';

const fmtApi = (m: moment.Moment) => m.format('YYYY-MM-DD');

const AdminCalendarScreen = ({ navigation }: any) => {
  const [month, setMonth] = useState(moment());
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const start = fmtApi(month.clone().startOf('month'));
      const end = fmtApi(month.clone().endOf('month'));
      const list = await getCalendarEvents(start, end, undefined, 100);
      setEvents(list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));
    } catch (e) {
      setError(apiErr(e, 'Could not load events.'));
    } finally {
      setLoading(false);
    }
  }, [month]);

  // Refetch on focus and whenever the month changes.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { refreshing, onRefresh } = useRefresh(load);

  const shiftMonth = (delta: number) => setMonth(m => m.clone().add(delta, 'month'));

  return (
    <View style={s.root}>
      <Header
        title={TITLE}
        divider
        height={50}
        onBackPress={() =>
          navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome')
        }
        rightSlot={
          <View style={s.headActions}>
            <TouchableOpacity
              style={s.headBtn}
              activeOpacity={0.6}
              hitSlop={6}
              onPress={() => navigation.navigate('AdminCalendarMonth')}
            >
              <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={19} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.headBtn}
              activeOpacity={0.6}
              hitSlop={6}
              onPress={() => navigation.navigate('AdminCalendarForm')}
            >
              <VectorIcon iconSet="Ionicons" iconName="add" size={22} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      <MonthBar
        label={month.format('MMMM YYYY')}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
      />
      <FullDivider />

      {loading && !refreshing ? (
        <View style={s.list}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[s.skeletonRow, i < 4 && s.rowDivider]}>
              <View style={s.skeletonLine}>
                <Skeleton width="55%" height={14} />
                <Skeleton width={60} height={10} />
              </View>
              <Skeleton width="80%" height={12} />
              <Skeleton width="35%" height={10} />
            </View>
          ))}
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
          contentContainerStyle={s.list}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {events.length === 0 ? (
            <DocNoData
              icon="calendar-outline"
              title="No events"
              subtitle="Nothing scheduled this month."
            />
          ) : (
            events.map((e, i) => (
              <EventRow
                key={e.id}
                type={capitalize(e.event_type)}
                title={e.title}
                description={e.description}
                meta={[
                  moment(e.date).format('DD MMM YYYY'),
                  timingLabel(e.is_all_day, e.start_time, e.end_time),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                isLast={i === events.length - 1}
                onPress={() => navigation.navigate('AdminCalendarDetail', { item: e })}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default AdminCalendarScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  headActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },

  // Loading skeleton
  skeletonRow: { paddingVertical: 14, gap: 8 },
  skeletonLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

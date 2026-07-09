import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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

const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');

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

  return (
    <View style={s.root}>
      <Header title={moment(date).format('ddd, D MMM YYYY')} onBackPress={() => navigation.goBack()} />
      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.count}>{events.length} event{events.length !== 1 ? 's' : ''}</Text>
          {events.length === 0 && <Text style={s.empty}>No events on this date.</Text>}
          {events.map(e => {
            const color = e.color || colorFor(e.event_type);
            return (
              <TouchableOpacity key={e.id} style={s.card} activeOpacity={0.7}
                onPress={() => navigation.navigate('AdminCalendarDetail', { item: e })}>
                <View style={[s.colorBar, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{e.title}</Text>
                  {!!e.description && <Text style={s.cardBody} numberOfLines={2}>{e.description}</Text>}
                  <View style={s.metaRow}>
                    <VectorIcon iconSet="Ionicons" iconName="time-outline" size={13} color={theme.colors.textMuted} />
                    <Text style={s.cardMeta}>{e.is_all_day ? 'All day' : (e.start_time ? `${hhmm(e.start_time)}${e.end_time ? `–${hhmm(e.end_time)}` : ''}` : '—')}</Text>
                    <View style={[s.typeTag, { backgroundColor: color + '18' }]}>
                      <Text style={[s.typeTagText, { color }]}>{e.event_type}</Text>
                    </View>
                  </View>
                </View>
                <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
};

export default AdminCalendarDayScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  count: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 10 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },
  card: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  colorBar: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  cardBody: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 3, lineHeight: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  cardMeta: { fontSize: 11, color: theme.colors.textMuted },
  typeTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.full },
  typeTagText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
});

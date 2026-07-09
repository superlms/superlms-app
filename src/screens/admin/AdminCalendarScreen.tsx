import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ApiEvent, getCalendarEvents } from '../../api/calendarApi';
import { colorFor } from './AdminCalendarFormScreen';

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthLabel = (d: Date) => d.toLocaleString('default', { month: 'long', year: 'numeric' });
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');

const AdminCalendarScreen = ({ navigation }: any) => {
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const list = await getCalendarEvents(fmtDate(start), fmtDate(end), undefined, 100);
      setEvents(list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load events.'));
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { refreshing, onRefresh } = useRefresh(load);

  const shiftMonth = (delta: number) => setCursor(c => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="Calendar"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={
          <TouchableOpacity style={s.headBtn} onPress={() => navigation.navigate('AdminCalendarMonth')} activeOpacity={0.8}>
            <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={19} color={theme.colors.primary} />
          </TouchableOpacity>
        }
      />

      {/* Month nav */}
      <View style={s.monthNav}>
        <TouchableOpacity style={s.navBtn} onPress={() => shiftMonth(-1)} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="chevron-back" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.monthText}>{monthLabel(cursor)}</Text>
        <TouchableOpacity style={s.navBtn} onPress={() => shiftMonth(1)} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {events.length === 0 && <Text style={s.empty}>No events this month.</Text>}
          {events.map(e => {
            const color = e.color || colorFor(e.event_type);
            return (
              <TouchableOpacity key={e.id} style={s.card} activeOpacity={0.7}
                onPress={() => navigation.navigate('AdminCalendarDetail', { item: e })}>
                <View style={[s.colorBar, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{e.title}</Text>
                  {!!e.description && <Text style={s.cardBody} numberOfLines={1}>{e.description}</Text>}
                  <View style={s.metaRow}>
                    <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={13} color={theme.colors.textMuted} />
                    <Text style={s.cardMeta}>{e.date}{e.is_all_day ? ' · All day' : (e.start_time ? ` · ${hhmm(e.start_time)}${e.end_time ? `–${hhmm(e.end_time)}` : ''}` : '')}</Text>
                    <View style={[s.typeTag, { backgroundColor: color + '18' }]}>
                      <Text style={[s.typeTagText, { color }]}>{e.event_type}</Text>
                    </View>
                  </View>
                </View>
                <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('AdminCalendarForm')} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export default AdminCalendarScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  navBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  colorBar: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  cardBody: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  cardMeta: { fontSize: 11, color: theme.colors.textMuted },
  typeTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.full },
  typeTagText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
});

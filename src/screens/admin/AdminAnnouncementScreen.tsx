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
import {
  AdminAnnouncement,
  AnnouncementStats,
  AnnouncementType,
  getAdminAnnouncements,
} from '../../api/adminContentApi';

type FilterKey = 'all_filter' | 'all' | 'user' | 'teacher';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all_filter', label: 'All' },
  { key: 'all', label: 'Both' },
  { key: 'user', label: 'Students' },
  { key: 'teacher', label: 'Teachers' },
];

const DAY_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'All time', value: null },
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 15 days', value: 15 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 45 days', value: 45 },
  { label: 'Last 60 days', value: 60 },
];

const TYPE_LABEL: Record<AnnouncementType, string> = { all: 'Both', user: 'Students', teacher: 'Teachers' };
const TYPE_COLOR: Record<AnnouncementType, string> = { all: '#6366F1', user: '#0EA5E9', teacher: '#EC4899' };

const AdminAnnouncementScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [stats, setStats] = useState<AnnouncementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all_filter');
  const [days, setDays] = useState<number | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminAnnouncements(filter === 'all_filter' ? undefined : filter, days ?? undefined);
      setItems(res.announcements);
      setStats(res.stats);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load announcements.'));
    } finally {
      setLoading(false);
    }
  }, [filter, days]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { refreshing, onRefresh } = useRefresh(load);

  const activeDayLabel = DAY_OPTIONS.find(d => d.value === days)?.label ?? 'All time';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="Announcements"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={
          <TouchableOpacity style={s.headBtn} onPress={() => setFilterOpen(true)} activeOpacity={0.8}>
            <VectorIcon iconSet="Ionicons" iconName="filter" size={18} color={theme.colors.primary} />
            {days != null && <View style={s.headDot} />}
          </TouchableOpacity>
        }
      />

      {/* Audience filter chips */}
      <View style={s.filterRow}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity key={f.key} style={[s.chip, active && s.chipActive]} onPress={() => setFilter(f.key)} activeOpacity={0.8}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {days != null && (
        <View style={s.dayBanner}>
          <Text style={s.dayBannerText}>Showing: {activeDayLabel}</Text>
          <TouchableOpacity onPress={() => setDays(null)}><Text style={s.dayBannerClear}>Clear</Text></TouchableOpacity>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 && <Text style={s.empty}>No announcements found.</Text>}
          {items.map(a => (
            <TouchableOpacity key={a.id} style={s.card} activeOpacity={0.7}
              onPress={() => navigation.navigate('AdminAnnouncementDetail', { item: a })}>
              <View style={[s.typeBadge, { backgroundColor: TYPE_COLOR[a.type] + '18' }]}>
                <Text style={[s.typeBadgeText, { color: TYPE_COLOR[a.type] }]}>{TYPE_LABEL[a.type]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{a.announcement_name}</Text>
                <Text style={s.cardBody} numberOfLines={1}>{a.announcement_content}</Text>
                <Text style={s.cardMeta} numberOfLines={1}>
                  {a.creator_name ?? 'Admin'}{a.created_at ? ` · ${new Date(a.created_at).toLocaleDateString()}` : ''}
                  {a.image_url ? ' · 📷' : ''}{a.pdf_url ? ' · 📄' : ''}
                </Text>
              </View>
              <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('AdminAnnouncementForm')} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Days filter popup (top-right) */}
      {filterOpen && (
        <View style={s.pOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFilterOpen(false)} />
          <View style={s.pCard}>
            <Text style={s.pTitle}>Filter by period</Text>
            {DAY_OPTIONS.map((d, i) => {
              const active = d.value === days;
              return (
                <TouchableOpacity key={i} style={[s.pRow, i === DAY_OPTIONS.length - 1 && { borderBottomWidth: 0 }]} activeOpacity={0.7}
                  onPress={() => { setDays(d.value); setFilterOpen(false); }}>
                  <Text style={[s.pRowText, active && s.pRowTextActive]}>{d.label}</Text>
                  {active && <VectorIcon iconSet="Ionicons" iconName="checkmark" size={16} color={theme.colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

export default AdminAnnouncementScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  headDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.primary },

  dayBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.colors.primaryLight },
  dayBannerText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  dayBannerClear: { fontSize: 12, fontWeight: '700', color: theme.colors.danger },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  // Compact card
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.full },
  typeBadgeText: { fontSize: 10, fontWeight: '800' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  cardBody: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  pOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, elevation: 50, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 66, paddingRight: 12 },
  pCard: { width: 220, backgroundColor: theme.colors.card, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 6, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  pTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, paddingVertical: 10 },
  pRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  pRowText: { fontSize: 14, color: theme.colors.textPrimary },
  pRowTextActive: { color: theme.colors.primary, fontWeight: '700' },
});

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
  AdminEnquiry,
  EnquiryStats,
  EnquiryTab,
  getAdminEnquiries,
} from '../../api/adminContentApi';

type StatusKey = '' | 'pending' | 'replied';

const AdminEnquiriesScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<EnquiryTab>('teacher');
  const [items, setItems] = useState<AdminEnquiry[]>([]);
  const [stats, setStats] = useState<EnquiryStats | null>(null);
  const [totals, setTotals] = useState({ teacher: 0, student: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusKey>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminEnquiries({ tab, search: search.trim() || undefined, status: status || undefined });
      setItems(res.enquiries);
      setStats(res.stats);
      setTotals(res.tab_totals);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load enquiries.'));
    } finally {
      setLoading(false);
    }
  }, [tab, search, status]);

  // Reload whenever the screen regains focus (e.g. after reply / delete).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { refreshing, onRefresh } = useRefresh(load);

  const openDetail = (e: AdminEnquiry) =>
    navigation.navigate('AdminEnquiryDetail', { tab, enquiry: e });

  const StatPill = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={[s.statPill, { backgroundColor: color + '14' }]}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="Enquiries"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['teacher', 'student'] as EnquiryTab[]).map(t => {
          const active = tab === t;
          return (
            <TouchableOpacity key={t} style={[s.tab, active && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
              <Text style={[s.tabText, active && s.tabTextActive]}>
                {t === 'teacher' ? 'Teachers' : 'Students'} ({t === 'teacher' ? totals.teacher : totals.student})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stats */}
      {!!stats && (
        <View style={s.statsRow}>
          <StatPill label="Total" value={stats.total} color="#6366F1" />
          <StatPill label="Pending" value={stats.pending} color="#F59E0B" />
          <StatPill label="Replied" value={stats.replied} color="#22C55E" />
        </View>
      )}

      {/* Search + status */}
      <View style={s.searchWrap}>
        <VectorIcon iconSet="Ionicons" iconName="search-outline" size={16} color={theme.colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search enquiries..."
          placeholderTextColor={theme.colors.textMuted}
          onSubmitEditing={load}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <View style={s.statusRow}>
        {([['', 'All'], ['pending', 'Pending'], ['replied', 'Replied']] as [StatusKey, string][]).map(([k, lbl]) => {
          const active = status === k;
          return (
            <TouchableOpacity key={k || 'all'} style={[s.chip, active && s.chipActive]} onPress={() => setStatus(k)} activeOpacity={0.8}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{lbl}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 && <Text style={s.empty}>No enquiries found.</Text>}
          {items.map(e => (
            <TouchableOpacity key={e.id} style={s.card} onPress={() => openDetail(e)} activeOpacity={0.85}>
              {/* status dot */}
              <View style={[s.dot, { backgroundColor: e.replied ? '#22C55E' : '#F59E0B' }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{e.topic}</Text>
                <Text style={s.cardBody} numberOfLines={1}>{e.query}</Text>
                <Text style={s.cardMeta} numberOfLines={1}>
                  {e.user_name}{e.created_at ? ` · ${new Date(e.created_at).toLocaleDateString()}` : ''}
                </Text>
              </View>
              <VectorIcon iconSet="Feather" iconName="chevron-right" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
};

export default AdminEnquiriesScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  tabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statPill: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, backgroundColor: theme.colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, padding: 0 },
  statusRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.primary },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  // Compact card: status dot · text · chevron
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.card, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  cardBody: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: 10.5, color: theme.colors.textMuted, marginTop: 3 },
});

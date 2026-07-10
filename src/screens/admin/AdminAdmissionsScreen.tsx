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
import ListRow from '../../components/ListRow';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AdmissionRow, AdmissionStats, getAdmissions } from '../../api/adminMoreApi';

const STATUS_COLOR: Record<string, string> = { pending: '#F59E0B', updated: '#0EA5E9', admitted: '#22C55E' };
const statusColor = (s: string) => STATUS_COLOR[s] ?? '#9CA3AF';

type StatusKey = '' | 'pending' | 'updated' | 'admitted';
const FILTERS: [StatusKey, string][] = [['', 'All'], ['pending', 'Pending'], ['updated', 'Updated'], ['admitted', 'Admitted']];

const AdminAdmissionsScreen = ({ navigation }: any) => {
  const [rows, setRows] = useState<AdmissionRow[]>([]);
  const [stats, setStats] = useState<AdmissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusKey>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdmissions({ search: search.trim() || undefined, status: status || undefined });
      setRows(res.admissions);
      setStats(res.stats);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load admissions.'));
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const { refreshing, onRefresh } = useRefresh(load);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header title="Admissions" onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} />

      <View style={s.statRow}>
        {[
          { label: 'Total', value: stats?.total, color: '#6366F1' },
          { label: 'Pending', value: stats?.pending, color: '#F59E0B' },
          { label: 'Admitted', value: stats?.admitted, color: '#22C55E' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.searchRow}>
        <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Search name, mobile, email"
          placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} onSubmitEditing={load} returnKeyType="search" />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity>}
      </View>
      <View style={s.chipRow}>
        {FILTERS.map(([k, lbl]) => {
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
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {rows.length === 0 && <Text style={s.empty}>No admission enquiries found.</Text>}
          {rows.map(r => (
            <ListRow
              key={r.id}
              color={statusColor(r.status)}
              title={r.student_name}
              subtitle={`${r.class ?? '—'}${r.stream ? ` · ${r.stream}` : ''}${r.guardian_name ? ` · ${r.guardian_name}` : ''}`}
              metaIcon="call-outline"
              meta={r.mobile || r.email || undefined}
              tag={r.status}
              tagColor={statusColor(r.status)}
              onPress={() => navigation.navigate('AdminAdmissionDetail', { admission: r })}
            />
          ))}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
};

export default AdminAdmissionsScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.primary },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },
});

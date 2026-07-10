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
import { AdminUserRow, AdminUserStats, getAdminUsers } from '../../api/adminMoreApi';

const roleLabel = (r: string) => (r === 'admin' ? 'Admin' : r === 'sub-admin' ? 'Sub-admin' : r);

const AdminUsersScreen = ({ navigation }: any) => {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminUsers({ search: search.trim() || undefined });
      setRows(res.users);
      setStats(res.stats);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load users.'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const { refreshing, onRefresh } = useRefresh(load);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header title="Users" onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} />

      <View style={s.statRow}>
        {[
          { label: 'Total', value: stats?.total, color: '#6366F1' },
          { label: 'Admins', value: stats?.admins, color: '#8B5CF6' },
          { label: 'Active', value: stats?.active, color: '#22C55E' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.searchRow}>
        <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Search name, email, mobile"
          placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} onSubmitEditing={load} returnKeyType="search" />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity>}
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {rows.length === 0 && <Text style={s.empty}>No users found.</Text>}
          {rows.map(u => (
            <ListRow
              key={u.id}
              color={u.is_active ? (u.role === 'admin' ? '#8B5CF6' : '#6366F1') : '#EF4444'}
              title={u.name}
              subtitle={u.email || u.mobile || '—'}
              metaIcon="shield-outline"
              meta={roleLabel(u.role)}
              tag={u.is_active ? 'Active' : 'Inactive'}
              tagColor={u.is_active ? '#22C55E' : '#EF4444'}
              onPress={() => navigation.navigate('AdminUserDetail', { user: u })}
            />
          ))}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
};

export default AdminUsersScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },
});

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AccountUser, getAccountUsers } from '../../api/adminFeeSetupApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { ErrorBox, ListRow, ListSkeleton, SearchBar } from './adminTransportUi';
import { Band, ClearPill, HeadActions, HeadBtn, PickPill, Strip } from './feeSetupUi';

/**
 * Accounts user — the panel's tab: the school's cashier / accounts logins,
 * newest first, with the header's counts (total, active, inactive), searched
 * by name, email or mobile and narrowed by status. A row opens the person —
 * switch them on or off, edit, delete; + adds one (their login is emailed to
 * them).
 */

type Status = '' | '1' | '0';

const AdminFeeAccountUsersScreen = ({ navigation }: any) => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('');
  const [rows, setRows] = useState<AccountUser[] | null>(null);
  const [stats, setStats] = useState<{ total: number; active: number; inactive: number } | null>(null);
  const [page, setPage] = useState({ current: 1, last: 1 });
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const d = await getAccountUsers({ search, status }, 1);
      if (mine !== seq.current) return;
      setRows(d.users);
      setStats(d.stats);
      setPage({ current: d.pagination.current_page, last: d.pagination.last_page });
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the account users.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useFocusLoad(() => {
    if (rows) load();
  });

  const loadMore = async () => {
    if (more || !rows || page.current >= page.last) return;
    const mine = seq.current;
    setMore(true);
    try {
      const d = await getAccountUsers({ search, status }, page.current + 1);
      if (mine !== seq.current) return;
      setRows(prev => [...(prev ?? []), ...d.users.filter(u => !(prev ?? []).some(p => p.id === u.id))]);
      setPage({ current: d.pagination.current_page, last: d.pagination.last_page });
    } catch {
      // The next scroll asks again.
    } finally {
      setMore(false);
    }
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Accounts user"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeadActions>
            <HeadBtn icon="add" onPress={() => navigation.navigate('AdminFeeAccountUserForm')} />
          </HeadActions>
        }
      />
      <View style={s.search}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, email, mobile..." />
      </View>
      <Band>
        <PickPill
          title="Status"
          label={status === '1' ? 'Active' : status === '0' ? 'Inactive' : 'All Status'}
          active={status !== ''}
          options={[
            { key: '', label: 'All Status' },
            { key: '1', label: 'Active' },
            { key: '0', label: 'Inactive' },
          ]}
          value={status}
          onPick={k => setStatus(k as Status)}
        />
        {(!!search || status !== '') && (
          <ClearPill
            onPress={() => {
              setSearch('');
              setStatus('');
            }}
          />
        )}
      </Band>

      {error && !rows ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !rows ? (
        <View style={s.pad}>
          <ListSkeleton photo rows={5} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={u => String(u.id)}
          contentContainerStyle={[s.list, rows.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            stats ? (
              <Strip
                items={[
                  { label: 'Total', value: stats.total },
                  { label: 'Active', value: stats.active, color: '#059669' },
                  { label: 'Inactive', value: stats.inactive, color: theme.colors.danger },
                ]}
              />
            ) : null
          }
          ListFooterComponent={more ? <ActivityIndicator style={s.more} size="small" color={theme.colors.primary} /> : null}
          ListEmptyComponent={
            <DocNoData
              icon="people-outline"
              title={search || status ? 'No users found' : 'No account users yet'}
              subtitle="Tap + to add a cashier / accounts login — their password is emailed to them."
            />
          }
          renderItem={({ item, index }) => (
            <ListRow
              photo={{ uri: item.image, name: item.name }}
              title={item.name}
              sub={[item.email, item.mobile_number].filter(Boolean).join(' · ')}
              meta={item.designation || item.department || null}
              right={item.is_active ? 'Active' : 'Inactive'}
              tone={item.is_active ? 'paid' : 'muted'}
              onPress={() => navigation.navigate('AdminFeeAccountUser', { id: item.id, row: item })}
              isLast={index === rows.length - 1}
            />
          )}
        />
      )}
    </View>
  );
};

export default AdminFeeAccountUsersScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  search: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 2 },
  pad: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  more: { paddingVertical: 16 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

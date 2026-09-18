import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DriverRow, RouteOption, getDrivers, getRouteOptions, routeLabel } from '../../api/adminTransportApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { FilterPills } from '../notification/inboxUi';
import { OptionSheet } from './adminFormUi';
import { DropPill, ErrorBox, ListRow, ListSkeleton, SearchBar } from './adminTransportUi';

/**
 * The school's drivers, as the admin panel's Drivers tab lists them — newest
 * first, searched by name, licence, vehicle or phone, and narrowed to a route
 * or to active / inactive drivers. A row opens the driver; + adds one.
 */

type StatusKey = 'all' | '1' | '0';

const STATUSES: { key: StatusKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '1', label: 'Active' },
  { key: '0', label: 'Inactive' },
];

const ALL = 'all';

const AdminTransportDriversScreen = ({ navigation }: any) => {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusKey>('all');
  const [routeId, setRouteId] = useState<number | null>(null);
  const [routeOpen, setRouteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(
    async (showSkeleton = !loadedOnce.current) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const res = await getDrivers({
          search: search.trim() || undefined,
          route_id: routeId ?? undefined,
          status: status === 'all' ? undefined : status,
        });
        setDrivers(res.drivers ?? []);
        loadedOnce.current = true;
      } catch (e) {
        setError(apiErr(e, 'Could not load drivers.'));
      } finally {
        setLoading(false);
      }
    },
    [search, routeId, status],
  );

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  const focusedOnce = useRef(false);
  useFocusLoad(() => {
    if (!focusedOnce.current) {
      focusedOnce.current = true;
      return;
    }
    load(false);
  });

  useEffect(() => {
    getRouteOptions().then(setRoutes).catch(() => {});
  }, []);

  const { refreshing, onRefresh } = useRefresh(() => load(true));

  const picked = routes.find(r => r.id === routeId);

  return (
    <View style={s.root}>
      <DocHeader
        title="Drivers"
        onBackPress={() => navigation.goBack()}
        rightSlot={<HeaderIconButton icon="add" size={22} onPress={() => navigation.navigate('AdminTransportDriverForm')} />}
      />

      <View style={s.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search driver name / license / vehicle…" />
        <View style={s.pillRow}>
          <FilterPills compact options={STATUSES} active={status} onChange={setStatus} />
          <DropPill label={picked ? routeLabel(picked) : 'All routes'} active={!!routeId} onPress={() => setRouteOpen(true)} />
        </View>
      </View>
      <View style={s.divider} />

      {loading ? (
        <View style={s.list}>
          <ListSkeleton photo />
        </View>
      ) : error && drivers.length === 0 ? (
        <ErrorBox message={error} onRetry={() => load(true)} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.list, drivers.length === 0 && s.grow]}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyboardShouldPersistTaps="handled"
        >
          {drivers.length === 0 ? (
            <DocNoData
              icon="person-outline"
              title="No drivers found"
              subtitle={
                search || routeId || status !== 'all' ? 'Nothing matches these filters.' : 'Tap + to add the first driver.'
              }
            />
          ) : (
            drivers.map((d, i) => (
              <ListRow
                key={d.id}
                photo={{ uri: d.image, name: d.name }}
                title={d.name}
                sub={[d.phone, d.vehicle_no].filter(Boolean).join(' · ') || 'No phone or vehicle yet'}
                meta={d.routes.length ? d.routes.map(r => r.label ?? r.name).join(', ') : 'No route assigned'}
                right={d.is_active ? null : 'Inactive'}
                tone="muted"
                isLast={i === drivers.length - 1}
                onPress={() => navigation.navigate('AdminTransportDriver', { id: d.id, item: d })}
              />
            ))
          )}
        </ScrollView>
      )}

      <OptionSheet
        visible={routeOpen}
        title="Route"
        options={[{ key: ALL, label: 'All routes' }, ...routes.map(r => ({ key: String(r.id), label: routeLabel(r) }))]}
        selected={[routeId ? String(routeId) : ALL]}
        onPick={k => setRouteId(k === ALL ? null : Number(k))}
        onClose={() => setRouteOpen(false)}
      />
    </View>
  );
};

export default AdminTransportDriversScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 10 },
  pillRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  divider: { height: 1, backgroundColor: theme.colors.border },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  grow: { flexGrow: 1 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

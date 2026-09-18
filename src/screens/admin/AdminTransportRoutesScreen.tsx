import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DriverRow, RouteGroup, getDrivers, getRouteGroups } from '../../api/adminTransportApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { FilterPills } from '../notification/inboxUi';
import { OptionSheet } from './adminFormUi';
import { DropPill, ErrorBox, ListRow, ListSkeleton, SearchBar, clock, formatINR } from './adminTransportUi';

/**
 * The school's routes, as the admin panel's Routes tab lists them: one row per
 * route with the vehicle types it runs, earliest pickup first — searched by
 * name and narrowed to a driver or to active / inactive routes. A row opens
 * the route; + adds one.
 */

type StatusKey = 'all' | '1' | '0';

const STATUSES: { key: StatusKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '1', label: 'Active' },
  { key: '0', label: 'Inactive' },
];

const ALL = 'all';

export const routeTimes = (r: Pick<RouteGroup, 'pickup_time' | 'drop_time'>) =>
  [clock(r.pickup_time), clock(r.drop_time)].filter(Boolean).join(' – ');

const AdminTransportRoutesScreen = ({ navigation }: any) => {
  const [routes, setRoutes] = useState<RouteGroup[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusKey>('all');
  const [driverId, setDriverId] = useState<number | null>(null);
  const [driverOpen, setDriverOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(
    async (showSkeleton = !loadedOnce.current) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const res = await getRouteGroups({
          search: search.trim() || undefined,
          driver_id: driverId ?? undefined,
          status: status === 'all' ? undefined : status,
        });
        setRoutes(res.routes);
        loadedOnce.current = true;
      } catch (e) {
        setError(apiErr(e, 'Could not load routes.'));
      } finally {
        setLoading(false);
      }
    },
    [search, driverId, status],
  );

  // A filter change reloads a moment after the typing stops.
  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  // Coming back from a route or the form updates the list in place.
  const focusedOnce = useRef(false);
  useFocusLoad(() => {
    if (!focusedOnce.current) {
      focusedOnce.current = true;
      return;
    }
    load(false);
  });

  // The panel's driver filter lists the active drivers.
  useEffect(() => {
    getDrivers({ status: '1' })
      .then(r => setDrivers(r.drivers))
      .catch(() => {});
  }, []);

  const { refreshing, onRefresh } = useRefresh(() => load(true));

  const driverName = drivers.find(d => d.id === driverId)?.name;

  return (
    <View style={s.root}>
      <DocHeader
        title="Routes"
        onBackPress={() => navigation.goBack()}
        rightSlot={<HeaderIconButton icon="add" size={22} onPress={() => navigation.navigate('AdminTransportRouteForm')} />}
      />

      <View style={s.filters}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search route name…" />
        <View style={s.pillRow}>
          <FilterPills compact options={STATUSES} active={status} onChange={setStatus} />
          <DropPill label={driverName ?? 'All drivers'} active={!!driverId} onPress={() => setDriverOpen(true)} />
        </View>
      </View>
      <View style={s.divider} />

      {loading ? (
        <View style={s.list}>
          <ListSkeleton />
        </View>
      ) : error && routes.length === 0 ? (
        <ErrorBox message={error} onRetry={() => load(true)} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.list, routes.length === 0 && s.grow]}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyboardShouldPersistTaps="handled"
        >
          {routes.length === 0 ? (
            <DocNoData
              icon="bus-outline"
              title="No routes found"
              subtitle={
                search || driverId || status !== 'all'
                  ? 'Nothing matches these filters.'
                  : 'Tap + to add the first route.'
              }
            />
          ) : (
            routes.map((r, i) => (
              <ListRow
                key={r.key}
                icon="bus-outline"
                title={r.route_name}
                sub={[r.vehicle_types.join(', '), routeTimes(r)].filter(Boolean).join(' · ') || 'No vehicle yet'}
                meta={[
                  `${formatINR(r.monthly_fee)} a month`,
                  `${r.students} ${r.students === 1 ? 'student' : 'students'}`,
                  r.driver_names.join(', ') || 'No driver',
                ].join(' · ')}
                right={r.is_active ? null : 'Inactive'}
                tone="muted"
                isLast={i === routes.length - 1}
                onPress={() => navigation.navigate('AdminTransportRoute', { routeKey: r.key, item: r })}
              />
            ))
          )}
        </ScrollView>
      )}

      <OptionSheet
        visible={driverOpen}
        title="Driver"
        options={[{ key: ALL, label: 'All drivers' }, ...drivers.map(d => ({ key: String(d.id), label: d.name }))]}
        selected={[driverId ? String(driverId) : ALL]}
        onPick={k => setDriverId(k === ALL ? null : Number(k))}
        onClose={() => setDriverOpen(false)}
      />
    </View>
  );
};

export default AdminTransportRoutesScreen;

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

import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { RouteGroup, deleteRouteGroup, getRouteGroup, toggleRouteGroup } from '../../api/adminTransportApi';
import { DocHeader } from '../more/docUi';
import { Words } from '../exam/examUi';
import { QuietAction, confirmDestructive } from './adminFormUi';
import { ErrorBox, InfoRow, ListRow, Section, clock, formatINR } from './adminTransportUi';

/**
 * One route, written as a student's My Route page writes their bus: the route
 * and its vehicle types at the head, then what the admin panel's route view
 * lists — the monthly fee and the year it comes to, pickup and drop times,
 * capacity, students and whether it runs — and a row for each vehicle type
 * with its driver, which opens that vehicle's students. The pencil edits it;
 * the route can be switched off and on, or deleted.
 */

const AdminTransportRouteScreen = ({ navigation, route }: any) => {
  const key: string = route?.params?.routeKey;
  const [item, setItem] = useState<RouteGroup | null>(route?.params?.item ?? null);
  const [loading, setLoading] = useState(!item);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'toggle' | 'delete' | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItem(await getRouteGroup(key));
    } catch (e) {
      setError(apiErr(e, 'Could not load this route.'));
    } finally {
      setLoading(false);
    }
  }, [key]);

  useFocusLoad(load);
  const { refreshing, onRefresh } = useRefresh(load);

  const toggle = async () => {
    setBusy('toggle');
    try {
      await toggleRouteGroup(key);
      await load();
    } catch (e) {
      AppAlert.alert('Could not change status', apiErr(e, 'Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const remove = () =>
    confirmDestructive('Delete route?', 'Removes the route and unassigns all its students.', 'Delete', async () => {
      setBusy('delete');
      try {
        await deleteRouteGroup(key);
        navigation.goBack();
      } catch (e) {
        AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
      } finally {
        setBusy(null);
      }
    });

  if (!item) {
    return (
      <View style={s.root}>
        <DocHeader title="Route" onBackPress={() => navigation.goBack()} />
        {loading ? null : <ErrorBox message={error ?? 'Route not found.'} onRetry={load} />}
      </View>
    );
  }

  const skeleton = loading;
  const rows = [
    ['Monthly Fee', formatINR(item.monthly_fee)],
    ['Annual Fee', `${formatINR(item.annual_fee)} · 11 months`],
    ['Pickup Time', clock(item.pickup_time) ?? '—'],
    ['Drop Time', clock(item.drop_time) ?? '—'],
    ['Capacity', item.capacity ? String(item.capacity) : '—'],
    ['Students', String(item.students)],
    ['Status', item.is_active ? 'Active' : 'Inactive'],
  ] as [string, string][];

  return (
    <View style={s.root}>
      <DocHeader
        title="Route"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeaderIconButton
            icon="create-outline"
            onPress={() => navigation.navigate('AdminTransportRouteForm', { item })}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* The route, and what runs it */}
        <View style={s.head}>
          <Words skeleton={skeleton} style={s.kicker}>
            SCHOOL TRANSPORT
          </Words>
          <Words skeleton={skeleton} style={s.title}>
            {item.route_name}
          </Words>
          <Words skeleton={skeleton} style={s.sub}>
            {item.vehicle_types.join(', ') || 'No vehicle type'}
          </Words>
        </View>

        <View style={s.rows}>
          {rows.map(([label, value], i) => (
            <InfoRow
              key={label}
              label={label}
              value={value}
              tone={label === 'Status' && !item.is_active ? 'due' : undefined}
              last={i === rows.length - 1}
              skeleton={skeleton}
            />
          ))}
        </View>

        {/* A vehicle per type, each with its own driver and students */}
        <Section title="Vehicles" skeleton={skeleton}>
          {item.rows.map((r, i) => (
            <ListRow
              key={r.id}
              icon="bus-outline"
              title={r.vehicle_type || 'Vehicle'}
              sub={[r.driver_name || 'No driver yet', r.vehicle_no].filter(Boolean).join(' · ')}
              meta={`${r.students} ${r.students === 1 ? 'student' : 'students'}`}
              isLast={i === item.rows.length - 1}
              onPress={() =>
                navigation.navigate('AdminTransportStudents', {
                  routeId: r.id,
                  routeLabel: `${item.route_name}${r.vehicle_type ? ` — ${r.vehicle_type}` : ''}`,
                })
              }
            />
          ))}
          <Text style={s.hint}>A driver is assigned to each vehicle from the Driver form.</Text>
        </Section>

        <View style={s.divider} />
        <View style={s.actions}>
          <QuietAction
            icon={item.is_active ? 'pause-circle' : 'play-circle'}
            label={item.is_active ? 'Mark route inactive' : 'Mark route active'}
            busy={busy === 'toggle'}
            onPress={toggle}
          />
          <QuietAction icon="trash-2" label="Delete route" danger busy={busy === 'delete'} onPress={remove} />
        </View>
      </ScrollView>
    </View>
  );
};

export default AdminTransportRouteScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },

  // What the route is
  head: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: theme.colors.textMuted },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 4 },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },

  rows: { paddingHorizontal: 20, paddingBottom: 6 },
  hint: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 10, paddingBottom: 8 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  actions: { paddingHorizontal: 20, paddingTop: 20, gap: 22 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

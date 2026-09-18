import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  RouteOption,
  TransportStudent,
  getFeeStudents,
  getRouteOptions,
  getTransportStudents,
  routeLabel,
} from '../../api/adminTransportApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { OptionSheet } from './adminFormUi';
import { DropPill, ErrorBox, ListRow, ListSkeleton, SearchBar, formatINR } from './adminTransportUi';

/**
 * Two of the admin panel's Transport tabs, on one page:
 *
 *  - Transport Students: pick a route (each vehicle type of it on its own) to
 *    see who rides it, each with the monthly fee × the months they are billed
 *    for, what is paid and what is left — searched by name or admission number.
 *  - Fee Summary: pick a route and then a student — or search for one — to see
 *    their fee.
 *
 * Either way a student opens their transport fee: the month-by-month status,
 * the months they are billed for, and their receipts.
 */

type Student = TransportStudent | { id: number; name: string; admission_no: string | null; class: string };

const idOf = (st: Student) => ('student_detail_id' in st ? st.student_detail_id : st.id);

const AdminTransportStudentsScreen = ({ navigation, route }: any) => {
  const feesMode = route?.name === 'AdminTransportFees';
  const title = feesMode ? 'Fee Summary' : 'Transport Students';

  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [routeId, setRouteId] = useState<number | null>(route?.params?.routeId ?? null);
  const [routeOpen, setRouteOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The route the list on screen is for: a new route loads with the skeleton,
  // a search within it in place.
  const shownRoute = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    getRouteOptions().then(setRoutes).catch(() => {});
  }, []);

  const q = search.trim();
  // The Fee Summary also finds a student by name without a route, as the panel's search does.
  const canLoad = !!routeId || (feesMode && q.length >= 2);

  const load = useCallback(
    async (showSkeleton = true) => {
      if (!canLoad) {
        setStudents([]);
        return;
      }
      if (showSkeleton || shownRoute.current !== routeId) setLoading(true);
      setError(null);
      try {
        const list: Student[] = feesMode
          ? await getFeeStudents(routeId, q)
          : (await getTransportStudents(routeId, q)).students ?? [];
        setStudents(list);
        shownRoute.current = routeId;
      } catch (e) {
        setError(apiErr(e, 'Could not load students.'));
      } finally {
        setLoading(false);
      }
    },
    [canLoad, routeId, q, feesMode],
  );

  useEffect(() => {
    const t = setTimeout(() => load(false), 300);
    return () => clearTimeout(t);
  }, [load]);

  // Coming back from a student (their months may have changed) updates in place.
  const focusedOnce = useRef(false);
  useFocusLoad(() => {
    if (!focusedOnce.current) {
      focusedOnce.current = true;
      return;
    }
    load(false);
  });

  const { refreshing, onRefresh } = useRefresh(() => load(true));

  const picked = routes.find(r => r.id === routeId);
  const pillLabel = picked ? routeLabel(picked) : route?.params?.routeLabel ?? 'Select route *';

  const open = (st: Student) =>
    navigation.navigate('AdminTransportStudentFee', {
      studentId: idOf(st),
      routeId: 'route_id' in st ? st.route_id ?? routeId : routeId,
      name: st.name,
    });

  const empty = !canLoad ? (
    <DocNoData
      icon="bus-outline"
      title={feesMode ? 'Pick a route and a student' : 'Pick a route to see its students'}
      subtitle={
        feesMode
          ? 'Or search a student by name or admission number to view their fee summary and receipts.'
          : 'Annual transport fee = monthly × billable months (per student).'
      }
    />
  ) : (
    <DocNoData
      icon="people-outline"
      title="No students"
      subtitle={q ? 'Nothing matches that search.' : 'No students assigned to this route yet.'}
    />
  );

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />

      <View style={s.filters}>
        <View style={s.pillRow}>
          <DropPill label={pillLabel} active={!!routeId} onPress={() => setRouteOpen(true)} />
        </View>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search student name / admission…" />
      </View>
      <View style={s.divider} />

      {loading ? (
        <View style={s.list}>
          <ListSkeleton photo />
        </View>
      ) : error && students.length === 0 ? (
        <ErrorBox message={error} onRetry={() => load(true)} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.list, students.length === 0 && s.grow]}
          refreshControl={canLoad ? <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {students.length === 0
            ? empty
            : students.map((st, i) => {
                const tx = 'student_detail_id' in st ? st : null;
                return (
                  <ListRow
                    key={idOf(st)}
                    photo={{ uri: tx?.image, name: st.name }}
                    title={st.name}
                    sub={[st.admission_no, st.class].filter(Boolean).join(' · ') || null}
                    meta={
                      tx
                        ? `${formatINR(tx.monthly)} × ${tx.months_count}/12 = ${formatINR(tx.annual)} · Paid ${formatINR(tx.paid)}`
                        : null
                    }
                    right={tx ? (tx.remaining > 0 ? formatINR(tx.remaining) : 'Paid') : null}
                    tone={tx ? (tx.remaining > 0 ? 'due' : 'paid') : undefined}
                    isLast={i === students.length - 1}
                    onPress={() => open(st)}
                  />
                );
              })}
        </ScrollView>
      )}

      <OptionSheet
        visible={routeOpen}
        title="Route"
        options={routes.map(r => ({ key: String(r.id), label: routeLabel(r), sub: r.is_active === false ? 'Inactive' : undefined }))}
        selected={routeId ? [String(routeId)] : []}
        onPick={k => setRouteId(Number(k))}
        onClose={() => setRouteOpen(false)}
        emptyText="No routes yet. Add a route first."
      />
    </View>
  );
};

export default AdminTransportStudentsScreen;

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

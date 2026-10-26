import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  StructurePage,
  deleteRoute,
  deleteStructure,
  getStructure,
  structurePdfUrl,
  transportPdfUrl,
} from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import { UnderlineTabs } from './adminExamUi';
import { ErrorBox, SearchBar } from './adminTransportUi';
import { confirmDestructive } from './adminFormUi';
import { ClassPills, useFeeClasses } from './adminFeeUi';
import {
  Band,
  ClearPill,
  GroupHead,
  GroupsSkeleton,
  HeadActions,
  HeadBtn,
  HeadLink,
  NumLine,
  PickPill,
  Prompt,
  TotalLine,
  plural,
  rupees,
} from './feeSetupUi';

/**
 * Fee Structure — the panel's tab: Academic and Transport.
 *
 * Academic: pick a class (and a section, or search a fee name) in the band and
 * its structure comes up, one group per section — or All Sections — each with
 * its fee heads numbered, its total, and Edit, Delete and Download (the PDF
 * the panel prints). The header has Add Dues (each student's Last Year Dues)
 * and + (Add Fee Structure), as the panel's has.
 *
 * Transport: pick a route and its month-by-month fee comes up — every month at
 * the route's fee, June free — with the annual total, and Edit, Delete and
 * Download. Routes themselves are made in Transportation.
 */

type Tab = 'academic' | 'transport';

const AdminFeeStructureScreen = ({ navigation }: any) => {
  const classes = useFeeClasses();
  const [tab, setTab] = useState<Tab>('academic');
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [routeId, setRouteId] = useState<number | null>(null);

  const [data, setData] = useState<StructurePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const seq = useRef(0);

  const term = search.trim();
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const d = await getStructure({
        standard_id: classId ?? undefined,
        section_id: sectionId ?? undefined,
        search: term || undefined,
        route_id: routeId ?? undefined,
      });
      if (mine === seq.current) setData(d);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the fee structure.'));
    } finally {
      if (mine === seq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [classId, sectionId, term, routeId]);

  // A filter changed: the structure for it (typing waits a moment).
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, term ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, term]);

  // Back from a form, what was saved is on the page.
  const first = useRef(true);
  useFocusLoad(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    load();
  });

  const cls = classes.find(c => c.id === classId) ?? null;

  const removeGroup = (standardId: number, secId: number | null, label: string) =>
    confirmDestructive('Delete Fee Structure?', `Every fee head of ${label} is deleted. This cannot be undone.`, 'Yes, delete', async () => {
      setBusy(`del-${standardId}-${secId ?? 0}`);
      try {
        const msg = await deleteStructure(standardId, secId);
        await load();
        AppAlert.alert('Deleted', msg);
      } catch (e) {
        AppAlert.alert('Not deleted', apiErr(e, 'Could not delete the fee structure.'));
      } finally {
        setBusy(null);
      }
    });

  const removeRoute = (id: number, name: string) =>
    confirmDestructive('Delete route?', `${name} is deleted. A route with students on it is kept — unassign them in Transportation first.`, 'Yes, delete', async () => {
      setBusy(`route-${id}`);
      try {
        const msg = await deleteRoute(id);
        setRouteId(null);
        AppAlert.alert('Deleted', msg);
      } catch (e) {
        AppAlert.alert('Not deleted', apiErr(e, 'Could not delete the route.'));
      } finally {
        setBusy(null);
      }
    });

  const openPdf = (url: string, name: string, title: string) =>
    navigation.navigate('TransportReceipt', {
      payment: { id: 0, receipt_number: name },
      url,
      namePrefix: 'Fee-Structure',
      title,
    });

  // ── Academic ───────────────────────────────────────────────────────────────
  const academic = () => {
    if (!classId) {
      return <Prompt icon="clipboard-outline" title="Select a class to see its fee structure" sub="Pick a class — and a section, if you want — from the filter above." />;
    }
    if (loading) return <GroupsSkeleton />;
    const groups = data?.groups ?? [];
    if (groups.length === 0) {
      return <Prompt icon="document-outline" title="No fee structure for this selection" sub="Use + (Add Fee Structure) to create one." />;
    }
    return (
      <View style={s.pad}>
        {groups.map((g, gi) => {
          const key = `${g.standard_id}-${g.section_id ?? 0}`;
          const label = `${g.class} · ${g.section}`;
          return (
            <View key={key}>
              <GroupHead
                first={gi === 0}
                letter={g.section_id ? g.section.slice(0, 2) : undefined}
                icon="layers-outline"
                title={label}
                sub={`${g.year ?? '—'} · ${plural(g.rows.length, 'fee head')}`}
                actions={[
                  {
                    icon: 'create-outline',
                    label: 'Edit',
                    onPress: () => navigation.navigate('AdminFeeStructureForm', { group: g }),
                  },
                  {
                    icon: 'trash-outline',
                    label: 'Delete',
                    tone: 'danger',
                    busy: busy === `del-${key}`,
                    onPress: () => removeGroup(g.standard_id, g.section_id, label),
                  },
                  {
                    icon: 'download-outline',
                    label: 'Download',
                    onPress: () =>
                      openPdf(structurePdfUrl(g.standard_id, g.section_id), `${g.class}-${g.section}`.replace(/\s+/g, '-'), 'Fee Structure'),
                  },
                ]}
              />
              {g.rows.map((r, i) => (
                <NumLine key={r.id} n={i + 1} label={r.fee_name} value={rupees(r.amount)} isLast={i === g.rows.length - 1} />
              ))}
              <TotalLine value={rupees(g.total)} />
            </View>
          );
        })}
      </View>
    );
  };

  // ── Transport ──────────────────────────────────────────────────────────────
  const transport = () => {
    const route = data?.route ?? null;
    if (!routeId) {
      return <Prompt icon="bus-outline" title="Select a route to see its monthly structure" sub="Pick a route from the filter above." />;
    }
    if (loading) return <GroupsSkeleton groups={1} lines={12} />;
    if (!route) return <Prompt icon="bus-outline" title="Route not found" sub="Pick another route from the filter above." />;
    return (
      <View style={s.pad}>
        <GroupHead
          first
          icon="bus-outline"
          title={route.name}
          sub={`${rupees(route.monthly_fee)} / month · ${route.billable_months} billable months${route.driver ? ` · ${route.driver}` : ''}`}
          badge={route.is_active ? null : { text: 'Inactive', tone: 'danger' }}
          actions={[
            { icon: 'create-outline', label: 'Edit', onPress: () => navigation.navigate('AdminFeeRouteForm', { route }) },
            {
              icon: 'trash-outline',
              label: 'Delete',
              tone: 'danger',
              busy: busy === `route-${route.id}`,
              onPress: () => removeRoute(route.id, route.name),
            },
            {
              icon: 'download-outline',
              label: 'Download',
              onPress: () => openPdf(transportPdfUrl(route.id), route.name.replace(/\s+/g, '-'), 'Transport Fee'),
            },
          ]}
        />
        {route.months.map((m, i) => (
          <NumLine
            key={m.month}
            n={i + 1}
            label={m.month}
            tag={m.free ? 'Free' : null}
            value={rupees(m.amount)}
            muted={m.free}
            isLast={i === route.months.length - 1}
          />
        ))}
        <TotalLine label="Annual Total" value={rupees(route.annual)} />
      </View>
    );
  };

  const routes = data?.routes ?? [];
  const route = routes.find(r => r.id === routeId) ?? null;

  return (
    <View style={s.root}>
      <DocHeader
        title="Fee Structure"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          tab === 'academic' ? (
            <HeadActions>
              <HeadLink label="Add Dues" onPress={() => navigation.navigate('AdminFeeDues', { classId, sectionId })} />
              <HeadBtn icon="add" onPress={() => navigation.navigate('AdminFeeStructureForm', { classId, sectionId })} />
            </HeadActions>
          ) : undefined
        }
      />
      <UnderlineTabs
        tabs={[
          { key: 'academic', label: 'Academic' },
          { key: 'transport', label: 'Transport' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'academic' ? (
        <>
          <Band>
            <ClassPills
              classes={classes}
              classId={classId}
              sectionId={sectionId}
              allLabel="Select Class"
              onChange={(c, sec) => {
                setClassId(c);
                setSectionId(sec);
              }}
            />
            {(!!classId || !!sectionId || !!term) && (
              <ClearPill
                onPress={() => {
                  setClassId(null);
                  setSectionId(null);
                  setSearch('');
                }}
              />
            )}
          </Band>
          {!!cls && (
            <View style={s.search}>
              <SearchBar value={search} onChangeText={setSearch} placeholder="Search fee name…" />
            </View>
          )}
        </>
      ) : (
        <Band>
          <PickPill
            title="Route"
            label={route ? route.name : 'Select Route'}
            active={!!route}
            options={routes.map(r => ({ key: String(r.id), label: r.name, sub: `${rupees(r.monthly_fee)} / month${r.is_active ? '' : ' · Inactive'}` }))}
            value={routeId ? String(routeId) : null}
            onPick={k => setRouteId(Number(k))}
          />
          {!!routeId && <ClearPill onPress={() => setRouteId(null)} />}
        </Band>
      )}

      {error && !data ? (
        <ErrorBox message={error} onRetry={() => { setLoading(true); load(); }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {tab === 'academic' ? academic() : transport()}
        </ScrollView>
      )}
    </View>
  );
};

export default AdminFeeStructureScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  pad: { paddingHorizontal: 20 },
  scroll: { paddingBottom: 40 },
  search: { paddingHorizontal: 20, paddingTop: 10 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  CertItem,
  TcAnalytics,
  TcItem,
  TcLookups,
  TcTab,
  getTcList,
  getTcLookups,
  getTcStats,
} from '../../api/adminTcCertificateApi';
import { OptionSheet } from './adminFormUi';
import { ErrorState, FilterBar, FilterChip, RowsSkeleton, SearchField } from './adminExamUi';
import { HeadBtn } from './adminAdmitCardUi';
import { CertRow, TABS, TcRow, monthLabel, monthOptions } from './adminTcUi';

/**
 * One of the panel's three tabs (Achievement, Participation, Transfer
 * Certificate) — the students it has been issued to, drawn as the student's
 * lists are: a search on the student or the certificate number, the panel's
 * filters as pills (month, class, section), the panel's counts for the tab
 * (issued in all, this month, last month, this week), then a row per
 * certificate, newest first, more as the list scrolls. A row opens its
 * details; + issues one for the tab.
 *
 * Route params: tab.
 */

const PER_PAGE = 20;
type Row = CertItem | TcItem;
type Sheet = 'month' | 'class' | 'section' | null;

const AdminTcCertificateListScreen = ({ navigation, route }: any) => {
  const tab: TcTab = route?.params?.tab ?? 'achievement';
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState('');
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  const [lookups, setLookups] = useState<TcLookups | null>(null);
  const [analytics, setAnalytics] = useState<TcAnalytics | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [page, setPage] = useState({ current: 1, last: 1 });
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const moreBusy = useRef(false);

  useEffect(() => {
    getTcLookups().then(setLookups).catch(() => {});
  }, []);

  const q = query.trim();
  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const [list, stats] = await Promise.all([
        getTcList<Row>({
          tab,
          search: q || undefined,
          standard_id: classId,
          section_id: sectionId,
          month: month || undefined,
          per_page: PER_PAGE,
          page: 1,
        }),
        // The panel's counts follow the tab and the class/section, not the month or search.
        getTcStats({ tab, standard_id: classId, section_id: sectionId }),
      ]);
      if (mine !== seq.current) return;
      setRows(list.data);
      setPage({ current: list.pagination?.current_page ?? 1, last: list.pagination?.last_page ?? 1 });
      setAnalytics(stats.analytics);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the certificates.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [tab, q, classId, sectionId, month]);

  // A filter or tab change asks again; typing waits a moment first.
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // Back from issuing, editing or deleting, the list is fresh.
  const loadRef = useRef(load);
  loadRef.current = load;
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      loadRef.current();
    }, []),
  );

  const loadMore = async () => {
    if (moreBusy.current || !rows || page.current >= page.last) return;
    const mine = seq.current;
    moreBusy.current = true;
    setLoadingMore(true);
    try {
      const list = await getTcList<Row>({
        tab,
        search: q || undefined,
        standard_id: classId,
        section_id: sectionId,
        month: month || undefined,
        per_page: PER_PAGE,
        page: page.current + 1,
      });
      if (mine !== seq.current) return;
      setRows(prev => {
        const have = new Set((prev ?? []).map(x => x.id));
        return [...(prev ?? []), ...list.data.filter(x => !have.has(x.id))];
      });
      setPage({ current: list.pagination?.current_page ?? page.current + 1, last: list.pagination?.last_page ?? page.last });
    } catch {
      // The next scroll asks again.
    } finally {
      moreBusy.current = false;
      setLoadingMore(false);
    }
  };

  const classes = lookups?.classes ?? [];
  const cls = classes.find(c => c.id === classId) ?? null;
  const sections = cls?.sections ?? [];
  const sec = sections.find(x => x.id === sectionId) ?? null;
  const narrowed = !!(month || classId || sectionId);
  const isTc = tab === 'tc';

  const issue = () =>
    isTc
      ? navigation.navigate('AdminTcForm', { classes })
      : navigation.navigate('AdminCertForm', { type: tab, classes });

  const open = (item: Row) => navigation.navigate('AdminTcDetail', { kind: isTc ? 'tc' : 'cert', item, classes });

  const sheetProps =
    sheet === 'month'
      ? {
          title: 'Month',
          options: [{ key: '', label: 'All Months' }, ...monthOptions()],
          selected: [month],
          onPick: (k: string) => setMonth(k),
        }
      : sheet === 'class'
      ? {
          title: 'Class',
          options: [{ key: '', label: 'All Classes' }, ...classes.map(c => ({ key: String(c.id), label: c.name }))],
          selected: [String(classId ?? '')],
          onPick: (k: string) => {
            setClassId(k ? Number(k) : null);
            setSectionId(null);
          },
        }
      : {
          title: 'Section',
          options: [{ key: '', label: 'All Sections' }, ...sections.map(x => ({ key: String(x.id), label: x.name }))],
          selected: [String(sectionId ?? '')],
          onPick: (k: string) => setSectionId(k ? Number(k) : null),
        };

  const list = rows ?? [];

  return (
    <View style={s.root}>
      <DocHeader
        title={TABS.find(t => t.key === tab)?.label ?? 'TC & Certificate'}
        onBackPress={() => navigation.goBack()}
        rightSlot={<HeadBtn icon="add" onPress={issue} />}
      />

      <SearchField value={query} onChangeText={setQuery} placeholder="Student / certificate no…" />

      <FilterBar
        onClear={
          narrowed
            ? () => {
                setMonth('');
                setClassId(null);
                setSectionId(null);
              }
            : undefined
        }
      >
        <FilterChip label={month ? monthLabel(month) : 'All Months'} active={!!month} onPress={() => setSheet('month')} />
        <FilterChip label={cls?.name ?? 'All Classes'} active={!!cls} onPress={() => setSheet('class')} />
        <FilterChip
          label={sec ? `Section ${sec.name}` : 'All Sections'}
          active={!!sec}
          disabled={sections.length === 0}
          onPress={() => setSheet('section')}
        />
      </FilterBar>

      {!rows && !error ? (
        <RowsSkeleton lead="icon" />
      ) : error && !rows ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={x => String(x.id)}
          contentContainerStyle={[s.list, list.length === 0 && s.grow]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            analytics ? (
              <Text style={s.count}>
                {/* The panel's Total Issued · This Month · Last Month · This Week */}
                {`${analytics.total} issued · ${analytics.this_month} this month · ${analytics.last_month} last month · ${analytics.this_week} this week`}
              </Text>
            ) : null
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={s.more} color={theme.colors.primary} /> : null}
          ListEmptyComponent={
            q || narrowed ? (
              <DocNoData icon="search-outline" title="No matches" subtitle="Nothing here matches the search or filters." />
            ) : (
              <DocNoData
                icon={isTc ? 'document-text-outline' : 'ribbon-outline'}
                title={isTc ? 'No transfer certificates yet' : 'No certificates yet'}
                subtitle={isTc ? 'Tap + to issue the first TC.' : 'Tap + to issue the first one.'}
              />
            )
          }
          renderItem={({ item, index }) =>
            isTc ? (
              <TcRow item={item as TcItem} isLast={index === list.length - 1} onPress={() => open(item)} />
            ) : (
              <CertRow item={item as CertItem} isLast={index === list.length - 1} onPress={() => open(item)} />
            )
          }
        />
      )}

      <OptionSheet
        visible={sheet !== null}
        title={sheetProps.title}
        options={sheetProps.options}
        selected={sheetProps.selected}
        onPick={sheetProps.onPick}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminTcCertificateListScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 40 },
  grow: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },
  more: { paddingVertical: 16 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

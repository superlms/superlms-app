import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AdminExam, AdminExamStatus, ExamOptions, getExams } from '../../api/adminExamApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { OptionSheet } from './adminFormUi';
import {
  AdminExamRow,
  EXAM_TYPES,
  ErrorState,
  FilterBar,
  FilterChip,
  RowsSkeleton,
  STATUS_LABEL,
  STATUS_ORDER,
  SearchField,
  TERMS,
  UnderlineTabs,
  academicYears,
  adminExamStyles as ui,
  statusOf,
} from './adminExamUi';

/**
 * The school's exams, drawn as the student's Exams list is — a search, the
 * statuses as tabs with their counts, and each exam as a row led by the day it
 * starts — with the panel's filters over it: academic year, exam type and
 * term. The list is in the panel's order (earliest start first), and each
 * status is the panel's, worked out from the dates. A row opens the exam; +
 * adds one.
 */

const TITLE = 'Exams';

type Tab = 'all' | AdminExamStatus;
type Sheet = 'year' | 'type' | 'term' | null;

const ALL = '';

const AdminExamListScreen = ({ navigation }: any) => {
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [options, setOptions] = useState<ExamOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [year, setYear] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [term, setTerm] = useState(ALL);
  const [sheet, setSheet] = useState<Sheet>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(
    async (showSkeleton = !loadedOnce.current) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const res = await getExams({
          academic_year: year || undefined,
          exam_type: type || undefined,
          term: term || undefined,
          // Every exam at once — the list scrolls rather than pages.
          per_page: 500,
        });
        setExams(res.exams);
        setOptions(res.options);
        loadedOnce.current = true;
      } catch (e) {
        setError(apiErr(e, 'Could not load exams.'));
      } finally {
        setLoading(false);
      }
    },
    [year, type, term],
  );

  // A filter change reloads with the skeleton; coming back to the screen
  // updates the list in place.
  useEffect(() => {
    load(true);
  }, [load]);
  const firstFocus = useRef(true);
  useFocusLoad(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    load(false);
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  // The panel's search is on the exam's name.
  const q = query.trim().toLowerCase();
  const searched = useMemo(
    () => (q ? exams.filter(e => e.exam_name.toLowerCase().includes(q)) : exams),
    [exams, q],
  );

  const counts = useMemo(() => {
    const c: Record<AdminExamStatus, number> = { draft: 0, published: 0, upcoming: 0, active: 0, completed: 0 };
    searched.forEach(e => {
      c[statusOf(e)] += 1;
    });
    return c;
  }, [searched]);

  // All, then only the statuses that have exams — none when all share one.
  const present = STATUS_ORDER.filter(st => counts[st] > 0);
  const tabs = present.length > 1 ? (['all', ...present] as Tab[]) : [];
  const activeTab: Tab = tabs.includes(tab) ? tab : 'all';

  const visible = activeTab === 'all' ? searched : searched.filter(e => statusOf(e) === activeTab);
  const showYear = new Set(visible.map(e => e.academic_year)).size > 1;

  const years = options?.academic_years?.length ? options.academic_years : academicYears();
  const types = options?.exam_types && Object.keys(options.exam_types).length ? options.exam_types : EXAM_TYPES;
  const terms = options?.terms?.length ? options.terms : TERMS;
  const narrowed = !!(year || type || term);

  const sheetProps =
    sheet === 'year'
      ? {
          title: 'Academic Year',
          options: [{ key: ALL, label: 'All Years' }, ...years.map(y => ({ key: y, label: y }))],
          selected: [year],
          onPick: setYear,
        }
      : sheet === 'type'
      ? {
          title: 'Exam Type',
          options: [{ key: ALL, label: 'All Types' }, ...Object.entries(types).map(([k, v]) => ({ key: k, label: v }))],
          selected: [type],
          onPick: setType,
        }
      : {
          title: 'Term',
          options: [{ key: ALL, label: 'All Terms' }, ...terms.map(t => ({ key: t, label: t }))],
          selected: [term],
          onPick: setTerm,
        };

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeaderIconButton icon="add" size={22} onPress={() => navigation.navigate('AdminExamForm', { options })} />
        }
      />

      <SearchField value={query} onChangeText={setQuery} placeholder="Search exam name" />

      <FilterBar
        onClear={
          narrowed
            ? () => {
                setYear(ALL);
                setType(ALL);
                setTerm(ALL);
              }
            : undefined
        }
      >
        <FilterChip label={year || 'All Years'} active={!!year} onPress={() => setSheet('year')} />
        <FilterChip label={type ? types[type] ?? type : 'All Types'} active={!!type} onPress={() => setSheet('type')} />
        <FilterChip label={term || 'All Terms'} active={!!term} onPress={() => setSheet('term')} />
      </FilterBar>

      {!loading && !error && tabs.length > 0 ? (
        <UnderlineTabs
          tabs={tabs.map(t => ({
            key: t,
            label: t === 'all' ? 'All' : STATUS_LABEL[t],
            count: t === 'all' ? searched.length : counts[t],
          }))}
          active={activeTab}
          onChange={setTab}
        />
      ) : (
        <View style={s.gap} />
      )}

      {loading ? (
        <RowsSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : (
        <ScrollView
          style={s.fill}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[ui.list, visible.length === 0 && s.grow]}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {visible.length === 0 ? (
            q ? (
              <DocNoData icon="search-outline" title="No matches" subtitle={`No exam matches “${query.trim()}”.`} />
            ) : (
              <DocNoData
                icon="school-outline"
                title="No exams found"
                subtitle={narrowed ? 'No exam matches these filters.' : 'Tap + to create your first exam.'}
              />
            )
          ) : (
            visible.map((exam, i) => (
              <AdminExamRow
                key={exam.id}
                exam={exam}
                showYear={showYear}
                isLast={i === visible.length - 1}
                onPress={() => navigation.navigate('AdminExamDetail', { exam, options })}
              />
            ))
          )}
        </ScrollView>
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

export default AdminExamListScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  gap: { height: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

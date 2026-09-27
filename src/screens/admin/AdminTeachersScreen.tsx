import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  TeacherLookups,
  TeacherRow,
  TeacherStats,
  getTeacherLookups,
  getTeachers,
} from '../../api/adminTeacherApi';
import { OptionSheet } from './adminFormUi';
import { FilterBar, FilterChip, SearchField, UnderlineTabs } from './adminExamUi';
import { ListSkeleton, plural } from './adminStudentsUi';
import { TeacherListRow } from './adminTeachersUi';
import TeacherExportSheet from './TeacherExportSheet';

/**
 * Teachers — the panel's Teachers page, drawn as the Students lists are: a
 * search (name, email, employee ID, phone), the panel's filters as pills —
 * class, then a section of it, and gender — and its status as tabs, All,
 * Active and Inactive, with their counts. Then a count (and, as the panel's
 * "This Year", how many joined this session) over a row per teacher, newest
 * first: the photo, the name, the username, employee ID and mobile, and the
 * class they are class teacher of. A row opens Teacher Detail. The header
 * holds Export — Excel or PDF, as the panel asks it — and the + that adds one.
 */

type Tab = 'all' | 'active' | 'inactive';
type Sheet = 'class' | 'section' | 'gender' | null;

const GENDERS = [
  { key: '', label: 'All Genders' },
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
];

const HeadBtn = ({ icon, onPress }: { icon: string; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} hitSlop={10} activeOpacity={0.6} style={s.headBtn}>
    <VectorIcon iconSet="Ionicons" iconName={icon} size={19} color={theme.colors.textPrimary} />
  </TouchableOpacity>
);

const AdminTeachersScreen = ({ navigation }: any) => {
  const [rows, setRows] = useState<TeacherRow[] | null>(null);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [lookups, setLookups] = useState<TeacherLookups | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [gender, setGender] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [sheet, setSheet] = useState<Sheet>(null);

  useEffect(() => {
    getTeacherLookups().then(setLookups).catch(() => {});
  }, []);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getTeachers({
        search: search.trim() || undefined,
        gender: gender || undefined,
        class: classId ?? undefined,
        section: classId && sectionId ? sectionId : undefined,
        // Every teacher at once — the list scrolls rather than pages.
        per_page: 1000,
      });
      if (mine === seq.current) {
        setRows(r.teachers);
        setStats(r.stats);
      }
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load teachers.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [search, gender, classId, sectionId]);

  // Typing waits a moment before it asks, as the panel's search does.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Back from a teacher's page (added, edited or deleted), the list is fresh.
  // The latest load is held aside so typing does not count as coming back.
  const loadRef = useRef(load);
  loadRef.current = load;
  const loaded = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!loaded.current) {
        loaded.current = true;
        return;
      }
      loadRef.current();
    }, []),
  );

  const list = useMemo(() => rows ?? [], [rows]);
  const counts = useMemo(() => {
    const active = list.filter(r => r.is_active).length;
    return { all: list.length, active, inactive: list.length - active };
  }, [list]);
  const visible = tab === 'all' ? list : list.filter(r => (tab === 'active' ? r.is_active : !r.is_active));

  const classes = lookups?.classes ?? [];
  const sections = (lookups?.sections ?? []).filter(x => x.standard_id === classId);
  const cls = classes.find(c => c.id === classId);
  const sec = sections.find(x => x.id === sectionId);
  const narrowed = !!(classId || gender);
  const searching = !!search.trim();

  const countLine =
    searching || narrowed
      ? `${plural(visible.length, 'teacher')} found`
      : [
          plural(visible.length, 'teacher'),
          tab === 'all' && stats?.this_year != null ? `${stats.this_year} joined this year` : null,
        ]
          .filter(Boolean)
          .join(' · ');

  const sheetProps =
    sheet === 'class'
      ? {
          title: 'Class',
          options: [{ key: '', label: 'All Classes' }, ...classes.map(c => ({ key: String(c.id), label: c.name }))],
          selected: [classId ? String(classId) : ''],
          onPick: (k: string) => {
            setClassId(k ? Number(k) : null);
            setSectionId(null);
          },
        }
      : sheet === 'section'
      ? {
          title: `Section · ${cls?.name ?? ''}`,
          options: [{ key: '', label: 'All Sections' }, ...sections.map(x => ({ key: String(x.id), label: x.name }))],
          selected: [sectionId ? String(sectionId) : ''],
          onPick: (k: string) => setSectionId(k ? Number(k) : null),
        }
      : {
          title: 'Gender',
          options: GENDERS,
          selected: [gender],
          onPick: setGender,
        };

  const body = () => {
    if (!rows && !error) return <ListSkeleton photo />;

    if (error && !rows) {
      return (
        <View style={s.centered}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={visible}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={[s.list, visible.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={visible.length > 0 ? <Text style={s.count}>{countLine}</Text> : null}
        ListEmptyComponent={
          searching || narrowed || tab !== 'all' ? (
            <DocNoData icon="search-outline" title="No teachers found" subtitle="Nothing matches this search or these filters." />
          ) : (
            <DocNoData icon="person-add-outline" title="No teachers yet" subtitle="Tap + to add the school’s first teacher." />
          )
        }
        renderItem={({ item, index }) => (
          <TeacherListRow
            teacher={item}
            onOpen={() => navigation.navigate('AdminTeacherDetail', { id: item.id })}
            isLast={index === visible.length - 1}
          />
        )}
      />
    );
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Teachers"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={
          <View style={s.headActions}>
            <HeadBtn icon="download-outline" onPress={() => setExportOpen(true)} />
            <HeadBtn icon="add" onPress={() => navigation.navigate('AdminTeacherForm')} />
          </View>
        }
      />

      <SearchField value={search} onChangeText={setSearch} placeholder="Search name, email, ID, phone" />

      <FilterBar
        onClear={
          narrowed
            ? () => {
                setClassId(null);
                setSectionId(null);
                setGender('');
              }
            : undefined
        }
      >
        <FilterChip label={cls?.name ?? 'All Classes'} active={!!classId} onPress={() => setSheet('class')} />
        <FilterChip
          label={sec ? `Section ${sec.name}` : 'All Sections'}
          active={!!sectionId}
          disabled={!classId || sections.length === 0}
          onPress={() => setSheet('section')}
        />
        <FilterChip
          label={GENDERS.find(g => g.key === gender)?.label ?? 'All Genders'}
          active={!!gender}
          onPress={() => setSheet('gender')}
        />
      </FilterBar>

      {rows ? (
        <UnderlineTabs
          tabs={[
            { key: 'all' as Tab, label: 'All', count: counts.all },
            { key: 'active' as Tab, label: 'Active', count: counts.active },
            { key: 'inactive' as Tab, label: 'Inactive', count: counts.inactive },
          ]}
          active={tab}
          onChange={setTab}
        />
      ) : (
        <View style={s.gap} />
      )}

      {body()}

      <OptionSheet
        visible={sheet !== null}
        title={sheetProps.title}
        options={sheetProps.options}
        selected={sheetProps.selected}
        onPick={sheetProps.onPick}
        onClose={() => setSheet(null)}
      />

      <TeacherExportSheet visible={exportOpen} onClose={() => setExportOpen(false)} />
    </View>
  );
};

export default AdminTeachersScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Header actions
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  gap: { height: 8 },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },

  // Error
  centered: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

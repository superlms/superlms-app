import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Select from '../../components/Select';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { saveCsvFile } from '../../api/pdfDownload';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  StudentRow,
  StudentStats,
  StudentLookups,
  StudentFilters,
  getStudents,
  getStudentLookups,
} from '../../api/adminStudentApi';
import { AppAlert } from '../../components/AppDialog';

/**
 * Every student of the school — the admin panel's Students module, drawn as the
 * app draws its own lists: a count, then a row per student with their photo,
 * their name and their class and numbers under it, on a plain page. The header
 * holds the filters, the export and the + that adds one; a row opens the
 * student.
 */

const GENDER_OPTS = [
  { label: 'All Genders', value: '' },
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];
const STATUS_OPTS = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: '1' },
  { label: 'Inactive', value: '0' },
];
const SORT_OPTS = [
  { label: 'Name (A–Z)', value: 'name_asc' },
  { label: 'Admission No', value: 'admission_no' },
  { label: 'Roll No', value: 'roll_no' },
];

const csvCell = (v: any) => {
  const str = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ── One student ──────────────────────────────────────────────────────────────
//   (photo)  Aarav Sharma                                          >
//            Class 5 · A · Roll 12 · Adm 2026-0007
const Avatar = ({ uri, name }: { uri?: string | null; name: string }) => {
  const [failed, setFailed] = useState(false);

  if (uri && !failed) {
    return <Image source={{ uri }} style={s.photo} onError={() => setFailed(true)} />;
  }
  return (
    <View style={[s.photo, s.initialBox]}>
      <Text style={s.initial}>{(name || 'S').charAt(0).toUpperCase()}</Text>
    </View>
  );
};

const Row = ({ student, onOpen, isLast }: { student: StudentRow; onOpen: () => void; isLast: boolean }) => {
  const meta = [
    [student.class, student.section].filter(Boolean).join(' · '),
    student.roll_no ? `Roll ${student.roll_no}` : null,
    student.admission_no ? `Adm ${student.admission_no}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onOpen}>
      <Avatar uri={student.image} name={student.full_name} />
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{student.full_name}</Text>
        {!!meta && <Text style={s.meta} numberOfLines={1}>{meta}</Text>}
      </View>
      {!student.is_active && <Text style={s.off}>OFF</Text>}
      <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
};

const ListSkeleton = () => (
  <View style={s.list}>
    <View style={s.skCount}><Skeleton width={90} height={12} /></View>
    {Array.from({ length: 7 }, (_, i) => (
      <View key={i} style={[s.row, i < 6 && s.rowDivider]}>
        <Skeleton width={34} height={34} radius={17} />
        <View style={s.skBody}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="60%" height={12} />
        </View>
        <Skeleton width={8} height={13} />
      </View>
    ))}
  </View>
);

// A plain header action — an icon and nothing behind it.
const HeadBtn = ({ icon, onPress, badge, busy }: { icon: string; onPress: () => void; badge?: number; busy?: boolean }) => (
  <TouchableOpacity style={s.headBtn} onPress={onPress} activeOpacity={0.6} disabled={busy} hitSlop={6}>
    {busy ? (
      <ActivityIndicator size="small" color={theme.colors.primary} />
    ) : (
      <VectorIcon iconSet="Ionicons" iconName={icon} size={19} color={theme.colors.textPrimary} />
    )}
    {!!badge && (
      <View style={s.headDot}><Text style={s.headDotText}>{badge}</Text></View>
    )}
  </TouchableOpacity>
);

// ── Screen ───────────────────────────────────────────────────────────────────
const AdminStudentsScreen = ({ navigation }: any) => {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookups, setLookups] = useState<StudentLookups | null>(null);

  const [search, setSearch] = useState('');

  // Filters (mirror the web filter panel).
  const [fClass, setFClass] = useState<number>(0);
  const [fSection, setFSection] = useState<number>(0);
  const [fGender, setFGender] = useState<string>('');
  const [fStatus, setFStatus] = useState<string>('');
  const [fSort, setFSort] = useState<string>('name_asc');

  const [filterOpen, setFilterOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const buildFilters = useCallback(
    (extra: Partial<StudentFilters> = {}): StudentFilters => {
      const f: StudentFilters = { sort: fSort as StudentFilters['sort'], ...extra };
      if (search.trim()) f.search = search.trim();
      if (fClass) f.class = fClass;
      if (fSection) f.section = fSection;
      if (fGender) f.gender = fGender;
      if (fStatus) f.status = fStatus as '0' | '1';
      return f;
    },
    [search, fClass, fSection, fGender, fStatus, fSort],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getStudents(buildFilters({ per_page: 200 }));
      setRows(res.students);
      setStats(res.stats);
    } catch (e) {
      setError(apiErr(e, 'Could not load the students.'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  useEffect(() => { getStudentLookups().then(setLookups).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { refreshing, onRefresh } = useRefresh(load);

  const activeFilterCount =
    (fClass ? 1 : 0) + (fSection ? 1 : 0) + (fGender ? 1 : 0) + (fStatus ? 1 : 0);
  const narrowed = activeFilterCount > 0 || !!search.trim();

  const clearFilters = () => {
    setFClass(0);
    setFSection(0);
    setFGender('');
    setFStatus('');
    setFSort('name_asc');
  };

  const sectionOptions = [
    { label: 'All Sections', value: 0 },
    ...((lookups?.sections ?? [])
      .filter(x => !fClass || x.standard_id === fClass)
      .map(x => ({ label: x.name, value: x.id }))),
  ];
  const classOptions = [
    { label: 'All Classes', value: 0 },
    ...((lookups?.classes ?? []).map(c => ({ label: c.name, value: c.id }))),
  ];

  const doExport = async () => {
    setExporting(true);
    try {
      const res = await getStudents(buildFilters({ per_page: 10000 }));
      const list = res.students;
      if (list.length === 0) {
        AppAlert.alert('Export', 'No students to export.');
        return;
      }
      const headers = ['Name', 'Admission No', 'Roll No', 'Class', 'Section', 'Gender', 'Email', 'Phone', 'Status'];
      const lines = [headers.join(',')];
      list.forEach(r => {
        lines.push([
          r.full_name, r.admission_no, r.roll_no, r.class, r.section,
          r.gender, r.email, r.phone, r.is_active ? 'Active' : 'Inactive',
        ].map(csvCell).join(','));
      });
      const stamp = new Date().toISOString().slice(0, 10);
      await saveCsvFile(`students_${stamp}`, lines.join('\n'));
      AppAlert.alert('Export complete', `${list.length} students exported to your Downloads.`);
    } catch (e) {
      AppAlert.alert('Export failed', apiErr(e, 'Could not export students.'));
    } finally {
      setExporting(false);
    }
  };

  // "128 students · 120 active", or what the filters left of them.
  const countLine = narrowed
    ? `${rows.length} of ${plural(stats?.total ?? rows.length, 'student')}`
    : `${plural(stats?.total ?? rows.length, 'student')}${stats ? ` · ${stats.active} active` : ''}`;

  const body = () => {
    if (loading && rows.length === 0 && !refreshing) return <ListSkeleton />;

    if (error && rows.length === 0) {
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
        data={rows}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={[s.list, rows.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={rows.length > 0 ? <Text style={s.count}>{countLine}</Text> : null}
        ListEmptyComponent={
          <DocNoData
            icon={narrowed ? 'search-outline' : 'person-add-outline'}
            title={narrowed ? 'No students found' : 'No students yet'}
            subtitle={
              narrowed
                ? 'Nothing matches this search and these filters. Clear them to see everyone.'
                : 'Add the school’s students with + at the top.'
            }
          />
        }
        renderItem={({ item, index }) => (
          <Row
            student={item}
            onOpen={() => navigation.navigate('AdminStudentDetail', { id: item.id })}
            isLast={index === rows.length - 1}
          />
        )}
      />
    );
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Students"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={
          <View style={s.headActions}>
            <HeadBtn icon="options-outline" onPress={() => setFilterOpen(true)} badge={activeFilterCount} />
            <HeadBtn icon="download-outline" onPress={doExport} busy={exporting} />
            <HeadBtn icon="add" onPress={() => navigation.navigate('AdminStudentForm')} />
          </View>
        }
      />

      <View style={s.searchWrap}>
        <View style={s.searchRow}>
          <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search name, admission, roll, phone"
            placeholderTextColor={theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {body()}

      {/* Filter popup (top-right). Plain overlay — not a Modal — so the Select
          dropdowns (which use their own Modal) never nest inside a Modal. */}
      {filterOpen && (
        <View style={s.filterOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFilterOpen(false)} />
          <View style={s.filterCard}>
            <View style={s.filterHead}>
              <Text style={s.filterTitle}>Filter Students</Text>
              <TouchableOpacity onPress={() => setFilterOpen(false)}><VectorIcon iconSet="Ionicons" iconName="close" size={20} color={theme.colors.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Select label="Class" value={fClass} options={classOptions}
                onChange={(v) => { setFClass(Number(v)); setFSection(0); }} />
              <Select label="Section" value={fSection} options={sectionOptions}
                onChange={(v) => setFSection(Number(v))} disabled={!fClass} />
              <Select label="Gender" value={fGender} options={GENDER_OPTS} onChange={(v) => setFGender(String(v))} />
              <Select label="Status" value={fStatus} options={STATUS_OPTS} onChange={(v) => setFStatus(String(v))} />
              <Select label="Sort By" value={fSort} options={SORT_OPTS} onChange={(v) => setFSort(String(v))} />
            </ScrollView>
            <View style={s.filterActions}>
              <TouchableOpacity style={[s.fbtn, s.fbtnGhost]} onPress={() => { clearFilters(); }} activeOpacity={0.85}>
                <Text style={s.fbtnGhostText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.fbtn, s.fbtnPrimary]} onPress={() => setFilterOpen(false)} activeOpacity={0.9}>
                <Text style={s.fbtnPrimaryText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default AdminStudentsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Header actions
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  headDot: { position: 'absolute', top: 0, right: -1, minWidth: 14, height: 14, paddingHorizontal: 3, borderRadius: 7, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  headDotText: { fontSize: 9, fontWeight: '800', color: theme.colors.white },

  // Search
  searchWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, padding: 0 },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  photo: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.background },
  initialBox: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  off: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },

  // Loading
  skCount: { paddingTop: 13, paddingBottom: 3 },
  skBody: { flex: 1, gap: 8 },

  // Error
  centered: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  // Filters
  filterOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, elevation: 50, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 56, paddingRight: 12 },
  filterCard: { width: '86%', maxWidth: 360, maxHeight: '80%', backgroundColor: theme.colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  filterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  filterTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  filterActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  fbtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fbtnGhost: { backgroundColor: theme.colors.border },
  fbtnGhostText: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  fbtnPrimary: { backgroundColor: theme.colors.primary },
  fbtnPrimaryText: { fontSize: 14, fontWeight: '700', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

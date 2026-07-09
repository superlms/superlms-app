import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import Select from '../../components/Select';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { saveCsvFile } from '../../api/pdfDownload';
import {
  StudentRow,
  StudentStats,
  StudentLookups,
  StudentFilters,
  getStudents,
  getStudentLookups,
} from '../../api/adminStudentApi';

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

const AdminStudentsScreen = ({ navigation }: any) => {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    try {
      const res = await getStudents(buildFilters({ per_page: 200 }));
      setRows(res.students);
      setStats(res.stats);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load students.'));
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  useEffect(() => { getStudentLookups().then(setLookups).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { refreshing, onRefresh } = useRefresh(load);

  const activeFilterCount =
    (fClass ? 1 : 0) + (fSection ? 1 : 0) + (fGender ? 1 : 0) + (fStatus ? 1 : 0);

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
        Alert.alert('Export', 'No students to export.');
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
      Alert.alert('Export complete', `${list.length} students exported to your Downloads.`);
    } catch (e) {
      Alert.alert('Export failed', apiErr(e, 'Could not export students.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="Students"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={
          <View style={s.headActions}>
            <TouchableOpacity style={s.headBtn} onPress={() => setFilterOpen(true)} activeOpacity={0.8}>
              <VectorIcon iconSet="Ionicons" iconName="filter" size={18} color={theme.colors.primary} />
              {activeFilterCount > 0 && <View style={s.headDot}><Text style={s.headDotText}>{activeFilterCount}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={s.headBtn} onPress={doExport} activeOpacity={0.8} disabled={exporting}>
              {exporting
                ? <ActivityIndicator size="small" color={theme.colors.primary} />
                : <VectorIcon iconSet="Ionicons" iconName="download-outline" size={18} color={theme.colors.primary} />}
            </TouchableOpacity>
          </View>
        }
      />

      <View style={s.statRow}>
        {[
          { label: 'Total', value: stats?.total, color: '#6366F1' },
          { label: 'Active', value: stats?.active, color: '#22C55E' },
          { label: 'This Year', value: stats?.this_year, color: '#0EA5E9' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.searchRow}>
        <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Search name, admission, roll, phone"
          placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} returnKeyType="search" />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity>}
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {rows.length === 0 && <Text style={s.empty}>No students found.</Text>}
          {rows.map(r => (
            <TouchableOpacity key={r.id} style={s.card} activeOpacity={0.7}
              onPress={() => navigation.navigate('AdminStudentDetail', { id: r.id })}>
              {r.image ? <Image source={{ uri: r.image }} style={s.avatarImg} /> : (
                <View style={[s.avatar, { backgroundColor: '#6366F118' }]}>
                  <Text style={s.avatarInit}>{(r.full_name || '?').charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{r.full_name}</Text>
                <Text style={s.cardSub} numberOfLines={1}>
                  {r.class ?? '—'}{r.section ? ` · ${r.section}` : ''}{r.roll_no ? ` · Roll ${r.roll_no}` : ''}
                </Text>
              </View>
              {!r.is_active && <View style={s.inactiveTag}><Text style={s.inactiveTagText}>Inactive</Text></View>}
              <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('AdminStudentForm')} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>

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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },

  headActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  headDot: { position: 'absolute', top: -2, right: -2, minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 8, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  headDotText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  scroll: { paddingHorizontal: 16, paddingTop: 10 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 },

  // Compact card — tap opens the detail screen.
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  avatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 38, height: 38, borderRadius: 12 },
  avatarInit: { fontSize: 16, fontWeight: '900', color: '#6366F1' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  inactiveTag: { backgroundColor: '#FEE2E2', borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  inactiveTagText: { fontSize: 10, fontWeight: '800', color: theme.colors.danger },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  filterOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, elevation: 50, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 66, paddingRight: 12 },
  filterCard: { width: '86%', maxWidth: 360, maxHeight: '80%', backgroundColor: theme.colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  filterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  filterTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  filterActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  fbtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fbtnGhost: { backgroundColor: theme.colors.border },
  fbtnGhostText: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  fbtnPrimary: { backgroundColor: theme.colors.primary },
  fbtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

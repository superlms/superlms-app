import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import ListRow from '../../components/ListRow';
import Select from '../../components/Select';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { saveCsvFile } from '../../api/pdfDownload';
import {
  TeacherRow,
  TeacherStats,
  TeacherFilters,
  getTeachers,
} from '../../api/adminTeacherApi';

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

const csvCell = (v: any) => {
  const str = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const AdminTeachersScreen = ({ navigation }: any) => {
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [fGender, setFGender] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const buildFilters = useCallback(
    (extra: Partial<TeacherFilters> = {}): TeacherFilters => {
      const f: TeacherFilters = { ...extra };
      if (search.trim()) f.search = search.trim();
      if (fGender) f.gender = fGender;
      if (fStatus) f.status = fStatus as '0' | '1';
      return f;
    },
    [search, fGender, fStatus],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTeachers(buildFilters({ per_page: 200 }));
      setRows(res.teachers);
      setStats(res.stats);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load teachers.'));
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { refreshing, onRefresh } = useRefresh(load);

  const activeFilterCount = (fGender ? 1 : 0) + (fStatus ? 1 : 0);
  const clearFilters = () => { setFGender(''); setFStatus(''); };

  const doExport = async () => {
    setExporting(true);
    try {
      const res = await getTeachers(buildFilters({ per_page: 10000 }));
      const list = res.teachers;
      if (list.length === 0) { Alert.alert('Export', 'No teachers to export.'); return; }
      const headers = ['Name', 'Employee ID', 'Email', 'Phone', 'Gender', 'Qualification', 'Status'];
      const lines = [headers.join(',')];
      list.forEach(r => {
        lines.push([
          r.name, r.employee_id, r.email, r.phone, r.gender, r.qualification,
          r.is_active ? 'Active' : 'Inactive',
        ].map(csvCell).join(','));
      });
      const stamp = new Date().toISOString().slice(0, 10);
      await saveCsvFile(`teachers_${stamp}`, lines.join('\n'));
      Alert.alert('Export complete', `${list.length} teachers exported to your Downloads.`);
    } catch (e) {
      Alert.alert('Export failed', apiErr(e, 'Could not export teachers.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="Teachers"
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
          { label: 'Total', value: stats?.total, color: '#8B5CF6' },
          { label: 'Active', value: stats?.active, color: '#22C55E' },
          { label: 'Inactive', value: stats?.inactive, color: '#EF4444' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.searchRow}>
        <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Search name, email, employee ID"
          placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} returnKeyType="search" />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity>}
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {rows.length === 0 && <Text style={s.empty}>No teachers found.</Text>}
          {rows.map(r => (
            <ListRow
              key={r.id}
              color={r.is_active ? '#8B5CF6' : '#EF4444'}
              title={r.name ?? '—'}
              subtitle={`${r.employee_id ?? '—'}${r.qualification ? ` · ${r.qualification}` : ''}`}
              metaIcon="mail-outline"
              meta={r.email || r.phone || undefined}
              tag={r.is_active ? 'Active' : 'Inactive'}
              tagColor={r.is_active ? '#22C55E' : '#EF4444'}
              onPress={() => navigation.navigate('AdminTeacherDetail', { id: r.id })}
            />
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('AdminTeacherForm')} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Filter popup (top-right) */}
      {filterOpen && (
        <View style={s.filterOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFilterOpen(false)} />
          <View style={s.filterCard}>
            <View style={s.filterHead}>
              <Text style={s.filterTitle}>Filter Teachers</Text>
              <TouchableOpacity onPress={() => setFilterOpen(false)}><VectorIcon iconSet="Ionicons" iconName="close" size={20} color={theme.colors.textMuted} /></TouchableOpacity>
            </View>
            <Select label="Gender" value={fGender} options={GENDER_OPTS} onChange={(v) => setFGender(String(v))} />
            <Select label="Status" value={fStatus} options={STATUS_OPTS} onChange={(v) => setFStatus(String(v))} />
            <View style={s.filterActions}>
              <TouchableOpacity style={[s.fbtn, s.fbtnGhost]} onPress={clearFilters} activeOpacity={0.85}>
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

export default AdminTeachersScreen;

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

  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  avatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 38, height: 38, borderRadius: 12 },
  avatarInit: { fontSize: 16, fontWeight: '900', color: '#8B5CF6' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  inactiveTag: { backgroundColor: '#FEE2E2', borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  inactiveTagText: { fontSize: 10, fontWeight: '800', color: theme.colors.danger },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  filterOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, elevation: 50, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 66, paddingRight: 12 },
  filterCard: { width: '86%', maxWidth: 360, backgroundColor: theme.colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border, elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  filterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  filterTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  filterActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  fbtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fbtnGhost: { backgroundColor: theme.colors.border },
  fbtnGhostText: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  fbtnPrimary: { backgroundColor: theme.colors.primary },
  fbtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import ListRow from '../../components/ListRow';
import FilterSheet from '../../components/FilterSheet';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AdminExam, ExamStats, ExamOptions, ExamFilters, SyllabusGroup,
  getExams, getSyllabus,
} from '../../api/adminExamApi';

type Tab = 'exams' | 'syllabus';
const STATUS_OPTS: [string, string][] = [['', 'All'], ['published', 'Published'], ['draft', 'Draft'], ['upcoming', 'Upcoming'], ['active', 'Active'], ['completed', 'Completed']];

const AdminExamScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<Tab>('exams');
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [stats, setStats] = useState<ExamStats | null>(null);
  const [options, setOptions] = useState<ExamOptions | null>(null);
  const [groups, setGroups] = useState<SyllabusGroup[]>([]);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // filters
  const [fYear, setFYear] = useState('');
  const [fType, setFType] = useState('');
  const [fTerm, setFTerm] = useState('');
  const [fStatus, setFStatus] = useState('');

  const loadExams = useCallback(async () => {
    const f: ExamFilters = { search: search.trim() || undefined };
    if (fYear) f.academic_year = fYear;
    if (fType) f.exam_type = fType;
    if (fTerm) f.term = fTerm;
    if (fStatus) f.status = fStatus as any;
    const res = await getExams(f);
    setExams(res.exams);
    setStats(res.stats);
    setOptions(res.options);
  }, [search, fYear, fType, fTerm, fStatus]);

  const loadSyllabus = useCallback(async () => {
    const res = await getSyllabus();
    setGroups(res.mode === 'list' ? res.groups : []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'exams') await loadExams();
      else await loadSyllabus();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load data.'));
    } finally {
      setLoading(false);
    }
  }, [tab, loadExams, loadSyllabus]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const { refreshing, onRefresh } = useRefresh(load);

  const activeFilters = (fYear ? 1 : 0) + (fType ? 1 : 0) + (fTerm ? 1 : 0) + (fStatus ? 1 : 0);
  const yearOpts = [{ label: 'All', value: '' }, ...((options?.academic_years ?? []).map(y => ({ label: y, value: y })))];
  const typeOpts = [{ label: 'All', value: '' }, ...Object.entries(options?.exam_types ?? {}).map(([k, v]) => ({ label: v, value: k }))];
  const termOpts = [{ label: 'All', value: '' }, ...((options?.terms ?? []).map(t => ({ label: t, value: t })))];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="Exams"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={tab === 'exams' ? (
          <TouchableOpacity style={s.headBtn} onPress={() => setFilterOpen(true)} activeOpacity={0.8}>
            <VectorIcon iconSet="Ionicons" iconName="filter" size={18} color={theme.colors.primary} />
            {activeFilters > 0 && <View style={s.headDot}><Text style={s.headDotText}>{activeFilters}</Text></View>}
          </TouchableOpacity>
        ) : undefined}
      />

      <View style={s.statRow}>
        {[
          { label: 'Total', value: stats?.total, color: '#22C55E' },
          { label: 'Published', value: stats?.published, color: '#0EA5E9' },
          { label: 'Upcoming', value: stats?.upcoming, color: '#F59E0B' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.tabRow}>
        {(['exams', 'syllabus'] as Tab[]).map(t => {
          const active = tab === t;
          return (
            <TouchableOpacity key={t} style={[s.tab, active && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
              <Text style={[s.tabText, active && s.tabTextActive]}>{t === 'exams' ? 'Exams' : 'Syllabus'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'exams' && (
        <View style={s.searchRow}>
          <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
          <TextInput style={s.searchInput} placeholder="Search exam name"
            placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} onSubmitEditing={load} returnKeyType="search" />
          {!!search && <TouchableOpacity onPress={() => setSearch('')}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity>}
        </View>
      )}

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

          {tab === 'exams' && exams.map(e => (
            <ListRow
              key={e.id}
              color={e.is_published ? '#22C55E' : '#94A3B8'}
              title={e.exam_name}
              subtitle={`${e.exam_type_label ?? e.exam_type} · ${e.term} · ${e.academic_year}`}
              metaIcon="calendar-outline"
              meta={`${e.start_date ?? ''} → ${e.end_date ?? ''}${e.uses_grading_system ? ' · Grading' : ` · ${e.total_marks}/${e.passing_marks}`}`}
              tag={e.is_published ? 'Published' : 'Draft'}
              tagColor={e.is_published ? '#22C55E' : '#64748B'}
              onPress={() => navigation.navigate('AdminExamForm', { exam: e, options })}
            />
          ))}

          {tab === 'syllabus' && groups.map((g, i) => (
            <ListRow
              key={`${g.exam_id}-${g.standard_id}-${g.section_id}-${g.subject_id}-${i}`}
              color="#14B8A6"
              title={g.subject_name}
              subtitle={`${g.exam_name} · ${g.standard_name}${g.section_name ? ` - ${g.section_name}` : ''}`}
              metaIcon="library-outline"
              meta={`${g.chapter_count} chapter(s)`}
              onPress={() => navigation.navigate('AdminExamSyllabusForm', { group: g })}
            />
          ))}

          {((tab === 'exams' && exams.length === 0) || (tab === 'syllabus' && groups.length === 0)) && (
            <Text style={s.empty}>Nothing here yet. Tap + to add.</Text>
          )}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab}
        onPress={() => (tab === 'exams' ? navigation.navigate('AdminExamForm', { options }) : navigation.navigate('AdminExamSyllabusForm', {}))}
        activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        onClear={() => { setFYear(''); setFType(''); setFTerm(''); setFStatus(''); }}
        sections={[
          { key: 'year', title: 'Academic Year', options: yearOpts, value: fYear, onChange: setFYear },
          { key: 'type', title: 'Exam Type', options: typeOpts, value: fType, onChange: setFType },
          { key: 'term', title: 'Term', options: termOpts, value: fTerm, onChange: setFTerm },
          { key: 'status', title: 'Status', options: STATUS_OPTS.map(([v, l]) => ({ label: l, value: v })), value: fStatus, onChange: setFStatus },
        ]}
      />
    </View>
  );
};

export default AdminExamScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  headBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  headDot: { position: 'absolute', top: -2, right: -2, minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 8, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  headDotText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 },
  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
});

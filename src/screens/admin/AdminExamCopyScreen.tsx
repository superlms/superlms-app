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
import { ExamCopyRow, ExamCopyStats, ExamFilterOptions, getExamCopies } from '../../api/adminExamExtraApi';

const pctColor = (p?: number | null) => (p == null ? '#9CA3AF' : p >= 75 ? '#22C55E' : p >= 40 ? '#F59E0B' : '#EF4444');

const AdminExamCopyScreen = ({ navigation }: any) => {
  const [rows, setRows] = useState<ExamCopyRow[]>([]);
  const [stats, setStats] = useState<ExamCopyStats | null>(null);
  const [options, setOptions] = useState<ExamFilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const [exam, setExam] = useState<number | 0>(0);
  const [std, setStd] = useState<number | 0>(0);
  const [subject, setSubject] = useState<number | 0>(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExamCopies({
        exam_id: exam || undefined, standard_id: std || undefined, subject_id: subject || undefined,
        search: search.trim() || undefined,
      });
      setRows(res.copies);
      setStats(res.stats);
      setOptions(res.options);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load exam copies.'));
    } finally {
      setLoading(false);
    }
  }, [exam, std, subject, search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const { refreshing, onRefresh } = useRefresh(load);

  const activeFilters = (exam ? 1 : 0) + (std ? 1 : 0) + (subject ? 1 : 0);
  const opt = (arr?: { id: number; name: string }[]) => [{ label: 'All', value: 0 }, ...(arr ?? []).map(x => ({ label: x.name, value: x.id }))];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="Exam Copies"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={
          <TouchableOpacity style={s.headBtn} onPress={() => setFilterOpen(true)} activeOpacity={0.8}>
            <VectorIcon iconSet="Ionicons" iconName="filter" size={18} color={theme.colors.primary} />
            {activeFilters > 0 && <View style={s.headDot}><Text style={s.headDotText}>{activeFilters}</Text></View>}
          </TouchableOpacity>
        }
      />

      <View style={s.statRow}>
        {[
          { label: 'Total', value: stats?.total, color: '#6366F1' },
          { label: 'Uploaded', value: stats?.uploaded, color: '#22C55E' },
          { label: 'Pending', value: stats?.pending, color: '#F59E0B' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.searchRow}>
        <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Search student name"
          placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} onSubmitEditing={load} returnKeyType="search" />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity>}
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {rows.length === 0 && <Text style={s.empty}>No exam copies for this selection.</Text>}
          {rows.map(r => (
            <ListRow
              key={r.id}
              color={r.is_absent ? '#EF4444' : pctColor(r.percentage)}
              title={r.student}
              subtitle={`${r.subject ?? '—'}${r.exam ? ` · ${r.exam}` : ''}${r.class ? ` · ${r.class}${r.section ? `-${r.section}` : ''}` : ''}`}
              metaIcon={r.has_pdf ? 'document-text-outline' : 'alert-circle-outline'}
              meta={r.is_absent ? 'Absent' : (r.marks_obtained != null ? `${r.marks_obtained}/${r.max_marks ?? '—'}${r.has_pdf ? ' · PDF' : ''}` : (r.has_pdf ? 'PDF' : 'No PDF'))}
              tag={r.is_absent ? 'ABS' : (r.grade || (r.percentage != null ? `${r.percentage}%` : undefined))}
              tagColor={r.is_absent ? '#EF4444' : pctColor(r.percentage)}
              onPress={() => navigation.navigate('AdminExamCopyDetail', { copy: r })}
            />
          ))}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        onClear={() => { setExam(0); setStd(0); setSubject(0); }}
        sections={[
          { key: 'exam', title: 'Exam', options: opt(options?.exams), value: exam, onChange: (v) => setExam(v) },
          { key: 'std', title: 'Class', options: opt(options?.standards), value: std, onChange: (v) => setStd(v) },
          { key: 'sub', title: 'Subject', options: opt(options?.subjects), value: subject, onChange: (v) => setSubject(v) },
        ]}
      />
    </View>
  );
};

export default AdminExamCopyScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  headDot: { position: 'absolute', top: -2, right: -2, minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 8, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  headDotText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },
});

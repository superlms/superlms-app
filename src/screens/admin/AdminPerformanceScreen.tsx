import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import ListRow from '../../components/ListRow';
import FilterSheet from '../../components/FilterSheet';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ExamFilterOptions, PerfStats, PerfSubject, getPerformance } from '../../api/adminExamExtraApi';

const pctColor = (p: number) => (p >= 75 ? '#22C55E' : p >= 40 ? '#F59E0B' : '#EF4444');

const AdminPerformanceScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState<PerfStats | null>(null);
  const [subjects, setSubjects] = useState<PerfSubject[]>([]);
  const [options, setOptions] = useState<ExamFilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);

  const [exam, setExam] = useState<number | 0>(0);
  const [std, setStd] = useState<number | 0>(0);
  const [subject, setSubject] = useState<number | 0>(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPerformance({
        exam_id: exam || undefined, standard_id: std || undefined, subject_id: subject || undefined,
      });
      setStats(res.stats);
      setSubjects(res.subjects);
      setOptions(res.options);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load performance.'));
    } finally {
      setLoading(false);
    }
  }, [exam, std, subject]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const { refreshing, onRefresh } = useRefresh(load);

  const activeFilters = (exam ? 1 : 0) + (std ? 1 : 0) + (subject ? 1 : 0);
  const opt = (arr?: { id: number; name: string }[]) => [{ label: 'All', value: 0 }, ...(arr ?? []).map(x => ({ label: x.name, value: x.id }))];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="Performance"
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
          { label: 'Avg %', value: stats ? `${stats.avg}%` : '—', color: '#6366F1' },
          { label: 'Copies', value: stats?.copies, color: '#0EA5E9' },
          { label: 'Exams', value: stats?.exams, color: '#F59E0B' },
          { label: 'Students', value: stats?.students, color: '#22C55E' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <Text style={s.section}>Average by subject</Text>
          {subjects.length === 0 && <Text style={s.empty}>No graded copies for this selection.</Text>}
          {subjects.map((r, i) => (
            <ListRow
              key={`${r.subject}-${i}`}
              color={pctColor(r.avg)}
              title={r.subject}
              subtitle={`${r.count} copies`}
              metaIcon="trending-up-outline"
              meta={`min ${r.min}% · max ${r.max}%`}
              tag={`${r.avg}%`}
              tagColor={pctColor(r.avg)}
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

export default AdminPerformanceScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  headDot: { position: 'absolute', top: -2, right: -2, minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 8, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  headDotText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  statRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statVal: { fontSize: 17, fontWeight: '900' },
  statLbl: { fontSize: 10, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  section: { fontSize: 12, fontWeight: '800', color: theme.colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },
});

import React, { useCallback, useEffect, useState } from 'react';
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
import { DrawerActions } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { FormModal, Field, ToggleRow, ChipPicker } from './AdminStandardScreen';
import {
  AdminExam,
  ExamStats,
  ExamOptions,
  ExamPayload,
  SyllabusGroup,
  SyllabusOptions,
  createExam,
  deleteExam,
  deleteSyllabusGroup,
  getExams,
  getSyllabus,
  getSyllabusOptions,
  saveSyllabus,
  toggleExamPublish,
  updateExam,
} from '../../api/adminExamApi';

type Tab = 'exams' | 'syllabus';

const emptyExam: ExamPayload = {
  exam_name: '', term: 'Term-1', academic_year: '', start_date: '', end_date: '',
  exam_type: '', description: '', is_published: false, uses_grading_system: false,
  total_marks: '', passing_marks: '',
};

const AdminExamScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<Tab>('exams');
  const [loading, setLoading] = useState(true);

  const [exams, setExams] = useState<AdminExam[]>([]);
  const [stats, setStats] = useState<ExamStats | null>(null);
  const [options, setOptions] = useState<ExamOptions | null>(null);
  const [search, setSearch] = useState('');

  const [groups, setGroups] = useState<SyllabusGroup[]>([]);

  // exam modal
  const [examModal, setExamModal] = useState(false);
  const [editExamId, setEditExamId] = useState<number | null>(null);
  const [form, setForm] = useState<ExamPayload>(emptyExam);
  const [saving, setSaving] = useState(false);
  const setF = (k: keyof ExamPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  // syllabus modal
  const [sylModal, setSylModal] = useState(false);
  const [sylOpt, setSylOpt] = useState<SyllabusOptions | null>(null);
  const [sylExam, setSylExam] = useState<number | null>(null);
  const [sylStd, setSylStd] = useState<number | null>(null);
  const [sylSec, setSylSec] = useState<number | null>(null);
  const [sylSub, setSylSub] = useState<number | null>(null);
  const [sylChapters, setSylChapters] = useState<number[]>([]);

  const loadExams = useCallback(async () => {
    const res = await getExams({ search });
    setExams(res.exams);
    setStats(res.stats);
    setOptions(res.options);
  }, [search]);

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

  useEffect(() => { load(); }, [load]);
  const { refreshing, onRefresh } = useRefresh(load);

  // ─── Exam CRUD ──────────────────────────────────────────────────────────────
  const openExam = (e?: AdminExam) => {
    if (e) {
      setEditExamId(e.id);
      setForm({
        exam_name: e.exam_name, term: e.term ?? 'Term-1', academic_year: e.academic_year,
        start_date: e.start_date ?? '', end_date: e.end_date ?? '', exam_type: e.exam_type,
        description: e.description ?? '', is_published: e.is_published,
        uses_grading_system: e.uses_grading_system,
        total_marks: e.total_marks ?? '', passing_marks: e.passing_marks ?? '',
      });
    } else {
      setEditExamId(null);
      setForm({ ...emptyExam, academic_year: options?.academic_years?.[0] ?? '' });
    }
    setExamModal(true);
  };
  const saveExam = async () => {
    if (!form.exam_name.trim() || !form.academic_year || !form.start_date || !form.end_date || !form.exam_type) {
      return Alert.alert('Required', 'Name, academic year, dates and exam type are required.');
    }
    if (!form.uses_grading_system && (!form.total_marks || !form.passing_marks)) {
      return Alert.alert('Required', 'Total and passing marks are required unless using grading system.');
    }
    setSaving(true);
    try {
      if (editExamId) await updateExam(editExamId, form);
      else await createExam(form);
      setExamModal(false);
      await loadExams();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save exam.'));
    } finally {
      setSaving(false);
    }
  };
  const togglePublish = async (e: AdminExam) => {
    try { await toggleExamPublish(e.id); await loadExams(); }
    catch (err) { Alert.alert('Error', apiErr(err, 'Could not update.')); }
  };
  const removeExam = (e: AdminExam) =>
    Alert.alert('Delete Exam', `Delete "${e.exam_name}"? Its syllabus will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteExam(e.id); await loadExams(); }
        catch (err) { Alert.alert('Error', apiErr(err, 'Could not delete.')); }
      } },
    ]);

  // ─── Syllabus ───────────────────────────────────────────────────────────────
  const openSyllabus = async (g?: SyllabusGroup) => {
    setSylModal(true);
    setSylOpt(null);
    const exam = g?.exam_id ?? null;
    const std = g?.standard_id ?? null;
    const sec = g?.section_id ?? null;
    const sub = g?.subject_id ?? null;
    setSylExam(exam); setSylStd(std); setSylSec(sec); setSylSub(sub); setSylChapters([]);
    const opt = await getSyllabusOptions({
      exam_id: exam ?? undefined, standard_id: std ?? undefined,
      section_id: sec ?? undefined, subject_id: sub ?? undefined,
    });
    setSylOpt(opt);
    if (opt.selected_chapter_ids) setSylChapters(opt.selected_chapter_ids);
  };
  const refreshSylOptions = async (next: { exam?: number | null; std?: number | null; sec?: number | null; sub?: number | null }) => {
    const exam = next.exam !== undefined ? next.exam : sylExam;
    const std = next.std !== undefined ? next.std : sylStd;
    const sec = next.sec !== undefined ? next.sec : sylSec;
    const sub = next.sub !== undefined ? next.sub : sylSub;
    const opt = await getSyllabusOptions({
      exam_id: exam ?? undefined, standard_id: std ?? undefined,
      section_id: sec ?? undefined, subject_id: sub ?? undefined,
    });
    setSylOpt(opt);
    if (opt.selected_chapter_ids) setSylChapters(opt.selected_chapter_ids);
  };
  const onSylExam = (id: number) => { setSylExam(id); refreshSylOptions({ exam: id }); };
  const onSylStd = (id: number) => { setSylStd(id); setSylSec(null); setSylSub(null); setSylChapters([]); refreshSylOptions({ std: id, sec: null, sub: null }); };
  const onSylSec = (id: number) => { setSylSec(id); setSylSub(null); setSylChapters([]); refreshSylOptions({ sec: id, sub: null }); };
  const onSylSub = (id: number) => { setSylSub(id); setSylChapters([]); refreshSylOptions({ sub: id }); };
  const toggleChapter = (id: number) => setSylChapters(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const saveSyl = async () => {
    if (!sylExam || !sylStd || !sylSub || sylChapters.length === 0) {
      return Alert.alert('Required', 'Exam, class, subject and at least one chapter are required.');
    }
    setSaving(true);
    try {
      await saveSyllabus({ exam_id: sylExam, standard_id: sylStd, section_id: sylSec, subject_id: sylSub, chapter_ids: sylChapters });
      setSylModal(false);
      await loadSyllabus();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save syllabus.'));
    } finally {
      setSaving(false);
    }
  };
  const removeSyl = (g: SyllabusGroup) =>
    Alert.alert('Remove Syllabus', `Remove syllabus for ${g.subject_name} (${g.standard_name})?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await deleteSyllabusGroup({ exam_id: g.exam_id, standard_id: g.standard_id, subject_id: g.subject_id }); await loadSyllabus(); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not remove.')); }
      } },
    ]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <View style={s.topbar}>
        <TouchableOpacity style={s.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Exams</Text>
      </View>

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
            placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} returnKeyType="search" />
          {!!search && <TouchableOpacity onPress={() => setSearch('')}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity>}
        </View>
      )}

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

          {tab === 'exams' && exams.map(e => (
            <View key={e.id} style={s.card}>
              <View style={s.cardMain}>
                <View style={[s.avatar, { backgroundColor: '#22C55E18' }]}>
                  <VectorIcon iconSet="Ionicons" iconName="document-text" size={20} color="#22C55E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{e.exam_name}</Text>
                  <Text style={s.cardSub}>{e.exam_type_label ?? e.exam_type} · {e.term} · {e.academic_year}</Text>
                  <Text style={s.cardMeta}>{e.start_date} → {e.end_date}{e.uses_grading_system ? ' · Grading' : ` · ${e.total_marks}/${e.passing_marks}`}</Text>
                </View>
                <View style={[s.statusTag, { backgroundColor: (e.is_published ? '#22C55E' : '#94A3B8') + '18' }]}>
                  <Text style={[s.statusTagText, { color: e.is_published ? '#16A34A' : '#64748B' }]}>{e.is_published ? 'Published' : 'Draft'}</Text>
                </View>
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.act} onPress={() => togglePublish(e)}>
                  <VectorIcon iconSet="Ionicons" iconName={e.is_published ? 'eye-off-outline' : 'paper-plane-outline'} size={17} color="#0EA5E9" />
                </TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => openExam(e)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={17} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => removeExam(e)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </View>
          ))}

          {tab === 'syllabus' && groups.map((g, i) => (
            <View key={`${g.exam_id}-${g.standard_id}-${g.section_id}-${g.subject_id}-${i}`} style={s.card}>
              <View style={s.cardMain}>
                <View style={[s.avatar, { backgroundColor: '#14B8A618' }]}>
                  <VectorIcon iconSet="Ionicons" iconName="library" size={20} color="#14B8A6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{g.subject_name}</Text>
                  <Text style={s.cardSub}>{g.exam_name} · {g.standard_name}{g.section_name ? ` - ${g.section_name}` : ''}</Text>
                  <Text style={s.cardMeta}>{g.chapter_count} chapter(s)</Text>
                </View>
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.act} onPress={() => openSyllabus(g)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={17} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => removeSyl(g)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </View>
          ))}

          {((tab === 'exams' && exams.length === 0) || (tab === 'syllabus' && groups.length === 0)) && (
            <Text style={s.empty}>Nothing here yet. Tap + to add.</Text>
          )}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={() => (tab === 'exams' ? openExam() : openSyllabus())} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Exam modal */}
      <FormModal visible={examModal} title={editExamId ? 'Edit Exam' : 'New Exam'}
        onClose={() => setExamModal(false)} onSave={saveExam} saving={saving} saveLabel={editExamId ? 'Update' : 'Create'}>
        <Field label="Exam Name" value={form.exam_name} onChangeText={(v: string) => setF('exam_name', v)} placeholder="e.g. Half Yearly 2026" />
        <Text style={s.fieldLabel}>Term</Text>
        <ChipPicker items={(options?.terms ?? ['Term-1', 'Term-2']).map(t => ({ id: t, label: t }))} selected={[form.term]} onToggle={(id: any) => setF('term', id)} />
        <Text style={s.fieldLabel}>Academic Year</Text>
        <ChipPicker items={(options?.academic_years ?? []).map(y => ({ id: y, label: y }))} selected={form.academic_year ? [form.academic_year] : []} onToggle={(id: any) => setF('academic_year', id)} />
        <Text style={s.fieldLabel}>Exam Type</Text>
        <ChipPicker items={Object.entries(options?.exam_types ?? {}).map(([k, v]) => ({ id: k, label: v }))} selected={form.exam_type ? [form.exam_type] : []} onToggle={(id: any) => setF('exam_type', id)} />
        <Field label="Start Date" value={form.start_date} onChangeText={(v: string) => setF('start_date', v)} placeholder="YYYY-MM-DD" />
        <Field label="End Date" value={form.end_date} onChangeText={(v: string) => setF('end_date', v)} placeholder="YYYY-MM-DD" />
        <ToggleRow label="Uses Grading System" value={form.uses_grading_system} onValueChange={(v: boolean) => setF('uses_grading_system', v)} />
        {!form.uses_grading_system && (
          <>
            <Field label="Total Marks" value={String(form.total_marks ?? '')} onChangeText={(v: string) => setF('total_marks', v)} placeholder="e.g. 100" keyboardType="number-pad" />
            <Field label="Passing Marks" value={String(form.passing_marks ?? '')} onChangeText={(v: string) => setF('passing_marks', v)} placeholder="e.g. 33" keyboardType="number-pad" />
          </>
        )}
        <Field label="Description" value={form.description} onChangeText={(v: string) => setF('description', v)} placeholder="Optional" multiline />
        <ToggleRow label="Published" value={form.is_published} onValueChange={(v: boolean) => setF('is_published', v)} />
      </FormModal>

      {/* Syllabus modal */}
      <FormModal visible={sylModal} title="Map Syllabus"
        onClose={() => setSylModal(false)} onSave={saveSyl} saving={saving} saveLabel="Save">
        {!sylOpt ? (
          <View style={{ paddingVertical: 24 }}><ActivityIndicator color={theme.colors.primary} /></View>
        ) : (
          <>
            <Text style={s.fieldLabel}>Exam</Text>
            <ChipPicker items={sylOpt.exams.map(e => ({ id: e.id, label: e.exam_name }))} selected={sylExam ? [sylExam] : []} onToggle={onSylExam} />
            <Text style={s.fieldLabel}>Class</Text>
            <ChipPicker items={sylOpt.standards.map(x => ({ id: x.id, label: x.name }))} selected={sylStd ? [sylStd] : []} onToggle={onSylStd} />
            <Text style={s.fieldLabel}>Section</Text>
            <ChipPicker items={sylOpt.sections.map(x => ({ id: x.id, label: x.name }))} selected={sylSec ? [sylSec] : []} onToggle={onSylSec} />
            <Text style={s.fieldLabel}>Subject</Text>
            <ChipPicker items={sylOpt.subjects.map(x => ({ id: x.id, label: x.name }))} selected={sylSub ? [sylSub] : []} onToggle={onSylSub} />
            <Text style={s.fieldLabel}>Chapters</Text>
            {sylOpt.chapters.length === 0 && <Text style={s.note}>Pick exam, class & subject to list chapters.</Text>}
            {sylOpt.chapters.map(ch => {
              const active = sylChapters.includes(ch.id);
              const ownedElsewhere = ch.owning_exam_id && ch.owning_exam_id !== sylExam;
              return (
                <TouchableOpacity key={ch.id} style={[s.chapRow, active && s.chapRowActive]} onPress={() => toggleChapter(ch.id)} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName={active ? 'checkbox' : 'square-outline'} size={18} color={active ? theme.colors.primary : theme.colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.chapName}>{ch.name}</Text>
                    {!!ownedElsewhere && <Text style={s.chapOwned}>In: {ch.owning_exam_name}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </FormModal>
    </View>
  );
};

export default AdminExamScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, flex: 1 },

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

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },
  statusTag: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  statusTagText: { fontSize: 10, fontWeight: '800' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  act: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  note: { fontSize: 11, color: theme.colors.textMuted, marginTop: 6 },
  chapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background, marginBottom: 6 },
  chapRowActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  chapName: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  chapOwned: { fontSize: 10, color: '#F59E0B', marginTop: 1 },
});

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
import { FormModal } from './AdminStandardScreen';
import AdminCurriculumFilter, { CurriculumSelection } from './AdminCurriculumFilter';
import {
  Mcq,
  QuizChapter,
  QuizTarget,
  createMcqs,
  deleteMcqs,
  getMcqs,
  getQuizStats,
  getQuizTree,
  updateMcqs,
} from '../../api/adminQuizApi';

const blankMcq = (): Mcq => ({
  question_text: '',
  time_limit: 30,
  options: [
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ],
});

const AdminQuizScreen = ({ navigation }: any) => {
  const [questions, setQuestions] = useState(0);
  const [sel, setSel] = useState<CurriculumSelection>({ standardId: null, sectionId: null, subjectId: null });
  const [chapters, setChapters] = useState<QuizChapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);

  // add modal
  const [addModal, setAddModal] = useState(false);
  const [target, setTarget] = useState<{ type: QuizTarget; id: number; name: string } | null>(null);
  const [addRows, setAddRows] = useState<Mcq[]>([blankMcq()]);

  // manage modal (edit/delete existing)
  const [manageModal, setManageModal] = useState(false);
  const [editRows, setEditRows] = useState<Mcq[]>([]);
  const [manageLoading, setManageLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const loadStats = useCallback(async () => { try { setQuestions((await getQuizStats()).questions); } catch {} }, []);
  const loadList = useCallback(async () => {
    if (!sel.standardId || !sel.subjectId) { setChapters([]); return; }
    setLoading(true);
    try {
      setChapters(await getQuizTree({ standard_id: sel.standardId, section_id: sel.sectionId, subject_id: sel.subjectId }));
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load quiz.')); }
    finally { setLoading(false); }
  }, [sel]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadList(); }, [loadList]);
  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadStats(), loadList()]); });

  const toggle = (id: number) => setExpanded(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  // ─── Add ──────────────────────────────────────────────────────────────────
  const openAdd = (type: QuizTarget, id: number, name: string) => {
    setTarget({ type, id, name });
    setAddRows([blankMcq()]);
    setAddModal(true);
  };
  const validateRows = (rows: Mcq[]): string | null => {
    for (let i = 0; i < rows.length; i++) {
      const q = rows[i];
      if (!q.question_text.trim()) return `Q${i + 1}: Question text is required.`;
      if (q.options.some(o => !o.text.trim())) return `Q${i + 1}: All options are required.`;
      if (!q.options.some(o => o.is_correct)) return `Q${i + 1}: Select the correct answer.`;
    }
    return null;
  };
  const saveAdd = async () => {
    const err = validateRows(addRows);
    if (err) return Alert.alert('Check questions', err);
    setSaving(true);
    try {
      await createMcqs(target!.type, target!.id, addRows);
      setAddModal(false);
      await Promise.all([loadStats(), loadList()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save MCQs.')); }
    finally { setSaving(false); }
  };

  // ─── Manage (edit/delete) ──────────────────────────────────────────────────
  const openManage = async (type: QuizTarget, id: number, name: string) => {
    setTarget({ type, id, name });
    setManageModal(true);
    setManageLoading(true);
    try {
      const res = await getMcqs(type, id);
      setEditRows(res.mcqs);
    } catch (e) {
      setEditRows([]);
      Alert.alert('Error', apiErr(e, 'Could not load MCQs.'));
    } finally {
      setManageLoading(false);
    }
  };
  const saveManage = async () => {
    if (editRows.length === 0) { setManageModal(false); return; }
    const err = validateRows(editRows);
    if (err) return Alert.alert('Check questions', err);
    setSaving(true);
    try {
      await updateMcqs(editRows);
      setManageModal(false);
      await Promise.all([loadStats(), loadList()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not update MCQs.')); }
    finally { setSaving(false); }
  };
  const deleteOne = (q: Mcq) =>
    Alert.alert('Delete MCQ', 'Delete this question?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteMcqs([q.id!]);
          setEditRows(rows => rows.filter(r => r.id !== q.id));
          await Promise.all([loadStats(), loadList()]);
        } catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  // ─── MCQ editor (shared by add + manage) ───────────────────────────────────
  const McqEditor = ({ rows, setRows, allowDelete }: { rows: Mcq[]; setRows: (r: Mcq[]) => void; allowDelete?: boolean }) => (
    <>
      {rows.map((q, qi) => (
        <View key={qi} style={st.qBlock}>
          <View style={st.qHead}>
            <Text style={st.qTitle}>Q{qi + 1}</Text>
            {allowDelete && q.id ? (
              <TouchableOpacity onPress={() => deleteOne(q)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
            ) : rows.length > 1 ? (
              <TouchableOpacity onPress={() => setRows(rows.filter((_, x) => x !== qi))}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={18} color={theme.colors.danger} /></TouchableOpacity>
            ) : null}
          </View>
          <TextInput style={st.input} placeholder="Question text" placeholderTextColor={theme.colors.textMuted}
            value={q.question_text} multiline
            onChangeText={v => setRows(rows.map((x, i) => i === qi ? { ...x, question_text: v } : x))} />
          <View style={st.timeRow}>
            <Text style={st.timeLabel}>Time (sec)</Text>
            <TextInput style={st.timeInput} keyboardType="number-pad" value={String(q.time_limit)}
              onChangeText={v => setRows(rows.map((x, i) => i === qi ? { ...x, time_limit: Number(v) || 30 } : x))} />
          </View>
          {q.options.map((o, oi) => {
            const correct = o.is_correct;
            return (
              <View key={oi} style={st.optRow}>
                <TouchableOpacity onPress={() => setRows(rows.map((x, i) => i === qi ? { ...x, options: x.options.map((oo, j) => ({ ...oo, is_correct: j === oi })) } : x))}>
                  <VectorIcon iconSet="Ionicons" iconName={correct ? 'radio-button-on' : 'radio-button-off'} size={20} color={correct ? '#22C55E' : theme.colors.textMuted} />
                </TouchableOpacity>
                <TextInput style={[st.input, { flex: 1 }]} placeholder={`Option ${oi + 1}`} placeholderTextColor={theme.colors.textMuted}
                  value={o.text} onChangeText={v => setRows(rows.map((x, i) => i === qi ? { ...x, options: x.options.map((oo, j) => j === oi ? { ...oo, text: v } : oo) } : x))} />
              </View>
            );
          })}
        </View>
      ))}
      {!allowDelete && (
        <TouchableOpacity style={st.addRow} onPress={() => setRows([...rows, blankMcq()])} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
          <Text style={st.addRowText}>Add another question</Text>
        </TouchableOpacity>
      )}
    </>
  );

  const renderActions = (type: QuizTarget, id: number, name: string, count: number) => (
    <View style={st.actionsRow}>
      <TouchableOpacity style={st.act} onPress={() => openAdd(type, id, name)}><VectorIcon iconSet="Ionicons" iconName="add" size={18} color="#3B82F6" /></TouchableOpacity>
      {count > 0 && <TouchableOpacity style={st.act} onPress={() => openManage(type, id, name)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>}
    </View>
  );

  return (
    <View style={st.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <View style={st.topbar}>
        <TouchableOpacity style={st.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={st.title}>Quiz</Text>
        <View style={st.badge}><Text style={st.badgeText}>{questions} Qs</Text></View>
      </View>

      <AdminCurriculumFilter onChange={setSel} />

      {loading ? (
        <View style={st.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {!sel.subjectId && <Text style={st.empty}>Select a class and subject to manage quizzes.</Text>}
          {sel.subjectId && chapters.length === 0 && <Text style={st.empty}>No chapters found.</Text>}
          {chapters.map(c => {
            const open = expanded.includes(c.id);
            return (
              <View key={c.id} style={st.card}>
                <TouchableOpacity style={st.chHead} activeOpacity={0.8} onPress={() => toggle(c.id)}>
                  <VectorIcon iconSet="Ionicons" iconName={open ? 'chevron-down' : 'chevron-forward'} size={18} color={theme.colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.chName}>{c.name}</Text>
                    <Text style={st.chMeta}>{c.mcq_count} MCQ(s) · {c.topics.length} topic(s)</Text>
                  </View>
                  {renderActions('chapter', c.id, c.name, c.mcq_count)}
                </TouchableOpacity>
                {open && (
                  <View style={st.body}>
                    {c.topics.length === 0 && <Text style={st.noTopic}>No topics.</Text>}
                    {c.topics.map(t => (
                      <View key={t.id} style={st.topicRow}>
                        <View style={st.dot} />
                        <View style={{ flex: 1 }}>
                          <Text style={st.topicName}>{t.name}</Text>
                          <Text style={st.topicMeta}>{t.mcq_count} MCQ(s)</Text>
                        </View>
                        {renderActions('topic', t.id, t.name, t.mcq_count)}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add */}
      <FormModal visible={addModal} title={`Add MCQs · ${target?.name ?? ''}`} onClose={() => setAddModal(false)} onSave={saveAdd} saving={saving} saveLabel="Save">
        <McqEditor rows={addRows} setRows={setAddRows} />
      </FormModal>

      {/* Manage */}
      <FormModal visible={manageModal} title={`Manage MCQs · ${target?.name ?? ''}`} onClose={() => setManageModal(false)} onSave={saveManage} saving={saving} saveLabel="Save Changes">
        {manageLoading ? (
          <View style={{ paddingVertical: 24 }}><ActivityIndicator color={theme.colors.primary} /></View>
        ) : editRows.length === 0 ? (
          <Text style={st.empty}>No MCQs.</Text>
        ) : (
          <McqEditor rows={editRows} setRows={setEditRows} allowDelete />
        )}
      </FormModal>
    </View>
  );
};

export default AdminQuizScreen;

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, flex: 1 },
  badge: { backgroundColor: theme.colors.primaryLight, borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800', color: theme.colors.primary },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  chHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  chName: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  chMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 6 },
  act: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  noTopic: { fontSize: 12, color: theme.colors.textMuted },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' },
  topicName: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  topicMeta: { fontSize: 10, color: theme.colors.textMuted },

  qBlock: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  qHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  qTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.textSecondary },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: theme.colors.textPrimary, backgroundColor: theme.colors.card },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  timeLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  timeInput: { width: 70, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: theme.colors.textPrimary, backgroundColor: theme.colors.card },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed' },
  addRowText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
});

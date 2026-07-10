import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { Mcq, QuizTarget, createMcqs, deleteMcqs, getMcqs, updateMcqs } from '../../api/adminQuizApi';

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

const validate = (rows: Mcq[]): string | null => {
  for (let i = 0; i < rows.length; i++) {
    const q = rows[i];
    if (!q.question_text.trim()) return `Q${i + 1}: Question text is required.`;
    if (q.options.some(o => !o.text.trim())) return `Q${i + 1}: All options are required.`;
    if (!q.options.some(o => o.is_correct)) return `Q${i + 1}: Select the correct answer.`;
  }
  return null;
};

// Add new MCQs (mode 'add') or edit/delete the existing ones (mode 'manage')
// for a chapter or topic. Opened from the Quiz list.
const AdminQuizFormScreen = ({ navigation, route }: any) => {
  const mode: 'add' | 'manage' = route.params?.mode ?? 'add';
  const target: { type: QuizTarget; id: number; name: string } = route.params?.target;

  const [rows, setRows] = useState<Mcq[]>(mode === 'add' ? [blankMcq()] : []);
  const [loading, setLoading] = useState(mode === 'manage');
  const [saving, setSaving] = useState(false);

  const loadExisting = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await getMcqs(target.type, target.id)).mcqs);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load MCQs.'));
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => { if (mode === 'manage') loadExisting(); }, [mode, loadExisting]);

  const setQ = (qi: number, patch: Partial<Mcq>) =>
    setRows(rs => rs.map((x, i) => (i === qi ? { ...x, ...patch } : x)));

  const save = async () => {
    if (rows.length === 0) { navigation.goBack(); return; }
    const err = validate(rows);
    if (err) return Alert.alert('Check questions', err);
    setSaving(true);
    try {
      if (mode === 'add') await createMcqs(target.type, target.id, rows);
      else await updateMcqs(rows);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save MCQs.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteOne = (q: Mcq, qi: number) => {
    if (!q.id) { setRows(rs => rs.filter((_, i) => i !== qi)); return; }
    Alert.alert('Delete MCQ', 'Delete this question?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteMcqs([q.id!]);
          setRows(rs => rs.filter(r => r.id !== q.id));
        } catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);
  };

  return (
    <View style={s.root}>
      <Header title={mode === 'add' ? 'Add MCQs' : 'Manage MCQs'} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {!!target?.name && (
              <View style={s.contextCard}>
                <VectorIcon iconSet="Ionicons" iconName="help-circle-outline" size={15} color="#3B82F6" />
                <Text style={s.contextText} numberOfLines={1}>{target.name}</Text>
              </View>
            )}

            {rows.length === 0 && <Text style={s.empty}>No questions here yet.</Text>}

            {rows.map((q, qi) => (
              <View key={qi} style={s.qBlock}>
                <View style={s.qHead}>
                  <Text style={s.qTitle}>Q{qi + 1}</Text>
                  <TouchableOpacity onPress={() => deleteOne(q, qi)}>
                    <VectorIcon iconSet="Ionicons" iconName={q.id ? 'trash-outline' : 'close-circle'} size={18} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
                <TextInput style={s.input} placeholder="Question text" placeholderTextColor={theme.colors.textMuted}
                  multiline value={q.question_text} onChangeText={v => setQ(qi, { question_text: v })} />
                <View style={s.timeRow}>
                  <Text style={s.timeLabel}>Time (sec)</Text>
                  <TextInput style={s.timeInput} keyboardType="number-pad" value={String(q.time_limit)}
                    onChangeText={v => setQ(qi, { time_limit: Number(v) || 30 })} />
                </View>
                {q.options.map((o, oi) => (
                  <View key={oi} style={s.optRow}>
                    <TouchableOpacity onPress={() => setQ(qi, { options: q.options.map((oo, j) => ({ ...oo, is_correct: j === oi })) })}>
                      <VectorIcon iconSet="Ionicons" iconName={o.is_correct ? 'radio-button-on' : 'radio-button-off'} size={20} color={o.is_correct ? '#22C55E' : theme.colors.textMuted} />
                    </TouchableOpacity>
                    <TextInput style={[s.input, { flex: 1, marginTop: 0 }]} placeholder={`Option ${oi + 1}`} placeholderTextColor={theme.colors.textMuted}
                      value={o.text} onChangeText={v => setQ(qi, { options: q.options.map((oo, j) => (j === oi ? { ...oo, text: v } : oo)) })} />
                  </View>
                ))}
              </View>
            ))}

            {mode === 'add' && (
              <TouchableOpacity style={s.addRow} onPress={() => setRows(r => [...r, blankMcq()])} activeOpacity={0.8}>
                <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
                <Text style={s.addRowText}>Add another question</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
        {!loading && (
          <View style={s.footer}>
            <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.9} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{mode === 'add' ? 'Save MCQs' : 'Save Changes'}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminQuizFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },
  contextCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#3B82F618', borderRadius: 12, padding: 12, marginBottom: 12 },
  contextText: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  qBlock: { marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  qHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  qTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.textSecondary },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: theme.colors.textPrimary, backgroundColor: theme.colors.background, marginTop: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  timeLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  timeInput: { width: 70, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13, color: theme.colors.textPrimary, backgroundColor: theme.colors.background },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed' },
  addRowText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  saveBtn: { height: 52, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

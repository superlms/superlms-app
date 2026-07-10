import React, { useState } from 'react';
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
import { SyllabusChapter, createChapters, updateChapter } from '../../api/adminSyllabusApi';

// Add many chapters at once, or edit a single one — depending on whether a
// `chapter` param is passed. Opened from the Syllabus list.
const AdminSyllabusChapterFormScreen = ({ navigation, route }: any) => {
  const editing: SyllabusChapter | undefined = route.params?.chapter;
  const sel = route.params?.sel ?? {};
  const isEdit = !!editing;

  const [rows, setRows] = useState<{ name: string; description: string }[]>(
    isEdit ? [{ name: editing!.name, description: editing!.description ?? '' }] : [{ name: '', description: '' }],
  );
  const [saving, setSaving] = useState(false);

  const setRow = (i: number, patch: Partial<{ name: string; description: string }>) =>
    setRows(rs => rs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const save = async () => {
    const clean = rows.filter(r => r.name.trim());
    if (clean.length === 0) return Alert.alert('Required', 'Add at least one chapter name.');
    setSaving(true);
    try {
      if (isEdit) {
        await updateChapter(editing!.id, { name: clean[0].name.trim(), description: clean[0].description.trim(), order: editing!.order });
      } else {
        await createChapters({ standard_id: sel.standardId, section_id: sel.sectionId, subject_id: sel.subjectId, chapters: clean });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save chapters.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title={isEdit ? 'Edit Chapter' : 'Add Chapters'} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {rows.map((r, i) => (
            <View key={i} style={s.block}>
              <View style={s.blockHead}>
                <Text style={s.blockTitle}>Chapter {i + 1}</Text>
                {!isEdit && rows.length > 1 && (
                  <TouchableOpacity onPress={() => setRows(rs => rs.filter((_, x) => x !== i))}>
                    <VectorIcon iconSet="Ionicons" iconName="close-circle" size={20} color={theme.colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput style={s.input} placeholder="Chapter name" placeholderTextColor={theme.colors.textMuted}
                value={r.name} onChangeText={v => setRow(i, { name: v })} />
              <TextInput style={[s.input, s.multi]} placeholder="Description (optional)" placeholderTextColor={theme.colors.textMuted}
                multiline value={r.description} onChangeText={v => setRow(i, { description: v })} />
            </View>
          ))}
          {!isEdit && (
            <TouchableOpacity style={s.addRow} onPress={() => setRows(r => [...r, { name: '', description: '' }])} activeOpacity={0.8}>
              <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
              <Text style={s.addRowText}>Add another chapter</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        <View style={s.footer}>
          <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.9} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{isEdit ? 'Update Chapter' : 'Save Chapters'}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminSyllabusChapterFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  block: { marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  blockTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.background, marginTop: 8 },
  multi: { minHeight: 64, textAlignVertical: 'top' },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed' },
  addRowText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  saveBtn: { height: 52, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

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
import { createTopics, updateTopic } from '../../api/adminSyllabusApi';

// Add many topics to a chapter, or edit a single topic.
const AdminSyllabusTopicFormScreen = ({ navigation, route }: any) => {
  const editing: { id: number; name: string } | undefined = route.params?.topic;
  const chapterId: number | undefined = route.params?.chapterId;
  const chapterName: string = route.params?.chapterName ?? '';
  const isEdit = !!editing;

  const [rows, setRows] = useState<string[]>(isEdit ? [editing!.name] : ['']);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const clean = rows.map(r => r.trim()).filter(Boolean);
    if (clean.length === 0) return Alert.alert('Required', 'Add at least one topic name.');
    setSaving(true);
    try {
      if (isEdit) await updateTopic(editing!.id, clean[0]);
      else await createTopics({ chapter_id: chapterId!, topics: clean.map(name => ({ name })) });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save topics.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title={isEdit ? 'Edit Topic' : 'Add Topics'} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {!isEdit && !!chapterName && (
            <View style={s.contextCard}>
              <VectorIcon iconSet="Ionicons" iconName="book-outline" size={15} color={theme.colors.primary} />
              <Text style={s.contextText} numberOfLines={1}>{chapterName}</Text>
            </View>
          )}
          {rows.map((r, i) => (
            <View key={i} style={s.rowLine}>
              <TextInput style={[s.input, { flex: 1 }]} placeholder={`Topic ${i + 1}`} placeholderTextColor={theme.colors.textMuted}
                value={r} onChangeText={v => setRows(rs => rs.map((x, idx) => (idx === i ? v : x)))} />
              {!isEdit && rows.length > 1 && (
                <TouchableOpacity onPress={() => setRows(rs => rs.filter((_, x) => x !== i))}>
                  <VectorIcon iconSet="Ionicons" iconName="close-circle" size={20} color={theme.colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {!isEdit && (
            <TouchableOpacity style={s.addRow} onPress={() => setRows(r => [...r, ''])} activeOpacity={0.8}>
              <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
              <Text style={s.addRowText}>Add another topic</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        <View style={s.footer}>
          <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.9} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{isEdit ? 'Update Topic' : 'Save Topics'}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminSyllabusTopicFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  contextCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.primaryLight, borderRadius: 12, padding: 12, marginBottom: 12 },
  contextText: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.card },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed', marginTop: 4 },
  addRowText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  saveBtn: { height: 52, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

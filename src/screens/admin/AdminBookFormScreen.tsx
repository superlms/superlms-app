import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr, pickImage, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { Field, ToggleRow, ChipPicker } from './AdminStandardScreen';
import { BookRow, BookPayload, createBook, getBookOptions, updateBook } from '../../api/adminBookApi';

const AdminBookFormScreen = ({ navigation, route }: any) => {
  const editing: BookRow | undefined = route.params?.book;
  const classes: { id: number; name: string }[] = route.params?.classes ?? [];
  const presetClassId: number = route.params?.presetClassId ?? classes[0]?.id ?? 0;
  const isEdit = !!editing;

  const [form, setForm] = useState<BookPayload>(
    isEdit
      ? { title: editing!.title, standard_id: editing!.standard_id, section_id: editing!.section_id ?? null, subject_id: editing!.subject_id, is_active: editing!.is_active, book_logo: null, pdf_file: null }
      : { title: '', standard_id: presetClassId, section_id: null, subject_id: 0, is_active: true, book_logo: null, pdf_file: null },
  );
  const [sections, setSections] = useState<{ id: number; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [logo, setLogo] = useState<PickedFile | null>(null);
  const [pdf, setPdf] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof BookPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const loadOptions = async (standardId: number, sectionId?: number | null) => {
    try {
      const o = await getBookOptions(standardId, sectionId);
      setSections(o.sections);
      setSubjects(o.subjects);
    } catch { setSections([]); setSubjects([]); }
  };

  useEffect(() => {
    if (form.standard_id) loadOptions(form.standard_id, form.section_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClassChange = async (id: number) => {
    set('standard_id', id); set('section_id', null); set('subject_id', 0);
    await loadOptions(id, null);
  };
  const onSectionChange = async (id: number | null) => {
    set('section_id', id); set('subject_id', 0);
    await loadOptions(form.standard_id, id);
  };

  const choose = async (kind: 'logo' | 'pdf') => {
    const f = kind === 'logo' ? await pickImage() : await pickPdf();
    if (!f) return;
    if (kind === 'logo') { setLogo(f); set('book_logo', f); } else { setPdf(f); set('pdf_file', f); }
  };

  const save = async () => {
    if (!form.title.trim() || !form.standard_id || !form.subject_id) {
      return Alert.alert('Required', 'Title, class and subject are required.');
    }
    setSaving(true);
    try {
      if (isEdit) await updateBook(editing!.id, form);
      else await createBook(form);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save book.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title={isEdit ? 'Edit Book' : 'New Book'} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Field label="Title" value={form.title} onChangeText={(v: string) => set('title', v)} placeholder="Book title" />

          <Text style={s.label}>Class</Text>
          <ChipPicker items={classes.map(c => ({ id: c.id, label: c.name }))}
            selected={form.standard_id ? [form.standard_id] : []} onToggle={onClassChange} />

          <Text style={s.label}>Section (optional)</Text>
          <ChipPicker items={[{ id: 0, label: 'All' }, ...sections.map(x => ({ id: x.id, label: x.name }))]}
            selected={[form.section_id ?? 0]} onToggle={(id: number) => onSectionChange(id === 0 ? null : id)} />

          <Text style={s.label}>Subject</Text>
          <ChipPicker items={subjects.map(x => ({ id: x.id, label: x.name }))}
            selected={form.subject_id ? [form.subject_id] : []} onToggle={(id: number) => set('subject_id', id)} />

          <TouchableOpacity style={s.pickBtn} onPress={() => choose('logo')} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="image-outline" size={16} color={theme.colors.primary} />
            <Text style={s.pickText} numberOfLines={1}>{logo ? logo.name : (isEdit ? 'Replace cover image' : 'Cover image (optional)')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.pickBtn} onPress={() => choose('pdf')} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="document-outline" size={16} color={theme.colors.primary} />
            <Text style={s.pickText} numberOfLines={1}>{pdf ? pdf.name : (isEdit ? 'Replace book PDF' : 'Book PDF (optional)')}</Text>
          </TouchableOpacity>

          <ToggleRow label="Active" value={form.is_active} onValueChange={(v: boolean) => set('is_active', v)} />
        </ScrollView>
        <View style={s.footer}>
          <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.9} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{isEdit ? 'Update Book' : 'Create Book'}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminBookFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 14, marginBottom: 6 },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  pickText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, maxWidth: '80%' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  saveBtn: { height: 52, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

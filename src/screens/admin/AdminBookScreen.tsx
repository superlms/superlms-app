import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
import { apiErr, pickImage, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { FormModal, Field, ToggleRow, ChipPicker } from './AdminStandardScreen';
import {
  BookRow,
  BookStats,
  BookPayload,
  createBook,
  deleteBook,
  getBookOptions,
  getBooks,
  updateBook,
} from '../../api/adminBookApi';

const emptyForm: BookPayload = {
  title: '', standard_id: 0, section_id: null, subject_id: 0, is_active: true, book_logo: null, pdf_file: null,
};

const AdminBookScreen = ({ navigation }: any) => {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [stats, setStats] = useState<BookStats | null>(null);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fClass, setFClass] = useState<number | null>(null);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BookPayload>(emptyForm);
  const [formSections, setFormSections] = useState<{ id: number; name: string }[]>([]);
  const [formSubjects, setFormSubjects] = useState<{ id: number; name: string }[]>([]);
  const [logo, setLogo] = useState<PickedFile | null>(null);
  const [pdf, setPdf] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof BookPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBooks({ standard_id: fClass ?? undefined, search });
      setBooks(res.books);
      setStats(res.stats);
      setClasses(res.classes);
      if (fClass === null && res.classes.length > 0) setFClass(res.classes[0].id);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load books.'));
    } finally {
      setLoading(false);
    }
  }, [fClass, search]);

  useEffect(() => { load(); }, [load]);
  const { refreshing, onRefresh } = useRefresh(load);

  const loadFormOptions = async (standardId: number, sectionId?: number | null) => {
    try {
      const o = await getBookOptions(standardId, sectionId);
      setFormSections(o.sections);
      setFormSubjects(o.subjects);
    } catch { setFormSections([]); setFormSubjects([]); }
  };

  const openCreate = async () => {
    setEditId(null);
    const cid = fClass ?? classes[0]?.id ?? 0;
    setForm({ ...emptyForm, standard_id: cid });
    setLogo(null); setPdf(null);
    if (cid) await loadFormOptions(cid, null);
    setModal(true);
  };

  const openEdit = async (b: BookRow) => {
    setEditId(b.id);
    setForm({
      title: b.title, standard_id: b.standard_id, section_id: b.section_id ?? null,
      subject_id: b.subject_id, is_active: b.is_active, book_logo: null, pdf_file: null,
    });
    setLogo(null); setPdf(null);
    await loadFormOptions(b.standard_id, b.section_id);
    setModal(true);
  };

  const onClassChange = async (id: number) => {
    set('standard_id', id);
    set('section_id', null);
    set('subject_id', 0);
    await loadFormOptions(id, null);
  };
  const onSectionChange = async (id: number | null) => {
    set('section_id', id);
    set('subject_id', 0);
    await loadFormOptions(form.standard_id, id);
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
      if (editId) await updateBook(editId, form);
      else await createBook(form);
      setModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save book.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = (b: BookRow) =>
    Alert.alert('Delete Book', `Delete "${b.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteBook(b.id); await load(); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <View style={s.topbar}>
        <TouchableOpacity style={s.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Library</Text>
      </View>

      <View style={s.statRow}>
        {[
          { label: 'Total', value: stats?.total, color: '#10B981' },
          { label: 'Active', value: stats?.active, color: '#22C55E' },
          { label: 'With PDF', value: stats?.with_pdf, color: '#0EA5E9' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Class filter (required) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        {classes.map(c => {
          const active = fClass === c.id;
          return (
            <TouchableOpacity key={c.id} style={[s.pchip, active && s.pchipActive]} onPress={() => setFClass(c.id)} activeOpacity={0.8}>
              <Text style={[s.pchipText, active && s.pchipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          );
        })}
        {classes.length === 0 && <Text style={s.pickerEmpty}>No classes</Text>}
      </ScrollView>

      <View style={s.searchRow}>
        <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Search book title"
          placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} returnKeyType="search" />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity>}
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {books.length === 0 && <Text style={s.empty}>No books in this class yet.</Text>}
          {books.map(b => (
            <View key={b.id} style={s.card}>
              <View style={s.cardMain}>
                {b.book_logo ? <Image source={{ uri: b.book_logo }} style={s.cover} /> : (
                  <View style={[s.cover, s.coverPlaceholder]}><VectorIcon iconSet="Ionicons" iconName="book" size={22} color="#10B981" /></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{b.title}</Text>
                  <Text style={s.cardSub}>{b.class ?? '—'}{b.section ? ` - ${b.section}` : ''}{b.subject ? ` · ${b.subject}` : ''}</Text>
                  {!!b.pdf_file && (
                    <TouchableOpacity style={s.pdfRow} onPress={() => Linking.openURL(b.pdf_file!)}>
                      <VectorIcon iconSet="Ionicons" iconName="document-text" size={13} color="#EF4444" />
                      <Text style={s.pdfText}>View PDF</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!b.is_active && <View style={s.inactiveTag}><Text style={s.inactiveTagText}>Inactive</Text></View>}
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.act} onPress={() => openEdit(b)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={17} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => remove(b)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={openCreate} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>

      <FormModal visible={modal} title={editId ? 'Edit Book' : 'New Book'} onClose={() => setModal(false)} onSave={save} saving={saving} saveLabel={editId ? 'Update' : 'Create'}>
        <Field label="Title" value={form.title} onChangeText={(v: string) => set('title', v)} placeholder="Book title" />
        <Text style={s.fieldLabel}>Class</Text>
        <ChipPicker items={classes.map(c => ({ id: c.id, label: c.name }))} selected={form.standard_id ? [form.standard_id] : []} onToggle={onClassChange} />
        <Text style={s.fieldLabel}>Section (optional)</Text>
        <ChipPicker items={[{ id: 0, label: 'All' }, ...formSections.map(x => ({ id: x.id, label: x.name }))]} selected={[form.section_id ?? 0]} onToggle={(id: number) => onSectionChange(id === 0 ? null : id)} />
        <Text style={s.fieldLabel}>Subject</Text>
        <ChipPicker items={formSubjects.map(x => ({ id: x.id, label: x.name }))} selected={form.subject_id ? [form.subject_id] : []} onToggle={(id: number) => set('subject_id', id)} />

        <TouchableOpacity style={s.pickBtn} onPress={() => choose('logo')} activeOpacity={0.85}>
          <VectorIcon iconSet="Ionicons" iconName="image-outline" size={16} color={theme.colors.primary} />
          <Text style={s.pickText} numberOfLines={1}>{logo ? logo.name : 'Cover image (optional)'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.pickBtn} onPress={() => choose('pdf')} activeOpacity={0.85}>
          <VectorIcon iconSet="Ionicons" iconName="document-outline" size={16} color={theme.colors.primary} />
          <Text style={s.pickText} numberOfLines={1}>{pdf ? pdf.name : 'Book PDF (optional)'}</Text>
        </TouchableOpacity>
        <ToggleRow label="Active" value={form.is_active} onValueChange={(v: boolean) => set('is_active', v)} />
      </FormModal>
    </View>
  );
};

export default AdminBookScreen;

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

  filterBar: { maxHeight: 46, paddingLeft: 16, marginTop: 12 },
  filterContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
  pchip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  pchipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pchipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  pchipTextActive: { color: '#fff' },
  pickerEmpty: { fontSize: 12, color: theme.colors.textMuted, paddingVertical: 8 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  scroll: { paddingHorizontal: 16, paddingTop: 10 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 44, height: 56, borderRadius: 8 },
  coverPlaceholder: { backgroundColor: '#10B98118', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  pdfText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  inactiveTag: { backgroundColor: '#FEE2E2', borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  inactiveTagText: { fontSize: 10, fontWeight: '800', color: theme.colors.danger },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  act: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  pickText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, maxWidth: '80%' },
});

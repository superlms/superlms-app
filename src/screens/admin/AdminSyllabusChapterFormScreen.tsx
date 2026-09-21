import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { SyllabusChapter, createChapters, deleteChapter, updateChapter } from '../../api/adminSyllabusApi';
import { AppAlert } from '../../components/AppDialog';

interface Row {
  id: number | null;
  name: string;
  description: string;
  order: string;
}

const toRow = (c: SyllabusChapter): Row => ({
  id: c.id,
  name: c.name,
  description: c.description ?? '',
  order: c.order == null ? '' : String(c.order),
});

const blankRow = (order: number): Row => ({ id: null, name: '', description: '', order: String(order) });

const toOrder = (v: string) => {
  const n = parseInt(v.trim(), 10);
  return Number.isFinite(n) ? n : undefined;
};

// Two ways in, as the admin web has them:
//   • `chapter` — the pencil on a list row: edit that one chapter, description and all.
//   • `sel` + `chapters` — the + in the Syllabus header: the subject's chapters
//     load as editable rows, more can be added and any removed, and Save puts
//     the whole set through at once.
const AdminSyllabusChapterFormScreen = ({ navigation, route }: any) => {
  const editing: SyllabusChapter | undefined = route.params?.chapter;
  const sel = route.params?.sel ?? {};
  const existing: SyllabusChapter[] = route.params?.chapters ?? [];
  const isEdit = !!editing;

  const [rows, setRows] = useState<Row[]>(() =>
    isEdit ? [toRow(editing!)] : existing.length ? existing.map(toRow) : [blankRow(1)],
  );
  const [removed, setRemoved] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const subjectLine = useMemo(
    () => [sel.standardName, sel.sectionName, sel.subjectName].filter(Boolean).join(' · '),
    [sel.standardName, sel.sectionName, sel.subjectName],
  );
  const hasSaved = rows.some(r => r.id) || removed.length > 0;

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const addRow = () =>
    setRows(rs => [...rs, blankRow(rs.reduce((m, r) => Math.max(m, toOrder(r.order) ?? 0), 0) + 1)]);

  // A saved chapter is only staged for removal here — it goes when Save does.
  const removeRow = (i: number) => {
    const row = rows[i];
    if (row?.id) setRemoved(ids => [...ids, row.id!]);
    setRows(rs => rs.filter((_, x) => x !== i));
  };

  const save = async () => {
    const clean = rows.map(r => ({ ...r, name: r.name.trim() }));
    const blank = clean.findIndex(r => !r.name);
    if (blank >= 0) return AppAlert.alert('Required', `Chapter ${blank + 1}: name is required.`);
    if (clean.length === 0 && removed.length === 0) {
      return AppAlert.alert('Required', 'Add at least one chapter.');
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateChapter(editing!.id, {
          name: clean[0].name,
          description: clean[0].description.trim(),
          order: toOrder(clean[0].order) ?? editing!.order,
        });
      } else {
        for (const id of removed) await deleteChapter(id);

        const added = clean.filter(r => !r.id);
        if (added.length) {
          await createChapters({
            standard_id: sel.standardId,
            section_id: sel.sectionId,
            subject_id: sel.subjectId,
            chapters: added.map(r => ({ name: r.name, description: r.description.trim(), order: toOrder(r.order) })),
          });
        }

        for (const r of clean) {
          if (!r.id) continue;
          const was = existing.find(c => c.id === r.id);
          const same = was && was.name === r.name && (was.order == null ? '' : String(was.order)) === r.order.trim();
          if (same) continue;
          await updateChapter(r.id, { name: r.name, description: r.description.trim(), order: toOrder(r.order) });
        }
      }
      navigation.goBack();
    } catch (e) {
      AppAlert.alert('Error', apiErr(e, 'Could not save chapters.'));
    } finally {
      setSaving(false);
    }
  };

  const title = isEdit ? 'Edit Chapter' : hasSaved ? 'Manage Chapters' : 'Add Chapters';

  return (
    <View style={s.root}>
      <Header title={title} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {!isEdit && !!subjectLine && (
            <View style={s.contextCard}>
              <VectorIcon iconSet="Ionicons" iconName="library-outline" size={15} color={theme.colors.primary} />
              <Text style={s.contextText} numberOfLines={1}>{subjectLine}</Text>
            </View>
          )}

          {isEdit ? (
            <View style={s.block}>
              <TextInput style={s.input} placeholder="Chapter name" placeholderTextColor={theme.colors.textMuted}
                value={rows[0].name} onChangeText={v => setRow(0, { name: v })} />
              <TextInput style={[s.input, s.multi]} placeholder="Description (optional)" placeholderTextColor={theme.colors.textMuted}
                multiline value={rows[0].description} onChangeText={v => setRow(0, { description: v })} />
              <TextInput style={[s.input, s.gap]} placeholder="Order" placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad" value={rows[0].order} onChangeText={v => setRow(0, { order: v })} />
            </View>
          ) : (
            <>
              <View style={s.listHead}>
                <Text style={s.listTitle}>Chapters</Text>
                <Text style={s.listCount}>{rows.length}</Text>
              </View>

              {rows.length === 0 && <Text style={s.none}>No chapters yet for this subject.</Text>}

              {rows.map((r, i) => (
                <View key={r.id ?? `new-${i}`} style={s.rowLine}>
                  <View style={[s.badge, r.id ? s.badgeSaved : s.badgeNew]}>
                    <Text style={[s.badgeText, { color: r.id ? theme.colors.success : theme.colors.primary }]}>
                      {r.id ? 'Saved' : 'New'}
                    </Text>
                  </View>
                  <TextInput style={[s.input, s.nameInput]} placeholder="Chapter name" placeholderTextColor={theme.colors.textMuted}
                    value={r.name} onChangeText={v => setRow(i, { name: v })} />
                  <TextInput style={[s.input, s.orderInput]} placeholder="#" placeholderTextColor={theme.colors.textMuted}
                    keyboardType="number-pad" value={r.order} onChangeText={v => setRow(i, { order: v })} />
                  <TouchableOpacity onPress={() => removeRow(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <VectorIcon iconSet="Ionicons" iconName="close-circle" size={20} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={s.addRow} onPress={addRow} activeOpacity={0.8}>
                <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
                <Text style={s.addRowText}>Add another chapter</Text>
              </TouchableOpacity>

              {hasSaved && <Text style={s.note}>Removing a saved chapter also deletes its topics when you save.</Text>}
            </>
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
  contextCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.primaryLight, borderRadius: 12, padding: 12, marginBottom: 12 },
  contextText: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },

  listHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  listTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.textSecondary },
  listCount: { fontSize: 11, fontWeight: '800', color: theme.colors.primary, backgroundColor: theme.colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.full },
  none: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 10 },

  block: { marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  badge: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeSaved: { backgroundColor: theme.colors.success + '14', borderColor: theme.colors.success + '55' },
  badgeNew: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary + '55' },
  badgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.card },
  nameInput: { flex: 1 },
  orderInput: { width: 54, paddingHorizontal: 8, textAlign: 'center' },
  multi: { minHeight: 64, textAlignVertical: 'top', marginTop: 8 },
  gap: { marginTop: 8 },

  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed', marginTop: 4 },
  addRowText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  note: { fontSize: 11, color: theme.colors.textMuted, marginTop: 10 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  saveBtn: { height: 52, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { SyllabusChapter, saveChapterSet, updateChapter } from '../../api/adminSyllabusApi';
import { DocHeader } from '../more/docUi';
import { FormCard, FormError, Hint, SubmitButton } from './adminFormUi';

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

/**
 * A subject's chapters, two ways in, as the admin panel has them:
 *   • `sel` + `chapters` — the + on Syllabus: the panel's chapter manager. The
 *     subject's chapters come up as rows to rename or reorder, more can be
 *     added under them and any taken off, and Save puts the whole set through
 *     at once — a removed chapter's topics go with it.
 *   • `chapter` — Edit chapter on an open chapter: that one chapter, its
 *     description and all.
 */
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
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const subjectLine = useMemo(
    () => [sel.standardName, sel.sectionName ? `Section ${sel.sectionName}` : null, sel.subjectName].filter(Boolean).join(' · '),
    [sel.standardName, sel.sectionName, sel.subjectName],
  );
  const hasSaved = rows.some(r => r.id) || removed.length > 0;

  const setRow = (i: number, patch: Partial<Row>) => {
    setRows(rs => rs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
    setError('');
  };

  const addRow = () =>
    setRows(rs => [...rs, blankRow(rs.reduce((m, r) => Math.max(m, toOrder(r.order) ?? 0), 0) + 1)]);

  // A saved chapter is only staged for removal here — it goes when Save does.
  const removeRow = (i: number) => {
    const row = rows[i];
    if (row?.id) setRemoved(ids => [...ids, row.id!]);
    setRows(rs => rs.filter((_, x) => x !== i));
    setError('');
  };

  const save = async () => {
    const clean = rows.map(r => ({ ...r, name: r.name.trim() }));
    const blank = clean.findIndex(r => !r.name);
    if (blank >= 0) return setError(isEdit ? 'Chapter name is required.' : `Chapter ${blank + 1}: Name is required.`);
    if (!isEdit && clean.length === 0 && removed.length === 0) return setError('Please add at least one chapter.');

    setSaving(true);
    try {
      if (isEdit) {
        await updateChapter(editing!.id, {
          name: clean[0].name,
          description: clean[0].description.trim(),
          order: toOrder(clean[0].order) ?? editing!.order,
        });
        navigation.goBack();
      } else {
        setSavedMsg(
          await saveChapterSet({
            standard_id: sel.standardId,
            section_id: sel.sectionId,
            subject_id: sel.subjectId,
            rows: clean.map(r => ({ id: r.id, name: r.name, order: toOrder(r.order) ?? 1 })),
            deleted_ids: removed,
          }),
        );
      }
    } catch (e) {
      setError(apiErr(e, 'Could not save chapters.'));
    } finally {
      setSaving(false);
    }
  };

  const closeSaved = () => {
    setSavedMsg('');
    navigation.goBack();
  };

  const title = isEdit ? 'Edit Chapter' : hasSaved ? 'Manage Chapters' : 'Add Chapters';

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {isEdit ? (
            <>
              <FormCard label="Chapter name" value={rows[0].name} onChangeText={v => setRow(0, { name: v })} placeholder="e.g. Thermodynamics" maxLength={255} />
              <FormCard
                label="Description"
                value={rows[0].description}
                onChangeText={v => setRow(0, { description: v })}
                placeholder="Optional"
                multiline
                minHeight={80}
              />
              <FormCard label="Order" value={rows[0].order} onChangeText={v => setRow(0, { order: v.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={4} />
            </>
          ) : (
            <>
              {!!subjectLine && <Text style={s.context}>{subjectLine}</Text>}
              <Text style={s.listTitle}>{`Chapters · ${rows.length}`}</Text>
              {rows.length === 0 && <Hint>No chapters for this subject — add one below, or save to remove the ones taken off.</Hint>}

              {rows.map((r, i) => (
                <View key={r.id ?? `new-${i}`} style={s.row}>
                  <View style={s.rowHead}>
                    <Text style={[s.state, r.id ? s.saved : s.fresh]}>{r.id ? 'Saved' : 'New'}</Text>
                    <TouchableOpacity onPress={() => removeRow(i)} hitSlop={8} activeOpacity={0.6}>
                      <VectorIcon iconSet="Ionicons" iconName="close" size={18} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <View style={s.pair}>
                    <FormCard
                      label={`Chapter ${i + 1}`}
                      value={r.name}
                      onChangeText={v => setRow(i, { name: v })}
                      placeholder="Chapter name"
                      maxLength={255}
                      style={s.flex}
                    />
                    <FormCard
                      label="Order"
                      value={r.order}
                      onChangeText={v => setRow(i, { order: v.replace(/\D/g, '') })}
                      keyboardType="number-pad"
                      maxLength={4}
                      style={s.order}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity style={s.addRow} onPress={addRow} activeOpacity={0.7}>
                <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
                <Text style={s.addRowText}>Add another chapter</Text>
              </TouchableOpacity>

              {hasSaved && <Hint>Removing a saved chapter also deletes its topics when you save.</Hint>}
            </>
          )}

          <FormError>{error}</FormError>
          <SubmitButton label={isEdit ? 'Save changes' : 'Save chapters'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <AppDialog visible={!!savedMsg} title="Chapters saved" message={savedMsg.replace(/^Chapters saved!\s*/, '')} actions={[{ text: 'Done', onPress: closeSaved }]} onRequestClose={closeSaved} />
    </View>
  );
};

export default AdminSyllabusChapterFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 14 },
  context: { fontSize: 13, color: theme.colors.textSecondary },
  listTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },

  row: { gap: 6 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  state: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  saved: { color: theme.colors.success },
  fresh: { color: theme.colors.primary },
  pair: { flexDirection: 'row', gap: 10 },
  order: { width: 84 },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addRowText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

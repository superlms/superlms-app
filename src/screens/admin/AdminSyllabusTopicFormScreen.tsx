import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { apiErr } from '../../utils/filePickers';
import { OutlineTopic, saveTopicSet, updateTopic } from '../../api/adminSyllabusApi';
import { DocHeader } from '../more/docUi';
import { FormCard, FormError, Hint, SubmitButton } from './adminFormUi';

interface Row {
  id: number | null;
  name: string;
  order: string;
}

const toOrder = (v: string) => {
  const n = parseInt(v.trim(), 10);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * A chapter's topics, two ways in, as the admin panel has them:
 *   • `chapterId` (+ `topics`) — Topics on an open chapter: the panel's topic
 *     manager. The chapter's topics come up as rows in their order to rename
 *     or reorder (one blank row when it has none), more can be added and any
 *     taken off, and Save puts the whole set through at once.
 *   • `topic` — the pencil on a topic: rename that one topic.
 */
const AdminSyllabusTopicFormScreen = ({ navigation, route }: any) => {
  const editing: { id: number; name: string } | undefined = route.params?.topic;
  const chapterId: number | undefined = route.params?.chapterId;
  const chapterName: string = route.params?.chapterName ?? '';
  const existing: OutlineTopic[] = route.params?.topics ?? [];
  const isEdit = !!editing;

  const [rows, setRows] = useState<Row[]>(() => {
    if (isEdit) return [{ id: editing!.id, name: editing!.name, order: '' }];
    // The panel's order: by their order, then as added; an unset order is its place.
    const saved = [...existing]
      .sort((a, b) => (a.order || 0) - (b.order || 0) || a.id - b.id)
      .map((t, i) => ({ id: t.id, name: t.name, order: String(t.order || i + 1) }));
    return saved.length ? saved : [{ id: null, name: '', order: '1' }];
  });
  const [removed, setRemoved] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const hasSaved = rows.some(r => r.id) || removed.length > 0;

  const setRow = (i: number, patch: Partial<Row>) => {
    setRows(rs => rs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
    setError('');
  };

  const addRow = () =>
    setRows(rs => [...rs, { id: null, name: '', order: String(rs.reduce((m, r) => Math.max(m, toOrder(r.order) ?? 0), 0) + 1) }]);

  const removeRow = (i: number) => {
    const row = rows[i];
    if (row?.id) setRemoved(ids => [...ids, row.id!]);
    setRows(rs => rs.filter((_, x) => x !== i));
    setError('');
  };

  const save = async () => {
    const clean = rows.map(r => ({ ...r, name: r.name.trim() }));
    const blank = clean.findIndex(r => !r.name);
    if (isEdit && blank >= 0) return setError('Topic name is required.');
    if (!isEdit) {
      if (clean.length === 0 && removed.length === 0) return setError('Please add at least one topic.');
      if (blank >= 0) return setError(`Topic ${blank + 1}: Name is required.`);
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateTopic(editing!.id, clean[0].name);
        navigation.goBack();
      } else {
        setSavedMsg(
          await saveTopicSet({
            chapter_id: chapterId!,
            rows: clean.map(r => ({ id: r.id, name: r.name, order: toOrder(r.order) ?? 1 })),
            deleted_ids: removed,
          }),
        );
      }
    } catch (e) {
      setError(apiErr(e, 'Could not save topics.'));
    } finally {
      setSaving(false);
    }
  };

  const closeSaved = () => {
    setSavedMsg('');
    navigation.goBack();
  };

  const title = isEdit ? 'Edit Topic' : hasSaved ? 'Manage Topics' : 'Add Topics';

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {isEdit ? (
            <FormCard label="Topic name" value={rows[0].name} onChangeText={v => setRow(0, { name: v })} placeholder="e.g. Newton's Laws of Motion" maxLength={255} />
          ) : (
            <>
              {!!chapterName && <Text style={s.context}>{quietCaps(chapterName)}</Text>}
              <Text style={s.listTitle}>{`Topics · ${rows.length}`}</Text>
              {rows.length === 0 && <Hint>No topics in this chapter — add one below, or save to remove the ones taken off.</Hint>}

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
                      label={`Topic ${i + 1}`}
                      value={r.name}
                      onChangeText={v => setRow(i, { name: v })}
                      placeholder="Topic name"
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
                <Text style={s.addRowText}>Add another topic</Text>
              </TouchableOpacity>
            </>
          )}

          <FormError>{error}</FormError>
          <SubmitButton label={isEdit ? 'Save changes' : 'Save topics'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <AppDialog visible={!!savedMsg} title="Topics saved" message={savedMsg.replace(/^Topics saved!\s*/, '')} actions={[{ text: 'Done', onPress: closeSaved }]} onRequestClose={closeSaved} />
    </View>
  );
};

export default AdminSyllabusTopicFormScreen;

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

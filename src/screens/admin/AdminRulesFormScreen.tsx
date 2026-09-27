import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { AppAlert, AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { AdminRules, RuleFile, removeAdminRulesFile, saveAdminRules } from '../../api/adminRulesApi';
import { DocHeader } from '../more/docUi';
import { FileChip, FormCard, FormError, Hint, SubmitButton, confirmDestructive } from './adminFormUi';

/**
 * Rules & Regulations, edited as the web panel's editor has them: the
 * sections (a heading of up to 255 characters and its description; one at
 * least), additional information (a key and a value), and PDFs of up to 2 MB
 * with a title each. With nothing saved yet it opens on the standard school
 * rules, as the panel does. A saved PDF comes off straight away with its
 * cross, as on the panel; everything else waits for Save, which keeps the
 * saved PDFs and adds the new ones.
 *
 * Route params: rules – as the page loaded them.
 */

const TWO_MB = 2 * 1024 * 1024;

// Each row keeps its id, so taking one off leaves the others' boxes as they are.
let nextId = 1;
const rowId = () => nextId++;

type Section = { id: number; head: string; desc: string };
type Info = { id: number; key: string; value: string };
type NewFile = { id: number; title: string; file: PickedFile };

// "PDF · 0.4 MB"
const fileSub = (type?: string | null, size?: number | null) =>
  [(type || 'pdf').toUpperCase(), size ? `${(size / 1048576).toFixed(1)} MB` : null].filter(Boolean).join(' · ');

const AdminRulesFormScreen = ({ navigation, route }: any) => {
  const rules: AdminRules | undefined = route?.params?.rules;
  const usingDefaults = !!rules?.using_defaults;
  const isCreate = !rules?.exists;

  const [sections, setSections] = useState<Section[]>(() => {
    const list = (rules?.sections ?? []).map(sec => ({ id: rowId(), head: sec.head ?? '', desc: sec.desc ?? '' }));
    return list.length ? list : [{ id: rowId(), head: '', desc: '' }];
  });
  const [info, setInfo] = useState<Info[]>(() =>
    (rules?.additional_info ?? []).map(a => ({ id: rowId(), key: a.key ?? '', value: a.value ?? '' })),
  );
  const [savedFiles, setSavedFiles] = useState<RuleFile[]>(rules?.exists ? rules.files ?? [] : []);
  const [newFiles, setNewFiles] = useState<NewFile[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const setSection = (i: number, patch: Partial<Section>) => {
    setSections(prev => prev.map((sec, j) => (j === i ? { ...sec, ...patch } : sec)));
    setError('');
  };
  // The panel keeps at least one section.
  const removeSection = (i: number) => setSections(prev => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev));

  const setInfoRow = (i: number, patch: Partial<Info>) => {
    setInfo(prev => prev.map((a, j) => (j === i ? { ...a, ...patch } : a)));
    setError('');
  };

  const addDocument = async () => {
    const f = await pickPdf();
    if (!f) return;
    if (f.size && f.size > TWO_MB) {
      AppAlert.alert('File too large', 'Each document must be 2 MB or smaller.');
      return;
    }
    const title = (f.name || '').replace(/\.pdf$/i, '');
    setNewFiles(prev => [...prev, { id: rowId(), title, file: f }]);
    setError('');
  };

  const setNewTitle = (i: number, title: string) => {
    setNewFiles(prev => prev.map((n, j) => (j === i ? { ...n, title } : n)));
    setError('');
  };

  // A saved PDF comes off at once, as on the panel.
  const removeSaved = (file: RuleFile) =>
    confirmDestructive(
      'Remove document?',
      `"${file.title || 'Document'}" will be deleted straight away.`,
      'Remove',
      async () => {
        setRemoving(file.file_path);
        try {
          const res = await removeAdminRulesFile(file.file_path);
          setSavedFiles(res?.files ?? savedFiles.filter(f => f.file_path !== file.file_path));
        } catch (e) {
          AppAlert.alert('Could not remove', apiErr(e, 'Please try again.'));
        } finally {
          setRemoving(null);
        }
      },
    );

  const save = async () => {
    for (let i = 0; i < sections.length; i++) {
      if (!sections[i].head.trim()) return setError(`Section ${i + 1} needs a heading.`);
      if (!sections[i].desc.trim()) return setError(`Section ${i + 1} needs a description.`);
    }
    for (let i = 0; i < newFiles.length; i++) {
      if (!newFiles[i].title.trim()) return setError('Every new document needs a title.');
    }

    setError('');
    setSaving(true);
    try {
      const res = await saveAdminRules({
        sections: sections.map(sec => ({ head: sec.head.trim(), desc: sec.desc.trim() })),
        // Rows left empty are dropped.
        additional_info: info
          .map(a => ({ key: a.key.trim(), value: a.value.trim() }))
          .filter(a => a.key || a.value),
        newFiles: newFiles.map(n => ({ title: n.title.trim(), file: n.file })),
      });
      setSuccessMsg(
        res.message ||
          (isCreate ? 'Rules & Regulations created successfully!' : 'Rules & Regulations updated successfully!'),
      );
    } catch (e) {
      setError(apiErr(e, 'Could not save the rules.'));
    } finally {
      setSaving(false);
    }
  };

  const closeSuccess = () => {
    setSuccessMsg('');
    navigation.goBack();
  };

  return (
    <View style={s.root}>
      <DocHeader
        title={isCreate ? 'Create Rules' : 'Edit Rules'}
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {usingDefaults && (
            <View style={s.note}>
              <VectorIcon iconSet="Ionicons" iconName="information-circle-outline" size={18} color={theme.colors.primary} />
              <Text style={s.noteText}>
                These are the standard school rules, loaded for you to start from. Edit or remove whichever you like
                and press Save to publish them as your school's rules.
              </Text>
            </View>
          )}

          {/* Sections */}
          <Text style={s.listTitle}>{`Sections · ${sections.length}`}</Text>
          {sections.map((sec, i) => (
            <View key={sec.id} style={s.row}>
              <View style={s.rowHead}>
                <Text style={s.rowLabel}>{`Section ${i + 1}`}</Text>
                {sections.length > 1 && (
                  <TouchableOpacity onPress={() => removeSection(i)} hitSlop={8} activeOpacity={0.6}>
                    <VectorIcon iconSet="Ionicons" iconName="close" size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <FormCard
                label="Heading"
                value={sec.head}
                onChangeText={v => setSection(i, { head: v })}
                placeholder="e.g., Attendance Rules"
                maxLength={255}
              />
              <FormCard
                label="Description"
                value={sec.desc}
                onChangeText={v => setSection(i, { desc: v })}
                placeholder="Detailed description of the rule..."
                multiline
                minHeight={100}
              />
            </View>
          ))}
          <TouchableOpacity
            style={s.addRow}
            onPress={() => setSections(prev => [...prev, { id: rowId(), head: '', desc: '' }])}
            activeOpacity={0.7}
          >
            <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
            <Text style={s.addRowText}>Add section</Text>
          </TouchableOpacity>

          <View style={s.divider} />

          {/* Additional information */}
          <Text style={s.listTitle}>Additional Information</Text>
          {info.length === 0 && <Hint>Optional: fees, contact and anything else students should know.</Hint>}
          {info.map((a, i) => (
            <View key={a.id} style={s.row}>
              <View style={s.rowHead}>
                <Text style={s.rowLabel}>{`Information ${i + 1}`}</Text>
                <TouchableOpacity onPress={() => setInfo(prev => prev.filter((_, j) => j !== i))} hitSlop={8} activeOpacity={0.6}>
                  <VectorIcon iconSet="Ionicons" iconName="close" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <FormCard
                label="Key"
                value={a.key}
                onChangeText={v => setInfoRow(i, { key: v })}
                placeholder="e.g., Fees, Contact"
                maxLength={255}
              />
              <FormCard
                label="Value"
                value={a.value}
                onChangeText={v => setInfoRow(i, { value: v })}
                placeholder="Detailed information..."
                multiline
                minHeight={60}
              />
            </View>
          ))}
          <TouchableOpacity
            style={s.addRow}
            onPress={() => setInfo(prev => [...prev, { id: rowId(), key: '', value: '' }])}
            activeOpacity={0.7}
          >
            <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
            <Text style={s.addRowText}>Add information</Text>
          </TouchableOpacity>

          <View style={s.divider} />

          {/* Documents: the saved ones, then the new ones */}
          <Text style={s.listTitle}>Documents</Text>
          {savedFiles.map(file => (
            <View key={file.file_path} style={s.fileRow}>
              <TouchableOpacity style={s.fileMain} activeOpacity={0.6} onPress={() => Linking.openURL(file.file_path)}>
                <View style={s.fileIcon}>
                  <VectorIcon iconSet="Feather" iconName="file-text" size={16} color={theme.colors.primary} />
                </View>
                <View style={s.flex}>
                  <Text style={s.fileTitle} numberOfLines={1}>
                    {file.title || 'Document'}
                  </Text>
                  <Text style={s.fileSub}>{fileSub(file.file_type, file.file_size)}</Text>
                </View>
              </TouchableOpacity>
              {removing === file.file_path ? (
                <ActivityIndicator size="small" color={theme.colors.textMuted} />
              ) : (
                <TouchableOpacity onPress={() => removeSaved(file)} hitSlop={8} activeOpacity={0.6} disabled={!!removing}>
                  <VectorIcon iconSet="Ionicons" iconName="close" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {newFiles.map((n, i) => (
            <View key={n.id} style={s.row}>
              <View style={s.rowHead}>
                <FileChip kind="pdf" />
                <TouchableOpacity onPress={() => setNewFiles(prev => prev.filter((_, j) => j !== i))} hitSlop={8} activeOpacity={0.6}>
                  <VectorIcon iconSet="Ionicons" iconName="close" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
              <FormCard
                label="Document Title"
                value={n.title}
                onChangeText={v => setNewTitle(i, v)}
                placeholder="e.g., Fee Structure PDF"
                maxLength={255}
              />
            </View>
          ))}
          {savedFiles.length === 0 && newFiles.length === 0 && <Hint>No documents attached.</Hint>}
          <TouchableOpacity style={s.addRow} onPress={addDocument} activeOpacity={0.7}>
            <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
            <Text style={s.addRowText}>Add document</Text>
          </TouchableOpacity>
          <Hint>PDF only · max 2 MB each.</Hint>

          <FormError>{error}</FormError>
          <SubmitButton label="Save Rules & Regulations" busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Saved */}
      <AppDialog
        visible={!!successMsg}
        title="Rules saved"
        message={successMsg}
        actions={[{ text: 'Done', onPress: closeSuccess }]}
        onRequestClose={closeSuccess}
      />
    </View>
  );
};

export default AdminRulesFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 14 },

  // The standard rules, loaded to start from
  note: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },

  listTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  row: { gap: 6 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  divider: { height: 1, backgroundColor: theme.colors.border },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addRowText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  // A saved document
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  fileTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  fileSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

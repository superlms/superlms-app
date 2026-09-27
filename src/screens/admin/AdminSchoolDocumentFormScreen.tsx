import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import VectorIcon from '../../components/VectorIcon';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickPdf } from '../../utils/filePickers';
import { PickedFile, addDocument } from '../../api/adminProfileApi';
import { DocHeader } from '../more/docUi';
import { FormField, FormSection } from '../teacherStudents/studentFormUi';
import { FormError, SubmitButton, isPdfFile } from './adminFormUi';
import { useRevealFocused } from './adminProfileUi';

/**
 * Add Document — the panel's document panel, drawn as the app's other forms
 * are: a Title (needed; the PDF's own name until one is typed) and the PDF
 * itself, PDF only and up to 2 MB, as the panel allows. It is uploaded at once
 * and joins the School Profile's documents.
 */

const TWO_MB = 2 * 1024 * 1024;

const AdminSchoolDocumentFormScreen = ({ navigation }: any) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();

  const choose = async () => {
    const f = await pickPdf();
    if (!f) return;
    if (!isPdfFile(f)) return setError('Document must be a PDF file.');
    if (f.size && f.size > TWO_MB) return setError('Document must not exceed 2 MB.');
    setFile(f);
    // The file's own name, until a title is typed.
    if (!title.trim()) setTitle((f.name ?? '').replace(/\.pdf$/i, ''));
    setError('');
  };

  const save = async () => {
    if (!title.trim()) return setError('Title is required.');
    if (!file) return setError('Choose the PDF file.');
    setSaving(true);
    try {
      await addDocument({ title: title.trim(), file });
      navigation.goBack();
    } catch (e) {
      setError(apiErr(e, 'Could not upload document.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title="Add Document" onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <FormSection title="Document" first />
          <FormField
            markFilled
            label="Title"
            value={title}
            onChangeText={(t: string) => { setTitle(t); setError(''); }}
            placeholder="e.g. Affiliation Certificate"
            maxLength={255}
          />

          <Text style={s.label}>PDF File</Text>
          {file ? (
            <View style={[s.drop, s.dropChosen]}>
              <VectorIcon iconSet="Feather" iconName="file-text" size={20} color={theme.colors.primary} />
              <View style={s.dropBody}>
                <Text style={s.fileName} numberOfLines={2}>{file.name || 'Selected PDF'}</Text>
                {!!file.size && <Text style={s.fileSize}>{(file.size / 1024).toFixed(0)} KB</Text>}
              </View>
              <TouchableOpacity onPress={() => setFile(null)} hitSlop={10} activeOpacity={0.6} accessibilityLabel="Remove file">
                <VectorIcon iconSet="Ionicons" iconName="close" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.drop} activeOpacity={0.7} onPress={choose}>
              <VectorIcon iconSet="Ionicons" iconName="cloud-upload-outline" size={22} color={theme.colors.textMuted} />
              <View style={s.dropBody}>
                <Text style={s.dropTitle}>Tap to choose a PDF</Text>
                <Text style={s.fileSize}>PDF only, up to 2 MB</Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={s.submit}>
            <FormError>{error}</FormError>
            <SubmitButton label="Add Document" busy={saving} onPress={save} />
          </View>

          <View style={s.tail} />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

export default AdminSchoolDocumentFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 48 },

  // The file — the student form's label and outline
  label: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  drop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
  },
  dropChosen: { borderStyle: 'solid', borderColor: theme.colors.primary },
  dropBody: { flex: 1, gap: 2 },
  dropTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  fileName: { fontSize: 14, color: theme.colors.textPrimary },
  fileSize: { fontSize: 12, color: theme.colors.textMuted },

  submit: { marginTop: 28, gap: 12 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

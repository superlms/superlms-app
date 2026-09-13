import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import {
  AdminAnnouncement,
  AnnouncementType,
  createAnnouncement,
  updateAnnouncement,
} from '../../api/adminContentApi';
import { DocHeader } from '../more/docUi';
import { AppDialog } from '../../components/AppDialog';

const AUDIENCES: { key: AnnouncementType; label: string }[] = [
  { key: 'all', label: 'Both' },
  { key: 'user', label: 'Students' },
  { key: 'teacher', label: 'Teachers' },
];

// Attachments are named by type, never by file name.
const fileLabel = (f: PickedFile) =>
  f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Image';

const AdminAnnouncementFormScreen = ({ navigation, route }: any) => {
  const item: AdminAnnouncement | undefined = route?.params?.item;
  const isEdit = !!item;

  const [name, setName] = useState(item?.announcement_name ?? '');
  const [content, setContent] = useState(item?.announcement_content ?? '');
  const [type, setType] = useState<AnnouncementType>(item?.type ?? 'all');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [focused, setFocused] = useState<'title' | 'content' | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const titleRef = useRef<TextInput>(null);
  const contentRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  // Whatever is already attached to the announcement, while no new file is picked.
  const existingFiles = file
    ? []
    : ([
        item?.image_url ? { label: 'Image', icon: 'image', url: item.image_url } : null,
        item?.pdf_url ? { label: 'PDF', icon: 'file-text', url: item.pdf_url } : null,
      ].filter(Boolean) as { label: string; icon: string; url: string }[]);

  const attach = async (kind: 'image' | 'pdf') => {
    setPickerOpen(false);
    const f = kind === 'image' ? await pickImage() : await pickPdf();
    if (f) {
      setFile(f);
      setError('');
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Enter a title for the announcement.');
      return;
    }
    if (!content.trim()) {
      setError('Write the announcement content.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const payload = {
        announcement_name: name.trim(),
        announcement_content: content.trim(),
        type,
        file,
      };
      if (isEdit) await updateAnnouncement(item!.id, payload);
      else await createAnnouncement(payload);
      setSuccessMsg(
        isEdit
          ? 'The announcement has been updated.'
          : 'The announcement has been posted to your school.',
      );
    } catch (e) {
      setError(apiErr(e, 'Could not save announcement.'));
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
      {/* The clip icon in the header attaches an image or a PDF */}
      <DocHeader
        title={isEdit ? 'Edit Announcement' : 'New Announcement'}
        onBackPress={() => navigation.goBack()}
        rightIcon="attach"
        onRightPress={() => setPickerOpen(true)}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title card — tap anywhere on it to type */}
          <Pressable
            style={[s.field, focused === 'title' && s.fieldFocused]}
            onPress={() => titleRef.current?.focus()}
          >
            <Text style={s.fieldLabel}>Title</Text>
            <TextInput
              ref={titleRef}
              style={s.fieldInput}
              placeholder="What is this announcement about?"
              placeholderTextColor={theme.colors.textMuted}
              value={name}
              onChangeText={t => { setName(t); setError(''); }}
              onFocus={() => setFocused('title')}
              onBlur={() => setFocused(null)}
              multiline
              submitBehavior="submit"
              textAlignVertical="top"
              returnKeyType="next"
              onSubmitEditing={() => contentRef.current?.focus()}
            />
          </Pressable>

          {/* Content card */}
          <Pressable
            style={[s.field, focused === 'content' && s.fieldFocused]}
            onPress={() => contentRef.current?.focus()}
          >
            <Text style={s.fieldLabel}>Content</Text>
            <TextInput
              ref={contentRef}
              style={[s.fieldInput, s.fieldInputMulti]}
              placeholder="Write the announcement here..."
              placeholderTextColor={theme.colors.textMuted}
              value={content}
              onChangeText={t => { setContent(t); setError(''); }}
              onFocus={() => setFocused('content')}
              onBlur={() => setFocused(null)}
              multiline
              textAlignVertical="top"
            />
          </Pressable>

          {/* Audience */}
          <View>
            <Text style={s.sectionLabel}>Audience</Text>
            <View style={s.segment}>
              {AUDIENCES.map(a => {
                const active = type === a.key;
                return (
                  <TouchableOpacity
                    key={a.key}
                    activeOpacity={0.7}
                    onPress={() => setType(a.key)}
                    style={[s.segmentItem, active && s.segmentItemActive]}
                  >
                    <Text style={[s.segmentText, active && s.segmentTextActive]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Attachment: the new file, the existing one, or a quiet hint */}
          {file ? (
            <View style={s.chips}>
              <View style={s.chip}>
                <VectorIcon
                  iconSet="Feather"
                  iconName={fileLabel(file) === 'PDF' ? 'file-text' : 'image'}
                  size={14}
                  color={theme.colors.primary}
                />
                <Text style={s.chipText} numberOfLines={1}>{fileLabel(file)}</Text>
                <TouchableOpacity onPress={() => setFile(null)} hitSlop={8}>
                  <VectorIcon iconSet="Ionicons" iconName="close" size={15} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          ) : existingFiles.length > 0 ? (
            <View>
              <View style={s.chips}>
                {existingFiles.map(f => (
                  <TouchableOpacity
                    key={f.label}
                    style={s.chip}
                    activeOpacity={0.7}
                    onPress={() => Linking.openURL(f.url)}
                  >
                    <VectorIcon iconSet="Feather" iconName={f.icon} size={14} color={theme.colors.primary} />
                    <Text style={s.chipText} numberOfLines={1}>{f.label}</Text>
                    <VectorIcon iconSet="Feather" iconName="external-link" size={12} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.hint}>
                Attach a new file with the clip icon at the top to replace this one.
              </Text>
            </View>
          ) : (
            <Text style={s.hint}>
              Optional: attach an image or a PDF with the clip icon at the top.
            </Text>
          )}

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={save}
            style={[s.submitBtn, saving && s.submitBtnBusy]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.white} size="small" />
            ) : (
              <Text style={s.submitText}>
                {isEdit ? 'Update Announcement' : 'Post Announcement'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Attachment type chooser */}
      <Modal
        transparent
        visible={pickerOpen}
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={s.sheetWrap}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setPickerOpen(false)} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Attach a file</Text>
            <TouchableOpacity style={[s.sheetRow, s.sheetRowDivider]} activeOpacity={0.6} onPress={() => attach('image')}>
              <VectorIcon iconSet="Feather" iconName="image" size={18} color={theme.colors.textSecondary} />
              <Text style={s.sheetRowText}>Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetRow} activeOpacity={0.6} onPress={() => attach('pdf')}>
              <VectorIcon iconSet="Feather" iconName="file-text" size={18} color={theme.colors.textSecondary} />
              <Text style={s.sheetRowText}>PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Saved */}
      <AppDialog
        visible={!!successMsg}
        title={isEdit ? 'Announcement updated' : 'Announcement posted'}
        message={successMsg}
        actions={[{ text: 'Done', onPress: closeSuccess }]}
        onRequestClose={closeSuccess}
      />
    </View>
  );
};

export default AdminAnnouncementFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },

  // Input cards — label inside, borderless input underneath
  field: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldFocused: { borderColor: theme.colors.primary },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },
  fieldInput: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: 4,
    marginTop: 2,
  },
  fieldInputMulti: { minHeight: 140 },

  // Audience segment
  sectionLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted, marginBottom: 8 },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentItemActive: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
  },
  segmentText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  segmentTextActive: { color: theme.colors.primary, fontWeight: '600' },

  // Attachment chip
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 200,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  hint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8 },
  errorText: { fontSize: 13, color: theme.colors.danger, lineHeight: 18 },

  // Submit
  submitBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnBusy: { opacity: 0.7 },
  submitText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },

  // Attachment sheet
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 4 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sheetRowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sheetRowText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

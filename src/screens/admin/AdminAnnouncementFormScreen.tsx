import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VectorIcon from '../../components/VectorIcon';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import {
  AdminAnnouncement,
  AnnouncementType,
  ClassOption,
  createAnnouncement,
  getAdminAnnouncements,
  updateAnnouncement,
} from '../../api/adminContentApi';
import { DocHeader } from '../more/docUi';
import {
  FieldLabel,
  FileChip,
  FormCard,
  FormError,
  Hint,
  OptionSheet,
  PickerCard,
  Segment,
  SubmitButton,
  isPdfFile,
  withinOneMb,
} from './adminFormUi';
import { lastKnownClasses } from './AdminAnnouncementScreen';

/**
 * A new announcement, or one being edited, as the admin panel's form has it:
 * the title (up to 1000 characters) and content (up to 3000), who it goes to —
 * everyone, the teachers, or the students (all of them, or one class) — and an
 * image or PDF of up to 1 MB from the clip in the header. On an edit the files
 * already on it show as chips; the cross takes one off when it is saved.
 */

const AUDIENCES: { key: AnnouncementType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'user', label: 'Students' },
  { key: 'teacher', label: 'Teachers' },
];

const ALL_CLASSES = 'all';

const AdminAnnouncementFormScreen = ({ navigation, route }: any) => {
  const item: AdminAnnouncement | undefined = route?.params?.item;
  const isEdit = !!item;

  const [name, setName] = useState(item?.announcement_name ?? '');
  const [content, setContent] = useState(item?.announcement_content ?? '');
  const [type, setType] = useState<AnnouncementType>(item?.type ?? 'all');
  const [standardId, setStandardId] = useState<number | null>(item?.standard_id ?? null);
  const [classes, setClasses] = useState<ClassOption[]>(lastKnownClasses());
  const [classOpen, setClassOpen] = useState(false);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [removePdf, setRemovePdf] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const contentRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  // The school's classes, for "Which students", when the list hasn't brought them.
  useEffect(() => {
    if (classes.length > 0) return;
    getAdminAnnouncements({ days: 1 })
      .then(r => setClasses(r.standards))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const className = classes.find(c => c.id === standardId)?.name ?? item?.standard_name ?? null;

  // A new file of a kind replaces the one of that kind on save.
  const newIsPdf = file ? isPdfFile(file) : false;
  const keptImage = !!item?.image_url && !removeImage && !(file && !newIsPdf);
  const keptPdf = !!item?.pdf_url && !removePdf && !(file && newIsPdf);

  const attach = async (kind: 'image' | 'pdf') => {
    setPickerOpen(false);
    const f = kind === 'image' ? await pickImage() : await pickPdf();
    if (f && withinOneMb(f)) {
      setFile(f);
      setError('');
    }
  };

  const pickType = (t: AnnouncementType) => {
    setType(t);
    // Leaving the students drops the class with them.
    if (t !== 'user') setStandardId(null);
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
        standard_id: type === 'user' ? standardId : null,
        file,
        remove_image: isEdit && removeImage,
        remove_pdf: isEdit && removePdf,
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

  const hasAnyFile = !!file || keptImage || keptPdf;

  return (
    <View style={s.root}>
      {/* The clip icon in the header attaches an image or a PDF */}
      <DocHeader
        title={isEdit ? 'Edit Announcement' : 'New Announcement'}
        onBackPress={() => navigation.goBack()}
        rightIcon="attach"
        onRightPress={() => setPickerOpen(true)}
      />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <FormCard
            label="Title"
            value={name}
            onChangeText={t => {
              setName(t);
              setError('');
            }}
            placeholder="What is this announcement about?"
            multiline
            maxLength={1000}
            returnKeyType="next"
            onSubmitEditing={() => contentRef.current?.focus()}
          />

          <FormCard
            label="Content"
            inputRef={contentRef}
            value={content}
            onChangeText={t => {
              setContent(t);
              setError('');
            }}
            placeholder="Write the announcement here..."
            multiline
            minHeight={140}
            maxLength={3000}
          />

          {/* Audience, and for students which of them */}
          <View>
            <FieldLabel>Audience</FieldLabel>
            <Segment options={AUDIENCES} value={type} onChange={pickType} />
          </View>

          {type === 'user' && (
            <View style={s.group}>
              <PickerCard
                label="Which students"
                value={standardId ? className : 'All Classes'}
                onPress={() => setClassOpen(true)}
              />
              <Hint>
                {standardId
                  ? `Only students of ${className ?? 'this class'} will see it.`
                  : 'Every student in the school will see it.'}
              </Hint>
            </View>
          )}

          {/* Attachments: the new file, what is already on it, or a quiet hint */}
          {hasAnyFile ? (
            <View style={s.group}>
              <View style={s.chips}>
                {keptImage && (
                  <FileChip
                    kind="image"
                    onPress={() => Linking.openURL(item!.image_url!)}
                    onRemove={() => setRemoveImage(true)}
                  />
                )}
                {keptPdf && (
                  <FileChip
                    kind="pdf"
                    onPress={() => Linking.openURL(item!.pdf_url!)}
                    onRemove={() => setRemovePdf(true)}
                  />
                )}
                {!!file && <FileChip kind={newIsPdf ? 'pdf' : 'image'} onRemove={() => setFile(null)} />}
              </View>
              <Hint>Image (JPG/PNG/GIF/WebP) or PDF · max 1 MB. The clip at the top adds or replaces one.</Hint>
            </View>
          ) : (
            <Hint>Optional: attach an image or a PDF (max 1 MB) with the clip icon at the top.</Hint>
          )}

          <FormError>{error}</FormError>

          <SubmitButton
            label={isEdit ? 'Update Announcement' : 'Post Announcement'}
            busy={saving}
            onPress={save}
          />
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

      <OptionSheet
        visible={classOpen}
        title="Which students"
        options={[
          { key: ALL_CLASSES, label: 'All Classes' },
          ...classes.map(c => ({ key: String(c.id), label: c.name })),
        ]}
        selected={[standardId ? String(standardId) : ALL_CLASSES]}
        onPick={k => setStandardId(k === ALL_CLASSES ? null : Number(k))}
        onClose={() => setClassOpen(false)}
      />

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
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

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

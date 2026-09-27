import React, { useRef, useState } from 'react';
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
import { AppAlert, AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { SuperAdminContact, sendSuperAdminContact, updateSuperAdminContact } from '../../api/adminContactApi';
import { DocHeader } from '../more/docUi';
import { FileChip, FormCard, FormError, Hint, SubmitButton, isPdfFile } from './adminFormUi';

/**
 * A new message to the Super Admin, or one being edited, as the panel's
 * Contact Admin form has it: the topic (up to 255 characters), the message,
 * and an optional JPG, PNG or PDF of up to 2 MB from the clip in the header.
 * On an edit the file already on it shows as a chip; a new one replaces it.
 *
 * Route params: item – the message being edited.
 */

const TWO_MB = 2 * 1024 * 1024;

// A photo is scaled to this longest side, so a camera shot fits the 2 MB.
const PHOTO_SIDE = 1600;

/** The panel's limits: JPG, PNG or PDF, 2 MB. */
const acceptable = (f: PickedFile) => {
  const type = (f.type || '').toLowerCase();
  const name = (f.name || '').toLowerCase();
  const ok = isPdfFile(f) || /image\/(jpe?g|png)/.test(type) || /\.(jpe?g|png)$/.test(name);
  if (!ok) {
    AppAlert.alert('File not supported', 'The attachment must be a JPG, PNG or PDF.');
    return false;
  }
  if (f.size && f.size > TWO_MB) {
    AppAlert.alert('File too large', 'The attachment must be 2 MB or smaller.');
    return false;
  }
  return true;
};

const AdminContactAdminFormScreen = ({ navigation, route }: any) => {
  const item: SuperAdminContact | undefined = route?.params?.item;
  const isEdit = !!item;

  const [topic, setTopic] = useState(item?.topic ?? '');
  const [message, setMessage] = useState(item?.admin_query ?? '');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SuperAdminContact | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const messageRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  // The file already on the message stays until a new one replaces it.
  const keptFile = !file && item?.image_url ? item.image_url : null;

  const attach = async (kind: 'image' | 'pdf') => {
    setPickerOpen(false);
    const f = kind === 'image' ? await pickImage({ maxSide: PHOTO_SIDE }) : await pickPdf();
    if (f && acceptable(f)) {
      setFile(f);
      setError('');
    }
  };

  const save = async () => {
    if (!topic.trim()) {
      setError('Enter a topic.');
      return;
    }
    if (!message.trim()) {
      setError('Write your message.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const payload = { topic: topic.trim(), admin_query: message.trim(), file };
      const done = isEdit ? await updateSuperAdminContact(item!.id, payload) : await sendSuperAdminContact(payload);
      setSaved(done ?? null);
      // The panel's own words
      setSuccessMsg(isEdit ? 'Message updated successfully!' : 'Message sent to Super Admin successfully!');
    } catch (e) {
      setError(apiErr(e, 'Could not save your message.'));
    } finally {
      setSaving(false);
    }
  };

  // A new message goes back to the list; an edit, to the message as saved.
  const closeSuccess = () => {
    setSuccessMsg('');
    if (isEdit) navigation.popTo('AdminContactAdminDetail', { item: saved ?? item });
    else navigation.goBack();
  };

  return (
    <View style={s.root}>
      {/* The clip icon in the header attaches an image or a PDF */}
      <DocHeader
        title={isEdit ? 'Edit Message' : 'New Message'}
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
            label="Topic"
            value={topic}
            onChangeText={t => {
              setTopic(t);
              setError('');
            }}
            placeholder="What is this about?"
            multiline
            maxLength={255}
            returnKeyType="next"
            onSubmitEditing={() => messageRef.current?.focus()}
          />

          <FormCard
            label="Your Message"
            inputRef={messageRef}
            value={message}
            onChangeText={t => {
              setMessage(t);
              setError('');
            }}
            placeholder="Describe your query in detail..."
            multiline
            minHeight={140}
          />

          {/* The attachment: the new file, the one already on it, or a quiet hint */}
          {file || keptFile ? (
            <View style={s.group}>
              <View style={s.chips}>
                {!!keptFile && (
                  <FileChip kind={item?.image_is_pdf ? 'pdf' : 'image'} onPress={() => Linking.openURL(keptFile)} />
                )}
                {!!file && <FileChip kind={isPdfFile(file) ? 'pdf' : 'image'} onRemove={() => setFile(null)} />}
              </View>
              <Hint>JPG, PNG or PDF · max 2 MB. The clip at the top {keptFile ? 'replaces it' : 'picks another'}.</Hint>
            </View>
          ) : (
            <Hint>Optional: attach a JPG, PNG or PDF (max 2 MB) with the clip icon at the top.</Hint>
          )}

          <FormError>{error}</FormError>

          <SubmitButton label={isEdit ? 'Update' : 'Send Message'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Attachment type chooser */}
      <Modal transparent visible={pickerOpen} animationType="fade" onRequestClose={() => setPickerOpen(false)}>
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
        title={isEdit ? 'Message updated' : 'Message sent'}
        message={successMsg}
        actions={[{ text: 'Done', onPress: closeSuccess }]}
        onRequestClose={closeSuccess}
      />
    </View>
  );
};

export default AdminContactAdminFormScreen;

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

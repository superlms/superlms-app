import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { pickImage, pickPdf } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import AttachmentPreviewModal from '../announcement/AttachmentPreviewModal';
import {
  updateTopicContent,
  contentErrorMessage,
  type SyllabusTopic,
  type ContentFile,
} from '../../api/contentApi';
import { hasMaterial } from './contentUi';
import { AppAlert } from '../../components/AppDialog';

const TITLE = 'Topic Content';

type Field = 'notes' | 'link';

/**
 * A topic's study material, written the way Contact School writes a query: the
 * topic on a card at the top, then the notes and the link as cards with their
 * label inside, an image and a PDF attached with the clip in the header and
 * shown as chips, and Save underneath.
 *
 * Opened from a topic with no material yet, or from a topic's page with its
 * edit button. Saving shows the topic's page with what was saved; material
 * cleared to nothing goes back to the topics. Chapters and topics themselves
 * are made on the Syllabus screen.
 */
const EditTopicContentScreen = ({ navigation, route }: any) => {
  const topic: SyllabusTopic = route.params?.topic;
  const chapterName = quietCaps(route.params?.chapterName);
  const subjectName: string = route.params?.subjectName ?? '';
  const fromView: boolean = !!route.params?.fromView;

  const [content, setContent] = useState(topic?.content ?? '');
  const [link, setLink] = useState(topic?.link ?? '');
  // A newly picked file, or the one the topic has (by its link), or none.
  const [image, setImage] = useState<ContentFile | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(topic?.imageUrl ?? null);
  const [pdf, setPdf] = useState<ContentFile | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(topic?.pdfUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState<Field | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const notesRef = useRef<TextInput>(null);
  const linkRef = useRef<TextInput>(null);

  const hadMaterial = !!topic && hasMaterial(topic);
  const hasImage = !!image || !!imageUrl;
  const hasPdf = !!pdf || !!pdfUrl;

  // ── Attach ────────────────────────────────────────────────────────────────
  const attachImage = async () => {
    const f = await pickImage();
    if (!f?.uri) return;
    setImage({ uri: f.uri, name: f.name || 'topic-image.jpg', type: f.type ?? undefined });
    setImageUrl(null);
  };

  const attachPdf = async () => {
    const f = await pickPdf();
    if (!f?.uri) return;
    setPdf({ uri: f.uri, name: f.name || 'topic.pdf', type: f.type ?? 'application/pdf' });
    setPdfUrl(null);
  };

  const onAttach = () =>
    AppAlert.alert('Attach', 'Add an image or a PDF to this topic. A new one takes the place of the one there.', [
      { text: 'Image', onPress: attachImage },
      { text: 'PDF', onPress: attachPdf },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const openPdf = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      AppAlert.alert('Error', 'Unable to open the PDF on this device.');
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (saving || !topic) return;
    const empty = !content.trim() && !link.trim() && !hasImage && !hasPdf;
    if (empty && !hadMaterial) {
      AppAlert.alert('Nothing to save', 'Add notes, a link, an image or a PDF first.');
      return;
    }
    setSaving(true);
    try {
      const saved = await updateTopicContent(topic.id, {
        name: topic.name,
        content: content.trim(),
        link: link.trim(),
        order: topic.order,
        image,
        pdf,
        removeImage: !hasImage && !!topic.imageUrl,
        removePdf: !hasPdf && !!topic.pdfUrl,
      });
      const params = { topic: saved, chapterName: route.params?.chapterName, subjectName, canEdit: true };
      if (hasMaterial(saved)) {
        // Back to the topic's page, now showing what was saved.
        if (fromView) navigation.popTo('ViewContent', params);
        else navigation.replace('ViewContent', params);
      } else {
        // Nothing left to read: back to the topics.
        navigation.pop(fromView ? 2 : 1);
      }
    } catch (e: any) {
      AppAlert.alert('Error', contentErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const where = [subjectName, chapterName].filter(Boolean).join(' · ');

  return (
    <View style={s.root}>
      {/* The clip in the header attaches an image or a PDF */}
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} rightIcon="attach" onRightPress={onAttach} />

      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Which topic this is */}
          <View style={s.field}>
            <Text style={s.fieldLabel}>Topic</Text>
            <Text style={s.topicName}>{quietCaps(topic?.name)}</Text>
            {!!where && <Text style={s.topicWhere}>{where}</Text>}
          </View>

          {/* Notes — tap anywhere on the card to type */}
          <Pressable
            style={[s.field, focused === 'notes' && s.fieldFocused]}
            onPress={() => notesRef.current?.focus()}
          >
            <Text style={s.fieldLabel}>Study notes</Text>
            <TextInput
              ref={notesRef}
              style={[s.fieldInput, s.fieldInputMulti]}
              placeholder="Write the study material for this topic..."
              placeholderTextColor={theme.colors.textMuted}
              value={content}
              onChangeText={setContent}
              onFocus={() => setFocused('notes')}
              onBlur={() => setFocused(null)}
              multiline
              textAlignVertical="top"
            />
          </Pressable>

          {/* Link */}
          <Pressable
            style={[s.field, focused === 'link' && s.fieldFocused]}
            onPress={() => linkRef.current?.focus()}
          >
            <Text style={s.fieldLabel}>Link</Text>
            <View style={s.linkRow}>
              <TextInput
                ref={linkRef}
                style={[s.fieldInput, s.linkInput]}
                placeholder="https:// — a web page, Drive file or video"
                placeholderTextColor={theme.colors.textMuted}
                value={link}
                onChangeText={setLink}
                onFocus={() => setFocused('link')}
                onBlur={() => setFocused(null)}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!!link && (
                <TouchableOpacity onPress={() => setLink('')} hitSlop={8} activeOpacity={0.6}>
                  <VectorIcon iconSet="Ionicons" iconName="close-circle" size={17} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </Pressable>

          {/* Attached files as chips — tap to look, × to take off — or a quiet hint */}
          {hasImage || hasPdf ? (
            <View style={s.chips}>
              {hasImage && (
                <Chip
                  icon="image"
                  label="Image"
                  onPress={() => setPreview(image?.uri ?? imageUrl)}
                  onRemove={() => {
                    setImage(null);
                    setImageUrl(null);
                  }}
                />
              )}
              {hasPdf && (
                <Chip
                  icon="file-text"
                  label="PDF"
                  onPress={pdfUrl ? () => openPdf(pdfUrl) : undefined}
                  onRemove={() => {
                    setPdf(null);
                    setPdfUrl(null);
                  }}
                />
              )}
            </View>
          ) : null}
          <Text style={s.hint}>
            {hasImage || hasPdf
              ? 'Tap a file to see it. Attach another with the clip icon at the top.'
              : 'Optional: attach an image or a PDF with the clip icon at the top.'}
          </Text>

          {/* Save */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={save}
            style={[s.submitBtn, saving && s.submitBtnBusy]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.white} size="small" />
            ) : (
              <Text style={s.submitText}>Save Content</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <AttachmentPreviewModal
        visible={preview !== null}
        accentColor={theme.colors.primary}
        imageUrl={preview || undefined}
        onClose={() => setPreview(null)}
      />
    </View>
  );
};

export default EditTopicContentScreen;

// An attached file: its kind and a cross, as Contact School shows one.
const Chip = ({
  icon,
  label,
  onPress,
  onRemove,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  onRemove: () => void;
}) => (
  <View style={s.chip}>
    <TouchableOpacity style={s.chipBody} onPress={onPress} disabled={!onPress} activeOpacity={0.6}>
      <VectorIcon iconSet="Feather" iconName={icon} size={14} color={theme.colors.primary} />
      <Text style={s.chipText} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={onRemove} hitSlop={8}>
      <VectorIcon iconSet="Ionicons" iconName="close" size={15} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  </View>
);

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },

  // Cards — label inside, borderless input underneath
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
  fieldInputMulti: { minHeight: 160, lineHeight: 22 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkInput: { flex: 1 },

  // The topic
  topicName: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 4 },
  topicWhere: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, marginBottom: 2 },

  // Attachment chips
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
  chipBody: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  hint: { fontSize: 12, color: theme.colors.textMuted },

  // Save
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
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

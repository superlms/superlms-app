import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader } from '../more/docUi';
import {
  updateTopicContent,
  contentErrorMessage,
  type SyllabusTopic,
  type ContentFile,
} from '../../api/contentApi';
import { ResourceRow } from './contentUi';

const TITLE = 'Topic Content';

// Editor opened from a topic on the teacher's study content. Adds study
// material (text / link / image) INTO an existing topic, then returns. Chapters
// & topics themselves are managed on the Syllabus screen.
const EditTopicContentScreen = ({ navigation, route }: any) => {
  const topic: SyllabusTopic = route.params?.topic;
  const chapterName = quietCaps(route.params?.chapterName);
  const subjectName = quietCaps(route.params?.subjectName);

  const [content, setContent] = useState(topic?.content ?? '');
  const [link, setLink] = useState(topic?.link ?? '');
  const [image, setImage] = useState<ContentFile | null>(null);
  const [preview, setPreview] = useState<string | null>(topic?.imageUrl ?? null);
  const [saving, setSaving] = useState(false);

  const existingPdf = topic?.pdfUrl ?? null;

  const pickImage = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, res => {
      if (res.didCancel || !res.assets?.length) return;
      const a = res.assets[0];
      if (!a.uri) return;
      setImage({
        uri: a.uri,
        name: a.fileName ?? `topic-image.${(a.type ?? 'image/jpeg').split('/')[1]}`,
        type: a.type,
      });
      setPreview(a.uri);
    });
  };

  const removeImage = () => {
    setImage(null);
    setPreview(null);
  };

  const save = async () => {
    if (saving) return;
    if (!content.trim() && !link.trim() && !image && !preview) {
      Alert.alert('Nothing to save', 'Add some text, a link or an image first.');
      return;
    }
    setSaving(true);
    try {
      await updateTopicContent(topic.id, {
        name: topic.name,
        content: content.trim(),
        link: link.trim(),
        order: topic.order,
        image,
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', contentErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const openPdf = async () => {
    if (!existingPdf) return;
    try {
      await Linking.openURL(existingPdf);
    } catch {
      Alert.alert('Error', 'Unable to open the PDF on this device.');
    }
  };

  const kicker = [subjectName, chapterName].filter(Boolean).join(' · ');

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Which topic this is */}
        <View style={s.head}>
          {!!kicker && <Text style={s.kicker}>{kicker.toUpperCase()}</Text>}
          <Text style={s.title}>{quietCaps(topic?.name)}</Text>
        </View>
        <View style={s.divider} />

        <View style={s.form}>
          {/* Notes */}
          <View>
            <Text style={s.label}>Study notes</Text>
            <TextInput
              style={[s.field, s.fieldMulti]}
              placeholder="Write the study material for this topic"
              placeholderTextColor={theme.colors.textMuted}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Link / document URL */}
          <View>
            <Text style={s.label}>Link</Text>
            <View style={[s.field, s.linkField]}>
              <VectorIcon iconSet="Ionicons" iconName="link-outline" size={17} color={theme.colors.textMuted} />
              <TextInput
                style={s.linkInput}
                placeholder="https:// — a web page, Drive file or video"
                placeholderTextColor={theme.colors.textMuted}
                value={link}
                onChangeText={setLink}
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
          </View>

          {/* Image */}
          <View>
            <Text style={s.label}>Image</Text>
            {preview ? (
              <>
                <Image source={{ uri: preview }} style={s.image} resizeMode="cover" />
                <View style={s.imageActions}>
                  <TouchableOpacity onPress={pickImage} hitSlop={8} activeOpacity={0.6}>
                    <Text style={s.linkText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={removeImage} hitSlop={8} activeOpacity={0.6}>
                    <Text style={s.dangerText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity style={[s.field, s.pickRow]} onPress={pickImage} activeOpacity={0.7}>
                <VectorIcon iconSet="Ionicons" iconName="image-outline" size={18} color={theme.colors.textSecondary} />
                <Text style={s.pickText}>Choose an image</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Existing document (managed from web/admin) */}
          {!!existingPdf && (
            <View>
              <Text style={s.label}>Document</Text>
              <ResourceRow
                icon="document-attach-outline"
                title="PDF document"
                sub="Added on the web portal"
                onPress={openPdf}
                isLast
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Save */}
      <View style={s.bar}>
        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnBusy]}
          onPress={save}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={s.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default EditTopicContentScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 28 },

  // Head
  head: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted },
  title: { fontSize: 20, fontWeight: '700', lineHeight: 27, color: theme.colors.textPrimary, marginTop: 6 },

  divider: { height: 1, backgroundColor: theme.colors.divider },

  // Form
  form: { paddingHorizontal: 20, paddingTop: 20, gap: 22 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8 },
  field: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  fieldMulti: { minHeight: 140, lineHeight: 22 },
  linkField: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 },
  linkInput: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, paddingVertical: 12 },

  image: { width: '100%', height: 180, borderRadius: theme.radius.md, backgroundColor: theme.colors.background },
  imageActions: { flexDirection: 'row', gap: 22, marginTop: 10 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  dangerText: { fontSize: 14, fontWeight: '500', color: theme.colors.danger },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  pickText: { fontSize: 15, color: theme.colors.textSecondary },

  // Save
  bar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  saveBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnBusy: { opacity: 0.7 },
  saveText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

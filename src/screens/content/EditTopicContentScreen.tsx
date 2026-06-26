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
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import {
  updateTopicContent,
  contentErrorMessage,
  type SyllabusTopic,
  type ContentFile,
} from '../../api/contentApi';

const PRIMARY = theme.colors.primary;

// Editor opened from the teacher content screen's topic arrow. Adds study
// material (text / link / image) INTO an existing topic, then returns. Chapters
// & topics themselves are managed on the Syllabus screen.
const EditTopicContentScreen = ({ navigation, route }: any) => {
  const topic: SyllabusTopic = route.params?.topic;
  const chapterName: string = route.params?.chapterName ?? '';
  const subjectName: string = route.params?.subjectName ?? '';
  const accent: string = route.params?.subjectColor ?? PRIMARY;

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

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Add Content" onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Topic header */}
        <View style={[s.topicCard, { borderLeftColor: accent }]}>
          <View style={[s.topicIcon, { backgroundColor: accent + '20' }]}>
            <VectorIcon iconSet="Ionicons" iconName="document-text-outline" size={18} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.topicName} numberOfLines={2}>{topic?.name}</Text>
            <Text style={s.topicMeta} numberOfLines={1}>
              {subjectName}{chapterName ? ` · ${chapterName}` : ''}
            </Text>
          </View>
        </View>

        {/* Text */}
        <Text style={s.label}>Text</Text>
        <TextInput
          style={[s.input, s.inputMulti]}
          placeholder="Write study content for this topic..."
          placeholderTextColor={theme.colors.textMuted}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />

        {/* Link / Document URL */}
        <Text style={s.label}>Link / Document URL</Text>
        <View style={s.linkRow}>
          <VectorIcon iconSet="Ionicons" iconName="link-outline" size={18} color={theme.colors.textMuted} />
          <TextInput
            style={s.linkInput}
            placeholder="https://...  (web link, Google Drive / PDF doc, video)"
            placeholderTextColor={theme.colors.textMuted}
            value={link}
            onChangeText={setLink}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!link && (
            <TouchableOpacity onPress={() => setLink('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <VectorIcon iconSet="Ionicons" iconName="close-circle" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Image */}
        <Text style={s.label}>Image</Text>
        {preview ? (
          <View style={s.imagePreviewWrap}>
            <Image source={{ uri: preview }} style={s.imagePreview} resizeMode="cover" />
            <TouchableOpacity style={s.imageRemove} onPress={removeImage}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={14} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[s.imageChange, { borderColor: accent }]} onPress={pickImage} activeOpacity={0.8}>
              <VectorIcon iconSet="Ionicons" iconName="image-outline" size={14} color={accent} />
              <Text style={[s.imageChangeText, { color: accent }]}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.imagePicker} onPress={pickImage} activeOpacity={0.8}>
            <VectorIcon iconSet="Ionicons" iconName="image-outline" size={20} color={theme.colors.textMuted} />
            <Text style={s.imagePickerText}>Select an image</Text>
          </TouchableOpacity>
        )}

        {/* Existing document (managed from web/admin) */}
        {!!existingPdf && (
          <>
            <Text style={s.label}>Document</Text>
            <TouchableOpacity style={s.pdfRow} onPress={openPdf} activeOpacity={0.85}>
              <View style={s.pdfIcon}>
                <VectorIcon iconSet="Feather" iconName="file-text" size={18} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.pdfTitle}>PDF Document</Text>
                <Text style={s.pdfSub} numberOfLines={1}>Tap to open</Text>
              </View>
              <VectorIcon iconSet="Ionicons" iconName="open-outline" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Save bar */}
      <View style={s.saveBar}>
        <TouchableOpacity
          style={[s.saveBtn, { backgroundColor: accent }, saving && { opacity: 0.7 }]}
          onPress={save}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <VectorIcon iconSet="Ionicons" iconName="checkmark" size={18} color="#fff" />
              <Text style={s.saveBtnText}>Submit Content</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default EditTopicContentScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },

  topicCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, borderLeftWidth: 4,
    padding: 14, marginBottom: 18, elevation: 1,
  },
  topicIcon: { width: 38, height: 38, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  topicName: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  topicMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, fontWeight: '500' },

  label: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.3 },
  input: {
    backgroundColor: theme.colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: theme.colors.textPrimary, borderWidth: 1.5, borderColor: theme.colors.border, marginBottom: 18,
  },
  inputMulti: { minHeight: 120 },

  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 1.5, borderColor: theme.colors.border, marginBottom: 18,
  },
  linkInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 10 },

  imagePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.border, borderRadius: 12,
    paddingVertical: 20, marginBottom: 18, backgroundColor: theme.colors.card,
  },
  imagePickerText: { fontSize: 13, color: theme.colors.textMuted, fontWeight: '600' },
  imagePreviewWrap: { marginBottom: 18 },
  imagePreview: { width: '100%', height: 180, borderRadius: 12, backgroundColor: theme.colors.card },
  imageRemove: {
    position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  imageChange: {
    position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.card, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  imageChangeText: { fontSize: 11, fontWeight: '800' },

  pdfRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    borderWidth: 1.5, borderColor: '#EF444440', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 18,
  },
  pdfIcon: { width: 40, height: 40, borderRadius: theme.radius.sm, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  pdfTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  pdfSub: { fontSize: 12, color: theme.colors.textMuted },

  saveBar: {
    padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 14,
  },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

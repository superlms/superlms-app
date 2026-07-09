import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';
import { apiErr, pickImage, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import {
  AdminAnnouncement,
  AnnouncementType,
  createAnnouncement,
  updateAnnouncement,
} from '../../api/adminContentApi';

const TYPES: { key: AnnouncementType; label: string; icon: string }[] = [
  { key: 'all', label: 'Both', icon: 'people-outline' },
  { key: 'user', label: 'Students', icon: 'school-outline' },
  { key: 'teacher', label: 'Teachers', icon: 'person-outline' },
];

const AdminAnnouncementFormScreen = ({ navigation, route }: any) => {
  const item: AdminAnnouncement | undefined = route?.params?.item;
  const isEdit = !!item;

  const [name, setName] = useState(item?.announcement_name ?? '');
  const [content, setContent] = useState(item?.announcement_content ?? '');
  const [type, setType] = useState<AnnouncementType>(item?.type ?? 'all');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);

  const existingImage = !file && item?.image_url;
  const existingPdf = !file && item?.pdf_url;

  const attach = async (kind: 'image' | 'pdf') => {
    const f = kind === 'image' ? await pickImage() : await pickPdf();
    if (f) setFile(f);
  };

  const save = async () => {
    if (!name.trim() || !content.trim()) {
      Alert.alert('Required', 'Title and content are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = { announcement_name: name.trim(), announcement_content: content.trim(), type, file };
      if (isEdit) await updateAnnouncement(item!.id, payload);
      else await createAnnouncement(payload);
      Alert.alert('Success', `Announcement ${isEdit ? 'updated' : 'created'} successfully.`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save announcement.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title={isEdit ? 'Edit Announcement' : 'New Announcement'} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Title *</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Announcement title" placeholderTextColor={theme.colors.textMuted} />

          <Text style={s.label}>Content *</Text>
          <TextInput style={[s.input, s.inputMultiline]} value={content} onChangeText={setContent} placeholder="Write the announcement…" placeholderTextColor={theme.colors.textMuted} multiline />

          <Text style={s.label}>Audience</Text>
          <View style={s.typeRow}>
            {TYPES.map(t => {
              const active = type === t.key;
              return (
                <TouchableOpacity key={t.key} style={[s.typeChip, active && s.typeChipActive]} onPress={() => setType(t.key)} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName={t.icon} size={15} color={active ? theme.colors.primary : theme.colors.textSecondary} />
                  <Text style={[s.typeChipText, active && s.typeChipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.label}>Attachment (optional)</Text>
          {!!file && (
            <View style={s.fileChip}>
              <VectorIcon iconSet="Ionicons" iconName="attach" size={15} color={theme.colors.primary} />
              <Text style={s.fileChipText} numberOfLines={1}>{file.name}</Text>
              <TouchableOpacity onPress={() => setFile(null)}><VectorIcon iconSet="Ionicons" iconName="close" size={15} color={theme.colors.textMuted} /></TouchableOpacity>
            </View>
          )}
          {!!existingImage && <Image source={{ uri: existingImage as string }} style={s.previewImg} />}
          {!!existingPdf && (
            <View style={s.fileChip}>
              <VectorIcon iconSet="Ionicons" iconName="document-text" size={15} color="#EF4444" />
              <Text style={s.fileChipText} numberOfLines={1}>Current PDF attached</Text>
            </View>
          )}
          <View style={s.attachRow}>
            <TouchableOpacity style={s.attachBtn} onPress={() => attach('image')} activeOpacity={0.8}>
              <VectorIcon iconSet="Ionicons" iconName="image-outline" size={16} color={theme.colors.primary} />
              <Text style={s.attachText}>Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.attachBtn} onPress={() => attach('pdf')} activeOpacity={0.8}>
              <VectorIcon iconSet="Ionicons" iconName="document-outline" size={16} color={theme.colors.primary} />
              <Text style={s.attachText}>PDF</Text>
            </TouchableOpacity>
          </View>
          {isEdit && (existingImage || existingPdf) && (
            <Text style={s.hint}>Pick a new file to replace the current attachment.</Text>
          )}

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving} activeOpacity={0.9}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{isEdit ? 'Update Announcement' : 'Create Announcement'}</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminAnnouncementFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.card },
  inputMultiline: { minHeight: 120, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  typeChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  typeChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  typeChipTextActive: { color: theme.colors.primary },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border },
  fileChipText: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },
  previewImg: { width: '100%', height: 160, borderRadius: 12, resizeMode: 'cover' },
  attachRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  attachBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  attachText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  hint: { fontSize: 11, color: theme.colors.textMuted, marginTop: 8 },
  saveBtn: { marginTop: 24, height: 50, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

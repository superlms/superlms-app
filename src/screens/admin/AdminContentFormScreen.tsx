import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr, pickImage, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { ContentType, saveContent } from '../../api/adminContentLibApi';

const TYPES: { id: ContentType; label: string; icon: string }[] = [
  { id: 'text', label: 'Text', icon: 'text-outline' },
  { id: 'url', label: 'Link', icon: 'link-outline' },
  { id: 'image', label: 'Image', icon: 'image-outline' },
  { id: 'pdf', label: 'PDF', icon: 'document-outline' },
];

const AdminContentFormScreen = ({ navigation, route }: any) => {
  const targetType: 'chapter' | 'topic' = route.params?.targetType;
  const targetId: number = route.params?.targetId;
  const name: string = route.params?.name ?? '';
  const existing = route.params?.existing;

  const [cType, setCType] = useState<ContentType>(
    existing?.image ? 'image' : existing?.pdf ? 'pdf' : existing?.url ? 'url' : 'text',
  );
  const [text, setText] = useState<string>(existing?.text ?? '');
  const [url, setUrl] = useState<string>(existing?.url ?? '');
  const [image, setImage] = useState<PickedFile | null>(null);
  const [pdf, setPdf] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);

  const choose = async (kind: 'image' | 'pdf') => {
    const f = kind === 'image' ? await pickImage() : await pickPdf();
    if (f) { if (kind === 'image') setImage(f); else setPdf(f); }
  };

  const save = async () => {
    if (cType === 'text' && !text.trim()) return Alert.alert('Required', 'Enter some text.');
    if (cType === 'url' && !url.trim()) return Alert.alert('Required', 'Enter a link.');
    if (cType === 'image' && !image) return Alert.alert('Required', 'Pick an image.');
    if (cType === 'pdf' && !pdf) return Alert.alert('Required', 'Pick a PDF.');
    setSaving(true);
    try {
      await saveContent({ target_type: targetType, target_id: targetId, content_type: cType, text, url, image, pdf });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save content.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title="Set Content" onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {!!name && (
            <View style={s.contextCard}>
              <VectorIcon iconSet="Ionicons" iconName={targetType === 'chapter' ? 'book-outline' : 'document-text-outline'} size={15} color={theme.colors.primary} />
              <Text style={s.contextText} numberOfLines={1}>{name}</Text>
            </View>
          )}

          <Text style={s.label}>Content type</Text>
          <View style={s.typeRow}>
            {TYPES.map(t => {
              const active = cType === t.id;
              return (
                <TouchableOpacity key={t.id} style={[s.typeChip, active && s.typeChipActive]} onPress={() => setCType(t.id)} activeOpacity={0.85}>
                  <VectorIcon iconSet="Ionicons" iconName={t.icon} size={15} color={active ? theme.colors.primary : theme.colors.textMuted} />
                  <Text style={[s.typeText, active && s.typeTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {cType === 'text' && (
            <TextInput style={[s.input, s.multi]} placeholder="Enter content text" placeholderTextColor={theme.colors.textMuted}
              multiline value={text} onChangeText={setText} />
          )}
          {cType === 'url' && (
            <TextInput style={s.input} placeholder="https://..." placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none" value={url} onChangeText={setUrl} />
          )}
          {cType === 'image' && (
            <TouchableOpacity style={s.pickBtn} onPress={() => choose('image')} activeOpacity={0.85}>
              <VectorIcon iconSet="Ionicons" iconName="image-outline" size={16} color={theme.colors.primary} />
              <Text style={s.pickText} numberOfLines={1}>{image ? image.name : 'Pick image'}</Text>
            </TouchableOpacity>
          )}
          {cType === 'pdf' && (
            <TouchableOpacity style={s.pickBtn} onPress={() => choose('pdf')} activeOpacity={0.85}>
              <VectorIcon iconSet="Ionicons" iconName="document-outline" size={16} color={theme.colors.primary} />
              <Text style={s.pickText} numberOfLines={1}>{pdf ? pdf.name : 'Pick PDF'}</Text>
            </TouchableOpacity>
          )}

          <Text style={s.note}>Saving replaces the existing content of this {targetType}.</Text>
        </ScrollView>
        <View style={s.footer}>
          <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.9} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save Content</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminContentFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  contextCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.primaryLight, borderRadius: 12, padding: 12, marginBottom: 16 },
  contextText: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  label: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  typeChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  typeText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  typeTextActive: { color: theme.colors.primary },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.card, marginTop: 16 },
  multi: { minHeight: 140, textAlignVertical: 'top' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  pickText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, maxWidth: '80%' },
  note: { fontSize: 11, color: theme.colors.textMuted, marginTop: 16 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  saveBtn: { height: 52, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

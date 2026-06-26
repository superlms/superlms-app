import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr, pickImage, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { FormModal, ChipPicker } from './AdminStandardScreen';
import AdminCurriculumFilter, { CurriculumSelection } from './AdminCurriculumFilter';
import {
  ContentChapter,
  ContentStats,
  ContentType,
  clearContent,
  getContent,
  getContentStats,
  saveContent,
} from '../../api/adminContentLibApi';

const TYPES = [
  { id: 'text', label: 'Text' },
  { id: 'url', label: 'Link' },
  { id: 'image', label: 'Image' },
  { id: 'pdf', label: 'PDF' },
];

const AdminContentScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [sel, setSel] = useState<CurriculumSelection>({ standardId: null, sectionId: null, subjectId: null });
  const [chapters, setChapters] = useState<ContentChapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);

  // content modal
  const [modal, setModal] = useState(false);
  const [target, setTarget] = useState<{ type: 'chapter' | 'topic'; id: number; name: string } | null>(null);
  const [cType, setCType] = useState<ContentType>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [image, setImage] = useState<PickedFile | null>(null);
  const [pdf, setPdf] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);

  const loadStats = useCallback(async () => { try { setStats(await getContentStats()); } catch {} }, []);
  const loadList = useCallback(async () => {
    if (!sel.standardId || !sel.subjectId) { setChapters([]); return; }
    setLoading(true);
    try {
      setChapters(await getContent({ standard_id: sel.standardId, section_id: sel.sectionId, subject_id: sel.subjectId }));
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load content.')); }
    finally { setLoading(false); }
  }, [sel]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadList(); }, [loadList]);
  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadStats(), loadList()]); });

  const toggle = (id: number) => setExpanded(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const openContent = (type: 'chapter' | 'topic', id: number, name: string, existing?: any) => {
    setTarget({ type, id, name });
    setText(existing?.text ?? '');
    setUrl(existing?.url ?? '');
    setImage(null);
    setPdf(null);
    setCType(existing?.image ? 'image' : existing?.pdf ? 'pdf' : existing?.url ? 'url' : 'text');
    setModal(true);
  };

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
      await saveContent({ target_type: target!.type, target_id: target!.id, content_type: cType, text, url, image, pdf });
      setModal(false);
      await Promise.all([loadStats(), loadList()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save content.')); }
    finally { setSaving(false); }
  };

  const clear = (type: 'chapter' | 'topic', id: number, name: string) =>
    Alert.alert('Remove Content', `Remove all content from "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await clearContent(type, id); await Promise.all([loadStats(), loadList()]); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not remove.')); }
      } },
    ]);

  const ContentPreview = ({ c }: { c: any }) => (
    <View style={st.preview}>
      {!!c.text && <Text style={st.previewText}>{c.text}</Text>}
      {!!c.url && <TouchableOpacity onPress={() => Linking.openURL(c.url)}><Text style={st.link}>🔗 {c.url}</Text></TouchableOpacity>}
      {!!c.image && <TouchableOpacity onPress={() => Linking.openURL(c.image)}><Text style={st.link}>🖼 View image</Text></TouchableOpacity>}
      {!!c.pdf && <TouchableOpacity onPress={() => Linking.openURL(c.pdf)}><Text style={st.link}>📄 View PDF</Text></TouchableOpacity>}
    </View>
  );

  return (
    <View style={st.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <View style={st.topbar}>
        <TouchableOpacity style={st.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={st.title}>Content</Text>
      </View>

      <View style={st.statRow}>
        {[
          { label: 'Chapters', value: stats?.chapters, color: '#6366F1' },
          { label: 'Topics', value: stats?.topics, color: '#F59E0B' },
          { label: 'With Content', value: stats?.with_content, color: '#22C55E' },
        ].map(c => (
          <View key={c.label} style={[st.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[st.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={st.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <AdminCurriculumFilter onChange={setSel} />

      {loading ? (
        <View style={st.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {!sel.subjectId && <Text style={st.empty}>Select a class and subject to manage content.</Text>}
          {sel.subjectId && chapters.length === 0 && <Text style={st.empty}>No chapters found.</Text>}
          {chapters.map(c => {
            const open = expanded.includes(c.id);
            return (
              <View key={c.id} style={st.card}>
                <TouchableOpacity style={st.chHead} activeOpacity={0.8} onPress={() => toggle(c.id)}>
                  <VectorIcon iconSet="Ionicons" iconName={open ? 'chevron-down' : 'chevron-forward'} size={18} color={theme.colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.chName}>{c.name}</Text>
                    <Text style={st.chMeta}>{c.has_content ? 'Has content' : 'No content'} · {c.topics.length} topic(s)</Text>
                  </View>
                  {c.has_content && <View style={st.dotGreen} />}
                  <TouchableOpacity style={st.act} onPress={() => openContent('chapter', c.id, c.name, c.content)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>
                  {c.has_content && <TouchableOpacity style={st.act} onPress={() => clear('chapter', c.id, c.name)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>}
                </TouchableOpacity>
                {open && (
                  <View style={st.body}>
                    {c.has_content && <ContentPreview c={c.content} />}
                    {c.topics.map(t => (
                      <View key={t.id} style={st.topicRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={st.topicName}>{t.name}</Text>
                          {t.has_content && <ContentPreview c={t.content} />}
                        </View>
                        <TouchableOpacity style={st.actSm} onPress={() => openContent('topic', t.id, t.name, t.content)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={14} color={theme.colors.primary} /></TouchableOpacity>
                        {t.has_content && <TouchableOpacity style={st.actSm} onPress={() => clear('topic', t.id, t.name)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={14} color={theme.colors.danger} /></TouchableOpacity>}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <FormModal visible={modal} title={`Content · ${target?.name ?? ''}`} onClose={() => setModal(false)} onSave={save} saving={saving} saveLabel="Save">
        <Text style={st.fieldLabel}>Type</Text>
        <ChipPicker items={TYPES} selected={[cType]} onToggle={(id: any) => setCType(id)} />
        {cType === 'text' && (
          <TextInput style={[st.input, st.inputMulti, { marginTop: 12 }]} placeholder="Enter content text" placeholderTextColor={theme.colors.textMuted} multiline value={text} onChangeText={setText} />
        )}
        {cType === 'url' && (
          <TextInput style={[st.input, { marginTop: 12 }]} placeholder="https://..." placeholderTextColor={theme.colors.textMuted} autoCapitalize="none" value={url} onChangeText={setUrl} />
        )}
        {cType === 'image' && (
          <TouchableOpacity style={st.pickBtn} onPress={() => choose('image')} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="image-outline" size={16} color={theme.colors.primary} />
            <Text style={st.pickText} numberOfLines={1}>{image ? image.name : 'Pick image'}</Text>
          </TouchableOpacity>
        )}
        {cType === 'pdf' && (
          <TouchableOpacity style={st.pickBtn} onPress={() => choose('pdf')} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="document-outline" size={16} color={theme.colors.primary} />
            <Text style={st.pickText} numberOfLines={1}>{pdf ? pdf.name : 'Pick PDF'}</Text>
          </TouchableOpacity>
        )}
        <Text style={st.note}>Saving replaces the existing content of this {target?.type}.</Text>
      </FormModal>
    </View>
  );
};

export default AdminContentScreen;

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, flex: 1 },

  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  chHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  chName: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  chMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  act: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  preview: { backgroundColor: theme.colors.background, borderRadius: 10, padding: 10, gap: 4 },
  previewText: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18 },
  link: { fontSize: 12, color: theme.colors.primary, fontWeight: '600' },
  topicRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  topicName: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  actSm: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.background },
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  pickText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, maxWidth: '80%' },
  note: { fontSize: 11, color: theme.colors.textMuted, marginTop: 12 },
});

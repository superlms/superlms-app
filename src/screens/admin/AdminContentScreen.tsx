import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import AdminCurriculumFilter, { CurriculumSelection } from './AdminCurriculumFilter';
import {
  ContentChapter,
  ContentStats,
  clearContent,
  getContent,
  getContentStats,
} from '../../api/adminContentLibApi';

const AdminContentScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [sel, setSel] = useState<CurriculumSelection>({ standardId: null, sectionId: null, subjectId: null });
  const [chapters, setChapters] = useState<ContentChapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);

  const loadStats = useCallback(async () => { try { setStats(await getContentStats()); } catch {} }, []);
  const loadList = useCallback(async () => {
    if (!sel.standardId || !sel.subjectId) { setChapters([]); return; }
    setLoading(true);
    try {
      setChapters(await getContent({ standard_id: sel.standardId, section_id: sel.sectionId, subject_id: sel.subjectId }));
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load content.')); }
    finally { setLoading(false); }
  }, [sel]);

  useFocusEffect(useCallback(() => { loadStats(); loadList(); }, [loadStats, loadList]));
  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadStats(), loadList()]); });

  const toggle = (id: number) => setExpanded(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const editContent = (type: 'chapter' | 'topic', id: number, name: string, existing?: any) =>
    navigation.navigate('AdminContentForm', { targetType: type, targetId: id, name, existing });

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
      <Header
        title="Content"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

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
                  <TouchableOpacity style={st.act} onPress={() => editContent('chapter', c.id, c.name, c.content)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>
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
                        <TouchableOpacity style={st.actSm} onPress={() => editContent('topic', t.id, t.name, t.content)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={14} color={theme.colors.primary} /></TouchableOpacity>
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
    </View>
  );
};

export default AdminContentScreen;

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },

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
});

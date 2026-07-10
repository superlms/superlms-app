import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  SyllabusChapter,
  SyllabusStats,
  deleteChapter,
  deleteTopic,
  getSyllabus,
  getSyllabusStats,
} from '../../api/adminSyllabusApi';

const AdminSyllabusScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState<SyllabusStats | null>(null);
  const [sel, setSel] = useState<CurriculumSelection>({ standardId: null, sectionId: null, subjectId: null });
  const [chapters, setChapters] = useState<SyllabusChapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);

  const loadStats = useCallback(async () => {
    try { setStats(await getSyllabusStats()); } catch {}
  }, []);

  const loadList = useCallback(async () => {
    if (!sel.standardId || !sel.subjectId) { setChapters([]); return; }
    setLoading(true);
    try {
      setChapters(await getSyllabus({ standard_id: sel.standardId, section_id: sel.sectionId, subject_id: sel.subjectId }));
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load syllabus.'));
    } finally {
      setLoading(false);
    }
  }, [sel]);

  // Reloads on first focus and whenever the curriculum selection changes, plus
  // when returning from an add / edit screen.
  useFocusEffect(useCallback(() => { loadStats(); loadList(); }, [loadStats, loadList]));

  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadStats(), loadList()]); });

  const toggle = (id: number) => setExpanded(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const addChapters = () => {
    if (!sel.subjectId) return Alert.alert('Select subject', 'Pick a class and subject first.');
    navigation.navigate('AdminSyllabusChapterForm', { sel });
  };
  const editChapter = (c: SyllabusChapter) => navigation.navigate('AdminSyllabusChapterForm', { chapter: c });
  const addTopics = (chapterId: number, chapterName: string) => navigation.navigate('AdminSyllabusTopicForm', { chapterId, chapterName });
  const editTopic = (t: { id: number; name: string }) => navigation.navigate('AdminSyllabusTopicForm', { topic: t });

  const removeChapter = (c: SyllabusChapter) =>
    Alert.alert('Delete Chapter', `Delete "${c.name}" and its topics?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteChapter(c.id); await Promise.all([loadStats(), loadList()]); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  const removeTopic = (t: { id: number; name: string }) =>
    Alert.alert('Delete Topic', `Delete "${t.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteTopic(t.id); await Promise.all([loadStats(), loadList()]); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  return (
    <View style={st.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="Syllabus"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

      <View style={st.statRow}>
        {[
          { label: 'Subjects', value: stats?.subjects, color: '#14B8A6' },
          { label: 'Chapters', value: stats?.chapters, color: '#6366F1' },
          { label: 'Topics', value: stats?.topics, color: '#F59E0B' },
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
          {!sel.subjectId && <Text style={st.empty}>Select a class and subject to view chapters.</Text>}
          {sel.subjectId && chapters.length === 0 && <Text style={st.empty}>No chapters yet. Tap + to add.</Text>}
          {chapters.map(c => {
            const open = expanded.includes(c.id);
            return (
              <View key={c.id} style={st.card}>
                <TouchableOpacity style={st.chHead} activeOpacity={0.8} onPress={() => toggle(c.id)}>
                  <VectorIcon iconSet="Ionicons" iconName={open ? 'chevron-down' : 'chevron-forward'} size={18} color={theme.colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.chName}>{c.name}</Text>
                    <Text style={st.chMeta}>{c.topics.length} topic(s)</Text>
                  </View>
                  <TouchableOpacity style={st.act} onPress={() => addTopics(c.id, c.name)}><VectorIcon iconSet="Ionicons" iconName="add" size={18} color="#14B8A6" /></TouchableOpacity>
                  <TouchableOpacity style={st.act} onPress={() => editChapter(c)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>
                  <TouchableOpacity style={st.act} onPress={() => removeChapter(c)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
                </TouchableOpacity>
                {open && (
                  <View style={st.topicWrap}>
                    {c.topics.length === 0 && <Text style={st.noTopic}>No topics. Tap + to add.</Text>}
                    {c.topics.map(t => (
                      <View key={t.id} style={st.topicRow}>
                        <View style={st.dot} />
                        <Text style={st.topicName}>{t.name}</Text>
                        <TouchableOpacity style={st.actSm} onPress={() => editTopic(t)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={14} color={theme.colors.primary} /></TouchableOpacity>
                        <TouchableOpacity style={st.actSm} onPress={() => removeTopic(t)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={14} color={theme.colors.danger} /></TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      {!!sel.subjectId && (
        <TouchableOpacity style={st.fab} onPress={addChapters} activeOpacity={0.9}>
          <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default AdminSyllabusScreen;

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
  act: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  topicWrap: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  noTopic: { fontSize: 12, color: theme.colors.textMuted },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
  topicName: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },
  actSm: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
});

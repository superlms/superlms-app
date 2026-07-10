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
import { QuizChapter, QuizTarget, getQuizStats, getQuizTree } from '../../api/adminQuizApi';

const AdminQuizScreen = ({ navigation }: any) => {
  const [questions, setQuestions] = useState(0);
  const [sel, setSel] = useState<CurriculumSelection>({ standardId: null, sectionId: null, subjectId: null });
  const [chapters, setChapters] = useState<QuizChapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);

  const loadStats = useCallback(async () => { try { setQuestions((await getQuizStats()).questions); } catch {} }, []);
  const loadList = useCallback(async () => {
    if (!sel.standardId || !sel.subjectId) { setChapters([]); return; }
    setLoading(true);
    try {
      setChapters(await getQuizTree({ standard_id: sel.standardId, section_id: sel.sectionId, subject_id: sel.subjectId }));
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load quiz.')); }
    finally { setLoading(false); }
  }, [sel]);

  useFocusEffect(useCallback(() => { loadStats(); loadList(); }, [loadStats, loadList]));
  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadStats(), loadList()]); });

  const toggle = (id: number) => setExpanded(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const openAdd = (type: QuizTarget, id: number, name: string) =>
    navigation.navigate('AdminQuizForm', { mode: 'add', target: { type, id, name } });
  const openManage = (type: QuizTarget, id: number, name: string) =>
    navigation.navigate('AdminQuizForm', { mode: 'manage', target: { type, id, name } });

  const renderActions = (type: QuizTarget, id: number, name: string, count: number) => (
    <View style={st.actionsRow}>
      <TouchableOpacity style={st.act} onPress={() => openAdd(type, id, name)}><VectorIcon iconSet="Ionicons" iconName="add" size={18} color="#3B82F6" /></TouchableOpacity>
      {count > 0 && <TouchableOpacity style={st.act} onPress={() => openManage(type, id, name)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>}
    </View>
  );

  return (
    <View style={st.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="Quiz"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightText={`${questions} Qs`}
      />

      <AdminCurriculumFilter onChange={setSel} />

      {loading ? (
        <View style={st.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {!sel.subjectId && <Text style={st.empty}>Select a class and subject to manage quizzes.</Text>}
          {sel.subjectId && chapters.length === 0 && <Text style={st.empty}>No chapters found.</Text>}
          {chapters.map(c => {
            const open = expanded.includes(c.id);
            return (
              <View key={c.id} style={st.card}>
                <TouchableOpacity style={st.chHead} activeOpacity={0.8} onPress={() => toggle(c.id)}>
                  <VectorIcon iconSet="Ionicons" iconName={open ? 'chevron-down' : 'chevron-forward'} size={18} color={theme.colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.chName}>{c.name}</Text>
                    <Text style={st.chMeta}>{c.mcq_count} MCQ(s) · {c.topics.length} topic(s)</Text>
                  </View>
                  {renderActions('chapter', c.id, c.name, c.mcq_count)}
                </TouchableOpacity>
                {open && (
                  <View style={st.body}>
                    {c.topics.length === 0 && <Text style={st.noTopic}>No topics.</Text>}
                    {c.topics.map(t => (
                      <View key={t.id} style={st.topicRow}>
                        <View style={st.dot} />
                        <View style={{ flex: 1 }}>
                          <Text style={st.topicName}>{t.name}</Text>
                          <Text style={st.topicMeta}>{t.mcq_count} MCQ(s)</Text>
                        </View>
                        {renderActions('topic', t.id, t.name, t.mcq_count)}
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

export default AdminQuizScreen;

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  chHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  chName: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  chMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 6 },
  act: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  noTopic: { fontSize: 12, color: theme.colors.textMuted },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' },
  topicName: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  topicMeta: { fontSize: 10, color: theme.colors.textMuted },
});

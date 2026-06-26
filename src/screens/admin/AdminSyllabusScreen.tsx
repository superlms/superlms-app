import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { apiErr } from '../../utils/filePickers';
import { FormModal, Field } from './AdminStandardScreen';
import AdminCurriculumFilter, { CurriculumSelection } from './AdminCurriculumFilter';
import {
  SyllabusChapter,
  SyllabusStats,
  createChapters,
  createTopics,
  deleteChapter,
  deleteTopic,
  getSyllabus,
  getSyllabusStats,
  updateChapter,
  updateTopic,
} from '../../api/adminSyllabusApi';

const AdminSyllabusScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState<SyllabusStats | null>(null);
  const [sel, setSel] = useState<CurriculumSelection>({ standardId: null, sectionId: null, subjectId: null });
  const [chapters, setChapters] = useState<SyllabusChapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);

  // bulk chapter modal
  const [chModal, setChModal] = useState(false);
  const [chRows, setChRows] = useState<{ name: string; description: string }[]>([{ name: '', description: '' }]);

  // bulk topic modal
  const [tpModal, setTpModal] = useState(false);
  const [tpChapterId, setTpChapterId] = useState<number | null>(null);
  const [tpRows, setTpRows] = useState<string[]>(['']);

  // edit chapter / topic
  const [editCh, setEditCh] = useState<SyllabusChapter | null>(null);
  const [editChName, setEditChName] = useState('');
  const [editChDesc, setEditChDesc] = useState('');
  const [editTp, setEditTp] = useState<{ id: number; name: string } | null>(null);
  const [editTpName, setEditTpName] = useState('');

  const [saving, setSaving] = useState(false);

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

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadList(); }, [loadList]);

  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadStats(), loadList()]); });

  const toggle = (id: number) => setExpanded(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  // chapters
  const openChapters = () => {
    if (!sel.subjectId) return Alert.alert('Select subject', 'Pick a class and subject first.');
    setChRows([{ name: '', description: '' }]);
    setChModal(true);
  };
  const saveChapters = async () => {
    const rows = chRows.filter(r => r.name.trim());
    if (rows.length === 0) return Alert.alert('Required', 'Add at least one chapter name.');
    setSaving(true);
    try {
      await createChapters({ standard_id: sel.standardId!, section_id: sel.sectionId, subject_id: sel.subjectId!, chapters: rows });
      setChModal(false);
      await Promise.all([loadStats(), loadList()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save chapters.')); }
    finally { setSaving(false); }
  };

  // topics
  const openTopics = (chapterId: number) => {
    setTpChapterId(chapterId);
    setTpRows(['']);
    setTpModal(true);
  };
  const saveTopics = async () => {
    const rows = tpRows.filter(r => r.trim()).map(name => ({ name: name.trim() }));
    if (rows.length === 0) return Alert.alert('Required', 'Add at least one topic name.');
    setSaving(true);
    try {
      await createTopics({ chapter_id: tpChapterId!, topics: rows });
      setTpModal(false);
      await Promise.all([loadStats(), loadList()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save topics.')); }
    finally { setSaving(false); }
  };

  // edit chapter
  const openEditChapter = (c: SyllabusChapter) => { setEditCh(c); setEditChName(c.name); setEditChDesc(c.description ?? ''); };
  const saveEditChapter = async () => {
    if (!editChName.trim()) return Alert.alert('Required', 'Chapter name is required.');
    setSaving(true);
    try {
      await updateChapter(editCh!.id, { name: editChName.trim(), description: editChDesc.trim(), order: editCh!.order });
      setEditCh(null);
      await loadList();
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not update.')); }
    finally { setSaving(false); }
  };
  const removeChapter = (c: SyllabusChapter) =>
    Alert.alert('Delete Chapter', `Delete "${c.name}" and its topics?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteChapter(c.id); await Promise.all([loadStats(), loadList()]); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  // edit topic
  const openEditTopic = (t: { id: number; name: string }) => { setEditTp(t); setEditTpName(t.name); };
  const saveEditTopic = async () => {
    if (!editTpName.trim()) return Alert.alert('Required', 'Topic name is required.');
    setSaving(true);
    try {
      await updateTopic(editTp!.id, editTpName.trim());
      setEditTp(null);
      await loadList();
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not update.')); }
    finally { setSaving(false); }
  };
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
      <View style={st.topbar}>
        <TouchableOpacity style={st.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={st.title}>Syllabus</Text>
      </View>

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
                  <TouchableOpacity style={st.act} onPress={() => openTopics(c.id)}><VectorIcon iconSet="Ionicons" iconName="add" size={18} color="#14B8A6" /></TouchableOpacity>
                  <TouchableOpacity style={st.act} onPress={() => openEditChapter(c)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>
                  <TouchableOpacity style={st.act} onPress={() => removeChapter(c)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
                </TouchableOpacity>
                {open && (
                  <View style={st.topicWrap}>
                    {c.topics.length === 0 && <Text style={st.noTopic}>No topics. Tap + to add.</Text>}
                    {c.topics.map(t => (
                      <View key={t.id} style={st.topicRow}>
                        <View style={st.dot} />
                        <Text style={st.topicName}>{t.name}</Text>
                        <TouchableOpacity style={st.actSm} onPress={() => openEditTopic(t)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={14} color={theme.colors.primary} /></TouchableOpacity>
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
        <TouchableOpacity style={st.fab} onPress={openChapters} activeOpacity={0.9}>
          <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Bulk chapters */}
      <FormModal visible={chModal} title="Add Chapters" onClose={() => setChModal(false)} onSave={saveChapters} saving={saving} saveLabel="Save">
        {chRows.map((r, i) => (
          <View key={i} style={st.rowBlock}>
            <View style={st.rowHeadLine}>
              <Text style={st.rowHeadText}>Chapter {i + 1}</Text>
              {chRows.length > 1 && <TouchableOpacity onPress={() => setChRows(rows => rows.filter((_, x) => x !== i))}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={18} color={theme.colors.danger} /></TouchableOpacity>}
            </View>
            <TextInput style={st.input} placeholder="Chapter name" placeholderTextColor={theme.colors.textMuted}
              value={r.name} onChangeText={v => setChRows(rows => rows.map((x, idx) => idx === i ? { ...x, name: v } : x))} />
            <TextInput style={[st.input, st.inputMulti, { marginTop: 8 }]} placeholder="Description (optional)" placeholderTextColor={theme.colors.textMuted} multiline
              value={r.description} onChangeText={v => setChRows(rows => rows.map((x, idx) => idx === i ? { ...x, description: v } : x))} />
          </View>
        ))}
        <TouchableOpacity style={st.addRow} onPress={() => setChRows(r => [...r, { name: '', description: '' }])} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
          <Text style={st.addRowText}>Add another chapter</Text>
        </TouchableOpacity>
      </FormModal>

      {/* Bulk topics */}
      <FormModal visible={tpModal} title="Add Topics" onClose={() => setTpModal(false)} onSave={saveTopics} saving={saving} saveLabel="Save">
        {tpRows.map((r, i) => (
          <View key={i} style={[st.rowHeadLine, { marginTop: 10 }]}>
            <TextInput style={[st.input, { flex: 1 }]} placeholder={`Topic ${i + 1}`} placeholderTextColor={theme.colors.textMuted}
              value={r} onChangeText={v => setTpRows(rows => rows.map((x, idx) => idx === i ? v : x))} />
            {tpRows.length > 1 && <TouchableOpacity onPress={() => setTpRows(rows => rows.filter((_, x) => x !== i))}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={18} color={theme.colors.danger} /></TouchableOpacity>}
          </View>
        ))}
        <TouchableOpacity style={st.addRow} onPress={() => setTpRows(r => [...r, ''])} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
          <Text style={st.addRowText}>Add another topic</Text>
        </TouchableOpacity>
      </FormModal>

      {/* Edit chapter */}
      <FormModal visible={!!editCh} title="Edit Chapter" onClose={() => setEditCh(null)} onSave={saveEditChapter} saving={saving} saveLabel="Update">
        <Field label="Name" value={editChName} onChangeText={setEditChName} placeholder="Chapter name" />
        <Field label="Description" value={editChDesc} onChangeText={setEditChDesc} placeholder="Optional" multiline />
      </FormModal>

      {/* Edit topic */}
      <FormModal visible={!!editTp} title="Edit Topic" onClose={() => setEditTp(null)} onSave={saveEditTopic} saving={saving} saveLabel="Update">
        <Field label="Name" value={editTpName} onChangeText={setEditTpName} placeholder="Topic name" />
      </FormModal>
    </View>
  );
};

export default AdminSyllabusScreen;

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
  act: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  topicWrap: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  noTopic: { fontSize: 12, color: theme.colors.textMuted },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary },
  topicName: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },
  actSm: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  rowBlock: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  rowHeadLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowHeadText: { flex: 1, fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.card },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed' },
  addRowText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
});

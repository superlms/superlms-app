import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr, pickImage, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { FormModal, Field } from './AdminStandardScreen';
import {
  HomeworkItem,
  HomeworkLookups,
  HomeworkStats,
  HwSubject,
  StatusRow,
  createHomework,
  createHomeworkBulk,
  deleteHomework,
  getHomeworkLookups,
  getHomeworkStats,
  getHomeworkStatus,
  getHomeworkSubjects,
  getHomeworks,
  updateHomework,
} from '../../api/adminHomeworkApi';

type Tab = 'homework' | 'status';

const AdminHomeworkScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<Tab>('homework');
  const [stats, setStats] = useState<HomeworkStats | null>(null);
  const [lookups, setLookups] = useState<HomeworkLookups | null>(null);

  // ── list + filters ──
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [fClass, setFClass] = useState<number | null>(null);
  const [fSection, setFSection] = useState<number | null>(null);

  // ── form ──
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [mode, setMode] = useState<'single' | 'all'>('single');
  const [fmClass, setFmClass] = useState<number | null>(null);
  const [fmSection, setFmSection] = useState<number | null>(null);
  const [fmSubject, setFmSubject] = useState<number | null>(null);
  const [fmTitle, setFmTitle] = useState('');
  const [fmDesc, setFmDesc] = useState('');
  const [fmFile, setFmFile] = useState<PickedFile | null>(null);
  const [subjects, setSubjects] = useState<HwSubject[]>([]);
  const [bulkRows, setBulkRows] = useState<Record<number, { title: string; description: string }>>({});
  const [saving, setSaving] = useState(false);

  // ── status tab ──
  const [stClass, setStClass] = useState<number | null>(null);
  const [stSection, setStSection] = useState<number | null>(null);
  const [stStudent, setStStudent] = useState<number | null>(null);
  const [statusRows, setStatusRows] = useState<StatusRow[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);

  const sectionsFor = (cid: number | null) => lookups?.classes.find(c => c.id === cid)?.sections ?? [];

  const loadStats = useCallback(async () => { try { setStats(await getHomeworkStats()); } catch {} }, []);
  useEffect(() => { loadStats(); getHomeworkLookups().then(setLookups).catch(() => {}); }, [loadStats]);

  const hasFilter = !!(search || fClass || fSection);
  const loadList = useCallback(async () => {
    if (!hasFilter) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await getHomeworks({ search, standard_id: fClass, section_id: fSection, per_page: 30 });
      setItems(res.data);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load homework.')); }
    finally { setLoading(false); }
  }, [search, fClass, fSection, hasFilter]);

  useEffect(() => { const t = setTimeout(loadList, 300); return () => clearTimeout(t); }, [loadList]);
  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadStats(), loadList()]); });

  // ── form helpers ──
  const loadFormSubjects = useCallback(async (cid: number | null, sid: number | null) => {
    if (!cid) { setSubjects([]); return; }
    try {
      const subs = await getHomeworkSubjects(cid, sid);
      setSubjects(subs);
      setBulkRows(prev => {
        const next: Record<number, { title: string; description: string }> = {};
        subs.forEach(s => { next[s.id] = prev[s.id] ?? { title: '', description: '' }; });
        return next;
      });
    } catch { setSubjects([]); }
  }, []);

  const openCreate = () => {
    setEditId(null); setMode('single');
    setFmClass(null); setFmSection(null); setFmSubject(null);
    setFmTitle(''); setFmDesc(''); setFmFile(null); setSubjects([]); setBulkRows({});
    setFormOpen(true);
  };

  const openEdit = (h: HomeworkItem) => {
    setEditId(h.id); setMode('single');
    setFmClass(h.standard_id); setFmSection(h.section_id); setFmSubject(h.subject_id);
    setFmTitle(h.title); setFmDesc(h.description); setFmFile(null);
    loadFormSubjects(h.standard_id, h.section_id);
    setFormOpen(true);
  };

  const chooseFile = () => {
    Alert.alert('Attach file', 'Choose a file type', [
      { text: 'PDF / Document', onPress: async () => { const f = await pickPdf(); if (f) setFmFile(f); } },
      { text: 'Image', onPress: async () => { const f = await pickImage(); if (f) setFmFile(f); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const saveForm = async () => {
    if (!fmClass) return Alert.alert('Required', 'Please select a class.');
    if (mode === 'all' && !editId) {
      const rows = subjects
        .map(s => ({ subject_id: s.id, ...(bulkRows[s.id] ?? { title: '', description: '' }) }))
        .filter(r => r.title.trim() !== '');
      if (rows.length === 0) return Alert.alert('Required', 'Fill homework for at least one subject.');
      setSaving(true);
      try {
        await createHomeworkBulk({ standard_id: fmClass, section_id: fmSection, items: rows });
        setFormOpen(false);
        await Promise.all([loadStats(), loadList()]);
      } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save homework.')); }
      finally { setSaving(false); }
      return;
    }

    if (!fmSubject) return Alert.alert('Required', 'Please select a subject.');
    if (!fmTitle.trim()) return Alert.alert('Required', 'Please enter a title.');
    if (!fmDesc.trim()) return Alert.alert('Required', 'Please enter a description.');
    setSaving(true);
    try {
      const payload = { title: fmTitle.trim(), standard_id: fmClass, section_id: fmSection, subject_id: fmSubject, description: fmDesc.trim(), file: fmFile };
      if (editId) await updateHomework(editId, payload);
      else await createHomework(payload);
      setFormOpen(false);
      await Promise.all([loadStats(), loadList()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save homework.')); }
    finally { setSaving(false); }
  };

  const confirmDelete = (h: HomeworkItem) =>
    Alert.alert('Delete Homework', `Delete "${h.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteHomework(h.id); await Promise.all([loadStats(), loadList()]); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  // ── status ──
  const [stStudentList, setStStudentList] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    if (!stClass || !stSection) { setStStudentList([]); setStStudent(null); return; }
    // reuse attendance students endpoint via homework lookups isn't available; use attendance API
    import('../../api/adminAttendanceApi').then(({ getSectionStudents }) => {
      getSectionStudents(stClass, stSection).then(list => setStStudentList(list.map(s => ({ id: s.id, name: s.name })))).catch(() => setStStudentList([]));
    });
  }, [stClass, stSection]);

  const loadStatus = useCallback(async () => {
    if (!stClass || !stSection || !stStudent) { setStatusRows([]); return; }
    setStatusLoading(true);
    try {
      const res = await getHomeworkStatus({ standard_id: stClass, section_id: stSection, student_id: stStudent, days: 14 });
      setStatusRows(res.rows);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load status.')); }
    finally { setStatusLoading(false); }
  }, [stClass, stSection, stStudent]);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  const statCards = [
    { label: 'Total', value: stats?.total, color: '#22C55E' },
    { label: 'This Week', value: stats?.this_week, color: '#0EA5E9' },
    { label: 'Teachers', value: stats?.by_teacher, color: '#8B5CF6' },
    { label: 'Classes', value: stats?.by_class, color: '#F59E0B' },
  ];

  return (
    <View style={s.root}>
      <Header title="Homework" onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} />

      <View style={s.statRow}>
        {statCards.map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.tabRow}>
        {(['homework', 'status'] as Tab[]).map(t => {
          const active = tab === t;
          return (
            <TouchableOpacity key={t} style={[s.tab, active && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
              <Text style={[s.tabText, active && s.tabTextActive]}>{t === 'homework' ? 'Homework' : 'Status'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'homework' ? (
        <>
          <View style={s.searchRow}>
            <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
            <TextInput style={s.searchInput} placeholder="Search homework" placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
            {(lookups?.classes ?? []).map(c => (
              <TouchableOpacity key={c.id} style={[s.pchip, fClass === c.id && s.pchipActive]} onPress={() => { setFClass(fClass === c.id ? null : c.id); setFSection(null); }}>
                <Text style={[s.pchipText, fClass === c.id && s.pchipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {!!fClass && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar2} contentContainerStyle={s.filterContent}>
              {sectionsFor(fClass).map(sec => (
                <TouchableOpacity key={sec.id} style={[s.pchip, fSection === sec.id && s.pchipActive]} onPress={() => setFSection(fSection === sec.id ? null : sec.id)}>
                  <Text style={[s.pchipText, fSection === sec.id && s.pchipTextActive]}>{sec.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {loading ? (
            <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
          ) : (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
              refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
              {!hasFilter && <Text style={s.empty}>Search or pick a class to view homework.</Text>}
              {hasFilter && items.length === 0 && <Text style={s.empty}>No homework found.</Text>}
              {items.map(h => (
                <View key={h.id} style={s.card}>
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{h.title}</Text>
                      <Text style={s.cardSub}>{h.standard}{h.section ? ` · ${h.section}` : ''} · {h.subject}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity style={s.act} onPress={() => openEdit(h)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>
                      <TouchableOpacity style={s.act} onPress={() => confirmDelete(h)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
                    </View>
                  </View>
                  {!!h.description && <Text style={s.cardDesc} numberOfLines={3}>{h.description}</Text>}
                  <View style={s.cardMeta}>
                    <Text style={s.cardMetaText}>👤 {h.teacher}</Text>
                    <Text style={s.cardMetaText}>{h.created_label}</Text>
                  </View>
                  {!!h.file && (
                    <TouchableOpacity style={s.fileChip} onPress={() => Linking.openURL(h.file!)}>
                      <VectorIcon iconSet="Ionicons" iconName="document-attach-outline" size={14} color={theme.colors.primary} />
                      <Text style={s.fileChipText}>View attachment</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <View style={{ height: 90 }} />
            </ScrollView>
          )}

          <TouchableOpacity style={s.fab} onPress={openCreate} activeOpacity={0.9}>
            <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
          </TouchableOpacity>
        </>
      ) : (
        // ── Status tab ──
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.fieldLabel}>Class</Text>
          <View style={s.wrapChips}>
            {(lookups?.classes ?? []).map(c => (
              <TouchableOpacity key={c.id} style={[s.selChip, stClass === c.id && s.selChipActive]} onPress={() => { setStClass(c.id); setStSection(null); setStStudent(null); }}>
                <Text style={[s.selChipText, stClass === c.id && s.selChipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!stClass && (
            <>
              <Text style={s.fieldLabel}>Section</Text>
              <View style={s.wrapChips}>
                {sectionsFor(stClass).map(sec => (
                  <TouchableOpacity key={sec.id} style={[s.selChip, stSection === sec.id && s.selChipActive]} onPress={() => { setStSection(sec.id); setStStudent(null); }}>
                    <Text style={[s.selChipText, stSection === sec.id && s.selChipTextActive]}>{sec.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          {!!stSection && (
            <>
              <Text style={s.fieldLabel}>Student</Text>
              <View style={s.wrapChips}>
                {stStudentList.map(st => (
                  <TouchableOpacity key={st.id} style={[s.selChip, stStudent === st.id && s.selChipActive]} onPress={() => setStStudent(st.id)}>
                    <Text style={[s.selChipText, stStudent === st.id && s.selChipTextActive]}>{st.name}</Text>
                  </TouchableOpacity>
                ))}
                {stStudentList.length === 0 && <Text style={s.pickerEmpty}>No students</Text>}
              </View>
            </>
          )}

          {statusLoading ? (
            <View style={{ paddingVertical: 24 }}><ActivityIndicator color={theme.colors.primary} /></View>
          ) : !stStudent ? (
            <Text style={s.empty}>Pick class, section and student to see the completion register.</Text>
          ) : (
            statusRows.map((r, i) => (
              <View key={i} style={s.statusRow}>
                <View style={s.statusDate}>
                  <Text style={s.statusDateDay}>{r.day.slice(0, 3)}</Text>
                  <Text style={s.statusDateNum}>{r.date}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  {r.items.length === 0 ? (
                    <Text style={s.statusNone}>No homework</Text>
                  ) : (
                    r.items.map((it, j) => (
                      <View key={j} style={s.statusItem}>
                        <VectorIcon iconSet="Ionicons" iconName={it.complete ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={it.complete ? '#22C55E' : theme.colors.textMuted} />
                        <Text style={s.statusItemText} numberOfLines={1}><Text style={{ fontWeight: '800' }}>{it.subject}</Text> · {it.title}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Create / Edit form */}
      <FormModal visible={formOpen} title={editId ? 'Edit Homework' : 'Add Homework'} onClose={() => setFormOpen(false)} onSave={saveForm} saving={saving} saveLabel="Save">
        {!editId && (
          <View style={s.modeRow}>
            {(['single', 'all'] as const).map(m => (
              <TouchableOpacity key={m} style={[s.modeBtn, mode === m && s.modeBtnActive]} onPress={() => setMode(m)}>
                <Text style={[s.modeBtnText, mode === m && s.modeBtnTextActive]}>{m === 'single' ? 'Single Subject' : 'All Subjects'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={s.fieldLabel}>Class</Text>
        <View style={s.wrapChips}>
          {(lookups?.classes ?? []).map(c => (
            <TouchableOpacity key={c.id} style={[s.selChip, fmClass === c.id && s.selChipActive]} onPress={() => { setFmClass(c.id); setFmSection(null); setFmSubject(null); loadFormSubjects(c.id, null); }}>
              <Text style={[s.selChipText, fmClass === c.id && s.selChipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!fmClass && (
          <>
            <Text style={s.fieldLabel}>Section (optional)</Text>
            <View style={s.wrapChips}>
              {sectionsFor(fmClass).map(sec => (
                <TouchableOpacity key={sec.id} style={[s.selChip, fmSection === sec.id && s.selChipActive]} onPress={() => { const v = fmSection === sec.id ? null : sec.id; setFmSection(v); setFmSubject(null); loadFormSubjects(fmClass, v); }}>
                  <Text style={[s.selChipText, fmSection === sec.id && s.selChipTextActive]}>{sec.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {mode === 'single' || editId ? (
          <>
            <Text style={s.fieldLabel}>Subject</Text>
            <View style={s.wrapChips}>
              {subjects.map(su => (
                <TouchableOpacity key={su.id} style={[s.selChip, fmSubject === su.id && s.selChipActive]} onPress={() => setFmSubject(su.id)}>
                  <Text style={[s.selChipText, fmSubject === su.id && s.selChipTextActive]}>{su.name}</Text>
                </TouchableOpacity>
              ))}
              {subjects.length === 0 && <Text style={s.pickerEmpty}>Select a class first</Text>}
            </View>
            <Field label="Title" value={fmTitle} onChangeText={setFmTitle} placeholder="Homework title" />
            <Field label="Description" value={fmDesc} onChangeText={setFmDesc} placeholder="Details / instructions" multiline />
            <Text style={s.fieldLabel}>Attachment (optional, ≤1 MB)</Text>
            <TouchableOpacity style={s.fileBtn} onPress={chooseFile}>
              <VectorIcon iconSet="Ionicons" iconName="cloud-upload-outline" size={16} color={theme.colors.primary} />
              <Text style={s.fileBtnText} numberOfLines={1}>{fmFile ? fmFile.name : 'Choose file'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.fieldLabel}>Homework per subject (blank = skip)</Text>
            {subjects.length === 0 && <Text style={s.pickerEmpty}>Select a class first</Text>}
            {subjects.map(su => (
              <View key={su.id} style={s.bulkBlock}>
                <Text style={s.bulkSubject}>{su.name}</Text>
                <TextInput style={s.bulkInput} placeholder="Title" placeholderTextColor={theme.colors.textMuted}
                  value={bulkRows[su.id]?.title ?? ''} onChangeText={v => setBulkRows(p => ({ ...p, [su.id]: { ...(p[su.id] ?? { title: '', description: '' }), title: v } }))} />
                <TextInput style={[s.bulkInput, { minHeight: 44, textAlignVertical: 'top' }]} placeholder="Description" placeholderTextColor={theme.colors.textMuted} multiline
                  value={bulkRows[su.id]?.description ?? ''} onChangeText={v => setBulkRows(p => ({ ...p, [su.id]: { ...(p[su.id] ?? { title: '', description: '' }), description: v } }))} />
              </View>
            ))}
          </>
        )}
      </FormModal>
    </View>
  );
};

export default AdminHomeworkScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },

  statRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLbl: { fontSize: 10, color: theme.colors.textSecondary, fontWeight: '700', marginTop: 2 },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  filterBar: { maxHeight: 46, paddingLeft: 16, marginTop: 10 },
  filterBar2: { maxHeight: 46, paddingLeft: 16, marginTop: 4 },
  filterContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
  pchip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  pchipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pchipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  pchipTextActive: { color: '#fff' },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardDesc: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 8, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cardMetaText: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' },
  act: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.primaryLight },
  fileChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 14, marginBottom: 6 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  selChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  selChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  selChipTextActive: { color: theme.colors.primary },
  pickerEmpty: { fontSize: 12, color: theme.colors.textMuted, paddingVertical: 8 },

  modeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  modeBtnActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  modeBtnTextActive: { color: theme.colors.primary },

  fileBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  fileBtnText: { flex: 1, fontSize: 13, color: theme.colors.textPrimary },

  bulkBlock: { marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  bulkSubject: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 8 },
  bulkInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: theme.colors.textPrimary, backgroundColor: theme.colors.card, marginBottom: 8 },

  statusRow: { flexDirection: 'row', gap: 12, backgroundColor: theme.colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  statusDate: { width: 84 },
  statusDateDay: { fontSize: 11, fontWeight: '800', color: theme.colors.primary },
  statusDateNum: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  statusNone: { fontSize: 12, color: theme.colors.textMuted, fontStyle: 'italic' },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  statusItemText: { flex: 1, fontSize: 12, color: theme.colors.textSecondary },
});

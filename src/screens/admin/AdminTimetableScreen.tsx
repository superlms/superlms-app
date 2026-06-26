import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { FormModal } from './AdminStandardScreen';
import {
  BuilderRow,
  SectionCard,
  TimetableLookups,
  TimetableStats,
  deleteTimetable,
  getTimetable,
  getTimetableBuilder,
  getTimetableLookups,
  getTimetableStats,
  saveTimetable,
} from '../../api/adminTimetableApi';

const DAYS = [1, 2, 3, 4, 5, 6];
const DAY_ABBR: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

const AdminTimetableScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState<TimetableStats | null>(null);
  const [lookups, setLookups] = useState<TimetableLookups | null>(null);
  const [view, setView] = useState<'class' | 'teacher'>('class');
  const [cards, setCards] = useState<SectionCard[]>([]);
  const [loading, setLoading] = useState(false);

  const [fClass, setFClass] = useState<number | null>(null);
  const [fSection, setFSection] = useState<number | null>(null);
  const [fTeacher, setFTeacher] = useState<number | null>(null);

  // builder
  const [builderOpen, setBuilderOpen] = useState(false);
  const [bClass, setBClass] = useState<number | null>(null);
  const [bSection, setBSection] = useState<number | null>(null);
  const [bRows, setBRows] = useState<BuilderRow[]>([]);
  const [bIsEdit, setBIsEdit] = useState(false);
  const [bLoading, setBLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // teacher picker
  const [pickerFor, setPickerFor] = useState<{ rowIdx: number; day: number } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const loadStats = useCallback(async () => { try { setStats(await getTimetableStats()); } catch {} }, []);
  useEffect(() => { loadStats(); getTimetableLookups().then(setLookups).catch(() => {}); }, [loadStats]);

  const loadCards = useCallback(async () => {
    const ready = view === 'class' ? fClass && fSection : fTeacher;
    if (!ready) { setCards([]); return; }
    setLoading(true);
    try {
      const res = await getTimetable({ view, standard_id: fClass, section_id: fSection, teacher_id: fTeacher });
      setCards(res.cards);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load timetable.')); }
    finally { setLoading(false); }
  }, [view, fClass, fSection, fTeacher]);

  useEffect(() => { loadCards(); }, [loadCards]);
  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadStats(), loadCards()]); });

  const sectionsFor = (cid: number | null) => lookups?.classes.find(c => c.id === cid)?.sections ?? [];
  const teacherName = (id: number | null) => lookups?.teachers.find(t => t.id === id)?.name ?? '';

  // ─── Builder ────────────────────────────────────────────────────────────────
  const openBuilder = (cid?: number, sid?: number) => {
    setBClass(cid ?? fClass ?? null);
    setBSection(null);
    setBRows([]);
    setBIsEdit(false);
    setBuilderOpen(true);
    if (cid && sid) loadBuilder(cid, sid);
  };
  const loadBuilder = async (cid: number, sid: number) => {
    setBClass(cid); setBSection(sid);
    setBLoading(true);
    try {
      const res = await getTimetableBuilder(cid, sid);
      setBRows(res.rows);
      setBIsEdit(res.is_edit);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load builder.')); }
    finally { setBLoading(false); }
  };
  const setRowTime = (idx: number, key: 'start_time' | 'end_time', v: string) =>
    setBRows(rows => rows.map((r, i) => i === idx ? { ...r, [key]: v } : r));
  const setDayTeacher = (idx: number, day: number, teacherId: number | null) =>
    setBRows(rows => rows.map((r, i) => i === idx ? { ...r, day_teachers: { ...r.day_teachers, [day]: teacherId } } : r));

  const saveBuilder = async () => {
    if (!bClass || !bSection) return Alert.alert('Required', 'Pick class and section.');
    setSaving(true);
    try {
      await saveTimetable({ standard_id: bClass, section_id: bSection, is_edit: bIsEdit, rows: bRows });
      setBuilderOpen(false);
      await Promise.all([loadStats(), loadCards()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save timetable.')); }
    finally { setSaving(false); }
  };

  const removeSection = (c: SectionCard) =>
    Alert.alert('Delete Timetable', `Remove ${c.standard} ${c.section} timetable?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteTimetable(c.standard_id, c.section_id!); await Promise.all([loadStats(), loadCards()]); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  const filteredTeachers = (lookups?.teachers ?? []).filter(t => t.name.toLowerCase().includes(pickerSearch.toLowerCase()));

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <View style={s.topbar}>
        <TouchableOpacity style={s.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Time Table</Text>
      </View>

      <View style={s.statRow}>
        {[
          { label: 'Schedules', value: stats?.schedules, color: '#0EA5E9' },
          { label: 'Teachers', value: stats?.teachers, color: '#8B5CF6' },
          { label: 'Subjects', value: stats?.subjects, color: '#22C55E' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.tabRow}>
        {(['class', 'teacher'] as const).map(t => {
          const active = view === t;
          return (
            <TouchableOpacity key={t} style={[s.tab, active && s.tabActive]} onPress={() => setView(t)} activeOpacity={0.8}>
              <Text style={[s.tabText, active && s.tabTextActive]}>{t === 'class' ? 'By Class' : 'By Teacher'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Filters */}
      {view === 'class' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
            {(lookups?.classes ?? []).map(c => (
              <TouchableOpacity key={c.id} style={[s.pchip, fClass === c.id && s.pchipActive]} onPress={() => { setFClass(c.id); setFSection(null); }}>
                <Text style={[s.pchipText, fClass === c.id && s.pchipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {!!fClass && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar2} contentContainerStyle={s.filterContent}>
              {sectionsFor(fClass).map(sec => (
                <TouchableOpacity key={sec.id} style={[s.pchip, fSection === sec.id && s.pchipActive]} onPress={() => setFSection(sec.id)}>
                  <Text style={[s.pchipText, fSection === sec.id && s.pchipTextActive]}>{sec.name}</Text>
                </TouchableOpacity>
              ))}
              {sectionsFor(fClass).length === 0 && <Text style={s.pickerEmpty}>No sections</Text>}
            </ScrollView>
          )}
        </>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
          {(lookups?.teachers ?? []).map(t => (
            <TouchableOpacity key={t.id} style={[s.pchip, fTeacher === t.id && s.pchipActive]} onPress={() => setFTeacher(t.id)}>
              <Text style={[s.pchipText, fTeacher === t.id && s.pchipTextActive]}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {cards.length === 0 && (
            <Text style={s.empty}>{view === 'class' ? 'Pick a class and section to view its timetable.' : 'Pick a teacher to view their timetable.'}</Text>
          )}
          {cards.map((c, ci) => (
            <View key={ci} style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.cardTitle}>{c.standard} · {c.section}</Text>
                {view === 'class' && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={s.act} onPress={() => openBuilder(c.standard_id, c.section_id ?? undefined)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>
                    <TouchableOpacity style={s.act} onPress={() => removeSection(c)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
                  </View>
                )}
              </View>
              {c.subject_groups.map((g, gi) => (
                <View key={gi} style={s.group}>
                  <View style={s.groupTop}>
                    <Text style={s.groupSubject}>{g.subject}</Text>
                    <Text style={s.groupTime}>{g.start_time}–{g.end_time}</Text>
                  </View>
                  <View style={s.daysRow}>
                    {DAYS.map(d => (
                      <View key={d} style={[s.dayBadge, g.days.includes(d) && s.dayBadgeOn]}>
                        <Text style={[s.dayBadgeText, g.days.includes(d) && s.dayBadgeTextOn]}>{DAY_ABBR[d]}</Text>
                      </View>
                    ))}
                  </View>
                  {g.teachers.map((t, ti) => (
                    <Text key={ti} style={s.teacherLine}>👤 {t.teacher_name} <Text style={s.teacherDays}>({t.days.map(d => DAY_ABBR[d]).join(', ')})</Text></Text>
                  ))}
                </View>
              ))}
            </View>
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={() => openBuilder()} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Builder */}
      <FormModal visible={builderOpen} title={bIsEdit ? 'Edit Timetable' : 'Create Timetable'} onClose={() => setBuilderOpen(false)} onSave={saveBuilder} saving={saving} saveLabel="Save">
        <Text style={s.fieldLabel}>Class</Text>
        <View style={s.wrapChips}>
          {(lookups?.classes ?? []).map(c => (
            <TouchableOpacity key={c.id} style={[s.selChip, bClass === c.id && s.selChipActive]} onPress={() => { setBClass(c.id); setBSection(null); setBRows([]); }}>
              <Text style={[s.selChipText, bClass === c.id && s.selChipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!!bClass && (
          <>
            <Text style={s.fieldLabel}>Section</Text>
            <View style={s.wrapChips}>
              {sectionsFor(bClass).map(sec => (
                <TouchableOpacity key={sec.id} style={[s.selChip, bSection === sec.id && s.selChipActive]} onPress={() => loadBuilder(bClass, sec.id)}>
                  <Text style={[s.selChipText, bSection === sec.id && s.selChipTextActive]}>{sec.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {bLoading ? (
          <View style={{ paddingVertical: 20 }}><ActivityIndicator color={theme.colors.primary} /></View>
        ) : bSection && bRows.length === 0 ? (
          <Text style={s.empty}>No subjects mapped to this section.</Text>
        ) : (
          bRows.map((r, idx) => (
            <View key={r.subject_id} style={s.subjBlock}>
              <Text style={s.subjName}>{r.subject_name}</Text>
              <View style={s.timeRow}>
                <TextInput style={s.timeInput} value={r.start_time} onChangeText={v => setRowTime(idx, 'start_time', v)} placeholder="09:00" placeholderTextColor={theme.colors.textMuted} />
                <Text style={s.timeSep}>to</Text>
                <TextInput style={s.timeInput} value={r.end_time} onChangeText={v => setRowTime(idx, 'end_time', v)} placeholder="10:00" placeholderTextColor={theme.colors.textMuted} />
              </View>
              <View style={s.dayGrid}>
                {DAYS.map(d => {
                  const tid = (r.day_teachers[d] ?? r.day_teachers[String(d)] ?? null) as number | null;
                  const on = !!tid;
                  return (
                    <TouchableOpacity key={d} style={[s.dayCell, on && s.dayCellOn]} onPress={() => { setPickerFor({ rowIdx: idx, day: d }); setPickerSearch(''); }} activeOpacity={0.8}>
                      <Text style={[s.dayCellDay, on && s.dayCellDayOn]}>{DAY_ABBR[d]}</Text>
                      <Text style={[s.dayCellTeacher, on && s.dayCellTeacherOn]} numberOfLines={1}>{on ? (teacherName(tid).split(' ')[0] || 'Set') : 'Tap'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </FormModal>

      {/* Teacher picker */}
      <Modal transparent visible={!!pickerFor} animationType="fade" onRequestClose={() => setPickerFor(null)}>
        <View style={s.overlay}>
          <View style={s.pickerCard}>
            <Text style={s.pickerTitle}>Select Teacher</Text>
            <View style={s.searchRow}>
              <VectorIcon iconSet="Ionicons" iconName="search" size={15} color={theme.colors.textMuted} />
              <TextInput style={s.searchInput} placeholder="Search teacher" placeholderTextColor={theme.colors.textMuted} value={pickerSearch} onChangeText={setPickerSearch} />
            </View>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={s.pickerRow} onPress={() => { if (pickerFor) setDayTeacher(pickerFor.rowIdx, pickerFor.day, null); setPickerFor(null); }}>
                <Text style={[s.pickerRowText, { color: theme.colors.danger }]}>None (clear)</Text>
              </TouchableOpacity>
              {filteredTeachers.map(t => (
                <TouchableOpacity key={t.id} style={s.pickerRow} onPress={() => { if (pickerFor) setDayTeacher(pickerFor.rowIdx, pickerFor.day, t.id); setPickerFor(null); }}>
                  <Text style={s.pickerRowText}>{t.name}</Text>
                </TouchableOpacity>
              ))}
              {filteredTeachers.length === 0 && <Text style={s.empty}>No teachers found.</Text>}
            </ScrollView>
            <TouchableOpacity style={s.pickerClose} onPress={() => setPickerFor(null)}><Text style={s.pickerCloseText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AdminTimetableScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, flex: 1 },

  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },

  filterBar: { maxHeight: 46, paddingLeft: 16, marginTop: 12 },
  filterBar2: { maxHeight: 46, paddingLeft: 16, marginTop: 4 },
  filterContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
  pchip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  pchipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pchipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  pchipTextActive: { color: '#fff' },
  pickerEmpty: { fontSize: 12, color: theme.colors.textMuted, paddingVertical: 8 },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 20 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary },
  act: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  group: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 10, marginTop: 6 },
  groupTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupSubject: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  groupTime: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  daysRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  dayBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: theme.colors.background },
  dayBadgeOn: { backgroundColor: theme.colors.primaryLight },
  dayBadgeText: { fontSize: 10, fontWeight: '700', color: theme.colors.textMuted },
  dayBadgeTextOn: { color: theme.colors.primary },
  teacherLine: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 6 },
  teacherDays: { color: theme.colors.textMuted, fontSize: 11 },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  selChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  selChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  selChipTextActive: { color: theme.colors.primary },

  subjBlock: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  subjName: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  timeInput: { width: 80, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: theme.colors.textPrimary, backgroundColor: theme.colors.card, textAlign: 'center' },
  timeSep: { fontSize: 12, color: theme.colors.textMuted },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  dayCell: { width: '31%', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card, paddingVertical: 7, paddingHorizontal: 6, alignItems: 'center' },
  dayCellOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  dayCellDay: { fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary },
  dayCellDayOn: { color: theme.colors.primary },
  dayCellTeacher: { fontSize: 10, color: theme.colors.textMuted, marginTop: 1 },
  dayCellTeacherOn: { color: theme.colors.primary, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  pickerCard: { width: '100%', maxWidth: 400, backgroundColor: theme.colors.card, borderRadius: 18, padding: 18 },
  pickerTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },
  pickerRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  pickerRowText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  pickerClose: { marginTop: 12, height: 44, borderRadius: 12, backgroundColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  pickerCloseText: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
});

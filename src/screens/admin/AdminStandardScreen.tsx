import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
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
import {
  AdminClass,
  AdminSection,
  AdminSubject,
  StandardStats,
  createClass,
  createSection,
  createSubject,
  deleteClass,
  deleteSection,
  deleteSubject,
  getClasses,
  getSections,
  getSubjects,
  updateClass,
  updateSection,
  updateSubject,
} from '../../api/adminStandardApi';

type Tab = 'classes' | 'sections' | 'subjects';
const TABS: { key: Tab; label: string }[] = [
  { key: 'classes', label: 'Classes' },
  { key: 'sections', label: 'Sections' },
  { key: 'subjects', label: 'Subjects' },
];

const AdminStandardScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<Tab>('classes');
  const [loading, setLoading] = useState(true);

  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [stats, setStats] = useState<StandardStats | null>(null);
  const [sections, setSections] = useState<AdminSection[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);

  // drill-down selection
  const [selClass, setSelClass] = useState<number | null>(null);
  const [selSection, setSelSection] = useState<number | null>(null);

  // class modal
  const [classModal, setClassModal] = useState(false);
  const [editClass, setEditClass] = useState<AdminClass | null>(null);
  const [cName, setCName] = useState('');
  const [cCode, setCCode] = useState('');
  const [cOrder, setCOrder] = useState('');
  const [cActive, setCActive] = useState(true);

  // section modal
  const [secModal, setSecModal] = useState(false);
  const [editSec, setEditSec] = useState<AdminSection | null>(null);
  const [sName, setSName] = useState('');
  const [sCode, setSCode] = useState('');
  const [sDesc, setSDesc] = useState('');
  const [sActive, setSActive] = useState(true);
  const [sClassId, setSClassId] = useState<number | null>(null);

  // subject modal
  const [subModal, setSubModal] = useState(false);
  const [editSub, setEditSub] = useState<AdminSubject | null>(null);
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subDesc, setSubDesc] = useState('');
  const [subActive, setSubActive] = useState(true);
  const [subMandatory, setSubMandatory] = useState(true);
  const [subClassId, setSubClassId] = useState<number | null>(null);
  const [subSectionIds, setSubSectionIds] = useState<number[]>([]);
  const [subModalSections, setSubModalSections] = useState<AdminSection[]>([]);

  const [saving, setSaving] = useState(false);

  const loadClasses = useCallback(async () => {
    const res = await getClasses();
    setClasses(res.standards);
    setStats(res.stats);
    return res.standards;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cls = await loadClasses();
      if (tab === 'sections') {
        const cid = selClass ?? cls[0]?.id ?? null;
        setSelClass(cid);
        if (cid) setSections((await getSections({ standard_id: cid })).sections);
        else setSections([]);
      }
      if (tab === 'subjects') {
        const cid = selClass ?? cls[0]?.id ?? null;
        setSelClass(cid);
        if (cid) {
          const secs = (await getSections({ standard_id: cid })).sections;
          setSections(secs);
          const sid = selSection ?? secs[0]?.id ?? null;
          setSelSection(sid);
          setSubjects(sid ? (await getSubjects({ section_id: sid })).subjects : []);
        } else {
          setSections([]);
          setSubjects([]);
        }
      }
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load data.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selClass, selSection, loadClasses]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const { refreshing, onRefresh } = useRefresh(load);

  const pickClass = async (cid: number) => {
    setSelClass(cid);
    setSelSection(null);
    setLoading(true);
    try {
      const secs = (await getSections({ standard_id: cid })).sections;
      setSections(secs);
      if (tab === 'subjects') {
        const sid = secs[0]?.id ?? null;
        setSelSection(sid);
        setSubjects(sid ? (await getSubjects({ section_id: sid })).subjects : []);
      }
    } finally {
      setLoading(false);
    }
  };

  const pickSection = async (sid: number) => {
    setSelSection(sid);
    setLoading(true);
    try {
      setSubjects((await getSubjects({ section_id: sid })).subjects);
    } finally {
      setLoading(false);
    }
  };

  // ─── Class CRUD ─────────────────────────────────────────────────────────────
  const openClass = (c?: AdminClass) => {
    setEditClass(c ?? null);
    setCName(c?.name ?? '');
    setCCode(c?.code ?? '');
    setCOrder(c?.order != null ? String(c.order) : '');
    setCActive(c?.is_active ?? true);
    setClassModal(true);
  };
  const saveClass = async () => {
    if (!cName.trim() || !cCode.trim()) return Alert.alert('Required', 'Name and code are required.');
    setSaving(true);
    try {
      const p = { name: cName.trim(), code: cCode.trim(), order: cOrder ? Number(cOrder) : undefined, is_active: cActive };
      if (editClass) await updateClass(editClass.id, p);
      else await createClass(p);
      setClassModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save class.'));
    } finally {
      setSaving(false);
    }
  };
  const removeClass = (c: AdminClass) =>
    Alert.alert('Delete Class', `Delete "${c.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteClass(c.id); await load(); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  // ─── Section CRUD ───────────────────────────────────────────────────────────
  const openSection = (s?: AdminSection) => {
    setEditSec(s ?? null);
    setSName(s?.name ?? '');
    setSCode(s?.code ?? '');
    setSDesc(s?.description ?? '');
    setSActive(s?.is_active ?? true);
    setSClassId(s?.standard_id ?? selClass ?? classes[0]?.id ?? null);
    setSecModal(true);
  };
  const saveSection = async () => {
    if (!sName.trim() || !sCode.trim() || !sClassId) return Alert.alert('Required', 'Name, code and class are required.');
    setSaving(true);
    try {
      const p = { name: sName.trim(), code: sCode.trim(), description: sDesc.trim(), standard_id: sClassId, is_active: sActive };
      if (editSec) await updateSection(editSec.id, p);
      else await createSection(p);
      setSecModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save section.'));
    } finally {
      setSaving(false);
    }
  };
  const removeSection = (s: AdminSection) =>
    Alert.alert('Delete Section', `Delete "${s.name}"? Its subjects will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteSection(s.id); await load(); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  // ─── Subject CRUD ───────────────────────────────────────────────────────────
  const openSubject = async (s?: AdminSubject) => {
    const cid = s?.standard_id ?? selClass ?? classes[0]?.id ?? null;
    setEditSub(s ?? null);
    setSubName(s?.name ?? '');
    setSubCode(s?.code ?? '');
    setSubDesc(s?.description ?? '');
    setSubActive(s?.is_active ?? true);
    setSubMandatory(s?.is_mandatory ?? true);
    setSubClassId(cid);
    setSubSectionIds(s?.section_ids ?? (selSection ? [selSection] : []));
    if (cid) setSubModalSections((await getSections({ standard_id: cid })).sections);
    setSubModal(true);
  };
  const onSubClassChange = async (cid: number) => {
    setSubClassId(cid);
    setSubSectionIds([]);
    setSubModalSections((await getSections({ standard_id: cid })).sections);
  };
  const toggleSubSection = (id: number) =>
    setSubSectionIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const saveSubject = async () => {
    if (!subName.trim() || !subCode.trim() || !subClassId || subSectionIds.length === 0)
      return Alert.alert('Required', 'Name, code, class and at least one section are required.');
    setSaving(true);
    try {
      const p = {
        name: subName.trim(), code: subCode.trim(), description: subDesc.trim(),
        standard_id: subClassId, section_ids: subSectionIds,
        is_mandatory: subMandatory, is_active: subActive,
      };
      if (editSub) await updateSubject(editSub.id, p);
      else await createSubject(p);
      setSubModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save subject.'));
    } finally {
      setSaving(false);
    }
  };
  const removeSubject = (s: AdminSubject) =>
    Alert.alert('Delete Subject', `Delete "${s.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteSubject(s.id); await load(); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  const className = (id?: number | null) => classes.find(c => c.id === id)?.name ?? '';

  const onFab = () => {
    if (tab === 'classes') openClass();
    else if (tab === 'sections') openSection();
    else openSubject();
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <View style={s.topbar}>
        <TouchableOpacity style={s.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Standards</Text>
      </View>

      {/* Stat row */}
      <View style={s.statRow}>
        {[
          { label: 'Classes', value: stats?.classes, color: '#F59E0B' },
          { label: 'Sections', value: stats?.sections, color: '#0EA5E9' },
          { label: 'Subjects', value: stats?.subjects, color: '#22C55E' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={[s.tab, active && s.tabActive]} onPress={() => setTab(t.key)} activeOpacity={0.8}>
              <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Class / Section pickers for drill-down */}
      {(tab === 'sections' || tab === 'subjects') && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pickerBar} contentContainerStyle={s.pickerContent}>
          {classes.map(c => {
            const active = selClass === c.id;
            return (
              <TouchableOpacity key={c.id} style={[s.pchip, active && s.pchipActive]} onPress={() => pickClass(c.id)} activeOpacity={0.8}>
                <Text style={[s.pchipText, active && s.pchipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      {tab === 'subjects' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pickerBar2} contentContainerStyle={s.pickerContent}>
          {sections.map(sec => {
            const active = selSection === sec.id;
            return (
              <TouchableOpacity key={sec.id} style={[s.pchip, active && s.pchipActive]} onPress={() => pickSection(sec.id)} activeOpacity={0.8}>
                <Text style={[s.pchipText, active && s.pchipTextActive]}>{sec.name}</Text>
              </TouchableOpacity>
            );
          })}
          {sections.length === 0 && <Text style={s.pickerEmpty}>No sections in this class</Text>}
        </ScrollView>
      )}

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

          {tab === 'classes' && classes.map(c => (
            <View key={c.id} style={s.card}>
              <View style={s.cardMain}>
                <View style={[s.avatar, { backgroundColor: '#F59E0B18' }]}>
                  <VectorIcon iconSet="Ionicons" iconName="book" size={20} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{c.name}</Text>
                  <Text style={s.cardSub}>Code {c.code}{c.board ? ` · ${c.board}` : ''}</Text>
                  <Text style={s.cardMeta}>{c.sections_count ?? 0} sections · {c.subjects_count ?? 0} subjects</Text>
                </View>
                {!c.is_active && <View style={s.inactiveTag}><Text style={s.inactiveTagText}>Inactive</Text></View>}
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.act} onPress={() => openClass(c)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={17} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => removeClass(c)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </View>
          ))}

          {tab === 'sections' && sections.map(sec => (
            <View key={sec.id} style={s.card}>
              <View style={s.cardMain}>
                <View style={[s.avatar, { backgroundColor: '#0EA5E918' }]}>
                  <VectorIcon iconSet="Ionicons" iconName="grid" size={20} color="#0EA5E9" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{sec.name}</Text>
                  <Text style={s.cardSub}>Code {sec.code} · {sec.standard_name ?? className(sec.standard_id)}</Text>
                  {!!sec.description && <Text style={s.cardMeta}>{sec.description}</Text>}
                </View>
                {!sec.is_active && <View style={s.inactiveTag}><Text style={s.inactiveTagText}>Inactive</Text></View>}
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.act} onPress={() => openSection(sec)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={17} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => removeSection(sec)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </View>
          ))}

          {tab === 'subjects' && subjects.map(sub => (
            <View key={sub.id} style={s.card}>
              <View style={s.cardMain}>
                <View style={[s.avatar, { backgroundColor: '#22C55E18' }]}>
                  <VectorIcon iconSet="Ionicons" iconName="library" size={20} color="#22C55E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{sub.name}</Text>
                  <Text style={s.cardSub}>Code {sub.code}{sub.is_mandatory != null ? ` · ${sub.is_mandatory ? 'Mandatory' : 'Optional'}` : ''}</Text>
                  {!!sub.sections && <Text style={s.cardMeta}>Sections: {sub.sections}</Text>}
                </View>
                {!sub.is_active && <View style={s.inactiveTag}><Text style={s.inactiveTagText}>Inactive</Text></View>}
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.act} onPress={() => openSubject(sub)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={17} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => removeSubject(sub)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </View>
          ))}

          {((tab === 'classes' && classes.length === 0) ||
            (tab === 'sections' && sections.length === 0) ||
            (tab === 'subjects' && subjects.length === 0)) && (
            <Text style={s.empty}>Nothing here yet. Tap + to add.</Text>
          )}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={onFab} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Class modal */}
      <FormModal visible={classModal} title={editClass ? 'Edit Class' : 'New Class'}
        onClose={() => setClassModal(false)} onSave={saveClass} saving={saving} saveLabel={editClass ? 'Update' : 'Create'}>
        <Field label="Class Name" value={cName} onChangeText={setCName} placeholder="e.g. Class 10" />
        <Field label="Class Code" value={cCode} onChangeText={setCCode} placeholder="e.g. 10" />
        <Field label="Display Order" value={cOrder} onChangeText={setCOrder} placeholder="0" keyboardType="number-pad" />
        <ToggleRow label="Active" value={cActive} onValueChange={setCActive} />
      </FormModal>

      {/* Section modal */}
      <FormModal visible={secModal} title={editSec ? 'Edit Section' : 'New Section'}
        onClose={() => setSecModal(false)} onSave={saveSection} saving={saving} saveLabel={editSec ? 'Update' : 'Create'}>
        <Text style={s.fieldLabel}>Class</Text>
        <ChipPicker items={classes.map(c => ({ id: c.id, label: c.name }))} selected={sClassId ? [sClassId] : []} onToggle={(id: number) => setSClassId(id)} />
        <Field label="Section Name" value={sName} onChangeText={setSName} placeholder="e.g. A" />
        <Field label="Section Code" value={sCode} onChangeText={setSCode} placeholder="e.g. A" />
        <Field label="Description" value={sDesc} onChangeText={setSDesc} placeholder="Optional" multiline />
        <ToggleRow label="Active" value={sActive} onValueChange={setSActive} />
      </FormModal>

      {/* Subject modal */}
      <FormModal visible={subModal} title={editSub ? 'Edit Subject' : 'New Subject'}
        onClose={() => setSubModal(false)} onSave={saveSubject} saving={saving} saveLabel={editSub ? 'Update' : 'Create'}>
        <Field label="Subject Name" value={subName} onChangeText={setSubName} placeholder="e.g. Mathematics" />
        <Field label="Subject Code" value={subCode} onChangeText={setSubCode} placeholder="e.g. MATH" />
        <Field label="Description" value={subDesc} onChangeText={setSubDesc} placeholder="Optional" multiline />
        <Text style={s.fieldLabel}>Class</Text>
        <ChipPicker items={classes.map(c => ({ id: c.id, label: c.name }))} selected={subClassId ? [subClassId] : []} onToggle={onSubClassChange} />
        <Text style={s.fieldLabel}>Sections (select one or more)</Text>
        <ChipPicker multi items={subModalSections.map(x => ({ id: x.id, label: x.name }))} selected={subSectionIds} onToggle={toggleSubSection} />
        <ToggleRow label="Mandatory" value={subMandatory} onValueChange={setSubMandatory} />
        <ToggleRow label="Active" value={subActive} onValueChange={setSubActive} />
      </FormModal>
    </View>
  );
};

// ─── Reusable bits (kept in-file so admin screens stay consistent) ─────────────
export const FormModal = ({ visible, title, onClose, onSave, saving, saveLabel, children }: any) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.modalCard}>
        <Text style={s.modalTitle}>{title}</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        <View style={s.modalActions}>
          <TouchableOpacity style={[s.mbtn, s.mbtnGhost]} onPress={onClose} activeOpacity={0.85}><Text style={s.mbtnGhostText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[s.mbtn, s.mbtnPrimary]} onPress={onSave} disabled={saving} activeOpacity={0.9}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.mbtnPrimaryText}>{saveLabel}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

export const Field = ({ label, multiline, ...props }: any) => (
  <View style={{ marginTop: 12 }}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput
      style={[s.input, multiline && s.inputMultiline]}
      placeholderTextColor={theme.colors.textMuted}
      multiline={multiline}
      {...props}
    />
  </View>
);

export const ToggleRow = ({ label, value, onValueChange }: any) => (
  <View style={s.toggleRow}>
    <Text style={s.toggleLabel}>{label}</Text>
    <Switch value={value} onValueChange={onValueChange}
      trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor="#fff" />
  </View>
);

export const ChipPicker = ({ items, selected, onToggle, multi }: any) => (
  <View style={s.chipPicker}>
    {items.length === 0 && <Text style={s.pickerEmpty}>No options</Text>}
    {items.map((it: any) => {
      const active = selected.includes(it.id);
      return (
        <TouchableOpacity key={it.id} style={[s.selChip, active && s.selChipActive]} onPress={() => onToggle(it.id)} activeOpacity={0.8}>
          {multi && <VectorIcon iconSet="Ionicons" iconName={active ? 'checkbox' : 'square-outline'} size={14} color={active ? theme.colors.primary : theme.colors.textMuted} />}
          <Text style={[s.selChipText, active && s.selChipTextActive]}>{it.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

export default AdminStandardScreen;

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

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },

  pickerBar: { maxHeight: 44, paddingLeft: 16 },
  pickerBar2: { maxHeight: 44, paddingLeft: 16, marginTop: 4 },
  pickerContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
  pchip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  pchipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pchipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  pchipTextActive: { color: '#fff' },
  pickerEmpty: { fontSize: 12, color: theme.colors.textMuted, paddingVertical: 8 },

  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },
  inactiveTag: { backgroundColor: '#FEE2E2', borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  inactiveTagText: { fontSize: 10, fontWeight: '800', color: theme.colors.danger },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  act: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 460, maxHeight: '88%', backgroundColor: theme.colors.card, borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  mbtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mbtnGhost: { backgroundColor: theme.colors.border },
  mbtnGhostText: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  mbtnPrimary: { backgroundColor: theme.colors.primary },
  mbtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.background },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  chipPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  selChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  selChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  selChipTextActive: { color: theme.colors.primary },
});

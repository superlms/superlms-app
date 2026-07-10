import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import ListRow from '../../components/ListRow';
import Select from '../../components/Select';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AdminClass,
  AdminSection,
  AdminSubject,
  StandardStats,
  getClasses,
  getSections,
  getSubjects,
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
        setSections(cid ? (await getSections({ standard_id: cid })).sections : []);
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

  // Reload when returning from the detail / form screens (the first focus is
  // already covered by the tab effect above, so skip it).
  const loadRef = useRef(load);
  loadRef.current = load;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      loadRef.current();
    }, []),
  );

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

  const className = (id?: number | null) => classes.find(c => c.id === id)?.name ?? '';

  const onFab = () => {
    if (tab === 'classes') navigation.navigate('AdminStandardForm', { type: 'class' });
    else if (tab === 'sections') navigation.navigate('AdminStandardForm', { type: 'section', presetClassId: selClass });
    else navigation.navigate('AdminStandardForm', { type: 'subject', presetClassId: selClass, presetSectionId: selSection });
  };

  const openDetail = (type: 'class' | 'section' | 'subject', item: any) =>
    navigation.navigate('AdminStandardDetail', { type, item });

  const analytics = [
    { label: 'Classes', value: stats?.classes, icon: 'book', color: '#F59E0B' },
    { label: 'Sections', value: stats?.sections, icon: 'grid', color: '#0EA5E9' },
    { label: 'Subjects', value: stats?.subjects, icon: 'library', color: '#22C55E' },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="Standards"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

      {/* Analytics */}
      <View style={s.analytics}>
        {analytics.map(a => (
          <View key={a.label} style={s.aCard}>
            <View style={[s.aIconWrap, { backgroundColor: a.color + '18' }]}>
              <VectorIcon iconSet="Ionicons" iconName={a.icon} size={17} color={a.color} />
            </View>
            <Text style={[s.aVal, { color: a.color }]}>{a.value ?? '—'}</Text>
            <Text style={s.aLbl}>{a.label}</Text>
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

      {/* Class / Section dropdown filters for drill-down */}
      {tab === 'sections' && (
        <View style={s.filterRow}>
          <View style={{ flex: 1 }}>
            <Select placeholder="Select class" value={selClass}
              options={classes.map(c => ({ label: c.name, value: c.id }))}
              onChange={(v) => pickClass(Number(v))} />
          </View>
        </View>
      )}
      {tab === 'subjects' && (
        <View style={s.filterRow}>
          <View style={{ flex: 1 }}>
            <Select placeholder="Class" value={selClass}
              options={classes.map(c => ({ label: c.name, value: c.id }))}
              onChange={(v) => pickClass(Number(v))} />
          </View>
          <View style={{ flex: 1 }}>
            <Select placeholder="Section" value={selSection}
              options={sections.map(sec => ({ label: sec.name, value: sec.id }))}
              onChange={(v) => pickSection(Number(v))} disabled={!selClass || sections.length === 0} />
          </View>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

          {tab === 'classes' && classes.map(c => (
            <ListRow
              key={c.id}
              color="#F59E0B"
              title={c.name}
              subtitle={`Code ${c.code}${c.board ? ` · ${c.board}` : ''}`}
              metaIcon="grid-outline"
              meta={`${c.sections_count ?? 0} sec · ${c.subjects_count ?? 0} sub`}
              tag={c.is_active ? 'Active' : 'Inactive'}
              tagColor={c.is_active ? '#22C55E' : '#EF4444'}
              onPress={() => openDetail('class', c)}
            />
          ))}

          {tab === 'sections' && sections.map(sec => (
            <ListRow
              key={sec.id}
              color="#0EA5E9"
              title={sec.name}
              subtitle={`Code ${sec.code}`}
              metaIcon="book-outline"
              meta={sec.standard_name ?? className(sec.standard_id)}
              tag={sec.is_active ? 'Active' : 'Inactive'}
              tagColor={sec.is_active ? '#22C55E' : '#EF4444'}
              onPress={() => openDetail('section', sec)}
            />
          ))}

          {tab === 'subjects' && subjects.map(sub => (
            <ListRow
              key={sub.id}
              color="#22C55E"
              title={sub.name}
              subtitle={`Code ${sub.code}`}
              metaIcon="pricetag-outline"
              meta={sub.is_mandatory != null ? (sub.is_mandatory ? 'Mandatory' : 'Optional') : undefined}
              tag={sub.is_active ? 'Active' : 'Inactive'}
              tagColor={sub.is_active ? '#22C55E' : '#EF4444'}
              onPress={() => openDetail('subject', sub)}
            />
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

  // Analytics
  analytics: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  aCard: { flex: 1, alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 14 },
  aIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  aVal: { fontSize: 20, fontWeight: '900' },
  aLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', marginTop: 2 },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },

  filterRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: -4 },
  pickerEmpty: { fontSize: 12, color: theme.colors.textMuted, paddingVertical: 8 },

  scroll: { paddingHorizontal: 16, paddingTop: 10 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 },

  // Compact card — tap opens the detail screen.
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.card, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  avatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  inactiveTag: { backgroundColor: '#FEE2E2', borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  inactiveTagText: { fontSize: 10, fontWeight: '800', color: theme.colors.danger },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  // Shared modal/form styles (used by the exported FormModal / Field / ToggleRow / ChipPicker).
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AdminClass,
  AdminSection,
  AdminSubject,
  LookupClass,
  getAcademicLookups,
  getClasses,
  getSections,
  getSubjects,
} from '../../api/adminStandardApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { SubjectIcon } from '../subjects/subjectIcon';
import { OptionSheet } from './adminFormUi';
import { ErrorBox, ListSkeleton } from './adminTransportUi';

/**
 * Standards — the admin panel's Academic Structure, drawn as the app's own
 * lists are. The classes come first; a class opens onto its sections and a
 * section onto its subjects, the way the panel drills in — by tapping the row
 * or the arrow at its end, with a red dot before it for an inactive one. Back
 * steps out a level. The eye on a row opens it on its own page, with Edit and
 * Delete. The + asks what to add — a class, a section or a subject — and opens
 * its form with what is picked filled in.
 */

// The level on show: the classes, one class's sections or one section's subjects.
type Tab = 'classes' | 'sections' | 'subjects';

const ADD: { key: string; label: string; sub: string }[] = [
  { key: 'class', label: 'Class', sub: 'A class, its code and display order' },
  { key: 'section', label: 'Section', sub: 'A section of a class' },
  { key: 'subject', label: 'Subject', sub: 'A subject, in the sections of a class' },
];

// "A, B, C…" — the first three sections, as the panel's list shows them.
const sectionLine = (names?: string[] | null) => {
  if (!names || names.length === 0) return 'No sections';
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown}…` : shown;
};

//  [▣]  Class 10 (10)                              (eye)  ● ›   (● only when inactive)
//       A, B, C…
const Row = ({
  lead,
  title,
  sub,
  meta,
  inactive,
  onPress,
  onInfo,
  onOpen,
  isLast,
}: {
  lead: React.ReactNode;
  title: string;
  sub?: string | null;
  meta?: string | null;
  inactive?: boolean;
  onPress: () => void;
  onInfo?: () => void;
  /** Opens what is inside it (a class's sections, a section's subjects). */
  onOpen?: () => void;
  isLast: boolean;
}) => (
  <TouchableOpacity style={[st.row, !isLast && st.rowDivider]} activeOpacity={0.6} onPress={onPress}>
    {lead}
    <View style={st.rowBody}>
      <Text style={[st.rowTitle, inactive && st.muted]} numberOfLines={1}>
        {title}
      </Text>
      {!!sub && (
        <Text style={st.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      )}
      {!!meta && (
        <Text style={st.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
      )}
    </View>
    {inactive && !onOpen && <Text style={st.inactive}>Inactive</Text>}
    {onInfo ? (
      <TouchableOpacity hitSlop={10} activeOpacity={0.6} onPress={onInfo} accessibilityLabel={`View ${title}`}>
        <VectorIcon iconSet="Ionicons" iconName="eye-outline" size={20} color={theme.colors.textMuted} />
      </TouchableOpacity>
    ) : (
      !onOpen && <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={15} color={theme.colors.textMuted} />
    )}
    {onOpen && (
      <View style={st.open}>
        {/* A red dot for an inactive one */}
        {inactive && <View style={st.dot} accessibilityLabel="Inactive" />}
        <TouchableOpacity hitSlop={10} activeOpacity={0.6} onPress={onOpen} accessibilityLabel={`Open ${title}`}>
          <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    )}
  </TouchableOpacity>
);

const Lead = ({ icon }: { icon: string }) => (
  <View style={st.lead}>
    <VectorIcon iconSet="Ionicons" iconName={icon} size={20} color={theme.colors.textSecondary} />
  </View>
);

const AdminStandardScreen = ({ navigation, route }: any) => {
  const [tab, setTab] = useState<Tab>('classes');
  const [lookups, setLookups] = useState<LookupClass[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);

  const [classes, setClasses] = useState<AdminClass[] | null>(null);
  const [sections, setSections] = useState<AdminSection[] | null>(null);
  const [subjects, setSubjects] = useState<AdminSubject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<null | 'add'>(null);
  const seq = useRef(0);

  const loadLookups = useCallback(() => {
    getAcademicLookups()
      .then(r => setLookups(r.classes ?? []))
      .catch(() => {});
  }, []);
  useEffect(loadLookups, [loadLookups]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      if (tab === 'classes') {
        const r = await getClasses();
        if (mine === seq.current) setClasses(r.standards);
      } else if (tab === 'sections') {
        // The panel lists sections of one class.
        const r = classId ? (await getSections({ standard_id: classId })).sections : [];
        if (mine === seq.current) setSections(r);
      } else {
        // …and subjects of one section.
        const r = sectionId
          ? (await getSubjects({ section_id: sectionId, standard_id: classId ?? undefined })).subjects
          : [];
        if (mine === seq.current) setSubjects(r);
      }
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [tab, classId, sectionId]);

  useEffect(() => {
    load();
  }, [load]);

  // Back from a form or a page, the lists (and the pickers) are fresh.
  const loaded = useRef(false);
  useFocusLoad(() => {
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    loadLookups();
    load();
  });

  // A class's or section's page can drill in, as its row does.
  useEffect(() => {
    const drill = route?.params?.drill;
    if (!drill) return;
    navigation.setParams({ drill: undefined });
    if (drill.tab === 'sections') openClass(drill.classId);
    else if (drill.tab === 'subjects') openSection(drill.classId, drill.sectionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.drill]);

  const openClass = (id: number) => {
    setTab('sections');
    setClassId(id);
    setSectionId(null);
    setSections(null);
  };

  const openSection = (cid: number, sid: number) => {
    setTab('subjects');
    setClassId(cid);
    setSectionId(sid);
    setSubjects(null);
  };

  // With no tabs to go back by, back steps out a level: a section's subjects
  // to its class's sections, those to the classes, and the classes away.
  const goUp = () => {
    if (tab === 'subjects' && classId) {
      openClass(classId);
    } else if (tab !== 'classes') {
      setTab('classes');
      setClassId(null);
      setSectionId(null);
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('PanelHome');
    }
  };

  // The phone's back button does the same while a class or section is open.
  useFocusEffect(
    useCallback(() => {
      if (tab === 'classes') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goUp();
        return true;
      });
      return () => sub.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, classId]),
  );

  const detail = (type: 'class' | 'section' | 'subject', item: any) =>
    navigation.navigate('AdminStandardDetail', { type, item, fromClassId: type === 'subject' ? classId : undefined });

  const add = (type: string) => {
    if (type === 'class') navigation.navigate('AdminStandardForm', { type });
    else if (type === 'section') navigation.navigate('AdminStandardForm', { type, presetClassId: classId ?? undefined });
    else navigation.navigate('AdminStandardForm', { type, presetClassId: classId ?? undefined, presetSectionId: sectionId ?? undefined });
  };

  const cls = lookups.find(c => c.id === classId) ?? null;

  const list = tab === 'classes' ? classes : tab === 'sections' ? sections : subjects;
  const waiting = (tab === 'sections' && !classId) || (tab === 'subjects' && !sectionId);

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isLast = index === (list?.length ?? 0) - 1;
    if (tab === 'classes') {
      const c = item as AdminClass;
      return (
        <Row
          lead={<Lead icon="school-outline" />}
          title={c.code ? `${c.name} (${c.code})` : c.name}
          sub={sectionLine(c.section_names)}
          meta={c.board || null}
          inactive={!c.is_active}
          onPress={() => openClass(c.id)}
          onInfo={() => detail('class', c)}
          onOpen={() => openClass(c.id)}
          isLast={isLast}
        />
      );
    }
    if (tab === 'sections') {
      const x = item as AdminSection;
      return (
        <Row
          lead={<Lead icon="grid-outline" />}
          title={x.name}
          sub={x.standard_name ?? cls?.name ?? null}
          meta={x.subjects_count != null ? `${x.subjects_count} ${x.subjects_count === 1 ? 'subject' : 'subjects'}` : null}
          inactive={!x.is_active}
          onPress={() => openSection(x.standard_id, x.id)}
          onInfo={() => detail('section', x)}
          onOpen={() => openSection(x.standard_id, x.id)}
          isLast={isLast}
        />
      );
    }
    const sj = item as AdminSubject;
    return (
      <Row
        lead={<SubjectIcon image={sj.image_url} size={40} />}
        title={sj.name}
        sub={[sj.code, sj.standard_name, sj.sections].filter(Boolean).join(' · ')}
        meta={sj.is_mandatory == null ? null : sj.is_mandatory ? 'Mandatory' : 'Optional'}
        inactive={!sj.is_active}
        onPress={() => detail('subject', sj)}
        isLast={isLast}
      />
    );
  };

  const empty = () => {
    if (tab === 'classes') {
      return (
        <DocNoData
          icon="school-outline"
          title="No classes found"
          subtitle="You haven’t added any classes yet — add one with +."
        />
      );
    }
    if (tab === 'sections') {
      return (
        <DocNoData
          icon="grid-outline"
          title="No sections in this class"
          subtitle="Add one with + and choose Section."
        />
      );
    }
    return (
      <DocNoData
        icon="library-outline"
        title="No subjects in this section"
        subtitle="Add one with + and choose Subject."
      />
    );
  };

  return (
    <View style={st.root}>
      <DocHeader
        title={tab === 'sections' ? 'Sections' : tab === 'subjects' ? 'Subjects' : 'Standards'}
        onBackPress={goUp}
        rightIcon="add"
        onRightPress={() => setSheet('add')}
      />
      {waiting ? (
        tab === 'sections' ? (
          <DocNoData icon="grid-outline" title="Select a class to view sections" subtitle="Go back and tap a class." />
        ) : (
          <DocNoData icon="library-outline" title="Select a section to view subjects" subtitle="Go back and tap a section." />
        )
      ) : error && !list ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !list ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={list as any[]}
          keyExtractor={(x: any) => `${tab}-${x.id}`}
          renderItem={renderItem}
          ListEmptyComponent={empty()}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLookups(); load(); }} />}
          contentContainerStyle={st.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      <OptionSheet
        visible={sheet === 'add'}
        title="What would you like to add?"
        options={ADD}
        selected={[]}
        onPick={k => {
          setSheet(null);
          add(k);
        }}
        onClose={() => setSheet(null)}
      />
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

const __mk_st = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingBottom: 40 },
  muted: { color: theme.colors.textMuted },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  lead: { width: 40, alignItems: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowSub: { fontSize: 13, color: theme.colors.textSecondary },
  rowMeta: { fontSize: 12, color: theme.colors.textMuted },
  inactive: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  open: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.colors.danger },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let st = __mk_st();
onThemeChange(() => { st = __mk_st(); });

// The shared modal / form pieces above (FormModal, Field, ToggleRow, ChipPicker),
// which other admin screens import from here.
const s = StyleSheet.create({
  pickerEmpty: { fontSize: 12, color: theme.colors.textMuted, paddingVertical: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 460, maxHeight: '88%', backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 24 },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  mbtn: { flex: 1, height: 46, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  mbtnGhost: { borderWidth: 1, borderColor: theme.colors.border },
  mbtnGhostText: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  mbtnPrimary: { backgroundColor: theme.colors.primary },
  mbtnPrimaryText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
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

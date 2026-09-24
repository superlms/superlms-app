import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { StudentLookups, exportStudents } from '../../api/adminStudentApi';

/**
 * Export, as the panel asks it — in the sheet the account switcher uses: Excel
 * or PDF, and every student or one class. Class wise lists the classes in the
 * same sheet to pick from (and, for a class with more than one section, one
 * section or the whole class); Export saves the file to the phone's Downloads.
 */

type Format = 'xlsx' | 'pdf';
type Scope = 'all' | 'class';
type Mode = 'main' | 'class' | 'section';

const FORMATS: { key: Format; title: string; sub: string; icon: string }[] = [
  { key: 'xlsx', title: 'Excel', sub: 'A sheet with every field, attendance and fees', icon: 'grid-outline' },
  { key: 'pdf', title: 'PDF', sub: 'A record card per student, class by class', icon: 'document-text-outline' },
];

const SCOPES: { key: Scope; title: string; sub: string; icon: string }[] = [
  { key: 'all', title: 'All students', sub: 'Every class of the school', icon: 'people-outline' },
  { key: 'class', title: 'Class wise', sub: 'One class, or one section of it', icon: 'school-outline' },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// One choice: its icon, title and line, and a tick or a chevron.
const Option = ({
  icon,
  title,
  sub,
  on,
  onPress,
  arrow,
  last,
}: {
  icon: string;
  title: string;
  sub?: string;
  on?: boolean;
  onPress: () => void;
  arrow?: boolean;
  last?: boolean;
}) => (
  <TouchableOpacity style={[s.row, !last && s.rowDivider]} activeOpacity={0.6} onPress={onPress}>
    <View style={[s.tile, on && s.tileOn]}>
      <VectorIcon iconSet="Ionicons" iconName={icon} size={18} color={on ? theme.colors.primary : theme.colors.textSecondary} />
    </View>
    <View style={s.rowMain}>
      <Text style={[s.rowTitle, on && s.rowTitleOn]} numberOfLines={1}>{title}</Text>
      {!!sub && <Text style={s.rowSub} numberOfLines={1}>{sub}</Text>}
    </View>
    {arrow ? (
      <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
    ) : on ? (
      <VectorIcon iconSet="Ionicons" iconName="checkmark-circle" size={22} color={theme.colors.primary} />
    ) : (
      <View style={s.radio} />
    )}
  </TouchableOpacity>
);

const StudentExportSheet = ({
  visible,
  onClose,
  lookups,
}: {
  visible: boolean;
  onClose: () => void;
  lookups: StudentLookups | null;
}) => {
  const contextInsets = useSafeAreaInsets();
  const insets = {
    top: Math.max(contextInsets.top, initialWindowMetrics?.insets.top ?? 0),
    bottom: Math.max(contextInsets.bottom, initialWindowMetrics?.insets.bottom ?? 0),
  };

  const [mode, setMode] = useState<Mode>('main');
  const [format, setFormat] = useState<Format>('xlsx');
  const [scope, setScope] = useState<Scope>('all');
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Each opening starts on the first page.
  useEffect(() => {
    if (visible) setMode('main');
  }, [visible]);

  const classes = lookups?.classes ?? [];
  const cls = classes.find(c => c.id === classId) ?? null;
  const sections = (lookups?.sections ?? []).filter(x => x.standard_id === classId);
  const sec = sections.find(x => x.id === sectionId) ?? null;

  const pickScope = (k: Scope) => {
    setScope(k);
    // Class wise opens the classes straight away when none is chosen yet.
    if (k === 'class' && !classId) setMode('class');
  };

  const run = async () => {
    if (scope === 'class' && !cls) {
      setMode('class');
      return;
    }
    const what = scope === 'class' && cls ? slug(`${cls.name} ${sec?.name ?? ''}`) : 'all';
    setBusy(true);
    try {
      const name = await exportStudents({
        format,
        classId: scope === 'class' ? classId : null,
        sectionId: scope === 'class' ? sectionId : null,
        fileName: `students_${what}_${moment().format('YYYY-MM-DD')}`,
      });
      onClose();
      AppAlert.alert('Exported', `${name} is saved in your Downloads.`);
    } catch (e) {
      AppAlert.alert('Export failed', apiErr(e, 'Could not export the students.'));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'class' ? 'Choose a class' : mode === 'section' ? `Choose a section · ${cls?.name ?? ''}` : 'Export Students';

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => (mode === 'main' ? onClose() : setMode('main'))}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.statusStrip, { height: insets.top }]} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.handle} />

          <View style={s.header}>
            {mode !== 'main' && (
              <TouchableOpacity onPress={() => setMode('main')} hitSlop={10} activeOpacity={0.6} style={s.back}>
                <VectorIcon iconSet="Ionicons" iconName="chevron-back" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            )}
            <Text style={s.title} numberOfLines={1}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} activeOpacity={0.6}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={22} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {mode === 'main' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
              <Text style={s.label}>FORMAT</Text>
              {FORMATS.map((f, i) => (
                <Option key={f.key} icon={f.icon} title={f.title} sub={f.sub} on={format === f.key} onPress={() => setFormat(f.key)} last={i === FORMATS.length - 1} />
              ))}

              <Text style={[s.label, s.labelGap]}>STUDENTS</Text>
              {SCOPES.map((o, i) => (
                <Option key={o.key} icon={o.icon} title={o.title} sub={o.sub} on={scope === o.key} onPress={() => pickScope(o.key)} last={i === SCOPES.length - 1 && scope !== 'class'} />
              ))}
              {scope === 'class' && (
                <>
                  <Option
                    icon="albums-outline"
                    title={cls ? cls.name : 'Choose a class'}
                    sub={cls ? `${cls.students ?? 0} students · tap to change` : 'Which class to export'}
                    onPress={() => setMode('class')}
                    arrow
                    last={sections.length <= 1}
                  />
                  {!!cls && sections.length > 1 && (
                    <Option
                      icon="grid-outline"
                      title={sec ? `Section ${sec.name}` : 'Whole class'}
                      sub="Tap to choose one section"
                      onPress={() => setMode('section')}
                      arrow
                      last
                    />
                  )}
                </>
              )}

              <TouchableOpacity style={[s.exportBtn, busy && s.exportBusy]} activeOpacity={0.85} onPress={run} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <>
                    <VectorIcon iconSet="Ionicons" iconName="download-outline" size={18} color={theme.colors.white} />
                    <Text style={s.exportText}>Export {format === 'pdf' ? 'PDF' : 'Excel'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          ) : mode === 'class' ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
              {classes.length === 0 && <Text style={s.empty}>No classes yet.</Text>}
              {classes.map((c, i) => (
                <Option
                  key={c.id}
                  icon="school-outline"
                  title={c.name}
                  sub={`${c.students ?? 0} students`}
                  on={c.id === classId}
                  onPress={() => {
                    setClassId(c.id);
                    setSectionId(null);
                    setScope('class');
                    setMode('main');
                  }}
                  last={i === classes.length - 1}
                />
              ))}
            </ScrollView>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
              <Option
                icon="albums-outline"
                title="Whole class"
                sub={`${cls?.students ?? 0} students`}
                on={!sectionId}
                onPress={() => { setSectionId(null); setMode('main'); }}
              />
              {sections.map((x, i) => (
                <Option
                  key={x.id}
                  icon="grid-outline"
                  title={`Section ${x.name}`}
                  sub={`${x.students ?? 0} students`}
                  on={x.id === sectionId}
                  onPress={() => { setSectionId(x.id); setMode('main'); }}
                  last={i === sections.length - 1}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default StudentExportSheet;

const __mk_s = () => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  statusStrip: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: theme.colors.statusBar },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    maxHeight: '85%',
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginTop: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  back: { marginLeft: -4 },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },

  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted, marginTop: 4, marginBottom: 2 },
  labelGap: { marginTop: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  tileOn: { backgroundColor: theme.colors.primaryLight },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowTitleOn: { fontWeight: '600' },
  rowSub: { fontSize: 12, color: theme.colors.textMuted },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: theme.colors.border },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 20 },

  exportBtn: {
    flexDirection: 'row',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  exportBusy: { opacity: 0.7 },
  exportText: { fontSize: 15, fontWeight: '700', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

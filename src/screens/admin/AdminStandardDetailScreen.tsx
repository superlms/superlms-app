import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  deleteClass,
  deleteSection,
  deleteSubject,
  getClasses,
  getSections,
  getSubjects,
} from '../../api/adminStandardApi';
import { DocHeader } from '../more/docUi';
import { SubjectIcon } from '../subjects/subjectIcon';
import { confirmDestructive } from './adminFormUi';
import { InfoRow } from './adminTransportUi';

/**
 * One class, section or subject on its own page — the panel's View: what it
 * is and where it sits, its counts, and when it was made. A class opens onto
 * its sections and a section onto its subjects from here too. The pencil
 * edits it; Delete, beside it in the header, asks first, and the server says
 * no, as the panel does, to a class or section with students in it (they are
 * moved first), to a class that still has sections — which the page itself
 * refuses before asking — and to a subject the timetable or assignments use.
 */

type StdType = 'class' | 'section' | 'subject';
const TITLES: Record<StdType, string> = { class: 'Class', section: 'Section', subject: 'Subject' };
// What the header says.
const HEADS: Record<StdType, string> = { class: 'Standard Detail', section: 'Section Detail', subject: 'Subject Detail' };
const ICONS: Record<StdType, string> = { class: 'school-outline', section: 'grid-outline', subject: 'library-outline' };

const when = (iso?: string | null) => (iso ? moment(iso).format('DD MMM YYYY, h:mm A') : null);

const AdminStandardDetailScreen = ({ navigation, route }: any) => {
  const type: StdType = route?.params?.type ?? 'class';
  const fromClassId: number | undefined = route?.params?.fromClassId ?? undefined;
  const [item, setItem] = useState<any>(route?.params?.item ?? null);
  const [busy, setBusy] = useState(false);

  // Back from its form, the page shows what was saved.
  const refresh = useCallback(async () => {
    if (!item?.id) return;
    try {
      let found: any = null;
      if (type === 'class') {
        found = (await getClasses()).standards.find((x: any) => x.id === item.id);
      } else if (type === 'section') {
        found = (await getSections({ standard_id: item.standard_id })).sections.find((x: any) => x.id === item.id);
      } else {
        found = (await getSubjects({ standard_id: fromClassId ?? item.standard_id })).subjects.find((x: any) => x.id === item.id);
      }
      if (found) setItem(found);
    } catch {
      // keep what was passed
    }
  }, [type, item?.id, item?.standard_id, fromClassId]);
  useFocusLoad(refresh);

  // A class with sections stays: they go first, each from its own page.
  const classSections = type === 'class' ? Math.max(item?.sections_count ?? 0, item?.section_names?.length ?? 0) : 0;

  const remove = () => {
    if (classSections > 0) {
      AppAlert.alert(
        'Cannot delete class',
        `"${item?.name}" has ${classSections} ${classSections === 1 ? 'section' : 'sections'}. Delete ${
          classSections === 1 ? 'it' : 'them'
        } first, then the class.`,
      );
      return;
    }
    confirmDestructive(
      `Delete ${TITLES[type].toLowerCase()}?`,
      type === 'section'
        ? `"${item?.name}" and the subjects only it has will be removed.`
        : `"${item?.name}" will be removed. This cannot be undone.`,
      'Delete',
      async () => {
        setBusy(true);
        try {
          if (type === 'class') await deleteClass(item.id);
          else if (type === 'section') await deleteSection(item.id);
          else await deleteSubject(item.id);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert(`Cannot delete ${TITLES[type].toLowerCase()}`, apiErr(e, 'Could not delete.'));
        } finally {
          setBusy(false);
        }
      },
    );
  };

  const edit = () => navigation.navigate('AdminStandardForm', { type, id: item.id, item, fromClassId });

  const drill = (d: object) => navigation.popTo('AdminStandardHome', { drill: d });

  if (!item) {
    return (
      <View style={s.root}>
        <DocHeader title={HEADS[type]} onBackPress={() => navigation.goBack()} />
        <ActivityIndicator style={s.loader} color={theme.colors.primary} />
      </View>
    );
  }

  const status = item.is_active ? 'Active' : 'Inactive';
  const rows: { label: string; value?: string | number | null; onPress?: () => void }[] =
    type === 'class'
      ? [
          { label: 'Code', value: item.code },
          { label: 'Board', value: item.board },
          { label: 'Display order', value: item.order },
          { label: 'Status', value: status },
          {
            label: 'Sections',
            value: `${item.sections_count ?? 0}${item.section_names?.length ? ` · ${item.section_names.join(', ')}` : ''}`,
            onPress: () => drill({ tab: 'sections', classId: item.id }),
          },
          { label: 'Subjects', value: item.subjects_count ?? 0 },
          { label: 'Created', value: when(item.created_at) },
        ]
      : type === 'section'
      ? [
          { label: 'Class', value: item.standard_name },
          { label: 'Code', value: item.code },
          { label: 'Description', value: item.description },
          { label: 'Status', value: status },
          {
            label: 'Subjects',
            value: item.subjects_count ?? 0,
            onPress: () => drill({ tab: 'subjects', classId: item.standard_id, sectionId: item.id }),
          },
          { label: 'Created', value: when(item.created_at) },
        ]
      : [
          { label: 'Code', value: item.code },
          { label: 'Class', value: item.standard_name ?? 'Not assigned' },
          { label: 'Sections', value: item.sections },
          { label: 'Mandatory', value: item.standard_id ? (item.is_mandatory ? 'Yes' : 'No') : 'N/A' },
          { label: 'Status', value: status },
          { label: 'Description', value: item.description },
          { label: 'Created', value: when(item.created_at) },
        ];
  const shown = rows.filter(r => r.value !== null && r.value !== undefined && r.value !== '');

  return (
    <View style={s.root}>
      {/* Delete sits in the header, beside the pencil */}
      <DocHeader
        title={HEADS[type]}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <View style={s.headActions}>
            <HeaderIconButton icon="create-outline" onPress={edit} />
            {busy ? (
              <ActivityIndicator style={s.headBusy} color={theme.colors.primary} />
            ) : (
              <HeaderIconButton icon="trash-outline" onPress={remove} />
            )}
          </View>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.head}>
          {type === 'subject' ? (
            <SubjectIcon image={item.image_url} size={52} />
          ) : (
            <View style={s.icon}>
              <VectorIcon iconSet="Ionicons" iconName={ICONS[type]} size={24} color={theme.colors.primary} />
            </View>
          )}
          <View style={s.headBody}>
            <Text style={s.name}>{item.name}</Text>
            <Text style={[s.sub, !item.is_active && s.off]}>
              {[type === 'class' && item.code ? `Code ${item.code}` : null, status].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        <View style={s.rows}>
          {shown.map((r, i) => (
            <InfoRow key={r.label} label={r.label} value={String(r.value)} onPress={r.onPress} last={i === shown.length - 1} />
          ))}
        </View>

      </ScrollView>
    </View>
  );
};

export default AdminStandardDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  loader: { marginTop: 40 },
  scroll: { paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary + '12',
  },
  headBody: { flex: 1, gap: 3 },
  name: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 13, color: theme.colors.textSecondary },
  off: { color: theme.colors.danger },
  rows: { paddingHorizontal: 20 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headBusy: { width: 40 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

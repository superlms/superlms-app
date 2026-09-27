import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { AppDialog } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickDocument, pickImage } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import {
  HomeworkItem,
  HomeworkLookups,
  HwSubject,
  createHomework,
  createHomeworkAll,
  getHomeworkLookups,
  getHomeworkSubjects,
  updateHomework,
} from '../../api/adminHomeworkApi';
import { DocHeader } from '../more/docUi';
import { FormCard, FormError, Hint, OptionSheet, PickerCard, Segment, SubmitButton } from './adminFormUi';
import { useRevealFocused } from './adminProfileUi';
import { fileNameOf, fileProblem } from './adminHomeworkUi';

/**
 * New / Edit Homework — the panel's form, drawn as the app's other admin forms
 * are. The standard (needed) and the section (optional: none is the whole
 * class); then, when adding, Single Subject or All Subjects.
 *
 *  • Single: the title, the subject and the description (all needed) and an
 *    attachment (optional — PDF, Word, Excel, PowerPoint, text or an image, up
 *    to 1 MB). Editing is always one homework; a new file replaces the old.
 *  • All Subjects: every subject of the class (or section), each with its own
 *    title, description and attachment; a subject whose title is left blank
 *    gets no homework, and at least one must be filled.
 *
 * A new standard clears the section and subject, a new section the subject;
 * what was typed for a subject stays while its subject is listed. Saved, an
 * edit opened from the details goes back to them as saved.
 *
 * Route params: item – the homework to edit; classId / sectionId – where a new
 * one is set (the list's); from – 'detail' when opened from the details.
 */

type Mode = 'single' | 'all';
type Sheet = 'class' | 'section' | 'subject' | null;
interface SubjectEntry {
  title: string;
  description: string;
  file: PickedFile | null;
}

const MODES: { key: Mode; label: string }[] = [
  { key: 'single', label: 'Single Subject' },
  { key: 'all', label: 'All Subjects' },
];

// A picture of a page needs no more than this on its longest side — it keeps
// the upload inside the panel's 1 MB.
const IMAGE_SIDE = 1600;

const AdminHomeworkFormScreen = ({ navigation, route }: any) => {
  const item: HomeworkItem | undefined = route?.params?.item;
  const fromDetail = route?.params?.from === 'detail';
  const isEdit = !!item;

  const [lookups, setLookups] = useState<HomeworkLookups | null>(null);
  const [classId, setClassId] = useState<number | null>(item?.standard_id ?? route?.params?.classId ?? null);
  const [sectionId, setSectionId] = useState<number | null>(item ? item.section_id : route?.params?.sectionId ?? null);
  const [mode, setMode] = useState<Mode>('single');
  const [subjectId, setSubjectId] = useState<number | null>(item?.subject_id ?? null);
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [subjects, setSubjects] = useState<HwSubject[]>([]);
  const [entries, setEntries] = useState<Record<number, SubjectEntry>>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  // Which attachment is being picked: the single one, or a subject's.
  const [picking, setPicking] = useState<'single' | number | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();

  useEffect(() => {
    getHomeworkLookups()
      .then(setLookups)
      .catch(e => setError(apiErr(e, 'Could not load the classes.')));
  }, []);

  // The class's (or the section's) subjects.
  useEffect(() => {
    setSubjects([]);
    if (!classId) return;
    let alive = true;
    getHomeworkSubjects(classId, sectionId)
      .then(list => alive && setSubjects(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [classId, sectionId]);

  const classes = lookups?.classes ?? [];
  const cls = classes.find(c => c.id === classId) ?? null;
  const sections = cls?.sections ?? [];
  const sec = sections.find(x => x.id === sectionId) ?? null;
  const subject = subjects.find(x => x.id === subjectId) ?? null;

  const entryOf = (sid: number): SubjectEntry => entries[sid] ?? { title: '', description: '', file: null };
  const setEntry = (sid: number, patch: Partial<SubjectEntry>) => {
    setEntries(prev => ({ ...prev, [sid]: { ...(prev[sid] ?? { title: '', description: '', file: null }), ...patch } }));
    setError('');
  };

  // ── Attachments ──
  const pick = async (from: 'document' | 'image') => {
    const target = picking;
    setPicking(null);
    const f = from === 'document' ? await pickDocument() : await pickImage({ maxSide: IMAGE_SIDE });
    if (!f || target === null) return;
    const subjectName = typeof target === 'number' ? subjects.find(x => x.id === target)?.name : undefined;
    const problem = fileProblem(f, subjectName);
    if (problem) {
      setError(problem);
      return;
    }
    if (target === 'single') setFile(f);
    else setEntry(target, { file: f });
    setError('');
  };

  // ── Save ──
  const save = async () => {
    if (!classId) return setError('Select the standard.');

    if (!isEdit && mode === 'all') {
      const items = subjects
        .map(x => ({ subject_id: x.id, ...entryOf(x.id) }))
        .filter(r => r.title.trim() !== '')
        .map(r => ({ ...r, title: r.title.trim(), description: r.description.trim() }));
      if (items.length === 0) return setError('Please fill homework for at least one subject.');
      setSaving(true);
      try {
        await createHomeworkAll({ standard_id: classId, section_id: sectionId, items });
        navigation.goBack();
      } catch (e) {
        setError(apiErr(e, 'Could not save homework.'));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!title.trim()) return setError('Enter the homework title.');
    if (!subjectId) return setError('Select the subject.');
    if (!description.trim()) return setError('Enter the description.');
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        standard_id: classId,
        section_id: sectionId,
        subject_id: subjectId,
        description: description.trim(),
        file,
      };
      if (item) {
        const saved = await updateHomework(item.id, payload);
        if (fromDetail) navigation.popTo('AdminHomeworkDetail', { item: saved ?? item });
        else navigation.goBack();
      } else {
        await createHomework(payload);
        navigation.goBack();
      }
    } catch (e) {
      setError(apiErr(e, 'Could not save homework.'));
    } finally {
      setSaving(false);
    }
  };

  const sheetProps =
    sheet === 'class'
      ? {
          title: 'Standard',
          options: classes.map(c => ({ key: String(c.id), label: c.name })),
          selected: [String(classId ?? '')],
          onPick: (k: string) => {
            if (Number(k) === classId) return;
            setClassId(Number(k));
            setSectionId(null);
            setSubjectId(null);
            setError('');
          },
        }
      : sheet === 'section'
      ? {
          title: 'Section',
          options: [{ key: '', label: 'No section', sub: 'The whole class' }, ...sections.map(x => ({ key: String(x.id), label: x.name }))],
          selected: [String(sectionId ?? '')],
          onPick: (k: string) => {
            const next = k ? Number(k) : null;
            if (next === sectionId) return;
            setSectionId(next);
            setSubjectId(null);
            setError('');
          },
        }
      : {
          title: 'Subject',
          options: subjects.map(x => ({ key: String(x.id), label: x.name })),
          selected: [String(subjectId ?? '')],
          onPick: (k: string) => {
            setSubjectId(Number(k));
            setError('');
          },
        };

  const savedFileName = item?.file ? fileNameOf({ uri: item.file }) : null;

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Homework' : 'New Homework'} onBackPress={() => navigation.goBack()} />

      {!lookups && !error ? (
        <View style={s.skeleton}>
          {[54, 54, 44, 54, 54, 120].map((h, i) => (
            <Skeleton key={i} width="100%" height={h} radius={12} />
          ))}
        </View>
      ) : (
        <Animated.View style={[s.flex, lift]}>
          <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
            <PickerCard label="Standard" value={cls?.name} placeholder="Select Standard" onPress={() => setSheet('class')} />
            <PickerCard
              label="Section (Optional)"
              value={sec ? sec.name : classId ? 'No section' : null}
              placeholder="Select Section"
              disabled={!cls || sections.length === 0}
              onPress={() => setSheet('section')}
            />

            {!isEdit && <Segment options={MODES} value={mode} onChange={m => { setMode(m); setError(''); }} />}

            {isEdit || mode === 'single' ? (
              <>
                <FormCard
                  label="Homework Title"
                  value={title}
                  onChangeText={t => { setTitle(t); setError(''); }}
                  placeholder="e.g. Chapter 3 exercises"
                  maxLength={255}
                />
                <PickerCard
                  label="Subject"
                  value={subject?.name ?? (item && item.subject_id === subjectId ? item.subject : null)}
                  placeholder="Select Subject"
                  disabled={!cls}
                  onPress={() => setSheet('subject')}
                />
                <FormCard
                  label="Description"
                  value={description}
                  onChangeText={t => { setDescription(t); setError(''); }}
                  placeholder="Enter homework description..."
                  multiline
                  minHeight={110}
                />
                <View style={s.group}>
                  <PickerCard
                    label="Attachment (Optional, max 1 MB)"
                    value={file ? fileNameOf(file) : savedFileName}
                    placeholder="Choose a file"
                    icon="attach-outline"
                    onPress={() => setPicking('single')}
                  />
                  {!!file && (
                    <TouchableOpacity onPress={() => setFile(null)} hitSlop={8} activeOpacity={0.6} style={s.removeLink}>
                      <Text style={s.removeText}>{savedFileName ? 'Keep the current file' : 'Remove'}</Text>
                    </TouchableOpacity>
                  )}
                  <Hint>Allowed: PDF, Word, Excel, PowerPoint, Text, Images (Max: 1 MB)</Hint>
                </View>
              </>
            ) : !cls ? (
              <Hint>Select a standard to load its subjects.</Hint>
            ) : subjects.length === 0 ? (
              <Hint>No subjects are mapped to this class/section.</Hint>
            ) : (
              <>
                <Hint>
                  Fill in the subjects you want to assign homework for. Leave a subject's title blank to skip it (no
                  homework for that subject).
                </Hint>
                {subjects.map(x => {
                  const e = entryOf(x.id);
                  return (
                    <View key={x.id} style={s.subjectBlock}>
                      <View style={s.subjectHead}>
                        <View style={s.subjectBadge}>
                          <Text style={s.subjectBadgeText}>{x.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={s.subjectName}>{x.name}</Text>
                      </View>
                      <FormCard
                        label="Title"
                        value={e.title}
                        onChangeText={t => setEntry(x.id, { title: t })}
                        placeholder="Title (leave blank to skip this subject)"
                        maxLength={255}
                      />
                      <FormCard
                        label="Description"
                        value={e.description}
                        onChangeText={t => setEntry(x.id, { description: t })}
                        placeholder="Description (optional)"
                        multiline
                        minHeight={64}
                      />
                      <View style={s.attachRow}>
                        <TouchableOpacity style={s.attachPick} onPress={() => setPicking(x.id)} hitSlop={6} activeOpacity={0.6}>
                          <VectorIcon iconSet="Ionicons" iconName="attach-outline" size={16} color={theme.colors.primary} />
                          <Text style={s.attachText} numberOfLines={1}>
                            {e.file ? fileNameOf(e.file) : 'Attach a file (optional · max 1 MB)'}
                          </Text>
                        </TouchableOpacity>
                        {!!e.file && (
                          <TouchableOpacity onPress={() => setEntry(x.id, { file: null })} hitSlop={8} activeOpacity={0.6}>
                            <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            <FormError>{error}</FormError>
            <SubmitButton label={isEdit ? 'Update Homework' : 'Create Homework'} busy={saving} onPress={save} />
            <View style={s.tail} />
          </ScrollView>
        </Animated.View>
      )}

      <OptionSheet
        visible={sheet !== null}
        title={sheetProps.title}
        options={sheetProps.options}
        selected={sheetProps.selected}
        onPick={sheetProps.onPick}
        onClose={() => setSheet(null)}
        emptyText={sheet === 'subject' ? 'No subjects are mapped to this class/section.' : undefined}
      />

      <AppDialog
        visible={picking !== null}
        title="Attach a file"
        message="A PDF, Word, Excel, PowerPoint or text file, or an image — up to 1 MB."
        actions={[
          { text: 'Document', onPress: () => pick('document') },
          { text: 'Image', onPress: () => pick('image') },
          { text: 'Cancel', style: 'cancel', onPress: () => setPicking(null) },
        ]}
        onRequestClose={() => setPicking(null)}
      />
    </View>
  );
};

export default AdminHomeworkFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  skeleton: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  tail: { height: 40 },
  group: { gap: 8 },

  removeLink: { alignSelf: 'flex-start' },
  removeText: { fontSize: 13, fontWeight: '600', color: theme.colors.danger },

  // A subject in All Subjects: its initial and name, its fields, its file
  subjectBlock: {
    gap: 10,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subjectHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectBadgeText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  subjectName: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  attachPick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  attachText: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

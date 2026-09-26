import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { SyllabusGroup, SyllabusOptions, getSyllabusOptions, saveSyllabus } from '../../api/adminExamApi';
import { DocHeader } from '../more/docUi';
import { FieldLabel, FormError, Hint, OptionSheet, PickerCard, SubmitButton } from './adminFormUi';
import { ErrorState } from './adminExamUi';

/**
 * Add or edit an exam's syllabus, as the panel's form has it: the exam, then
 * the class, its section and the subject — each clearing the ones after it —
 * then the subject's chapters to tick, with how many are ticked, Select all
 * and Clear. The chapters this exam already has come ticked. A chapter can
 * belong to one exam's syllabus at a time: adding, one in another exam is
 * locked and names it; editing, it can be ticked and moves here on save, and
 * unticking every chapter removes the syllabus.
 *
 * Route params: group – the syllabus to edit (absent when adding).
 */

type Sheet = 'exam' | 'class' | 'section' | 'subject' | null;
type Picks = { exam?: number | null; std?: number | null; sec?: number | null; sub?: number | null };

const AdminExamSyllabusFormScreen = ({ navigation, route }: any) => {
  const group: SyllabusGroup | undefined = route.params?.group;
  const isEdit = !!group;

  const [opt, setOpt] = useState<SyllabusOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exam, setExam] = useState<number | null>(group?.exam_id ?? null);
  const [std, setStd] = useState<number | null>(group?.standard_id ?? null);
  const [sec, setSec] = useState<number | null>(group?.section_id ?? null);
  const [sub, setSub] = useState<number | null>(group?.subject_id ?? null);
  const [chapters, setChapters] = useState<number[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // The pickers' lists for what is chosen, and the chapters this exam already has ticked.
  const refresh = useCallback(
    async (next: Picks = {}) => {
      const e = next.exam !== undefined ? next.exam : exam;
      const c = next.std !== undefined ? next.std : std;
      const se = next.sec !== undefined ? next.sec : sec;
      const su = next.sub !== undefined ? next.sub : sub;
      setBusy(true);
      try {
        const o = await getSyllabusOptions({
          exam_id: e ?? undefined,
          standard_id: c ?? undefined,
          section_id: se ?? undefined,
          subject_id: su ?? undefined,
        });
        setOpt(o);
        setLoadError(null);
        if (o.selected_chapter_ids) setChapters(o.selected_chapter_ids);
      } catch (err) {
        setLoadError(apiErr(err, 'Could not load the choices.'));
      } finally {
        setBusy(false);
      }
    },
    [exam, std, sec, sub],
  );

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onExam = (id: number) => {
    setExam(id);
    setError('');
    refresh({ exam: id });
  };
  const onStd = (id: number) => {
    setStd(id);
    setSec(null);
    setSub(null);
    setChapters([]);
    setError('');
    refresh({ std: id, sec: null, sub: null });
  };
  const onSec = (id: number) => {
    setSec(id);
    setSub(null);
    setChapters([]);
    setError('');
    refresh({ sec: id, sub: null });
  };
  const onSub = (id: number) => {
    setSub(id);
    setChapters([]);
    setError('');
    refresh({ sub: id });
  };

  const list = sub ? opt?.chapters ?? [] : [];
  // Adding, a chapter already in another exam's syllabus is locked.
  const ownedElsewhere = (c: SyllabusOptions['chapters'][number]) => !!c.owning_exam_id && c.owning_exam_id !== exam;
  const locked = (c: SyllabusOptions['chapters'][number]) => !isEdit && ownedElsewhere(c);
  const picked = chapters.filter(id => list.some(c => c.id === id));

  const toggle = (id: number) => {
    setError('');
    setChapters(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };
  const selectAll = () => setChapters(list.filter(c => !locked(c)).map(c => c.id));

  const save = async () => {
    if (!exam) return setError('Please select an exam.');
    if (!std) return setError('Please select a class.');
    if (!sub) return setError('Please select a subject.');
    if (!isEdit && picked.length === 0) return setError('Please select at least one chapter.');

    setError('');
    setSaving(true);
    try {
      await saveSyllabus({
        exam_id: exam,
        standard_id: std,
        section_id: sec,
        subject_id: sub,
        chapter_ids: picked,
        edit: isEdit,
      });
      navigation.goBack();
    } catch (e) {
      setError(apiErr(e, 'Could not save the syllabus.'));
    } finally {
      setSaving(false);
    }
  };

  const examLabel = (() => {
    const e = opt?.exams.find(x => x.id === exam);
    return e ? `${e.exam_name} (${e.academic_year})` : group?.exam_name ?? null;
  })();
  const className = opt?.standards.find(x => x.id === std)?.name ?? (std === group?.standard_id ? group?.standard_name : null);
  const sectionName = opt?.sections.find(x => x.id === sec)?.name ?? (sec === group?.section_id ? group?.section_name : null);
  const subjectName = opt?.subjects.find(x => x.id === sub)?.name ?? (sub === group?.subject_id ? group?.subject_name : null);

  const sheetProps =
    sheet === 'exam'
      ? {
          title: 'Exam',
          options: (opt?.exams ?? []).map(e => ({ key: String(e.id), label: e.exam_name, sub: e.academic_year })),
          selected: exam ? [String(exam)] : [],
          onPick: (k: string) => onExam(Number(k)),
        }
      : sheet === 'class'
      ? {
          title: 'Class',
          options: (opt?.standards ?? []).map(c => ({ key: String(c.id), label: c.name })),
          selected: std ? [String(std)] : [],
          onPick: (k: string) => onStd(Number(k)),
        }
      : sheet === 'section'
      ? {
          title: 'Section',
          options: (opt?.sections ?? []).map(c => ({ key: String(c.id), label: c.name })),
          selected: sec ? [String(sec)] : [],
          onPick: (k: string) => onSec(Number(k)),
        }
      : {
          title: 'Subject',
          options: (opt?.subjects ?? []).map(c => ({ key: String(c.id), label: c.name })),
          selected: sub ? [String(sub)] : [],
          onPick: (k: string) => onSub(Number(k)),
        };

  const title = isEdit ? 'Edit Exam Syllabus' : 'Add Exam Syllabus';

  if (!opt) {
    return (
      <View style={s.root}>
        <DocHeader title={title} onBackPress={() => navigation.goBack()} />
        {loadError ? (
          <ErrorState message={loadError} onRetry={() => refresh()} />
        ) : (
          <View style={s.loader}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <PickerCard label="Exam" value={examLabel} placeholder="Select exam" onPress={() => setSheet('exam')} />
          <PickerCard label="Class" value={className} placeholder="Select class" onPress={() => setSheet('class')} />

          <View style={s.pair}>
            <View style={s.half}>
              <PickerCard
                label="Section"
                value={sectionName}
                placeholder="Select section"
                disabled={!std}
                onPress={() => setSheet('section')}
              />
              {!std && <Hint>Choose a class first.</Hint>}
            </View>
            <View style={s.half}>
              <PickerCard
                label="Subject"
                value={subjectName}
                placeholder="Select subject"
                disabled={!sec}
                onPress={() => setSheet('subject')}
              />
              {!sec && <Hint>Choose a section first.</Hint>}
            </View>
          </View>

          {!!sub && (
            <View style={s.group}>
              <View style={s.chapHead}>
                <View style={s.flex}>
                  <FieldLabel>Chapters</FieldLabel>
                  {list.length > 0 && (
                    <Text style={s.countText}>
                      {picked.length} of {list.length} selected
                    </Text>
                  )}
                </View>
                {busy ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  list.length > 0 && (
                    <View style={s.links}>
                      <TouchableOpacity onPress={selectAll} hitSlop={8} activeOpacity={0.6}>
                        <Text style={s.linkText}>Select all</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setChapters([])} hitSlop={8} activeOpacity={0.6}>
                        <Text style={s.linkMuted}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </View>

              {isEdit && list.length > 0 && (
                <Text style={s.note}>
                  Chapters in other exams stay selectable and move here when you save. Untick every chapter to remove
                  this syllabus.
                </Text>
              )}

              {!busy && list.length === 0 ? (
                <Hint>No chapters found for this class, section and subject. Add its chapters first.</Hint>
              ) : (
                <View style={s.chapList}>
                  {list.map((c, i) => {
                    const on = chapters.includes(c.id);
                    const lock = locked(c);
                    const other = ownedElsewhere(c);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[s.chapRow, i < list.length - 1 && s.chapDivider, lock && s.chapLocked]}
                        activeOpacity={0.6}
                        disabled={lock}
                        onPress={() => toggle(c.id)}
                      >
                        <VectorIcon
                          iconSet="Ionicons"
                          iconName={on ? 'checkbox' : 'square-outline'}
                          size={19}
                          color={on ? theme.colors.primary : theme.colors.textMuted}
                        />
                        <View style={s.flex}>
                          <Text style={[s.chapName, lock && s.chapNameLocked]}>{c.name}</Text>
                          {other && (
                            <Text style={[s.chapOwner, isEdit && s.chapOwnerMove]}>
                              {isEdit ? 'Will move from' : 'In'} {c.owning_exam_name}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          <FormError>{error}</FormError>

          <SubmitButton label={isEdit ? 'Update Syllabus' : 'Save Syllabus'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={sheet !== null}
        title={sheetProps.title}
        options={sheetProps.options}
        selected={sheetProps.selected}
        onPick={sheetProps.onPick}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminExamSyllabusFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, gap: 6 },
  group: { gap: 8 },

  // Chapters
  chapHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  countText: { fontSize: 13, color: theme.colors.textSecondary, marginTop: -4 },
  links: { flexDirection: 'row', gap: 16, paddingBottom: 2 },
  linkText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  linkMuted: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  note: { fontSize: 12, lineHeight: 17, color: '#B45309' },
  chapList: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
  },
  chapRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  chapDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  chapLocked: { opacity: 0.55 },
  chapName: { fontSize: 15, color: theme.colors.textPrimary },
  chapNameLocked: { color: theme.colors.textSecondary },
  chapOwner: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  chapOwnerMove: { color: '#B45309' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { pickDocument, pickImage } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  DateSheet,
  FieldLabel,
  FormCard,
  Hint,
  OptionSheet,
  PickerCard,
  QuietAction,
  Segment,
  SubmitButton,
  SwitchRow,
  TimeSheet,
  adminFormStyles as fs,
  clock12,
} from '../admin/adminFormUi';
import { getTeacherClassesSubjects, marksErrorMessage, type ClassSubject } from '../../api/marksApi';
import {
  saveAssignment,
  assignmentErrorMessage,
  type Assignment,
  type AssignmentType,
  type PickedAttachment,
  type QuestionDraft,
  type SubmissionMode,
} from '../../api/assignmentApi';
import { FileChip, LETTERS, openFile } from './assignmentUi';

/**
 * Setting an assignment — or, opened with `{ assignment }`, editing one — as
 * the admin panel's Assignments form does: the class and subject (those the
 * teacher teaches), a title and instructions, written or MCQ, how a written one
 * is answered (text, a file or both), when it opens and is due, its marks, and
 * whether students can see it. A file goes on from the paperclip in the
 * header; an MCQ gets its questions here, each with its options and the right
 * one ticked.
 */

const MAX_FILE = 5 * 1024 * 1024;

const blankQuestion = (): QuestionDraft => ({
  id: null,
  question_text: '',
  marks: 1,
  options: [0, 1, 2, 3].map(i => ({ id: null, text: '', is_correct: i === 0 })),
});

// "Mathematics · Class 5 A"
const comboLabel = (c: ClassSubject) =>
  [c.subject_name, [c.standard_name, c.section_name].filter(Boolean).join(' ')].filter(Boolean).join(' · ');

const comboKey = (c: { standard_id: number | null; section_id: number | null; subject_id: number | null }) =>
  `${c.standard_id}-${c.section_id}-${c.subject_id}`;

const split = (dt?: string | null, fallback?: moment.Moment) => {
  const m = dt ? moment(dt, ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm']) : fallback ?? moment();
  return { date: m.format('YYYY-MM-DD'), time: m.format('HH:mm') };
};

// ── Loading ──────────────────────────────────────────────────────────────────
// A card as the form draws it — its label and what it will hold, unseen — under
// a grey box of its size.
const CardSkeleton = ({ label, value, tall }: { label: string; value: string; tall?: number }) => (
  <View>
    <View style={[fs.field, s.unseen]}>
      <Text style={fs.fieldLabel}>{label}</Text>
      <Text style={[fs.fieldInput, !!tall && { minHeight: tall }]}>{value}</Text>
    </View>
    <Skeleton radius={theme.radius.md} style={s.fill} />
  </View>
);

const FormSkeleton = ({ editing }: { editing?: Assignment }) => {
  const mcq = editing?.type === 'mcq';
  return (
    <View style={s.form} pointerEvents="none">
      <CardSkeleton
        label="Class and subject"
        value={editing ? [editing.subject, editing.standard, editing.section].filter(Boolean).join(' · ') : 'Choose a class and subject'}
      />
      <CardSkeleton label="Title" value={editing?.title || 'e.g. Chapter 3 worksheet'} />
      <CardSkeleton label="Instructions" value={editing?.description || 'What should the class do?'} tall={96} />
      <Skeleton width="100%" height={40} radius={theme.radius.md} />
      {!mcq && <Skeleton width="100%" height={40} radius={theme.radius.md} />}
      <View style={s.pair}>
        <View style={s.pairWide}>
          <CardSkeleton label="Opens on" value="19 Sep 2026" />
        </View>
        <View style={s.pairNarrow}>
          <CardSkeleton label="At" value="09:00 AM" />
        </View>
      </View>
      <View style={s.pair}>
        <View style={s.pairWide}>
          <CardSkeleton label="Due on" value="26 Sep 2026" />
        </View>
        <View style={s.pairNarrow}>
          <CardSkeleton label="At" value="05:00 PM" />
        </View>
      </View>
      <CardSkeleton label="Total marks" value="10" />
      {mcq &&
        (editing?.questions ?? []).map(q => (
          <View key={q.id} style={s.question}>
            <CardSkeleton label="Question" value={q.question_text} tall={44} />
            {q.options.map(o => (
              <Skeleton key={o.id} width="100%" height={46} radius={theme.radius.md} />
            ))}
          </View>
        ))}
      <Skeleton width="100%" height={48} radius={theme.radius.md} />
    </View>
  );
};

const AssignmentFormScreen = ({ navigation, route }: any) => {
  const editing: Assignment | undefined = route?.params?.assignment;

  const [combos, setCombos] = useState<ClassSubject[]>([]);
  const [loadingCombos, setLoadingCombos] = useState(true);
  const [combosError, setCombosError] = useState<string | null>(null);

  const [combo, setCombo] = useState<ClassSubject | null>(null);
  const [comboOpen, setComboOpen] = useState(false);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [type, setType] = useState<AssignmentType>(editing?.type ?? 'written');
  const [mode, setMode] = useState<SubmissionMode>(editing?.submission_mode ?? 'both');
  const start0 = split(editing?.start_date);
  const end0 = split(editing?.end_date, moment().add(7, 'days').hour(17).minute(0));
  const [startDate, setStartDate] = useState(start0.date);
  const [startTime, setStartTime] = useState(start0.time);
  const [endDate, setEndDate] = useState(end0.date);
  const [endTime, setEndTime] = useState(end0.time);
  const [sheet, setSheet] = useState<null | 'startDate' | 'startTime' | 'endDate' | 'endTime' | 'attach'>(null);
  const [marks, setMarks] = useState(editing?.marks_set ? String(editing.marks_set) : '');
  const [active, setActive] = useState(editing?.is_active ?? true);
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    editing?.type === 'mcq' && editing.questions?.length
      ? editing.questions.map(q => ({
          id: q.id,
          question_text: q.question_text,
          marks: q.marks,
          options: q.options.map(o => ({ id: o.id, text: o.text, is_correct: !!o.is_correct })),
        }))
      : [blankQuestion()],
  );
  const [file, setFile] = useState<PickedAttachment | null>(null);
  // The file the assignment already has, until it is removed or replaced.
  const [keptFile, setKeptFile] = useState<string | null>(editing?.file ?? null);
  const [saving, setSaving] = useState(false);

  const loadCombos = useCallback(async () => {
    setLoadingCombos(true);
    setCombosError(null);
    try {
      const list = await getTeacherClassesSubjects();
      setCombos(list);
      if (editing) {
        const own = list.find(c => comboKey(c) === comboKey(editing));
        setCombo(
          own ?? {
            standard_id: editing.standard_id ?? 0,
            standard_name: editing.standard ?? '',
            section_id: editing.section_id ?? 0,
            section_name: editing.section ?? '',
            subject_id: editing.subject_id ?? 0,
            subject_name: editing.subject ?? '',
            label: '',
          },
        );
      } else if (list.length === 1) {
        setCombo(list[0]);
      }
    } catch (e: any) {
      setCombosError(marksErrorMessage(e));
    } finally {
      setLoadingCombos(false);
    }
  }, [editing]);

  useEffect(() => {
    loadCombos();
  }, [loadCombos]);

  // ── Questions ──────────────────────────────────────────────────────────────
  const setQuestion = (i: number, patch: Partial<QuestionDraft>) =>
    setQuestions(qs => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const setOptionText = (i: number, k: number, text: string) =>
    setQuestions(qs =>
      qs.map((q, j) => (j === i ? { ...q, options: q.options.map((o, m) => (m === k ? { ...o, text } : o)) } : q)),
    );
  const setCorrect = (i: number, k: number) =>
    setQuestions(qs =>
      qs.map((q, j) => (j === i ? { ...q, options: q.options.map((o, m) => ({ ...o, is_correct: m === k })) } : q)),
    );

  // ── Files ──────────────────────────────────────────────────────────────────
  const attach = async (how: string) => {
    await new Promise<void>(r => setTimeout(r, 300));
    const f = how === 'photo' ? await pickImage() : await pickDocument();
    if (!f) return;
    if (f.size && f.size > MAX_FILE) {
      AppAlert.alert('File too large', 'Attachment must be 5 MB or smaller.');
      return;
    }
    setFile({ uri: f.uri, name: f.name || 'attachment', type: f.type ?? undefined, size: f.size ?? undefined });
  };

  // ── Saving ─────────────────────────────────────────────────────────────────
  const problem = (): string | null => {
    if (!combo) return 'Choose the class and subject.';
    if (!title.trim()) return 'Give the assignment a title.';
    const start = moment(`${startDate} ${startTime}`, 'YYYY-MM-DD HH:mm');
    const end = moment(`${endDate} ${endTime}`, 'YYYY-MM-DD HH:mm');
    if (end.isBefore(start)) return 'The due date must be on or after the opening date.';
    if (marks && !/^\d+$/.test(marks.trim())) return 'Total marks must be a whole number.';
    if (type === 'mcq') {
      if (questions.length === 0) return 'Add at least one question.';
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const filled = q.options.filter(o => o.text.trim());
        if (!q.question_text.trim()) return `Q${i + 1}: write the question.`;
        if (filled.length < 2) return `Q${i + 1}: add at least two options.`;
        if (!filled.some(o => o.is_correct)) return `Q${i + 1}: tick the right option.`;
      }
    }
    return null;
  };

  const save = async () => {
    const why = problem();
    if (why) return AppAlert.alert('Check the form', why);
    setSaving(true);
    try {
      await saveAssignment(
        {
          standard_id: combo!.standard_id,
          section_id: combo!.section_id,
          subject_id: combo!.subject_id,
          title: title.trim(),
          description: description.trim(),
          type,
          submission_mode: mode,
          start_date: `${startDate} ${startTime}`,
          end_date: `${endDate} ${endTime}`,
          total_marks: marks.trim(),
          is_active: active,
          questions: questions.map(q => ({
            ...q,
            question_text: q.question_text.trim(),
            marks: Math.max(1, Number(q.marks) || 1),
            options: q.options.map(o => ({ ...o, text: o.text.trim() })),
          })),
        },
        { id: editing?.id, file, removeFile: !!editing?.file && !keptFile },
      );
      AppAlert.alert(editing ? 'Assignment updated' : 'Assignment posted', editing ? 'Your changes were saved.' : 'Your class can see it now.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      AppAlert.alert(editing ? 'Could not save' : 'Could not post', assignmentErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const formReady = !loadingCombos && !combosError && (combos.length > 0 || !!editing);

  const renderQuestion = (q: QuestionDraft, i: number) => (
    <View key={q.id ?? `new-${i}`} style={s.question}>
      <View style={s.qHead}>
        <Text style={s.qTitle}>{`Question ${i + 1}`}</Text>
        {questions.length > 1 && (
          <TouchableOpacity hitSlop={10} onPress={() => setQuestions(qs => qs.filter((_, j) => j !== i))}>
            <VectorIcon iconSet="Feather" iconName="trash-2" size={16} color={theme.colors.danger} />
          </TouchableOpacity>
        )}
      </View>
      <FormCard
        label="Question"
        value={q.question_text}
        onChangeText={t => setQuestion(i, { question_text: t })}
        placeholder="Type the question"
        multiline
      />
      {q.options.map((o, k) => (
        <View key={k} style={[s.optionRow, o.is_correct && s.optionRowRight]}>
          <TouchableOpacity hitSlop={8} onPress={() => setCorrect(i, k)} activeOpacity={0.6}>
            <VectorIcon
              iconSet="Ionicons"
              iconName={o.is_correct ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={o.is_correct ? '#16A34A' : theme.colors.textMuted}
            />
          </TouchableOpacity>
          <TextInput
            style={s.optionInput}
            value={o.text}
            onChangeText={t => setOptionText(i, k, t)}
            placeholder={`Option ${LETTERS[k]}`}
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>
      ))}
      <View style={s.qFoot}>
        <Hint>Tick the right option.</Hint>
        <View style={s.marksBox}>
          <Text style={s.marksLabel}>Marks</Text>
          <TextInput
            style={s.marksInput}
            value={String(q.marks)}
            onChangeText={t => setQuestion(i, { marks: Number(t.replace(/\D/g, '')) || 0 })}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      </View>
    </View>
  );

  const renderBody = () => {
    if (loadingCombos) return <FormSkeleton editing={editing} />;
    if (combosError) {
      return (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{combosError}</Text>
          <TouchableOpacity onPress={loadCombos} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!formReady) {
      return (
        <DocNoData
          icon="book-outline"
          title="No subject assigned"
          subtitle="No classes or subjects are assigned to you in the timetable yet."
        />
      );
    }

    return (
      <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <PickerCard
          label="Class and subject"
          value={combo ? comboLabel(combo) : null}
          placeholder="Choose a class and subject"
          onPress={() => setComboOpen(true)}
        />
        <FormCard label="Title" value={title} onChangeText={t => setTitle(t.replace(/\n/g, ' '))} placeholder="e.g. Chapter 3 worksheet" maxLength={255} />
        <FormCard
          label="Instructions"
          value={description}
          onChangeText={setDescription}
          placeholder="What should the class do?"
          multiline
          minHeight={96}
        />

        <View>
          <FieldLabel>Type</FieldLabel>
          <Segment
            options={[
              { key: 'written', label: 'Written' },
              { key: 'mcq', label: 'MCQ' },
            ]}
            value={type}
            onChange={setType}
          />
        </View>

        {type === 'written' && (
          <View>
            <FieldLabel>Students answer with</FieldLabel>
            <Segment
              options={[
                { key: 'text', label: 'Text' },
                { key: 'file', label: 'A file' },
                { key: 'both', label: 'Either or both' },
              ]}
              value={mode}
              onChange={setMode}
            />
          </View>
        )}

        <View style={s.pair}>
          <PickerCard
            style={s.pairWide}
            label="Opens on"
            value={moment(startDate).format('D MMM YYYY')}
            icon="calendar-outline"
            onPress={() => setSheet('startDate')}
          />
          <PickerCard
            style={s.pairNarrow}
            label="At"
            value={clock12(startTime)}
            icon="time-outline"
            onPress={() => setSheet('startTime')}
          />
        </View>
        <View style={s.pair}>
          <PickerCard
            style={s.pairWide}
            label="Due on"
            value={moment(endDate).format('D MMM YYYY')}
            icon="calendar-outline"
            onPress={() => setSheet('endDate')}
          />
          <PickerCard
            style={s.pairNarrow}
            label="At"
            value={clock12(endTime)}
            icon="time-outline"
            onPress={() => setSheet('endTime')}
          />
        </View>

        <View style={s.stack}>
          <FormCard
            label="Total marks"
            value={marks}
            onChangeText={t => setMarks(t.replace(/\D/g, ''))}
            placeholder={type === 'mcq' ? 'The questions’ marks added up' : 'e.g. 10'}
            keyboardType="number-pad"
            maxLength={5}
          />
          {type === 'mcq' && <Hint>Leave it blank to total the marks of the questions.</Hint>}
        </View>

        <SwitchRow label="Show to students" value={active} onValueChange={setActive} />

        {(file || keptFile) && (
          <View>
            <FieldLabel>Attachment</FieldLabel>
            {file ? (
              <FileChip name={file.name} type={file.type} onRemove={() => setFile(null)} />
            ) : (
              <View style={s.keptRow}>
                <FileChip name={keptFile} onPress={() => openFile(keptFile)} />
                <TouchableOpacity hitSlop={10} onPress={() => setKeptFile(null)}>
                  <VectorIcon iconSet="Ionicons" iconName="close" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {type === 'mcq' && (
          <View style={s.questions}>
            {questions.map(renderQuestion)}
            <QuietAction icon="plus" label="Add question" onPress={() => setQuestions(qs => [...qs, blankQuestion()])} />
          </View>
        )}

        <SubmitButton label={editing ? 'Save changes' : 'Post assignment'} busy={saving} onPress={save} />
      </ScrollView>
    );
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DocHeader
        title={editing ? 'Edit Assignment' : 'New Assignment'}
        onBackPress={() => navigation.goBack()}
        rightIcon={formReady ? 'attach-outline' : undefined}
        onRightPress={formReady ? () => setSheet('attach') : undefined}
      />
      {renderBody()}

      <OptionSheet
        visible={comboOpen}
        title="Class and subject"
        options={combos.map(c => ({ key: comboKey(c), label: comboLabel(c) }))}
        selected={combo ? [comboKey(combo)] : []}
        onPick={k => setCombo(combos.find(c => comboKey(c) === k) ?? null)}
        onClose={() => setComboOpen(false)}
        emptyText="No classes or subjects are assigned to you yet."
      />
      <OptionSheet
        visible={sheet === 'attach'}
        title="Attach"
        options={[
          { key: 'photo', label: 'Photo', sub: 'From your gallery' },
          { key: 'document', label: 'Document', sub: 'PDF, Word, Excel, PowerPoint or text, up to 5 MB' },
        ]}
        selected={[]}
        onPick={attach}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        visible={sheet === 'startDate'}
        title="Opens on"
        value={startDate}
        onPick={setStartDate}
        onClose={() => setSheet(null)}
      />
      <DateSheet visible={sheet === 'endDate'} title="Due on" value={endDate} onPick={setEndDate} onClose={() => setSheet(null)} />
      <TimeSheet visible={sheet === 'startTime'} title="Opens at" value={startTime} onPick={setStartTime} onClose={() => setSheet(null)} />
      <TimeSheet visible={sheet === 'endTime'} title="Due at" value={endTime} onPick={setEndTime} onClose={() => setSheet(null)} />
    </KeyboardAvoidingView>
  );
};

export default AssignmentFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  form: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 16 },
  stack: { gap: 6 },

  pair: { flexDirection: 'row', gap: 10 },
  pairWide: { flex: 3 },
  pairNarrow: { flex: 2 },

  keptRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  questions: { gap: 22 },
  question: { gap: 10 },
  qHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  optionRowRight: { borderColor: '#16A34A' },
  optionInput: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, paddingVertical: 11 },
  qFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  marksBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marksLabel: { fontSize: 12, color: theme.colors.textMuted },
  marksInput: {
    minWidth: 48,
    textAlign: 'center',
    fontSize: 14,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },

  // Loading
  // Hidden by opacity: on Android a transparent colour draws text and borders black.
  unseen: { opacity: 0 },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },

  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

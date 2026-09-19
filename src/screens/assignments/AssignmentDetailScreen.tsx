import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { pickDocument, pickImage } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import { SubjectIcon } from '../subjects/subjectIcon';
import { FormCard, OptionSheet, QuietAction, SubmitButton, Hint } from '../admin/adminFormUi';
import {
  getAssignment,
  getTeacherAssignment,
  submitAssignment,
  assignmentErrorMessage,
  type Assignment,
  type AssignmentQuestion,
  type PickedAttachment,
  type RosterRow,
} from '../../api/assignmentApi';
import {
  Fact,
  FileChip,
  OptionRow,
  STATUS,
  Words,
  classLabel,
  kindLabel,
  num,
  openFile,
  whenLabel,
  type OptionState,
} from './assignmentUi';

/**
 * One assignment, opened from the list.
 *
 * Its subject, title and class; when it opens and is due, its marks and kind;
 * the instructions and the teacher's file. A student then answers it — the
 * MCQs one tap an option, or a written answer and/or a file as it asks — or,
 * once sent, sees their answer, its status, marks and remark, and for MCQs the
 * right answers. A teacher sees the questions with the right answers and the
 * class, student by student, with who turned it in; a student's row opens what
 * they sent, and the pencil edits the assignment.
 *
 * While it loads, the page is drawn as a skeleton from the assignment as the
 * list had it and from what this page held last time.
 */

const MAX_FILE = 10 * 1024 * 1024;

// Stand-ins for parts the list does not carry, before this page has ever loaded.
const sampleQuestions = (n: number): AssignmentQuestion[] =>
  Array.from({ length: Math.min(Math.max(n, 1), 5) }, (_, i) => ({
    id: -(i + 1),
    question_text: 'What is the value of the expression given below?',
    marks: 1,
    options: ['First choice', 'Second choice here', 'Third', 'Fourth choice'].map((t, j) => ({
      id: -(j + 1),
      text: t,
      is_correct: null,
    })),
  }));

const sampleRoster = (n: number): RosterRow[] =>
  Array.from({ length: Math.min(Math.max(n, 3), 8) }, (_, i) => ({
    student_detail_id: -(i + 1),
    name: ['Aarav Sharma', 'Diya Patel', 'Kabir Singh', 'Ananya Gupta', 'Vivaan Rao'][i % 5],
    roll_no: String(i + 1),
    image: null,
    status: i % 2 ? 'pending' : 'submitted',
    submission_id: null,
    submitted_at: null,
    marks: null,
    mcq_score: null,
  }));

const SAMPLE: Assignment = {
  id: 0,
  title: 'Chapter 3 worksheet',
  description: 'Solve the questions from the exercise at the end of the chapter and show your working.',
  type: 'written',
  submission_mode: 'both',
  file: null,
  standard_id: null,
  standard: 'Class 5',
  section_id: null,
  section: 'A',
  subject_id: null,
  subject: 'Mathematics',
  subject_image: null,
  created_by: 'Class teacher',
  start_date: null,
  end_date: null,
  window_status: 'open',
  total_marks: 10,
  question_count: 0,
  submission: null,
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');

// How an option reads on a sent MCQ: chosen and right, chosen and wrong, the right one, or plain.
const reviewState = (q: AssignmentQuestion, optionId: number, correct: boolean | null): OptionState => {
  const chosen = q.chosen_option_id === optionId;
  if (chosen) return correct ? 'right' : 'wrong';
  return correct ? 'answer' : 'idle';
};

const AssignmentDetailScreen = ({ navigation, route }: any) => {
  const summary: Assignment | undefined = route.params?.assignment;
  const id: number | undefined = route.params?.assignmentId ?? summary?.id;
  const teacher = !!route.params?.teacher;

  const [detail, setDetail] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastHere, rememberHere] = useLastLoaded<Assignment>(id != null ? `assignment:${teacher ? 't' : 's'}:${id}` : null);

  // A student's answer while they write it.
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [answer, setAnswer] = useState('');
  const [file, setFile] = useState<PickedAttachment | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  // Sending a written answer again, before it is checked.
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(
    async (showSkeleton = false) => {
      if (id == null) {
        setError('Assignment not found.');
        setLoading(false);
        return;
      }
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const next = await (teacher ? getTeacherAssignment(id) : getAssignment(id));
        setDetail(next);
        rememberHere(next);
      } catch (e: any) {
        console.log('[AssignmentDetail] Error:', e?.response?.status, e?.message);
        setError(assignmentErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [id, teacher, rememberHere],
  );

  const { refreshing, onRefresh } = useRefresh(() => load(true));
  useFocusLoad(() => load());

  // While loading: the assignment as the list had it, shaped by what this page held last time.
  const drawn = (): Assignment => {
    const here = lastHere && lastHere.id === id ? lastHere : null;
    const base: Assignment = { ...SAMPLE, ...(here ?? {}), ...(summary ?? {}) };
    return {
      ...base,
      description: here ? here.description : base.description,
      questions:
        base.type === 'mcq' ? here?.questions ?? sampleQuestions(base.question_count) : [],
      roster: here?.roster ?? sampleRoster(base.class_size ?? 0),
      stats: here?.stats ?? base.stats,
    };
  };

  const skeleton = loading || refreshing;
  const shown: Assignment | null = skeleton ? drawn() : detail;

  // ── Sending ────────────────────────────────────────────────────────────────
  const attach = async (how: string) => {
    // Let the sheet close before the picker opens over it.
    await new Promise<void>(r => setTimeout(r, 300));
    const f = how === 'photo' ? await pickImage() : await pickDocument();
    if (!f) return;
    if (f.size && f.size > MAX_FILE) {
      AppAlert.alert('File too large', 'Your file must be 10 MB or smaller.');
      return;
    }
    setFile({ uri: f.uri, name: f.name || 'attachment', type: f.type ?? undefined, size: f.size ?? undefined });
  };

  const send = async (a: Assignment, body: Parameters<typeof submitAssignment>[1]) => {
    setSending(true);
    try {
      await submitAssignment(a.id, body);
      setEditing(false);
      setFile(null);
      await load();
      AppAlert.alert('Submitted', 'Your answer has been sent to your teacher.');
    } catch (e: any) {
      AppAlert.alert('Could not submit', assignmentErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const submitMcq = (a: Assignment) => {
    const qs = a.questions ?? [];
    const answers = qs
      .filter(q => picked[q.id] != null)
      .map(q => ({ question_id: q.id, option_id: picked[q.id] }));
    if (answers.length === 0) {
      AppAlert.alert('No answers yet', 'Tap an option under each question to answer it.');
      return;
    }
    const left = qs.length - answers.length;
    AppAlert.alert(
      'Submit your answers?',
      (left > 0 ? `${left} question${left === 1 ? ' is' : 's are'} not answered. ` : '') +
        'You can’t change your answers after this.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: () => send(a, { answers }) },
      ],
    );
  };

  const submitWritten = (a: Assignment) => {
    const mode = a.submission_mode || 'both';
    const text = answer.trim();
    const hasFile = !!file || (editing && !!a.submission?.file);
    if (mode === 'text' && !text) return AppAlert.alert('Write your answer', 'This assignment is answered in text.');
    if (mode === 'file' && !hasFile) return AppAlert.alert('Attach your file', 'This assignment is answered with a file.');
    if (mode === 'both' && !text && !hasFile) {
      return AppAlert.alert('Nothing to send', 'Write your answer or attach a file.');
    }
    send(a, { answer_text: text || undefined, file });
  };

  const startEditing = (a: Assignment) => {
    setAnswer(a.submission?.answer_text ?? '');
    setFile(null);
    setEditing(true);
  };

  // ── Parts ──────────────────────────────────────────────────────────────────
  const renderHead = (a: Assignment) => (
    <View style={s.head}>
      {skeleton ? <Skeleton width={44} height={44} radius={9} /> : <SubjectIcon image={a.subject_image} size={44} />}
      <View style={s.headBody}>
        <Words skeleton={skeleton} style={s.title}>
          {a.title}
        </Words>
        <Words skeleton={skeleton} style={s.sub}>
          {[a.subject, classLabel(a)].filter(Boolean).join(' · ')}
        </Words>
      </View>
    </View>
  );

  const renderFacts = (a: Assignment) => (
    <View>
      {!!a.start_date && <Fact label="Opens" value={whenLabel(a.start_date)} skeleton={skeleton} />}
      {!!a.end_date && <Fact label="Due" value={whenLabel(a.end_date)} skeleton={skeleton} />}
      <Fact label="Marks" value={a.total_marks > 0 ? num(a.total_marks) : '—'} skeleton={skeleton} />
      <Fact label="Type" value={kindLabel(a)} skeleton={skeleton} />
      {teacher && !!a.created_by && <Fact label="Set by" value={a.created_by} skeleton={skeleton} />}
      {teacher && a.is_active === false && <Fact label="Students" value="Hidden from students" skeleton={skeleton} />}
    </View>
  );

  const renderInstructions = (a: Assignment) => (
    <>
      {!!a.description && (
        <View style={s.block}>
          <Words skeleton={skeleton} style={s.sectionTitle}>
            Instructions
          </Words>
          <Words skeleton={skeleton} style={s.body}>
            {a.description}
          </Words>
        </View>
      )}
      {!!a.file && <FileChip name={a.file} onPress={() => openFile(a.file)} skeleton={skeleton} />}
    </>
  );

  // A question, its options as `stateOf` reads them, and a tap when answering.
  const renderQuestion = (
    q: AssignmentQuestion,
    i: number,
    stateOf: (optionId: number, correct: boolean | null) => OptionState,
    onPick?: (optionId: number) => void,
    note?: string | null,
  ) => (
    <View key={q.id} style={s.question}>
      <View style={s.qHead}>
        <Words skeleton={skeleton} style={s.qNo}>
          {`Q${i + 1}`}
        </Words>
        <Words skeleton={skeleton} style={s.qMarks}>
          {`${q.marks} mark${q.marks === 1 ? '' : 's'}`}
        </Words>
      </View>
      <Words skeleton={skeleton} style={s.qText}>
        {q.question_text}
      </Words>
      <View style={s.options}>
        {q.options.map((o, j) => (
          <OptionRow
            key={o.id}
            index={j}
            text={o.text}
            state={stateOf(o.id, o.is_correct)}
            onPress={onPick ? () => onPick(o.id) : undefined}
            skeleton={skeleton}
          />
        ))}
      </View>
      {!!note && (
        <Words skeleton={skeleton} style={s.note}>
          {note}
        </Words>
      )}
    </View>
  );

  // A student's sent answer.
  const renderSubmission = (a: Assignment) => {
    const sub = a.submission!;
    const status = STATUS[sub.status];
    const canEdit = a.type === 'written' && sub.status === 'submitted' && a.window_status === 'open';
    return (
      <View style={s.section}>
        <Words skeleton={skeleton} style={s.sectionTitle}>
          Your submission
        </Words>
        <View style={s.statusLine}>
          {skeleton ? (
            <Skeleton width={8} height={8} radius={4} />
          ) : (
            <View style={[s.dot, { backgroundColor: status.color }]} />
          )}
          <Words skeleton={skeleton} style={[s.statusText, !skeleton && { color: status.color }]}>
            {status.label}
          </Words>
          {!!sub.submitted_at && (
            <Words skeleton={skeleton} style={s.statusWhen}>
              {`· ${whenLabel(sub.submitted_at)}`}
            </Words>
          )}
        </View>

        <View>
          {a.type === 'mcq' && sub.mcq_score != null && (
            <Fact label="Score" value={`${sub.mcq_score}/${a.total_marks}`} skeleton={skeleton} />
          )}
          {sub.marks != null && (
            <Fact label="Marks" value={`${num(sub.marks)}${a.total_marks > 0 ? `/${num(a.total_marks)}` : ''}`} skeleton={skeleton} />
          )}
          {!!sub.remarks && <Fact label="Remark" value={sub.remarks} skeleton={skeleton} />}
        </View>

        {a.type === 'written' ? (
          <>
            {!!sub.answer_text && (
              <Words skeleton={skeleton} style={s.body}>
                {sub.answer_text}
              </Words>
            )}
            {!!sub.file && (
              <FileChip name={sub.file_name || sub.file} onPress={() => openFile(sub.file)} skeleton={skeleton} />
            )}
            {canEdit && !skeleton && (
              <QuietAction icon="edit-2" label="Edit your answer" onPress={() => startEditing(a)} />
            )}
          </>
        ) : (
          (a.questions ?? []).map((q, i) =>
            renderQuestion(
              q,
              i,
              (oid, correct) => reviewState(q, oid, correct),
              undefined,
              q.chosen_option_id == null ? 'Not answered' : null,
            ),
          )
        )}
      </View>
    );
  };

  // A student answering.
  const renderAttempt = (a: Assignment) => {
    if (a.type === 'mcq') {
      const qs = a.questions ?? [];
      return (
        <View style={s.section}>
          <Words skeleton={skeleton} style={s.sectionTitle}>
            Questions
          </Words>
          {qs.map((q, i) =>
            renderQuestion(
              q,
              i,
              oid => (picked[q.id] === oid ? 'picked' : 'idle'),
              oid => setPicked(p => ({ ...p, [q.id]: oid })),
            ),
          )}
          {skeleton ? (
            <Skeleton width="100%" height={48} radius={theme.radius.md} />
          ) : (
            <SubmitButton label="Submit answers" busy={sending} onPress={() => submitMcq(a)} />
          )}
        </View>
      );
    }

    const mode = a.submission_mode || 'both';
    const keptFile = editing ? a.submission?.file : null;
    return (
      <View style={s.section}>
        <Words skeleton={skeleton} style={s.sectionTitle}>
          {editing ? 'Edit your answer' : 'Your answer'}
        </Words>
        {skeleton ? (
          <Skeleton width="100%" height={mode === 'file' ? 48 : 160} radius={theme.radius.md} />
        ) : (
          <>
            {mode !== 'file' && (
              <FormCard
                label={mode === 'both' ? 'Answer (optional with a file)' : 'Answer'}
                value={answer}
                onChangeText={setAnswer}
                placeholder="Write your answer here"
                multiline
                minHeight={140}
              />
            )}
            {mode !== 'text' &&
              (file ? (
                <FileChip name={file.name} type={file.type} onRemove={() => setFile(null)} />
              ) : keptFile ? (
                <View style={s.keptRow}>
                  <FileChip name={a.submission?.file_name || keptFile} onPress={() => openFile(keptFile)} />
                  <QuietAction icon="paperclip" label="Replace file" onPress={() => setAttachOpen(true)} />
                </View>
              ) : (
                <QuietAction icon="paperclip" label="Attach a file" onPress={() => setAttachOpen(true)} />
              ))}
            <Hint>
              {mode === 'text'
                ? 'Answer this one in text.'
                : mode === 'file'
                ? 'Answer this one with a file — a photo, PDF or document up to 10 MB.'
                : 'Write your answer, attach a file (up to 10 MB), or both.'}
            </Hint>
            <View style={s.actions}>
              <SubmitButton label={editing ? 'Send again' : 'Submit'} busy={sending} onPress={() => submitWritten(a)} />
              {editing && <QuietAction icon="x" label="Cancel" onPress={() => setEditing(false)} />}
            </View>
          </>
        )}
      </View>
    );
  };

  const renderStudentPart = (a: Assignment) => {
    if (a.submission && !editing) return renderSubmission(a);
    if (a.window_status === 'upcoming') {
      return (
        <Words skeleton={skeleton} style={s.notice}>
          {`This assignment opens ${whenLabel(a.start_date)}. You can answer it then.`}
        </Words>
      );
    }
    if (a.window_status === 'closed') {
      return (
        <Words skeleton={skeleton} style={s.notice}>
          This assignment is closed.
        </Words>
      );
    }
    return renderAttempt(a);
  };

  // A teacher's view: the questions with their answers, then the class.
  const renderTeacherPart = (a: Assignment) => {
    const roster = a.roster ?? [];
    const stats = a.stats ?? {
      total: roster.length,
      submitted: roster.filter(r => r.status !== 'pending').length,
      pending: 0,
      reviewed: 0,
    };
    return (
      <>
        {a.type === 'mcq' && (a.questions ?? []).length > 0 && (
          <View style={s.section}>
            <Words skeleton={skeleton} style={s.sectionTitle}>
              Questions
            </Words>
            {(a.questions ?? []).map((q, i) => renderQuestion(q, i, (_oid, correct) => (correct ? 'answer' : 'idle')))}
          </View>
        )}

        <View style={s.block}>
          <Words skeleton={skeleton} style={s.sectionTitle}>
            Submissions
          </Words>
          <Words skeleton={skeleton} style={s.summary}>
            {`${stats.submitted} of ${stats.total} submitted` + (stats.reviewed ? ` · ${stats.reviewed} checked` : '')}
          </Words>
          {roster.length === 0 && !skeleton && <Text style={s.note}>No students in this class yet.</Text>}
          {roster.map((r, i) => {
            const status = STATUS[r.status];
            const score =
              r.marks != null
                ? `${num(r.marks)}/${num(a.total_marks)}`
                : a.type === 'mcq' && r.mcq_score != null
                ? `${r.mcq_score}/${a.total_marks}`
                : null;
            const opens = !!r.submission_id && !skeleton;
            const Row: any = opens ? TouchableOpacity : View;
            return (
              <Row
                key={r.student_detail_id}
                style={[s.person, i < roster.length - 1 && s.personDivider]}
                {...(opens
                  ? {
                      activeOpacity: 0.6,
                      onPress: () =>
                        navigation.navigate('AssignmentSubmission', {
                          assignmentId: a.id,
                          submissionId: r.submission_id,
                          assignment: a,
                          row: r,
                        }),
                    }
                  : {})}
              >
                {skeleton ? (
                  <Skeleton width={34} height={34} radius={17} />
                ) : (
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{initials(r.name)}</Text>
                  </View>
                )}
                <View style={s.personBody}>
                  <Words skeleton={skeleton} style={s.personName} numberOfLines={1}>
                    {r.name}
                  </Words>
                  <Words skeleton={skeleton} style={s.personSub} numberOfLines={1}>
                    {[r.roll_no ? `Roll ${r.roll_no}` : null, r.submitted_at ? whenLabel(r.submitted_at) : status.label]
                      .filter(Boolean)
                      .join(' · ')}
                  </Words>
                </View>
                <Words skeleton={skeleton} style={[s.personTag, !skeleton && { color: score ? theme.colors.textPrimary : status.color }]}>
                  {score ?? (r.status === 'pending' ? '—' : status.label)}
                </Words>
                {opens && (
                  <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
                )}
              </Row>
            );
          })}
        </View>
      </>
    );
  };

  const renderBody = () => {
    if (error && !detail && !skeleton) {
      return (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(true)} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!shown) return null;
    return (
      <ScrollView
        contentContainerStyle={s.page}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View pointerEvents={skeleton ? 'none' : 'auto'} style={s.pageInner}>
          {renderHead(shown)}
          {renderFacts(shown)}
          {renderInstructions(shown)}
          {teacher ? renderTeacherPart(shown) : renderStudentPart(shown)}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Assignment"
        onBackPress={() => navigation.goBack()}
        rightIcon={teacher && detail ? 'create-outline' : undefined}
        onRightPress={teacher && detail ? () => navigation.navigate('AssignmentForm', { assignment: detail }) : undefined}
      />
      {renderBody()}
      <OptionSheet
        visible={attachOpen}
        title="Attach"
        options={[
          { key: 'photo', label: 'Photo', sub: 'From your gallery' },
          { key: 'document', label: 'Document', sub: 'PDF, Word, Excel, PowerPoint or text' },
        ]}
        selected={[]}
        onPick={attach}
        onClose={() => setAttachOpen(false)}
      />
    </View>
  );
};

export default AssignmentDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  page: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  pageInner: { gap: 22 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headBody: { flex: 1, gap: 3 },
  title: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary, lineHeight: 24 },
  sub: { fontSize: 13, color: theme.colors.textSecondary },

  section: { gap: 12 },
  block: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  body: { fontSize: 15, color: theme.colors.textPrimary, lineHeight: 22 },
  notice: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  note: { fontSize: 12, color: theme.colors.textMuted },
  summary: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 },

  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: '600' },
  statusWhen: { fontSize: 13, color: theme.colors.textMuted },

  question: { gap: 8 },
  qHead: { flexDirection: 'row', justifyContent: 'space-between' },
  qNo: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  qMarks: { fontSize: 12, color: theme.colors.textMuted },
  qText: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary, lineHeight: 22 },
  options: { gap: 8, marginTop: 2 },

  keptRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actions: { gap: 14 },

  // The class, student by student
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  personDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },
  personBody: { flex: 1, gap: 2 },
  personName: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  personSub: { fontSize: 12, color: theme.colors.textSecondary },
  personTag: { fontSize: 13, fontWeight: '500', color: theme.colors.textMuted },

  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

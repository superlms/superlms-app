import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import {
  getAssignmentSubmission,
  assignmentErrorMessage,
  type Assignment,
  type RosterRow,
  type SubmissionDetail,
} from '../../api/assignmentApi';
import { Fact, FileChip, OptionRow, STATUS, Words, num, openFile, whenLabel, type OptionState } from './assignmentUi';

/**
 * What one student turned in, for their teacher: who, when, where it stands
 * (status, marks, remark), then their written answer and file — or each MCQ
 * with the option they chose and the right one, and their score.
 *
 * While it loads, it is drawn from the student's row on the class list, the
 * assignment, and what this page held last time.
 */

const SAMPLE_TEXT =
  'The answer as the student wrote it, line after line, running on for a few sentences like a short paragraph.';

const AssignmentSubmissionScreen = ({ navigation, route }: any) => {
  const assignmentId: number = route.params?.assignmentId;
  const submissionId: number = route.params?.submissionId;
  const assignment: Assignment | undefined = route.params?.assignment;
  const row: RosterRow | undefined = route.params?.row;

  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastHere, rememberHere] = useLastLoaded<SubmissionDetail>(`assignment-submission:${submissionId}`);

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const next = await getAssignmentSubmission(assignmentId, submissionId);
        setDetail(next);
        rememberHere(next);
      } catch (e: any) {
        console.log('[AssignmentSubmission] Error:', e?.response?.status, e?.message);
        setError(assignmentErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [assignmentId, submissionId, rememberHere],
  );

  const { refreshing, onRefresh } = useRefresh(() => load(true));
  useFocusLoad(() => load());

  // While loading: the row and the assignment as the class list had them.
  const drawn = (): SubmissionDetail => {
    if (lastHere && lastHere.id === submissionId) return lastHere;
    const a: Assignment | undefined = assignment;
    return {
      id: submissionId,
      assignment: a as Assignment,
      student: { id: row?.student_detail_id ?? null, name: row?.name ?? 'Student name', roll_no: row?.roll_no ?? '1', image: null },
      status: row?.status && row.status !== 'pending' ? row.status : 'submitted',
      answer_text: a?.type === 'mcq' ? null : SAMPLE_TEXT,
      file: null,
      file_name: null,
      marks: row?.marks ?? null,
      mcq_score: row?.mcq_score ?? null,
      remarks: null,
      submitted_at: row?.submitted_at ?? null,
      answers:
        a?.type === 'mcq'
          ? (a.questions ?? []).map(q => ({ ...q, question_id: q.id, chosen_option_id: q.options[0]?.id ?? null }))
          : [],
    };
  };

  const skeleton = loading || refreshing;
  const shown = skeleton ? drawn() : detail;
  const a = shown?.assignment ?? assignment;
  const total = a?.total_marks ?? 0;

  const renderPage = (d: SubmissionDetail) => {
    const status = STATUS[d.status];
    const isMcq = (d.assignment?.type ?? assignment?.type) === 'mcq';
    return (
      <View style={s.pageInner} pointerEvents={skeleton ? 'none' : 'auto'}>
        {/* Who */}
        <View style={s.head}>
          {skeleton ? (
            <Skeleton width={44} height={44} radius={22} />
          ) : (
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {(d.student.name ?? '?')
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map(w => w[0]?.toUpperCase())
                  .join('')}
              </Text>
            </View>
          )}
          <View style={s.headBody}>
            <Words skeleton={skeleton} style={s.name}>
              {d.student.name ?? 'Student'}
            </Words>
            <Words skeleton={skeleton} style={s.sub}>
              {[d.student.roll_no ? `Roll ${d.student.roll_no}` : null, a?.title].filter(Boolean).join(' · ')}
            </Words>
          </View>
        </View>

        {/* Where it stands */}
        <View>
          <View style={s.fact}>
            <Words skeleton={skeleton} style={s.factLabel}>
              Status
            </Words>
            <Words skeleton={skeleton} style={[s.factValue, !skeleton && s.factStrong, !skeleton && { color: status.color }]}>
              {status.label}
            </Words>
          </View>
          {!!d.submitted_at && <Fact label="Sent" value={whenLabel(d.submitted_at)} skeleton={skeleton} />}
          {isMcq && d.mcq_score != null && <Fact label="Score" value={`${d.mcq_score}/${total}`} skeleton={skeleton} />}
          {d.marks != null && (
            <Fact label="Marks" value={`${num(d.marks)}${total > 0 ? `/${num(total)}` : ''}`} skeleton={skeleton} />
          )}
          {!!d.remarks && <Fact label="Remark" value={d.remarks} skeleton={skeleton} />}
        </View>

        {/* What they sent */}
        {isMcq ? (
          <View style={s.section}>
            <Words skeleton={skeleton} style={s.sectionTitle}>
              Answers
            </Words>
            {d.answers.map((q, i) => (
              <View key={q.question_id} style={s.question}>
                <View style={s.qHead}>
                  <Words skeleton={skeleton} style={s.qNo}>
                    {`Q${i + 1}`}
                  </Words>
                  <Words skeleton={skeleton} style={s.qMarks}>
                    {q.chosen_option_id == null ? 'Not answered' : q.is_correct ? `+${q.marks}` : '0'}
                  </Words>
                </View>
                <Words skeleton={skeleton} style={s.qText}>
                  {q.question_text}
                </Words>
                <View style={s.options}>
                  {q.options.map((o, j) => {
                    const chosen = q.chosen_option_id === o.id;
                    const state: OptionState = chosen ? (o.is_correct ? 'right' : 'wrong') : o.is_correct ? 'answer' : 'idle';
                    return <OptionRow key={o.id} index={j} text={o.text} state={state} skeleton={skeleton} />;
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.section}>
            <Words skeleton={skeleton} style={s.sectionTitle}>
              Answer
            </Words>
            {d.answer_text ? (
              <Words skeleton={skeleton} style={s.body}>
                {d.answer_text}
              </Words>
            ) : (
              !d.file && <Text style={s.note}>Nothing was written.</Text>
            )}
            {!!d.file && <FileChip name={d.file_name || d.file} onPress={() => openFile(d.file)} skeleton={skeleton} />}
          </View>
        )}
      </View>
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
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {renderPage(shown)}
      </ScrollView>
    );
  };

  return (
    <View style={s.root}>
      <DocHeader title="Submission" onBackPress={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};

export default AssignmentSubmissionScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  page: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  pageInner: { gap: 22 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headBody: { flex: 1, gap: 3 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
  name: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary },
  sub: { fontSize: 13, color: theme.colors.textSecondary },

  fact: { flexDirection: 'row', gap: 12, paddingVertical: 5 },
  factLabel: { width: 72, fontSize: 13, color: theme.colors.textMuted },
  factValue: { fontSize: 14, color: theme.colors.textPrimary },
  factStrong: { fontWeight: '600' },

  section: { gap: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  body: { fontSize: 15, color: theme.colors.textPrimary, lineHeight: 22 },
  note: { fontSize: 13, color: theme.colors.textMuted },

  question: { gap: 8 },
  qHead: { flexDirection: 'row', justifyContent: 'space-between' },
  qNo: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  qMarks: { fontSize: 12, color: theme.colors.textMuted },
  qText: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary, lineHeight: 22 },
  options: { gap: 8, marginTop: 2 },

  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton, SkeletonIcon } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { SubjectRow } from '../subjects/subjectLists';
import { plural } from '../subjects/subjectsUi';
import {
  getStudentExamResult,
  marksErrorMessage,
  type ExamSubjectResult,
  type GradeBand,
  type StudentExamResult,
} from '../../api/marksApi';
import type { Exam } from '../exam/examData';
import { Words } from '../exam/examUi';

/**
 * One exam's result for a student: the score, then each subject as the
 * Subjects list draws it — icon and name — with the marks, grade and
 * percentage the teacher added, "Absent", or that marks aren't in yet.
 *
 * A load — the first, a pull to refresh, Try again — draws the page as a
 * skeleton from the result it shows, the one this exam had last time, the
 * last of any exam, or an ordinary one.
 */

// 45 → "45", 45.5 → "45.5"
const fmt = (n: number) => String(Number(n.toFixed(2)));

const subjectMeta = (sub: ExamSubjectResult) => {
  if (!sub.uploaded) return 'Marks not added yet';
  if (sub.is_absent) return 'Absent';
  return [
    `${fmt(sub.marks_obtained ?? 0)} / ${fmt(sub.max_marks ?? 0)}`,
    sub.grade ? `Grade ${sub.grade}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
};

// "O 91–100 · A+ 81–90 · … · F below 35"
const scaleText = (scale: GradeBand[]) =>
  scale
    .map(b => (b.min <= 0 ? `${b.grade} below ${b.max + 1}` : `${b.grade} ${b.min}–${b.max}`))
    .join(' · ');

// ── A result to draw before any has loaded here ──────────────────────────────
const SAMPLE_SCALE: GradeBand[] = [
  { grade: 'O', min: 91, max: 100, remark: 'Outstanding' },
  { grade: 'A+', min: 81, max: 90, remark: 'Excellent' },
  { grade: 'A', min: 71, max: 80, remark: 'Very Good' },
  { grade: 'B', min: 61, max: 70, remark: 'Good' },
  { grade: 'C', min: 51, max: 60, remark: 'Fair' },
  { grade: 'D', min: 41, max: 50, remark: 'Average' },
  { grade: 'P', min: 35, max: 40, remark: 'Pass' },
  { grade: 'F', min: 0, max: 34, remark: 'Fail' },
];

const sampleResult = (exam: Exam): StudentExamResult => {
  const total = exam.totalMarks > 0 ? exam.totalMarks : 100;
  const done = exam.status === 'Completed';
  const subjects = ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science'].map(
    (name, i): ExamSubjectResult => {
      const obtained = Math.round(total * (0.62 + i * 0.06));
      return {
        subject_id: -(i + 1),
        subject_name: name,
        subject_image: null,
        uploaded: done,
        is_absent: false,
        marks_obtained: done ? obtained : null,
        max_marks: done ? total : null,
        percentage: done ? (obtained / total) * 100 : null,
        grade: done ? 'A' : null,
        remarks: null,
      };
    },
  );
  const obtained = subjects.reduce((a, x) => a + (x.marks_obtained ?? 0), 0);
  const max = done ? total * subjects.length : 0;
  return {
    exam: { id: Number(exam.id) || 0, name: exam.name, total_marks: total, passing_marks: null },
    subjects,
    summary: {
      subjects: subjects.length,
      uploaded: done ? subjects.length : 0,
      absent: 0,
      marks_obtained: obtained,
      max_marks: max,
      percentage: done ? (obtained / max) * 100 : null,
      grade: done ? 'A' : null,
      remark: done ? 'Very Good' : null,
    },
    grading_scale: SAMPLE_SCALE,
  };
};

const isResult = (r: StudentExamResult | null | undefined): r is StudentExamResult =>
  !!r && Array.isArray(r.subjects);

const ProgressBar = ({ pct, skeleton }: { pct: number; skeleton: boolean }) =>
  skeleton ? (
    <Skeleton width="100%" height={5} radius={3} />
  ) : (
    <View style={s.barBg}>
      <View style={[s.barFill, { width: `${Math.max(0, Math.min(100, pct))}%` as any }]} />
    </View>
  );

const ExamResultScreen = ({ navigation, route }: any) => {
  const exam: Exam = route.params.exam;
  const [result, setResult] = useState<StudentExamResult | null>(null);
  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back to the screen updates it in place.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastHere, rememberHere] = useLastLoaded<StudentExamResult>(`exam-result:${exam.id}`);
  const [lastAny, rememberAny] = useLastLoaded<StudentExamResult>('exam-result');

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const next = await getStudentExamResult(exam.id);
        setResult(next);
        rememberHere(next);
        rememberAny(next);
      } catch (e: any) {
        console.log('[getStudentExamResult] Error:', e?.response?.status, e?.message);
        setError(marksErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [exam.id, rememberHere, rememberAny],
  );

  const reload = useCallback(() => load(true), [load]);

  useFocusLoad(() => load());

  // The result the page is drawn from: while loading, what it last showed.
  const view: StudentExamResult | null = loading
    ? result ?? (isResult(lastHere) ? lastHere : isResult(lastAny) ? lastAny : sampleResult(exam))
    : result;

  const renderScore = (r: StudentExamResult, skeleton: boolean) => {
    const { summary } = r;
    if (summary.uploaded === 0 || summary.percentage === null) {
      return (
        <View style={s.notice}>
          {skeleton ? (
            <SkeletonIcon iconName="time-outline" size={18} />
          ) : (
            <VectorIcon iconSet="Ionicons" iconName="time-outline" size={18} color={theme.colors.textMuted} />
          )}
          <View style={s.noticeBody}>
            <Words skeleton={skeleton} style={s.noticeText}>
              Marks for this exam haven’t been added yet.
            </Words>
          </View>
        </View>
      );
    }

    const pct = Math.round(summary.percentage);
    const stats = [
      { label: 'Marks', value: `${fmt(summary.marks_obtained)}/${fmt(summary.max_marks)}` },
      {
        label: 'Subjects',
        value:
          summary.uploaded >= summary.subjects
            ? String(summary.uploaded)
            : `${summary.uploaded} of ${summary.subjects}`,
      },
      ...(summary.absent > 0 ? [{ label: 'Absent', value: String(summary.absent) }] : []),
    ];

    return (
      <View>
        <View style={s.hero}>
          <View style={s.heroText}>
            <Words skeleton={skeleton} style={s.heroCaption}>
              Score
            </Words>
            <Words skeleton={skeleton} style={s.bigPct}>
              {pct}%
            </Words>
            {!!summary.remark && (
              <Words skeleton={skeleton} style={s.heroLabel}>
                {summary.remark}
              </Words>
            )}
          </View>
          {!!summary.grade &&
            (skeleton ? (
              <Skeleton width={68} height={68} radius={34} />
            ) : (
              <View style={s.gradeBadge}>
                <Text style={s.gradeValue}>{summary.grade}</Text>
                <Text style={s.gradeCaption}>Grade</Text>
              </View>
            ))}
        </View>

        <View style={s.heroBar}>
          <ProgressBar pct={pct} skeleton={skeleton} />
        </View>

        <View style={s.stats}>
          {stats.map((st, i) => (
            <View key={st.label} style={[s.stat, i > 0 && s.statDivider]}>
              <Words skeleton={skeleton} style={s.statValue}>
                {st.value}
              </Words>
              <Words skeleton={skeleton} style={s.statLabel}>
                {st.label}
              </Words>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderPage = (r: StudentExamResult, skeleton: boolean) => {
    const subjects = r.subjects;
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, subjects.length === 0 && s.grow]}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {renderScore(r, skeleton)}

        {subjects.length === 0 ? (
          <DocNoData
            icon="albums-outline"
            title="No subjects yet"
            subtitle="No subjects have been assigned to your class."
            skeleton={skeleton}
          />
        ) : (
          <>
            <Words skeleton={skeleton} style={s.count}>
              {plural(subjects.length, 'subject')}
            </Words>
            {subjects.map((sub, i) => (
              <SubjectRow
                key={sub.subject_id}
                image={sub.subject_image}
                title={sub.subject_name}
                meta={subjectMeta(sub)}
                isLast={i === subjects.length - 1}
                skeleton={skeleton}
                trailing={
                  !sub.uploaded ? null : sub.is_absent ? (
                    <Words skeleton={skeleton} style={[s.trailing, s.absent]}>
                      AB
                    </Words>
                  ) : (
                    <Words skeleton={skeleton} style={s.trailing}>
                      {Math.round(sub.percentage ?? 0)}%
                    </Words>
                  )
                }
              />
            ))}
          </>
        )}

        {r.summary.uploaded > 0 && r.grading_scale?.length > 0 && (
          <Words skeleton={skeleton} style={s.scale}>
            Grade scale: {scaleText(r.grading_scale)}
          </Words>
        )}
      </ScrollView>
    );
  };

  const renderBody = () => {
    if (loading && view) return renderPage(view, true);

    if (!result) {
      return (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error ?? 'Something went wrong. Please try again.'}</Text>
          <TouchableOpacity onPress={reload} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return renderPage(result, false);
  };

  return (
    <View style={s.root}>
      <DocHeader title={exam.name} onBackPress={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};

export default ExamResultScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  grow: { flexGrow: 1 },

  // Score
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroText: { flex: 1 },
  heroCaption: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },
  bigPct: { fontSize: 40, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 48 },
  heroLabel: { fontSize: 14, color: theme.colors.textSecondary },
  gradeBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeValue: { fontSize: 22, fontWeight: '700', color: theme.colors.primary, lineHeight: 26 },
  gradeCaption: { fontSize: 11, color: theme.colors.primary },
  heroBar: { marginTop: 16 },

  // Stats
  stats: {
    flexDirection: 'row',
    marginTop: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: theme.colors.border },
  statValue: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  statLabel: { fontSize: 12, color: theme.colors.textMuted },

  // Progress bar
  barBg: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.primary },

  // Nothing added yet
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  noticeBody: { flex: 1 },
  noticeText: { fontSize: 13, color: theme.colors.textSecondary },

  // Subjects
  count: { fontSize: 12, color: theme.colors.textMuted, marginTop: 24, marginBottom: 2 },
  trailing: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  absent: { color: theme.colors.danger },

  scale: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18, marginTop: 20 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

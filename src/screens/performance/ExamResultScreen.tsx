import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
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

/**
 * One exam's result for a student: the score, then each subject as the
 * Subjects list draws it — icon and name — with the marks, grade and
 * percentage the teacher added, "Absent", or that marks aren't in yet.
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

const ProgressBar = ({ pct }: { pct: number }) => (
  <View style={s.barBg}>
    <View style={[s.barFill, { width: `${Math.max(0, Math.min(100, pct))}%` as any }]} />
  </View>
);

const ResultSkeleton = ({ rows }: { rows: number }) => {
  const n = rows > 0 ? Math.min(rows, 10) : 5;
  return (
    <View style={s.scroll}>
      <View style={s.hero}>
        <View style={s.skHeroText}>
          <Skeleton width={40} height={12} />
          <Skeleton width={90} height={36} />
          <Skeleton width={70} height={13} />
        </View>
        <Skeleton width={68} height={68} radius={34} />
      </View>
      <View style={s.heroBar}>
        <Skeleton width="100%" height={5} />
      </View>
      <View style={s.skCount}>
        <Skeleton width={70} height={12} />
      </View>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={[s.skRow, i < n - 1 && s.rowDivider]}>
          <Skeleton width={30} height={30} radius={6} />
          <View style={s.skBody}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="35%" height={12} />
          </View>
          <Skeleton width={34} height={14} />
        </View>
      ))}
    </View>
  );
};

const ExamResultScreen = ({ navigation, route }: any) => {
  const exam: Exam = route.params.exam;
  const [result, setResult] = useState<StudentExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await getStudentExamResult(exam.id));
    } catch (e: any) {
      console.log('[getStudentExamResult] Error:', e?.response?.status, e?.message);
      setError(marksErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [exam.id]);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  const renderScore = (r: StudentExamResult) => {
    const { summary } = r;
    if (summary.uploaded === 0 || summary.percentage === null) {
      return (
        <View style={s.notice}>
          <VectorIcon iconSet="Ionicons" iconName="time-outline" size={18} color={theme.colors.textMuted} />
          <Text style={s.noticeText}>Marks for this exam haven’t been added yet.</Text>
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
            <Text style={s.heroCaption}>Score</Text>
            <Text style={s.bigPct}>{pct}%</Text>
            {!!summary.remark && <Text style={s.heroLabel}>{summary.remark}</Text>}
          </View>
          {!!summary.grade && (
            <View style={s.gradeBadge}>
              <Text style={s.gradeValue}>{summary.grade}</Text>
              <Text style={s.gradeCaption}>Grade</Text>
            </View>
          )}
        </View>

        <View style={s.heroBar}>
          <ProgressBar pct={pct} />
        </View>

        <View style={s.stats}>
          {stats.map((st, i) => (
            <View key={st.label} style={[s.stat, i > 0 && s.statDivider]}>
              <Text style={s.statValue}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderBody = () => {
    if (refreshing || (loading && !result)) {
      return <ResultSkeleton rows={result?.subjects.length ?? 0} />;
    }

    if (!result) {
      return (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error ?? 'Something went wrong. Please try again.'}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const subjects = result.subjects;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, subjects.length === 0 && s.grow]}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {renderScore(result)}

        {subjects.length === 0 ? (
          <DocNoData
            icon="albums-outline"
            title="No subjects yet"
            subtitle="No subjects have been assigned to your class."
          />
        ) : (
          <>
            <Text style={s.count}>{plural(subjects.length, 'subject')}</Text>
            {subjects.map((sub, i) => (
              <SubjectRow
                key={sub.subject_id}
                image={sub.subject_image}
                title={sub.subject_name}
                meta={subjectMeta(sub)}
                isLast={i === subjects.length - 1}
                trailing={
                  !sub.uploaded ? null : sub.is_absent ? (
                    <Text style={[s.trailing, s.absent]}>AB</Text>
                  ) : (
                    <Text style={s.trailing}>{Math.round(sub.percentage ?? 0)}%</Text>
                  )
                }
              />
            ))}
          </>
        )}

        {result.summary.uploaded > 0 && result.grading_scale?.length > 0 && (
          <Text style={s.scale}>Grade scale: {scaleText(result.grading_scale)}</Text>
        )}
      </ScrollView>
    );
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
  noticeText: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },

  // Subjects
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 24, paddingBottom: 2 },
  trailing: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  absent: { color: theme.colors.danger },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },

  scale: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18, marginTop: 20 },

  // Loading
  skHeroText: { flex: 1, gap: 8 },
  skCount: { paddingTop: 25, paddingBottom: 3 },
  skRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  skBody: { flex: 1, gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

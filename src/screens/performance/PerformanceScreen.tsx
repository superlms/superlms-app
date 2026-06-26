import React, { useCallback, useEffect, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { getStudentMarks, marksErrorMessage } from '../../api/marksApi';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SubjectMark {
  subject: string;
  obtained: number;
  total: number;
  color: string;
}

interface ExamResult {
  id: string;
  examName: string;
  subjects: SubjectMark[];
}

// ─── Subject colour (server has no styling) ───────────────────────────────────
const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: '#4F46E5',
  Science: '#0EA5E9',
  English: '#D97706',
  'Social Science': '#16A34A',
  Hindi: '#DC2626',
  'Computer Science': '#7C3AED',
};
const PALETTE = ['#4F46E5', '#0EA5E9', '#D97706', '#16A34A', '#DC2626', '#7C3AED', '#0891B2', '#DB2777'];
const subjectColor = (name: string): string => {
  if (SUBJECT_COLORS[name]) return SUBJECT_COLORS[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
};

// Group a flat marks list into exam → subjects.
const buildExamResults = (marks: any[]): ExamResult[] => {
  const byExam = new Map<number, ExamResult>();
  marks.forEach(m => {
    if (m.is_absent) return;
    const total = Number(m.max_marks ?? 0);
    if (!total) return;
    let exam = byExam.get(m.exam_id);
    if (!exam) {
      exam = { id: String(m.exam_id), examName: m.exam_name ?? 'Exam', subjects: [] };
      byExam.set(m.exam_id, exam);
    }
    exam.subjects.push({
      subject: m.subject_name ?? 'Subject',
      obtained: Number(m.marks_obtained ?? 0),
      total,
      color: subjectColor(m.subject_name ?? ''),
    });
  });
  return Array.from(byExam.values());
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getGrade = (pct: number) => {
  if (pct >= 90) return { grade: 'A+', color: '#16A34A' };
  if (pct >= 80) return { grade: 'A', color: '#16A34A' };
  if (pct >= 70) return { grade: 'B+', color: '#0EA5E9' };
  if (pct >= 60) return { grade: 'B', color: '#0EA5E9' };
  if (pct >= 50) return { grade: 'C', color: '#D97706' };
  if (pct >= 35) return { grade: 'D', color: '#D97706' };
  return { grade: 'F', color: '#DC2626' };
};

const getPerformanceLabel = (pct: number) => {
  if (pct >= 90)
    return {
      label: 'Outstanding',
      color: '#16A34A',
      bg: '#DCFCE7',
      icon: 'trophy',
    };
  if (pct >= 75)
    return {
      label: 'Excellent',
      color: '#0EA5E9',
      bg: '#E0F2FE',
      icon: 'star',
    };
  if (pct >= 60)
    return {
      label: 'Good',
      color: '#4F46E5',
      bg: '#E0E7FF',
      icon: 'thumbs-up',
    };
  if (pct >= 45)
    return {
      label: 'Average',
      color: '#D97706',
      bg: '#FEF3C7',
      icon: 'trending-up',
    };
  return {
    label: 'Needs Improvement',
    color: '#DC2626',
    bg: '#FEE2E2',
    icon: 'alert-circle',
  };
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const ProgressBar = ({ pct, color }: { pct: number; color: string }) => (
  <View style={pStyles.barBg}>
    <View
      style={[
        pStyles.barFill,
        { width: `${pct}%` as any, backgroundColor: color },
      ]}
    />
  </View>
);

const __mk_pStyles = () => StyleSheet.create({
  barBg: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
const PerformanceScreen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const marks = await getStudentMarks();
      const results = buildExamResults(marks);
      setExamResults(results);
      setExpandedId(results[0]?.id ?? null);
    } catch (e: any) {
      console.log('[getStudentMarks] Error:', e?.response?.status, e?.message);
      setError(marksErrorMessage(e));
      setExamResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  // Overall stats across all exams
  const allSubjectTotals: Record<
    string,
    { obtained: number; total: number; color: string }
  > = {};
  let grandObtained = 0;
  let grandTotal = 0;

  examResults.forEach(exam => {
    exam.subjects.forEach(s => {
      if (!allSubjectTotals[s.subject]) {
        allSubjectTotals[s.subject] = { obtained: 0, total: 0, color: s.color };
      }
      allSubjectTotals[s.subject].obtained += s.obtained;
      allSubjectTotals[s.subject].total += s.total;
      grandObtained += s.obtained;
      grandTotal += s.total;
    });
  });

  const overallPct =
    grandTotal > 0 ? Math.round((grandObtained / grandTotal) * 100) : 0;
  const overallPerf = getPerformanceLabel(overallPct);
  const { grade: overallGrade } = getGrade(overallPct);

  if (loading) {
    return (
      <View style={styles.safeArea}>
        <Header title="My Performance" />
        <View style={styles.center}>
          <ScreenSkeleton variant="dashboard" />
        </View>
      </View>
    );
  }

  if (error || examResults.length === 0) {
    return (
      <View style={styles.safeArea}>
        <Header title="My Performance" />
        <View style={styles.center}>
          <View style={styles.stateIconWrap}>
            <VectorIcon
              iconSet="Ionicons"
              iconName={error ? 'cloud-offline-outline' : 'bar-chart-outline'}
              size={32}
              color={error ? theme.colors.danger : theme.colors.primary}
            />
          </View>
          <Text style={styles.stateTitle}>
            {error ? 'Couldn’t load performance' : 'No results yet'}
          </Text>
          <Text style={styles.stateText}>
            {error || 'Your marks will appear here once exams are graded.'}
          </Text>
          {!!error && (
            <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
              <VectorIcon iconSet="Ionicons" iconName="refresh" size={15} color={theme.colors.primary} />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <Header title="My Performance" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ── Overall Summary Card ── */}
        <View style={styles.summaryCard}>
          <View
            style={[
              styles.summaryAccent,
              { backgroundColor: overallPerf.color },
            ]}
          />
          <View style={styles.summaryInner}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={styles.summaryTitle}>Overall Performance</Text>
                <Text style={styles.summarySubtitle}>
                  {examResults.length} Exams ·{' '}
                  {Object.keys(allSubjectTotals).length} Subjects
                </Text>
              </View>
              <View
                style={[styles.gradeBadge, { backgroundColor: overallPerf.bg }]}
              >
                <Text style={[styles.gradeText, { color: overallPerf.color }]}>
                  {overallGrade}
                </Text>
              </View>
            </View>

            {/* Big percentage circle */}
            <View style={styles.circleRow}>
              <View style={[styles.circle, { borderColor: overallPerf.color }]}>
                <Text
                  style={[styles.circlePercent, { color: overallPerf.color }]}
                >
                  {overallPct}%
                </Text>
                <Text style={styles.circleLabel}>Score</Text>
              </View>
              <View style={styles.summaryStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{grandObtained}</Text>
                  <Text style={styles.statLabel}>Obtained</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{grandTotal}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {grandTotal - grandObtained}
                  </Text>
                  <Text style={styles.statLabel}>Lost</Text>
                </View>
              </View>
            </View>

            <View
              style={[styles.perfBadge, { backgroundColor: overallPerf.bg }]}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName={overallPerf.icon}
                size={15}
                color={overallPerf.color}
              />
              <Text
                style={[styles.perfBadgeText, { color: overallPerf.color }]}
              >
                {overallPerf.label}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Subject-wise Overall ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subject-wise Overall</Text>
          <View style={styles.card}>
            {Object.entries(allSubjectTotals).map(([subject, data], i, arr) => {
              const pct = Math.round((data.obtained / data.total) * 100);
              const { grade } = getGrade(pct);
              return (
                <View key={subject}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.subjectRow}>
                    <View
                      style={[
                        styles.subjectDot,
                        { backgroundColor: data.color },
                      ]}
                    />
                    <View style={{ flex: 1, gap: 5 }}>
                      <View style={styles.subjectTopRow}>
                        <Text style={styles.subjectName}>{subject}</Text>
                        <View style={styles.subjectRight}>
                          <Text style={styles.subjectMarks}>
                            {data.obtained}/{data.total}
                          </Text>
                          <View
                            style={[
                              styles.gradeChip,
                              { backgroundColor: data.color + '20' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.gradeChipText,
                                { color: data.color },
                              ]}
                            >
                              {grade}
                            </Text>
                          </View>
                          <Text
                            style={[styles.subjectPct, { color: data.color }]}
                          >
                            {pct}%
                          </Text>
                        </View>
                      </View>
                      <ProgressBar pct={pct} color={data.color} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Exam-wise Breakdown ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exam-wise Breakdown</Text>
          {examResults.map(exam => {
            const examObtained = exam.subjects.reduce(
              (s, x) => s + x.obtained,
              0,
            );
            const examTotal = exam.subjects.reduce((s, x) => s + x.total, 0);
            const examPct = Math.round((examObtained / examTotal) * 100);
            const { grade } = getGrade(examPct);
            const perf = getPerformanceLabel(examPct);
            const isExpanded = expandedId === exam.id;

            return (
              <View key={exam.id} style={styles.examCard}>
                {/* Exam header */}
                <TouchableOpacity
                  style={styles.examHeader}
                  onPress={() => setExpandedId(isExpanded ? null : exam.id)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[styles.examIconWrap, { backgroundColor: perf.bg }]}
                  >
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName={perf.icon}
                      size={18}
                      color={perf.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.examName}>{exam.examName}</Text>
                    <Text style={styles.examMeta}>
                      {exam.subjects.length} subject
                      {exam.subjects.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.examHeaderRight}>
                    <Text style={[styles.examPct, { color: perf.color }]}>
                      {examPct}%
                    </Text>
                    <Text style={styles.examMarks}>
                      {examObtained}/{examTotal}
                    </Text>
                    <View
                      style={[styles.gradeChip, { backgroundColor: perf.bg }]}
                    >
                      <Text
                        style={[styles.gradeChipText, { color: perf.color }]}
                      >
                        {grade}
                      </Text>
                    </View>
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={theme.colors.textMuted}
                    />
                  </View>
                </TouchableOpacity>

                {/* Exam total progress bar */}
                <View style={styles.examBarRow}>
                  <ProgressBar pct={examPct} color={perf.color} />
                </View>

                {/* Subject breakdown */}
                {isExpanded && (
                  <View style={styles.subjectList}>
                    {exam.subjects.map((s, i) => {
                      const sPct = Math.round((s.obtained / s.total) * 100);
                      const { grade: sg } = getGrade(sPct);
                      return (
                        <View key={i} style={styles.subjectDetailRow}>
                          <View
                            style={[
                              styles.subjectDot,
                              { backgroundColor: s.color },
                            ]}
                          />
                          <View style={{ flex: 1, gap: 4 }}>
                            <View style={styles.subjectTopRow}>
                              <Text style={styles.subjectName}>
                                {s.subject}
                              </Text>
                              <View style={styles.subjectRight}>
                                <Text style={styles.subjectMarks}>
                                  {s.obtained}/{s.total}
                                </Text>
                                <View
                                  style={[
                                    styles.gradeChip,
                                    { backgroundColor: s.color + '20' },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.gradeChipText,
                                      { color: s.color },
                                    ]}
                                  >
                                    {sg}
                                  </Text>
                                </View>
                                <Text
                                  style={[
                                    styles.subjectPct,
                                    { color: s.color },
                                  ]}
                                >
                                  {sPct}%
                                </Text>
                              </View>
                            </View>
                            <ProgressBar pct={sPct} color={s.color} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Grade Legend ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grade Scale</Text>
          <View style={styles.card}>
            <View style={styles.gradeGrid}>
              {[
                { grade: 'A+', range: '90–100%', color: '#16A34A' },
                { grade: 'A', range: '80–89%', color: '#16A34A' },
                { grade: 'B+', range: '70–79%', color: '#0EA5E9' },
                { grade: 'B', range: '60–69%', color: '#0EA5E9' },
                { grade: 'C', range: '50–59%', color: '#D97706' },
                { grade: 'D', range: '35–49%', color: '#D97706' },
                { grade: 'F', range: 'Below 35%', color: '#DC2626' },
              ].map(g => (
                <View key={g.grade} style={styles.gradeItem}>
                  <View
                    style={[
                      styles.gradeBadgeSm,
                      { backgroundColor: g.color + '20' },
                    ]}
                  >
                    <Text style={[styles.gradeBadgeSmText, { color: g.color }]}>
                      {g.grade}
                    </Text>
                  </View>
                  <Text style={styles.gradeRange}>{g.range}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default PerformanceScreen;

const __mk_styles = () => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: 16, paddingBottom: 30 },

  // States
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: 10,
  },
  stateIconWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stateTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  stateText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  // Summary card
  summaryCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  summaryAccent: { height: 5 },
  summaryInner: { padding: theme.spacing.lg, gap: 14 },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  summarySubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  gradeBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: { fontSize: 18, fontWeight: '800' },

  circleRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  circle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePercent: { fontSize: 22, fontWeight: '800' },
  circleLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },

  summaryStats: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  statLabel: { fontSize: 11, color: theme.colors.textMuted },
  statDivider: { width: 1, height: 30, backgroundColor: theme.colors.border },

  perfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  perfBadgeText: { fontSize: 13, fontWeight: '700' },

  // Sections
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },

  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: theme.colors.border },

  // Subject row
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  subjectDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  subjectDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  subjectTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  subjectRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subjectMarks: { fontSize: 12, color: theme.colors.textSecondary },
  subjectPct: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },

  gradeChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  gradeChipText: { fontSize: 11, fontWeight: '700' },

  // Exam card
  examCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: 10,
  },
  examHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: theme.spacing.md,
  },
  examIconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  examMeta: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  examHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  examPct: { fontSize: 15, fontWeight: '800' },
  examMarks: { fontSize: 11, color: theme.colors.textSecondary },
  examBarRow: { paddingHorizontal: theme.spacing.md, paddingBottom: 10 },
  subjectList: { paddingBottom: 6 },

  // Grade legend
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: theme.spacing.md,
    gap: 10,
  },
  gradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '45%',
  },
  gradeBadgeSm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeBadgeSmText: { fontSize: 13, fontWeight: '800' },
  gradeRange: { fontSize: 12, color: theme.colors.textSecondary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let pStyles = __mk_pStyles();
onThemeChange(() => { pStyles = __mk_pStyles(); });
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });

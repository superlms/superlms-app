import React, { useCallback, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { getStudentMarks, marksErrorMessage } from '../../api/marksApi';
import {
  DocHeader,
  DocSection,
  DocNoData,
  DocLoading,
  DocError,
  docStyles,
} from '../more/docUi';

const TITLE = 'My Performance';
const ALL = 'all';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SubjectMark {
  subject: string;
  obtained: number;
  total: number;
}

interface ExamResult {
  id: string;
  examName: string;
  subjects: SubjectMark[];
}

// Group a flat marks list into exam → subjects (absent / ungraded rows skipped).
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
    });
  });
  return Array.from(byExam.values());
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pctOf = (obtained: number, total: number) =>
  total > 0 ? Math.round((obtained / total) * 100) : 0;

const getGrade = (pct: number) => {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 35) return 'D';
  return 'F';
};

const getPerformanceLabel = (pct: number) => {
  if (pct >= 90) return 'Outstanding';
  if (pct >= 75) return 'Excellent';
  if (pct >= 60) return 'Good';
  if (pct >= 45) return 'Average';
  return 'Needs Improvement';
};

// Sum marks per subject across the given exams, keeping first-seen order.
const subjectTotals = (exams: ExamResult[]): SubjectMark[] => {
  const map = new Map<string, SubjectMark>();
  exams.forEach(e =>
    e.subjects.forEach(s => {
      const cur = map.get(s.subject) ?? { subject: s.subject, obtained: 0, total: 0 };
      cur.obtained += s.obtained;
      cur.total += s.total;
      map.set(s.subject, cur);
    }),
  );
  return Array.from(map.values());
};

const sumMarks = (subjects: SubjectMark[]) =>
  subjects.reduce(
    (acc, s) => ({ obtained: acc.obtained + s.obtained, total: acc.total + s.total }),
    { obtained: 0, total: 0 },
  );

const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? 's' : ''}`;

const GRADE_SCALE =
  'A+ 90–100 · A 80–89 · B+ 70–79 · B 60–69 · C 50–59 · D 35–49 · F below 35';

// ─── Sub-components ───────────────────────────────────────────────────────────
const ProgressBar = ({ pct }: { pct: number }) => (
  <View style={styles.barBg}>
    <View style={[styles.barFill, { width: `${pct}%` as any }]} />
  </View>
);

// Exam selector: a soft, label-less field that opens a bottom sheet of exams.
const ExamPicker = ({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value) ?? options[0];

  return (
    <>
      <TouchableOpacity style={styles.select} activeOpacity={0.7} onPress={() => setOpen(true)}>
        <VectorIcon iconSet="Ionicons" iconName="document-text-outline" size={18} color={theme.colors.primary} />
        <Text style={styles.selectText} numberOfLines={1}>
          {selected?.label}
        </Text>
        <VectorIcon iconSet="Ionicons" iconName="chevron-down" size={18} color={theme.colors.textMuted} />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetWrap}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select exam</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((o, i) => {
                const active = o.id === selected?.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.sheetRow, i < options.length - 1 && styles.rowDivider]}
                    activeOpacity={0.6}
                    onPress={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[styles.sheetRowText, active && styles.sheetRowTextActive]}
                      numberOfLines={1}
                    >
                      {o.label}
                    </Text>
                    {active && (
                      <VectorIcon iconSet="Ionicons" iconName="checkmark" size={18} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const PerformanceScreen = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [selected, setSelected] = useState<string>(ALL);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const marks = await getStudentMarks();
      setExamResults(buildExamResults(marks));
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

  if (loading) return <DocLoading title={TITLE} />;
  if (error) return <DocError title={TITLE} message={error} onRetry={load} />;

  const refreshControl = <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />;

  if (examResults.length === 0) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} />
        <ScrollView contentContainerStyle={docStyles.scroll} refreshControl={refreshControl}>
          <DocNoData
            icon="bar-chart-outline"
            title="No results yet"
            subtitle="Your marks will appear here once exams are graded."
          />
        </ScrollView>
      </View>
    );
  }

  // A selected exam that disappeared after a refresh falls back to all exams.
  const exam = selected === ALL ? undefined : examResults.find(e => e.id === selected);
  const subjects = subjectTotals(exam ? [exam] : examResults);
  const { obtained, total } = sumMarks(subjects);
  const pct = pctOf(obtained, total);

  const options = [
    { id: ALL, label: 'All exams' },
    ...examResults.map(e => ({ id: e.id, label: e.examName })),
  ];

  const stats = [
    { label: 'Marks', value: `${obtained}/${total}` },
    { label: 'Subjects', value: String(subjects.length) },
    ...(exam ? [] : [{ label: 'Exams', value: String(examResults.length) }]),
  ];

  const selectExam = (id: string) => {
    setSelected(id);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={docStyles.root}>
      <DocHeader title={TITLE} />

      {/* Exam selector, pinned under the header, with a full-width line below */}
      <View style={styles.filterBar}>
        <ExamPicker options={options} value={exam ? exam.id : ALL} onChange={selectExam} />
      </View>
      <View style={styles.fullDivider} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[docStyles.scroll, styles.scroll]}
        refreshControl={refreshControl}
      >
        {/* Score */}
        <View>
          <View style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroCaption}>Score</Text>
              <Text style={styles.bigPct}>{pct}%</Text>
              <Text style={styles.heroLabel}>{getPerformanceLabel(pct)}</Text>
            </View>
            <View style={styles.gradeBadge}>
              <Text style={styles.gradeValue}>{getGrade(pct)}</Text>
              <Text style={styles.gradeCaption}>Grade</Text>
            </View>
          </View>

          <View style={styles.heroBar}>
            <ProgressBar pct={pct} />
          </View>

          <View style={styles.stats}>
            {stats.map((st, i) => (
              <View key={st.label} style={[styles.stat, i > 0 && styles.statDivider]}>
                <Text style={styles.statValue}>{st.value}</Text>
                <Text style={styles.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Subjects */}
        <DocSection title="Subjects">
          {subjects.map((sub, i) => {
            const sPct = pctOf(sub.obtained, sub.total);
            return (
              <View
                key={sub.subject}
                style={[styles.row, i < subjects.length - 1 && styles.rowDivider]}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {sub.subject}
                  </Text>
                  <Text style={styles.rowPct}>{sPct}%</Text>
                </View>
                <ProgressBar pct={sPct} />
                <Text style={styles.rowMeta}>
                  {sub.obtained} / {sub.total} · Grade {getGrade(sPct)}
                </Text>
              </View>
            );
          })}
        </DocSection>

        {/* Exams — only when viewing all; tapping one selects it */}
        {!exam && (
          <DocSection title="Exams">
            {examResults.map((e, i) => {
              const m = sumMarks(e.subjects);
              const ePct = pctOf(m.obtained, m.total);
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.row, i < examResults.length - 1 && styles.rowDivider]}
                  activeOpacity={0.6}
                  onPress={() => selectExam(e.id)}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {e.examName}
                    </Text>
                    <Text style={styles.rowPct}>{ePct}%</Text>
                    <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
                  </View>
                  <Text style={styles.rowMeta}>
                    {plural(e.subjects.length, 'subject')} · {m.obtained} / {m.total} · Grade {getGrade(ePct)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </DocSection>
        )}

        <Text style={styles.scale}>Grade scale: {GRADE_SCALE}</Text>
      </ScrollView>
    </View>
  );
};

export default PerformanceScreen;

const __mk_styles = () => StyleSheet.create({
  // Filter bar
  filterBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.card,
  },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },
  scroll: { paddingTop: 20 },

  // Exam selector
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  selectText: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },

  // Bottom sheet
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '70%',
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 4 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sheetRowText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  sheetRowTextActive: { color: theme.colors.primary, fontWeight: '600' },

  // Score
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
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

  // Rows (subjects / exams)
  row: { paddingVertical: 12, gap: 6 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  rowPct: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  rowMeta: { fontSize: 12, color: theme.colors.textMuted },

  // Progress bar
  barBg: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.primary },

  scale: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });

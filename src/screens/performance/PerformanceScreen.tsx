import React, { useCallback, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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

// Exam filter: a card-style field that opens a list of exams to pick from.
const ExamPicker = ({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value) ?? options[0];

  return (
    <>
      <TouchableOpacity style={styles.picker} activeOpacity={0.7} onPress={() => setOpen(true)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pickerLabel}>Exam</Text>
          <Text style={styles.pickerValue} numberOfLines={1}>
            {selected?.label}
          </Text>
        </View>
        <VectorIcon iconSet="Ionicons" iconName="chevron-down" size={18} color={theme.colors.textMuted} />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1}>
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
          </TouchableOpacity>
        </TouchableOpacity>
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

  const selectExam = (id: string) => {
    setSelected(id);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View style={docStyles.root}>
      <DocHeader title={TITLE} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={docStyles.scroll}
        refreshControl={refreshControl}
      >
        {/* Exam filter */}
        <ExamPicker options={options} value={exam ? exam.id : ALL} onChange={selectExam} />

        {/* Summary for the selection */}
        <View>
          <View style={styles.summaryTop}>
            <Text style={styles.bigPct}>{pct}%</Text>
            <View style={styles.gradePill}>
              <Text style={styles.gradePillText}>Grade {getGrade(pct)}</Text>
            </View>
          </View>
          <Text style={styles.summaryLine}>
            {getPerformanceLabel(pct)} · {obtained} / {total} marks
          </Text>
          <View style={styles.summaryBar}>
            <ProgressBar pct={pct} />
          </View>
          <Text style={styles.summaryMeta}>
            {exam
              ? plural(subjects.length, 'subject')
              : `${plural(examResults.length, 'exam')} · ${plural(subjects.length, 'subject')}`}
          </Text>
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

        {/* Exams — only when viewing all; tapping one filters to it */}
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
  // Exam picker
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pickerLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },
  pickerValue: { fontSize: 15, color: theme.colors.textPrimary, marginTop: 2 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '70%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 6 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sheetRowText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  sheetRowTextActive: { color: theme.colors.primary, fontWeight: '600' },

  // Summary
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bigPct: { fontSize: 36, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 42 },
  gradePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryLight,
  },
  gradePillText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  summaryLine: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },
  summaryBar: { marginTop: 12 },
  summaryMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8 },

  // Rows (subjects / exams)
  row: { paddingVertical: 12, gap: 6 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  rowPct: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  rowMeta: { fontSize: 12, color: theme.colors.textMuted },

  // Progress bar
  barBg: {
    height: 6,
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

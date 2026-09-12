import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocError, DocHeader, DocLoading } from '../more/docUi';
import { getExamDetail, examErrorMessage } from '../../api/examApi';
import type { Exam } from './examData';
import { SyllabusList, examWhen, humanize, longDate, shortRange } from './examUi';

const TITLE = 'Exam';

// ── Label / value row ────────────────────────────────────────────────────────
const InfoRow = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View style={[s.infoRow, !last && s.rowDivider]}>
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={s.infoValue}>{value}</Text>
  </View>
);

// A block under a plain heading, separated from the last by a line.
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <>
    <View style={s.divider} />
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  </>
);

const same = (a?: string, b?: string) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

const ExamDetailScreen = ({ navigation, route }: any) => {
  const summary: Exam | undefined = route.params?.exam;
  const examId: string | number | undefined = route.params?.examId ?? summary?.id;

  // Start from the summary the list passed along (instant render), then fill in
  // the syllabus and description from the detail endpoint.
  const [exam, setExam] = useState<Exam | undefined>(summary);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (examId == null) {
      setError('Exam not found.');
      return;
    }
    setError(null);
    try {
      setExam(await getExamDetail(examId));
    } catch (e: any) {
      console.log('[getExamDetail] Error:', e?.response?.status, e?.message);
      setError(examErrorMessage(e));
    }
  }, [examId]);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  // Once there is an exam on screen it stays there; a failed refresh does not
  // swap it for an error.
  if (!exam) {
    return error ? (
      <DocError title={TITLE} message={error} onRetry={load} />
    ) : (
      <DocLoading title={TITLE} />
    );
  }

  const live = exam.status === 'Ongoing';
  const standing = [exam.status, examWhen(exam)].filter(Boolean).join(' · ');
  const type = humanize(exam.type);
  const term = humanize(exam.term);

  // Only the lines that are actually filled in, and no term that merely
  // repeats the type or name above.
  const rows = [
    ['Academic Year', exam.academicYear],
    ['Term', same(term, type) || same(term, exam.name) ? '' : term],
    ['Starts', longDate(exam.startIso)],
    ['Ends', longDate(exam.endIso)],
    ['Total Marks', exam.totalMarks > 0 ? String(exam.totalMarks) : ''],
    ['Passing Marks', exam.passingMarks > 0 ? String(exam.passingMarks) : ''],
  ].filter(([, v]) => !!v) as [string, string][];

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* What it is, when, and where it stands */}
        <View style={s.head}>
          <Text style={s.kicker}>{type.toUpperCase()}</Text>
          <Text style={s.title}>{exam.name}</Text>
          <Text style={s.range}>{shortRange(exam)}</Text>
          <Text style={[s.standing, live && s.standingLive]}>{standing}</Text>
        </View>

        {rows.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.body}>
              {rows.map(([label, value], i) => (
                <InfoRow key={label} label={label} value={value} last={i === rows.length - 1} />
              ))}
            </View>
          </>
        )}

        {!!exam.description && (
          <Section title="About">
            <Text style={s.paragraph}>{exam.description}</Text>
          </Section>
        )}

        {exam.syllabus.length > 0 && (
          <Section title="Syllabus">
            <SyllabusList items={exam.syllabus} />
          </Section>
        )}

        {exam.instructions.length > 0 && (
          <Section title="Instructions">
            {exam.instructions.map((text, i) => (
              <View key={i} style={s.instRow}>
                <Text style={s.instNum}>{i + 1}.</Text>
                <Text style={s.instText}>{text}</Text>
              </View>
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  );
};

export default ExamDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },

  // Head
  head: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    lineHeight: 29,
    marginTop: 6,
  },
  range: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  standing: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary, marginTop: 10 },
  standingLive: { color: theme.colors.primary },

  // Full-width lines between the blocks
  divider: { height: 1, backgroundColor: theme.colors.divider },

  // Label / value rows
  body: { paddingHorizontal: 20, paddingTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  infoLabel: { width: '40%', paddingRight: 12, fontSize: 14, color: theme.colors.textSecondary },
  infoValue: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 },
  paragraph: { fontSize: 14, lineHeight: 22, color: theme.colors.textPrimary, paddingTop: 6, paddingBottom: 10 },

  // Instructions
  instRow: { flexDirection: 'row', paddingVertical: 6 },
  instNum: { width: 22, fontSize: 14, lineHeight: 21, color: theme.colors.textMuted },
  instText: { flex: 1, fontSize: 14, lineHeight: 21, color: theme.colors.textPrimary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

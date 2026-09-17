import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { getExamDetail, examErrorMessage } from '../../api/examApi';
import type { Exam, SyllabusItem } from './examData';
import {
  SyllabusList,
  Words,
  examWhen,
  examsToDraw,
  humanize,
  longDate,
  shortRange,
} from './examUi';

/**
 * Exam Detail, for students and teachers: what the exam is, when, its marks,
 * what it covers and — for a student — the instructions.
 *
 * Route params:
 *   exam    – the exam from the list, drawn at once
 *   examId  – when opened without one (the home screen)
 *   teacher – true for a teacher, who goes without the student's instructions
 *
 * A load — the first, a pull to refresh, Try again — draws the page as a
 * skeleton from its own data: the exam on screen or from the list, with the
 * syllabus and description this exam had last time (else another exam's
 * syllabus, else an ordinary one).
 */

const TITLE = 'Exam Detail';

// An ordinary syllabus, for a detail never loaded on this phone.
const SAMPLE_SYLLABUS: SyllabusItem[] = [
  { subject: 'English', topics: ['Reading comprehension', 'Grammar', 'Letter writing'] },
  { subject: 'Mathematics', topics: ['Number system', 'Algebra', 'Geometry', 'Mensuration'] },
  { subject: 'Science', topics: ['Food', 'Materials', 'Living things'] },
];

const isExam = (v: Exam | null | undefined): v is Exam => !!v && typeof v.name === 'string';

// ── Label / value row ────────────────────────────────────────────────────────
const InfoRow = ({
  label,
  value,
  last,
  skeleton,
}: {
  label: string;
  value: string;
  last?: boolean;
  skeleton: boolean;
}) => (
  <View style={[s.infoRow, !last && s.rowDivider]}>
    <View style={s.infoLabelCol}>
      <Words skeleton={skeleton} style={s.infoLabel}>
        {label}
      </Words>
    </View>
    <View style={s.infoValueCol}>
      <Words skeleton={skeleton} style={s.infoValue}>
        {value}
      </Words>
    </View>
  </View>
);

// A block under a plain heading, separated from the last by a line.
const Section = ({
  title,
  skeleton,
  children,
}: {
  title: string;
  skeleton: boolean;
  children: React.ReactNode;
}) => (
  <>
    <View style={s.divider} />
    <View style={s.section}>
      <Words skeleton={skeleton} style={s.sectionTitle}>
        {title}
      </Words>
      {children}
    </View>
  </>
);

const same = (a?: string, b?: string) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

const ExamDetailScreen = ({ navigation, route }: any) => {
  const summary: Exam | undefined = route.params?.exam;
  const examId: string | number | undefined = route.params?.examId ?? summary?.id;
  // The instructions are the student's (admit card, hall); a teacher goes without them.
  const teacher = !!route.params?.teacher;

  const [detail, setDetail] = useState<Exam | null>(null);
  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back to the screen updates it in place.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastHere, rememberHere] = useLastLoaded<Exam>(examId != null ? `exam-detail:${examId}` : null);
  const [lastAny, rememberAny] = useLastLoaded<Exam>('exam-detail');

  const load = useCallback(
    async (showSkeleton = false) => {
      if (examId == null) {
        setError('Exam not found.');
        setLoading(false);
        return;
      }
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const next = await getExamDetail(examId);
        setDetail(next);
        rememberHere(next);
        rememberAny(next);
      } catch (e: any) {
        console.log('[getExamDetail] Error:', e?.response?.status, e?.message);
        setError(examErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [examId, rememberHere, rememberAny],
  );

  const reload = useCallback(() => load(true), [load]);

  useFocusLoad(() => load());

  // While loading: the exam as far as it is known, shaped by what it held
  // last time. Once there is an exam on screen it stays there; a failed
  // refresh does not swap it for an error.
  const drawn = (): Exam => {
    if (detail) return detail;
    const here = isExam(lastHere) ? lastHere : null;
    const base = summary ?? here ?? examsToDraw(false, [], null)[0];
    return {
      ...base,
      description: here ? here.description : base.description,
      syllabus: here
        ? here.syllabus
        : isExam(lastAny) && lastAny.syllabus.length > 0
        ? lastAny.syllabus
        : SAMPLE_SYLLABUS,
    };
  };

  const shown: Exam | null = loading ? drawn() : detail ?? summary ?? null;

  const renderPage = (exam: Exam, skeleton: boolean) => {
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {/* What it is, when, and where it stands */}
        <View style={s.head}>
          <Words skeleton={skeleton} style={s.kicker}>
            {type.toUpperCase()}
          </Words>
          <Words skeleton={skeleton} style={s.title}>
            {exam.name}
          </Words>
          <Words skeleton={skeleton} style={s.range}>
            {shortRange(exam)}
          </Words>
          <Words skeleton={skeleton} style={[s.standing, live && s.standingLive]}>
            {standing}
          </Words>
        </View>

        {rows.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.body}>
              {rows.map(([label, value], i) => (
                <InfoRow
                  key={label}
                  label={label}
                  value={value}
                  last={i === rows.length - 1}
                  skeleton={skeleton}
                />
              ))}
            </View>
          </>
        )}

        {!!exam.description && (
          <Section title="About" skeleton={skeleton}>
            <Words skeleton={skeleton} style={s.paragraph}>
              {exam.description}
            </Words>
          </Section>
        )}

        {exam.syllabus.length > 0 && (
          <Section title="Syllabus" skeleton={skeleton}>
            <SyllabusList items={exam.syllabus} skeleton={skeleton} />
          </Section>
        )}

        {!teacher && exam.instructions.length > 0 && (
          <Section title="Instructions" skeleton={skeleton}>
            {exam.instructions.map((text, i) => (
              <View key={i} style={s.instRow}>
                <View style={s.instNumCol}>
                  <Words skeleton={skeleton} style={s.instNum}>
                    {i + 1}.
                  </Words>
                </View>
                <View style={s.instTextCol}>
                  <Words skeleton={skeleton} style={s.instText}>
                    {text}
                  </Words>
                </View>
              </View>
            ))}
          </Section>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      {shown ? (
        renderPage(shown, loading)
      ) : (
        <View style={s.center}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error ?? 'Exam not found.'}</Text>
          {examId != null && (
            <TouchableOpacity onPress={reload} hitSlop={10}>
              <Text style={s.linkText}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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
  infoLabelCol: { width: '40%', paddingRight: 12 },
  infoLabel: { fontSize: 14, color: theme.colors.textSecondary },
  infoValueCol: { flex: 1 },
  infoValue: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 },
  paragraph: { fontSize: 14, lineHeight: 22, color: theme.colors.textPrimary, marginTop: 6, marginBottom: 10 },

  // Instructions
  instRow: { flexDirection: 'row', paddingVertical: 6 },
  instNumCol: { width: 22 },
  instNum: { fontSize: 14, lineHeight: 21, color: theme.colors.textMuted },
  instTextCol: { flex: 1 },
  instText: { fontSize: 14, lineHeight: 21, color: theme.colors.textPrimary },

  // Error
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

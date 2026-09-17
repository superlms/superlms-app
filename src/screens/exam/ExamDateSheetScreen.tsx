import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  getExamDateSheet,
  examErrorMessage,
  type DateSheetClass,
  type DateSheetPaper,
  type ExamDateSheet,
} from '../../api/examApi';
import type { Exam } from './examData';
import { Words } from './examUi';

/**
 * One exam's date sheet: its papers day by day — the date, the subject, the
 * time and how long it runs. A student sees their class's sheet; a teacher
 * sees each class they teach, with their own subjects' papers.
 *
 * Route params:
 *   exam    – the exam, from the list
 *   teacher – true for a teacher
 *
 * A load — the first, a pull to refresh, Try again — draws the page as a
 * skeleton from the sheet it shows, the one this exam had last time, or an
 * ordinary one.
 */

// "2026-10-02" → that calendar day, or null.
const dayOf = (iso?: string | null) => {
  if (!iso) return null;
  const d = moment(iso.slice(0, 10), 'YYYY-MM-DD', true);
  return d.isValid() ? d : null;
};

// "14:00" → "2:00 PM"
const clock = (t?: string | null) => {
  const m = t ? moment(t, 'HH:mm', true) : null;
  return m?.isValid() ? m.format('h:mm A') : null;
};

// "3 hrs", "1 hr 30 min", "45 min"
const duration = (from?: string | null, to?: string | null) => {
  const a = from ? moment(from, 'HH:mm', true) : null;
  const b = to ? moment(to, 'HH:mm', true) : null;
  if (!a?.isValid() || !b?.isValid()) return null;
  const mins = b.diff(a, 'minutes');
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h} ${h === 1 ? 'hr' : 'hrs'}` : null, m ? `${m} min` : null].filter(Boolean).join(' ');
};

const timeLine = (p: DateSheetPaper) => {
  const from = clock(p.start_time);
  const to = clock(p.end_time);
  if (!from) return 'Time to be announced';
  return [to ? `${from} – ${to}` : from, duration(p.start_time, p.end_time)].filter(Boolean).join('  ·  ');
};

// "Today", "Tomorrow", "In 5 days" — nothing once it has passed.
const soon = (d: moment.Moment) => {
  const n = d.diff(moment().startOf('day'), 'days');
  return n < 0 ? null : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
};

const classLabel = (c: DateSheetClass) => [c.standard_name, c.section_name].filter(Boolean).join(' - ');

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "2 – 10 Oct 2026", from the first paper's day to the last.
const papersRange = (papers: DateSheetPaper[]) => {
  const days = papers.map(p => dayOf(p.exam_date)).filter((d): d is moment.Moment => !!d);
  if (days.length === 0) return null;
  const from = moment.min(days);
  const to = moment.max(days);
  if (from.isSame(to, 'day')) return from.format('D MMM YYYY');
  if (from.isSame(to, 'month')) return `${from.format('D')} – ${to.format('D MMM YYYY')}`;
  if (from.isSame(to, 'year')) return `${from.format('D MMM')} – ${to.format('D MMM YYYY')}`;
  return `${from.format('D MMM YYYY')} – ${to.format('D MMM YYYY')}`;
};

// ── A sheet to draw before this exam's has loaded here ───────────────────────
const sampleSheet = (exam: Exam, teacher: boolean): ExamDateSheet => {
  const start = dayOf(exam.startIso) ?? moment().startOf('day');
  const subjects = teacher ? ['Mathematics', 'Mathematics'] : ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science'];
  const papers = (names: string[], offset: number): DateSheetPaper[] =>
    names.map((name, i) => ({
      id: -(offset + i + 1),
      subject_id: -(offset + i + 1),
      subject_name: name,
      subject_image: null,
      exam_date: start.clone().add(i * 2, 'days').format('YYYY-MM-DD'),
      start_time: '10:00',
      end_time: '13:00',
      shift: 1,
    }));
  return {
    exam,
    classes: teacher
      ? [
          { standard_id: -1, standard_name: 'Class 6', section_id: -1, section_name: 'A', papers: papers(subjects.slice(0, 1), 0) },
          { standard_id: -2, standard_name: 'Class 7', section_id: -2, section_name: 'A', papers: papers(subjects.slice(1), 10) },
        ]
      : [{ standard_id: -1, standard_name: 'Class 6', section_id: -1, section_name: 'A', papers: papers(subjects, 0) }],
  };
};

const isSheet = (v: ExamDateSheet | null | undefined): v is ExamDateSheet => !!v && Array.isArray(v.classes);

// ── One paper ────────────────────────────────────────────────────────────────
//   OCT   Mathematics                                SHIFT 2
//     2   10:00 AM – 1:00 PM  ·  3 hrs
//         Friday  ·  In 5 days
const PaperRow = ({
  paper,
  showShift,
  isLast,
  skeleton,
}: {
  paper: DateSheetPaper;
  showShift: boolean;
  isLast: boolean;
  skeleton: boolean;
}) => {
  const day = dayOf(paper.exam_date);
  const today = !!day && day.isSame(moment(), 'day');
  const past = !!day && day.isBefore(moment().startOf('day'));
  const when = day ? soon(day) : null;

  return (
    <View style={[s.row, !isLast && s.rowDivider]}>
      <View style={s.dateCol}>
        {day ? (
          <>
            <Words skeleton={skeleton} style={[s.dateMonth, today && s.accent]}>
              {day.format('MMM').toUpperCase()}
            </Words>
            <Words skeleton={skeleton} style={[s.dateDay, today && s.accent, past && s.muted]}>
              {day.format('D')}
            </Words>
          </>
        ) : (
          <Words skeleton={skeleton} style={[s.dateDay, s.muted]}>
            —
          </Words>
        )}
      </View>

      <View style={s.body}>
        <View style={s.line}>
          <View style={s.fill}>
            <Words skeleton={skeleton} style={s.name} numberOfLines={1}>
              {paper.subject_name || 'Subject'}
            </Words>
          </View>
          {showShift && (
            <Words skeleton={skeleton} style={s.shift}>
              {`SHIFT ${paper.shift || 1}`}
            </Words>
          )}
        </View>
        <Words skeleton={skeleton} style={s.meta} numberOfLines={1}>
          {timeLine(paper)}
        </Words>
        <Words skeleton={skeleton} style={s.when} numberOfLines={1}>
          {day ? day.format('dddd') : 'Date to be announced'}
          {!!when && <Text style={today ? s.accent : undefined}>{`  ·  ${when}`}</Text>}
        </Words>
      </View>
    </View>
  );
};

const ExamDateSheetScreen = ({ navigation, route }: any) => {
  const exam: Exam = route.params.exam;
  const teacher = !!route.params?.teacher;
  const [sheet, setSheet] = useState<ExamDateSheet | null>(null);
  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back to the screen updates it in place.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [last, rememberLast] = useLastLoaded<ExamDateSheet>(
    `datesheet:${teacher ? 'teacher' : 'student'}:${exam.id}`,
  );

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const next = await getExamDateSheet(exam.id);
        setSheet(next);
        rememberLast(next);
      } catch (e: any) {
        console.log('[getExamDateSheet] Error:', e?.response?.status, e?.message);
        setError(examErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [exam.id, rememberLast],
  );

  const reload = useCallback(() => load(true), [load]);

  useFocusLoad(() => load());

  // The sheet the page is drawn from: while loading, what it last showed.
  const view: ExamDateSheet | null = loading
    ? sheet ?? (isSheet(last) ? last : sampleSheet(exam, teacher))
    : sheet;

  const renderPage = (v: ExamDateSheet, skeleton: boolean) => {
    const classes = v.classes.filter(c => c.papers.length > 0);
    const papers = classes.flatMap(c => c.papers);
    const range = papersRange(papers);
    const own = v.classes[0];

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.list, papers.length === 0 && s.grow]}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {papers.length === 0 ? (
          <DocNoData
            icon="calendar-outline"
            title="No date sheet yet"
            subtitle={
              teacher
                ? 'The date sheet for your classes and subjects will appear here once the school sets it.'
                : 'Your class’s date sheet will appear here once the school sets it.'
            }
            skeleton={skeleton}
          />
        ) : (
          <>
            <View style={s.intro}>
              <Words skeleton={skeleton} style={s.introTitle} numberOfLines={1}>
                {teacher ? 'Your subjects’ papers' : own ? classLabel(own) || 'Your class' : 'Your class'}
              </Words>
              <Words skeleton={skeleton} style={s.meta} numberOfLines={1}>
                {[
                  plural(papers.length, 'paper'),
                  teacher ? `${classes.length} ${classes.length === 1 ? 'class' : 'classes'}` : null,
                  range,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Words>
            </View>

            {classes.map(c => {
              const showShift = c.papers.some(p => (p.shift || 1) > 1);
              return (
                <View key={`${c.standard_id}-${c.section_id ?? 0}`}>
                  {teacher && (
                    <Words skeleton={skeleton} style={s.groupTitle}>
                      {classLabel(c)} · {plural(c.papers.length, 'paper')}
                    </Words>
                  )}
                  {c.papers.map((p, i) => (
                    <PaperRow
                      key={p.id}
                      paper={p}
                      showShift={showShift}
                      isLast={i === c.papers.length - 1}
                      skeleton={skeleton}
                    />
                  ))}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    );
  };

  const renderBody = () => {
    if (loading && view) return renderPage(view, true);

    if (!sheet) {
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

    return renderPage(sheet, false);
  };

  return (
    <View style={s.root}>
      <DocHeader title={exam.name} onBackPress={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};

export default ExamDateSheetScreen;

// The date column and the gap after it, as on the exams list.
const DATE_COL = 40;
const GAP = 16;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  grow: { flexGrow: 1 },
  fill: { flex: 1 },

  // The class and how many papers, over what days
  intro: {
    paddingTop: 16,
    paddingBottom: 14,
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  introTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  groupTitle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 16, marginBottom: 2 },

  // Row — the day as its own column, then the paper
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: GAP, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  dateCol: { width: DATE_COL, alignItems: 'center', paddingTop: 1 },
  dateMonth: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: theme.colors.textMuted },
  dateDay: { fontSize: 20, fontWeight: '600', lineHeight: 24, color: theme.colors.textPrimary, marginTop: 1 },
  muted: { color: theme.colors.textMuted },
  accent: { color: theme.colors.primary },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  shift: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textSecondary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  when: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

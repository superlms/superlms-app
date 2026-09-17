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
  getExamSeating,
  examErrorMessage,
  type ExamSeating,
  type SeatingPaper,
} from '../../api/examApi';
import type { Exam } from './examData';
import { Words } from './examUi';
import { clock, dayOf, papersRange, soon, timeLine } from './paperUi';

/**
 * Seating Plan, one exam: each paper of the student's date sheet with its day,
 * time, and the room and seat the school's seating plan gives for that
 * paper's own session.
 *
 * A load — the first, a pull to refresh, Try again — draws the page as a
 * skeleton from the papers it shows, those this exam had last time, or
 * ordinary ones.
 */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ── Papers to draw before this exam's have loaded here ───────────────────────
const sampleSeating = (exam: Exam): ExamSeating => {
  const start = dayOf(exam.startIso) ?? moment().startOf('day');
  const subjects = ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science'];
  return {
    exam,
    class: 'Class 6 - A',
    exam_center: null,
    reporting_time: null,
    seated: true,
    papers: subjects.map((name, i) => ({
      id: -(i + 1),
      subject_id: -(i + 1),
      subject_name: name,
      subject_image: null,
      exam_date: start.clone().add(i * 2, 'days').format('YYYY-MM-DD'),
      start_time: '10:00',
      end_time: '13:00',
      shift: 1,
      room: `${i + 1}`,
      seat: `B${i + 2} (1)`,
    })),
  };
};

const isSeating = (v: ExamSeating | null | undefined): v is ExamSeating => !!v && Array.isArray(v.papers);

// ── One paper ────────────────────────────────────────────────────────────────
//   OCT   Mathematics                                SHIFT 2
//     2   Friday  ·  In 5 days
//         10:00 AM – 1:00 PM  ·  3 hrs
//         ROOM  12      SEAT  B2 (1)
const PaperRow = ({
  paper,
  showShift,
  isLast,
  skeleton,
}: {
  paper: SeatingPaper;
  showShift: boolean;
  isLast: boolean;
  skeleton: boolean;
}) => {
  const day = dayOf(paper.exam_date);
  const today = !!day && day.isSame(moment(), 'day');
  const past = !!day && day.isBefore(moment().startOf('day'));
  const when = day ? soon(day) : null;
  const seated = !!paper.room || !!paper.seat;

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
              {paper.subject_name || 'Paper'}
            </Words>
          </View>
          {showShift && (
            <Words skeleton={skeleton} style={s.shift}>
              {`SHIFT ${paper.shift || 1}`}
            </Words>
          )}
        </View>
        <Words skeleton={skeleton} style={s.meta} numberOfLines={1}>
          {day ? day.format('dddd') : 'Date to be announced'}
          {!!when && <Text style={today ? s.accent : undefined}>{`  ·  ${when}`}</Text>}
        </Words>
        <Words skeleton={skeleton} style={s.when} numberOfLines={1}>
          {timeLine(paper)}
        </Words>

        {seated ? (
          <View style={s.seatLine}>
            <View style={s.seatPair}>
              <Words skeleton={skeleton} style={s.seatLabel}>
                ROOM
              </Words>
              <Words skeleton={skeleton} style={s.seatValue} numberOfLines={1}>
                {paper.room || '—'}
              </Words>
            </View>
            <View style={s.seatPair}>
              <Words skeleton={skeleton} style={s.seatLabel}>
                SEAT
              </Words>
              <Words skeleton={skeleton} style={s.seatValue} numberOfLines={1}>
                {paper.seat || '—'}
              </Words>
            </View>
          </View>
        ) : (
          <Words skeleton={skeleton} style={s.unseated}>
            Room and seat not allotted yet
          </Words>
        )}
      </View>
    </View>
  );
};

const ExamSeatingScreen = ({ navigation, route }: any) => {
  const exam: Exam = route.params.exam;
  const [seating, setSeating] = useState<ExamSeating | null>(null);
  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back to the screen updates it in place.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [last, rememberLast] = useLastLoaded<ExamSeating>(`seating:${exam.id}`);

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const next = await getExamSeating(exam.id);
        setSeating(next);
        rememberLast(next);
      } catch (e: any) {
        console.log('[getExamSeating] Error:', e?.response?.status, e?.message);
        setError(examErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [exam.id, rememberLast],
  );

  const reload = useCallback(() => load(true), [load]);

  useFocusLoad(() => load());

  // The page is drawn from: while loading, what it last showed.
  const view: ExamSeating | null = loading
    ? seating ?? (isSeating(last) ? last : sampleSeating(exam))
    : seating;

  const renderPage = (v: ExamSeating, skeleton: boolean) => {
    const papers = v.papers;
    const showShift = papers.some(p => (p.shift || 1) > 1);
    // "09:30" as a time; anything else the school typed, as it is.
    const reporting = v.reporting_time ? clock(v.reporting_time.slice(0, 5)) ?? v.reporting_time : null;
    const centre = [v.exam_center ? `Centre: ${v.exam_center}` : null, reporting ? `Report by ${reporting}` : null]
      .filter(Boolean)
      .join('  ·  ');

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.list, papers.length === 0 && s.grow]}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {papers.length === 0 ? (
          <DocNoData
            icon="grid-outline"
            title="Seating plan not out yet"
            subtitle="Your room and seat for each paper will appear here once the school makes the seating plan."
            skeleton={skeleton}
          />
        ) : (
          <>
            <View style={s.intro}>
              <Words skeleton={skeleton} style={s.introTitle} numberOfLines={1}>
                {v.class || 'Your class'}
              </Words>
              <Words skeleton={skeleton} style={s.meta} numberOfLines={1}>
                {[plural(papers.length, 'paper'), papersRange(papers)].filter(Boolean).join('  ·  ')}
              </Words>
              {!!centre && (
                <Words skeleton={skeleton} style={s.meta}>
                  {centre}
                </Words>
              )}
              {!v.seated && (
                <Words skeleton={skeleton} style={s.notice}>
                  The school hasn’t allotted rooms and seats for this exam yet.
                </Words>
              )}
            </View>

            {papers.map((p, i) => (
              <PaperRow
                key={p.id}
                paper={p}
                showShift={showShift}
                isLast={i === papers.length - 1}
                skeleton={skeleton}
              />
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  const renderBody = () => {
    if (loading && view) return renderPage(view, true);

    if (!seating) {
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

    return renderPage(seating, false);
  };

  return (
    <View style={s.root}>
      <DocHeader title={exam.name} onBackPress={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};

export default ExamSeatingScreen;

// The date column and the gap after it, as on the exams list.
const DATE_COL = 40;
const GAP = 16;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  grow: { flexGrow: 1 },
  fill: { flex: 1 },

  // The class, its papers and where to report
  intro: {
    paddingTop: 16,
    paddingBottom: 14,
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  introTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  notice: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },

  // Row — the day as its own column, then the paper and the seat
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
  when: { fontSize: 12, color: theme.colors.textMuted },

  // Room and seat
  seatLine: { flexDirection: 'row', gap: 24, marginTop: 6 },
  seatPair: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  seatLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },
  seatValue: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
  unseated: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

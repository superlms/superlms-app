import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { Skeleton } from '../../components/Skeleton';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { dashboardErrorMessage } from '../../api/dashboardApi';
import { getStudentAnalytics, type StudentAnalytics as Data } from '../../api/analyticsApi';
import { getMyAttendance } from '../../api/attendanceApi';
import { getFeeDashboard, type FeeDashboard } from '../../api/feeApi';
import {
  ABSENT,
  COMPARE,
  Card,
  CardHead,
  Columns,
  DashError,
  DashSkeleton,
  KpiGrid,
  LOW_ATTENDANCE,
  LineRow,
  NEUTRAL,
  Note,
  PASS_MARK,
  PRESENT,
  PctRow,
  Pill,
  SplitBar,
  bandFor,
  deltaOf,
} from '../home/dashboardUi';
import { CompareBars, FigureRow, Legend, LineChart, MonthGrid, ProgressColumns } from './charts';
import { Hero, Tabs, changeText, inr, monthLong, monthShort, pctOrDash, plural } from './analyticsUi';

type Tab = 'overview' | 'attendance' | 'exams' | 'homework' | 'quiz' | 'fees' | 'timetable';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'exams', label: 'Exams' },
  { key: 'homework', label: 'Homework' },
  { key: 'quiz', label: 'Assignments' },
  { key: 'fees', label: 'Fees' },
  { key: 'timetable', label: 'Timetable' },
];

const WEEKDAYS: Record<string, string> = {
  Mon: 'Mondays',
  Tue: 'Tuesdays',
  Wed: 'Wednesdays',
  Thu: 'Thursdays',
  Fri: 'Fridays',
  Sat: 'Saturdays',
};

const YOU_VS_CLASS = [
  { label: 'You', color: theme.colors.primary, line: true },
  { label: 'Class average', color: COMPARE, line: true },
];

/**
 * A student's Analytics: an overview of every part, then a tab each for
 * attendance, exams, homework, assignments (the quiz questions), fees and the
 * timetable — graphs over time, and the class's own figure beside theirs
 * wherever there is one.
 */
const StudentAnalytics = ({ navigation }: { navigation: any }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<Data | null>(null);
  const [fees, setFees] = useState<FeeDashboard | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // A month picked from the attendance history, shown as a calendar.
  const [month, setMonth] = useState<string | null>(null);
  const [monthDays, setMonthDays] = useState<{ date: string; status: string }[] | null>(null);
  const monthRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    // Fees are their own call; the rest of Analytics doesn't wait on them or fail with them.
    getFeeDashboard()
      .then(setFees)
      .catch(() => setFees(null));
    try {
      setData(await getStudentAnalytics());
    } catch (e: any) {
      console.log('[getStudentAnalytics] Error:', e?.response?.status, e?.message);
      setError(dashboardErrorMessage(e));
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);
  useFocusLoad(load);

  const pickMonth = async (m: string) => {
    const current = moment().format('YYYY-MM');
    const next = m === current || m === monthRef.current ? null : m;
    monthRef.current = next;
    setMonth(next);
    setMonthDays(null);
    if (!next) return;
    try {
      const a = await getMyAttendance(next);
      if (monthRef.current === next) setMonthDays(a.days.map(d => ({ date: d.date, status: d.status })));
    } catch {
      if (monthRef.current === next) setMonthDays([]);
    }
  };

  const tabs = <Tabs tabs={TABS} active={tab} onChange={setTab} />;

  if (!data) {
    return (
      <>
        {tabs}
        {error ? <DashError message={error} onRetry={load} /> : <DashSkeleton kpis={false} />}
      </>
    );
  }

  const go = (key: Tab) => () => setTab(key);
  const body = (() => {
    switch (tab) {
      case 'attendance':
        return <AttendanceTab data={data} month={month} monthDays={monthDays} onPickMonth={pickMonth} navigation={navigation} />;
      case 'exams':
        return <ExamsTab data={data} navigation={navigation} />;
      case 'homework':
        return <HomeworkTab data={data} navigation={navigation} />;
      case 'quiz':
        return <QuizTab data={data} navigation={navigation} />;
      case 'fees':
        return <FeesTab fees={fees} navigation={navigation} />;
      case 'timetable':
        return <TimetableTab data={data} navigation={navigation} />;
      default:
        return <Overview data={data} fees={fees} go={go} />;
    }
  })();

  return (
    <>
      {tabs}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {body}
      </ScrollView>
    </>
  );
};

export default StudentAnalytics;

// ── Overview ─────────────────────────────────────────────────────────────────
const Overview = ({
  data,
  fees,
  go,
}: {
  data: Data;
  fees: FeeDashboard | null | undefined;
  go: (t: Tab) => () => void;
}) => {
  const months = data.attendance.months;
  const now = months[months.length - 1];
  const before = months[months.length - 2];
  const ex = data.exams;
  const o = ex.overall;
  const hw = data.homework;
  const quiz = data.quiz;

  return (
    <>
      <KpiGrid
        items={[
          {
            icon: 'calendar-outline',
            label: 'Attendance',
            value: pctOrDash(now?.percentage),
            note: now && now.working > 0 ? `${now.present} of ${now.working} days · ${monthShort(now.month)}` : 'Not marked yet',
            delta: deltaOf(now?.percentage, before?.percentage, before ? monthShort(before.month) : ''),
            low: now?.percentage != null && now.percentage < LOW_ATTENDANCE,
            onPress: go('attendance'),
          },
          {
            icon: 'stats-chart-outline',
            label: 'Score',
            value: pctOrDash(o?.percentage),
            note: o ? `Grade ${o.grade ?? '—'} · ${plural(o.exams, 'exam')}` : 'No marks yet',
            delta: deltaOf(o?.percentage, o?.class_average, 'class'),
            low: o?.percentage != null && o.percentage < PASS_MARK,
            onPress: go('exams'),
          },
          {
            icon: 'book-outline',
            label: 'Homework',
            value: pctOrDash(hw.percentage),
            note: hw.total > 0 ? `${hw.pending} pending of ${hw.total}` : 'Nothing set yet',
            onPress: go('homework'),
          },
          {
            icon: 'help-circle-outline',
            label: 'Assignments',
            value: pctOrDash(quiz.accuracy),
            note: quiz.attempted > 0 ? `${quiz.correct} of ${quiz.attempted} right` : 'None answered yet',
            onPress: go('quiz'),
          },
        ]}
      />

      {months.some(m => m.percentage != null) && (
        <Card>
          <CardHead icon="calendar-outline" title="Attendance trend" sub="Last six months, you and your class" action="More" onAction={go('attendance')} />
          <LineChart
            labels={months.map(m => monthShort(m.month))}
            series={[
              { key: 'you', label: 'You', points: months.map(m => m.percentage) },
              { key: 'class', label: 'Class', points: months.map(m => m.class_average), compare: true },
            ]}
          />
          <Legend items={YOU_VS_CLASS} />
          <View style={s.gap} />
        </Card>
      )}

      {ex.exams.length > 0 && (
        <Card>
          <CardHead icon="trending-up-outline" title="Score trend" sub="Exam by exam, you and your class" action="More" onAction={go('exams')} />
          <LineChart
            labels={ex.exams.map(e => e.exam_name || 'Exam')}
            subs={ex.exams.map(e => (e.date ? moment(e.date, 'YYYY-MM-DD').format('MMM') : null))}
            series={[
              { key: 'you', label: 'You', points: ex.exams.map(e => e.percentage) },
              { key: 'class', label: 'Class', points: ex.exams.map(e => e.class_average), compare: true },
            ]}
          />
          <Legend items={YOU_VS_CLASS} />
          <View style={s.gap} />
        </Card>
      )}

      {ex.subjects.length > 0 && (
        <Card>
          <CardHead icon="library-outline" title="Where you stand" sub="Each subject against the class average" action="More" onAction={go('exams')} />
          <CompareBars
            rows={ex.subjects.map(sb => ({
              key: sb.subject,
              label: quietCaps(sb.subject),
              mine: sb.percentage,
              theirs: sb.class_average,
              low: sb.percentage != null && sb.percentage < PASS_MARK,
            }))}
          />
        </Card>
      )}

      {!!fees && (
        <Card>
          <CardHead icon="wallet-outline" title="Fees" sub={`${Math.round(fees.summary.cleared_percent ?? 0)}% cleared`} action="More" onAction={go('fees')} />
          <PctRow
            label="Paid so far"
            pct={Math.round(fees.summary.cleared_percent ?? 0)}
            value={`${inr(fees.summary.total_paid)} of ${inr(fees.summary.total_due)}`}
            meta={fees.summary.remaining > 0 ? `${inr(fees.summary.remaining)} still to pay` : 'Nothing left to pay'}
            isLast
          />
        </Card>
      )}
    </>
  );
};

// ── Attendance ───────────────────────────────────────────────────────────────
const AttendanceTab = ({
  data,
  month,
  monthDays,
  onPickMonth,
  navigation,
}: {
  data: Data;
  month: string | null;
  monthDays: { date: string; status: string }[] | null;
  onPickMonth: (m: string) => void;
  navigation: any;
}) => {
  const a = data.attendance;
  const now = a.months[a.months.length - 1];
  const absent = a.months.reduce((n, m) => n + m.absent, 0);
  const counted = a.weekdays.filter(w => w.percentage != null);
  const weakest = counted.length > 1 ? [...counted].sort((x, y) => (x.percentage ?? 0) - (y.percentage ?? 0))[0] : null;

  // The calendar: this month, or the month picked from the list.
  const days = month ? monthDays : a.this_month;
  const shown = month ?? now?.month ?? moment().format('YYYY-MM');
  const count = (st: string) => (days ?? []).filter(d => d.status === st).length;

  return (
    <>
      <Hero
        kicker="Attendance · last six months"
        value={pctOrDash(a.overall.percentage)}
        low={a.overall.percentage != null && a.overall.percentage < LOW_ATTENDANCE}
        band={a.overall.percentage != null ? bandFor(a.overall.percentage) : null}
        caption={a.overall.working > 0 ? `${a.overall.present} of ${a.overall.working} working days present` : 'Nothing marked yet'}
        stats={[
          { label: 'This month', value: pctOrDash(now?.percentage), low: now?.percentage != null && now.percentage < LOW_ATTENDANCE },
          { label: 'Present in a row', value: plural(a.streak, 'day') },
          { label: 'Absent (6 months)', value: String(absent), low: absent > 0 && (a.overall.percentage ?? 100) < LOW_ATTENDANCE },
        ]}
      />

      <Card>
        <CardHead icon="trending-up-outline" title="Month by month" sub="Tap a month to see its days" action="Open" onAction={() => navigation.navigate('Attendance')} />
        <LineChart
          labels={a.months.map(m => monthShort(m.month))}
          series={[
            { key: 'you', label: 'You', points: a.months.map(m => m.percentage) },
            { key: 'class', label: 'Class', points: a.months.map(m => m.class_average), compare: true },
          ]}
        />
        <Legend items={YOU_VS_CLASS} />
        {[...a.months].reverse().filter(m => m.working > 0 || m.month === now?.month).map((m, i, list) => (
          <LineRow
            key={m.month}
            title={monthLong(m.month)}
            meta={
              m.working > 0
                ? [`${m.present} of ${m.working} days`, m.absent ? `${m.absent} absent` : null, m.class_average != null ? `class ${m.class_average}%` : null]
                    .filter(Boolean)
                    .join(' · ')
                : 'Nothing marked'
            }
            trailing={
              <View style={s.trail}>
                <Text style={[s.trailValue, m.percentage != null && m.percentage < LOW_ATTENDANCE && s.low]}>
                  {pctOrDash(m.percentage)}
                </Text>
                {(month ?? now?.month) === m.month && <Text style={s.trailOn}>Shown</Text>}
              </View>
            }
            onPress={() => onPickMonth(m.month)}
            isLast={i === list.length - 1}
          />
        ))}
      </Card>

      <Card>
        <CardHead icon="calendar-number-outline" title={moment(shown, 'YYYY-MM').format('MMMM YYYY')} sub="Day by day" />
        {days == null ? (
          <View style={s.loading}>
            <Skeleton width="100%" height={160} radius={12} />
          </View>
        ) : days.length === 0 ? (
          <Note>Couldn’t load this month.</Note>
        ) : (
          <>
            <MonthGrid days={days} />
            <SplitBar
              parts={[
                { label: 'Present', value: count('present'), color: PRESENT },
                { label: 'Absent', value: count('absent'), color: ABSENT },
                { label: 'Holiday', value: count('holiday'), color: NEUTRAL },
                { label: 'Not marked', value: count('not_marked'), color: theme.colors.border },
              ]}
            />
          </>
        )}
      </Card>

      {counted.length > 0 && (
        <Card>
          <CardHead
            icon="today-outline"
            title="By day of the week"
            sub={
              weakest && (weakest.percentage ?? 100) < 100
                ? `Most often away on ${WEEKDAYS[weakest.day] ?? weakest.day}`
                : 'Over the last six months'
            }
          />
          <Columns
            data={a.weekdays.map(w => ({
              key: w.day,
              label: w.day,
              sub: w.absent ? `${w.absent} off` : null,
              value: w.percentage,
              low: w.percentage != null && w.percentage < LOW_ATTENDANCE,
            }))}
            selected={weakest?.day}
          />
        </Card>
      )}
    </>
  );
};

// ── Exams ────────────────────────────────────────────────────────────────────
const ExamsTab = ({ data, navigation }: { data: Data; navigation: any }) => {
  const ex = data.exams;
  const o = ex.overall;
  if (!o) {
    return (
      <Hero kicker="Exams" value="No marks yet" caption="Your scores, and how they compare with your class, appear here once exam marks are published." />
    );
  }
  const best = ex.subjects[0];
  const grades = ex.grades.filter(g => g.grade !== 'AB' || g.count > 0);
  const most = Math.max(1, ...grades.map(g => g.count));

  return (
    <>
      <Hero
        kicker="Overall score"
        value={pctOrDash(o.percentage)}
        low={o.percentage != null && o.percentage < ex.pass_percentage}
        band={o.grade ? `Grade ${o.grade}${o.remark ? ` · ${o.remark}` : ''}` : null}
        caption={`${Math.round(o.obtained)} of ${Math.round(o.max)} marks · ${plural(o.papers, 'paper')} in ${plural(o.exams, 'exam')}`}
        stats={[
          { label: 'Class average', value: pctOrDash(o.class_average) },
          { label: 'Papers passed', value: `${o.passed}/${o.papers}`, low: o.passed < o.papers },
          { label: best ? `Best · ${quietCaps(best.subject)}` : 'Best subject', value: pctOrDash(best?.percentage) },
        ]}
      />

      <Card>
        <CardHead icon="trending-up-outline" title="Exam by exam" sub="All subjects together" action="Results" onAction={() => navigation.navigate('Performance')} />
        {ex.exams.length >= 2 && (
          <>
            <LineChart
              labels={ex.exams.map(e => e.exam_name || 'Exam')}
              subs={ex.exams.map(e => (e.date ? moment(e.date, 'YYYY-MM-DD').format('MMM') : null))}
              series={[
                { key: 'you', label: 'You', points: ex.exams.map(e => e.percentage) },
                { key: 'class', label: 'Class', points: ex.exams.map(e => e.class_average), compare: true },
              ]}
            />
            <Legend items={YOU_VS_CLASS} />
          </>
        )}
        {[...ex.exams].reverse().map((e, i, list) => {
          const prev = list[i + 1];
          const change = changeText(e.percentage, prev?.percentage, 'previous');
          return (
            <LineRow
              key={e.exam_id}
              title={e.exam_name || 'Exam'}
              meta={[
                `${Math.round(e.obtained)} of ${Math.round(e.max)} marks`,
                e.class_average != null ? `class ${e.class_average}%` : null,
                change,
              ]
                .filter(Boolean)
                .join(' · ')}
              metaLines={2}
              trailing={
                <View style={s.trail}>
                  <Text style={[s.trailValue, e.percentage != null && e.percentage < ex.pass_percentage && s.low]}>
                    {pctOrDash(e.percentage)}
                  </Text>
                  {!!e.grade && <Pill text={e.grade} />}
                </View>
              }
              isLast={i === list.length - 1}
            />
          );
        })}
      </Card>

      {!!ex.latest && ex.latest.papers.length > 0 && (
        <Card>
          <CardHead icon="document-text-outline" title={ex.latest.exam_name || 'Latest exam'} sub="Latest exam, paper by paper, against the class" />
          <Legend items={[{ label: 'You', color: theme.colors.primary }, { label: 'Class average', color: COMPARE }]} />
          <CompareBars
            rows={ex.latest.papers.map(p => ({
              key: p.subject,
              label: quietCaps(p.subject),
              mine: p.absent ? null : p.percentage,
              theirs: p.class_average,
              low: p.absent || (p.percentage != null && p.percentage < ex.pass_percentage),
              meta: [
                p.absent ? 'Absent' : p.obtained != null ? `${Math.round(p.obtained)} / ${Math.round(p.max)}` : null,
                p.class_highest != null ? `class best ${p.class_highest}%` : null,
              ]
                .filter(Boolean)
                .join(' · '),
            }))}
          />
        </Card>
      )}

      <Card>
        <CardHead icon="library-outline" title="By subject" sub="All exams together · the tick is the class average" />
        {ex.subjects.map((sb, i) => (
          <PctRow
            key={sb.subject}
            label={quietCaps(sb.subject)}
            pct={sb.percentage ?? 0}
            low={sb.percentage != null && sb.percentage < ex.pass_percentage}
            mark={sb.class_average}
            tag={sb.grade ? <Pill text={sb.grade} /> : null}
            meta={[
              `${Math.round(sb.obtained)} of ${Math.round(sb.max)} marks`,
              sb.class_average != null ? `class ${sb.class_average}%` : null,
              plural(sb.papers, 'paper'),
            ]
              .filter(Boolean)
              .join(' · ')}
            isLast={i === ex.subjects.length - 1}
          />
        ))}
      </Card>

      <Card>
        <CardHead icon="ribbon-outline" title="Grades" sub={`Across ${plural(o.papers, 'paper')}`} />
        <Columns
          max={most}
          format={v => String(v)}
          selected={grades.reduce((a, b) => (b.count > a.count ? b : a), grades[0])?.grade}
          data={grades.map(g => ({ key: g.grade, label: g.grade, value: g.count, low: g.grade === 'F' || g.grade === 'AB' }))}
        />
      </Card>
    </>
  );
};

// ── Homework ─────────────────────────────────────────────────────────────────
const HomeworkTab = ({ data, navigation }: { data: Data; navigation: any }) => {
  const hw = data.homework;
  return (
    <>
      <Hero
        kicker="Homework done"
        value={pctOrDash(hw.percentage)}
        low={hw.percentage != null && hw.percentage < 50}
        caption={hw.total > 0 ? `${hw.done} done · ${hw.pending} pending of ${hw.total} set for your class` : 'No homework has been set for your class yet.'}
        stats={[
          { label: 'Set', value: String(hw.total) },
          { label: 'Done', value: String(hw.done) },
          { label: 'Pending', value: String(hw.pending), low: hw.pending > 0 },
        ]}
      />
      <Card>
        <CardHead icon="bar-chart-outline" title="Week by week" sub="Set each week, and how much of it you've done" action="Open" onAction={() => navigation.navigate('Homework')} />
        <ProgressColumns data={hw.weeks.map(w => ({ key: w.week, label: w.label, total: w.set, done: w.done ?? 0 }))} />
        <Legend items={[{ label: 'Done', color: theme.colors.primary }, { label: 'Set', color: theme.colors.primary + '40' }]} />
        <View style={s.gap} />
      </Card>
      {hw.by_subject.length > 0 && (
        <Card>
          <CardHead icon="library-outline" title="By subject" sub="Done out of set" />
          {hw.by_subject.map((sb, i) => {
            const pct = sb.total > 0 ? Math.round((sb.done / sb.total) * 100) : 0;
            return (
              <PctRow
                key={sb.subject}
                label={quietCaps(sb.subject)}
                pct={pct}
                value={`${sb.done}/${sb.total}`}
                meta={sb.total - sb.done > 0 ? `${sb.total - sb.done} pending` : 'All done'}
                isLast={i === hw.by_subject.length - 1}
              />
            );
          })}
        </Card>
      )}
    </>
  );
};

// ── Quiz ─────────────────────────────────────────────────────────────────────
const QuizTab = ({ data, navigation }: { data: Data; navigation: any }) => {
  const q = data.quiz;
  const untried = Math.max(q.available - q.attempted, 0);
  return (
    <>
      <Hero
        kicker="Assignments · accuracy"
        value={pctOrDash(q.accuracy)}
        low={q.accuracy != null && q.accuracy < PASS_MARK}
        band={q.accuracy != null ? bandFor(q.accuracy) : null}
        caption={
          q.attempted > 0
            ? `${q.correct} right of ${plural(q.attempted, 'question')} answered`
            : 'Answer the assignment questions for your class to see how you do.'
        }
      >
        <FigureRow
          items={[
            { label: 'Answered', value: String(q.attempted) },
            { label: 'Right', value: String(q.correct), good: q.correct > 0 },
            { label: 'Wrong', value: String(q.attempted - q.correct), low: q.attempted - q.correct > 0 },
            { label: 'Not tried', value: String(untried) },
          ]}
        />
      </Hero>
      {q.available > 0 && (
        <Card>
          <CardHead icon="help-circle-outline" title="Questions tried" sub={`${q.attempted} of ${q.available} for your class`} action="Open" onAction={() => navigation.navigate('Quiz')} />
          <SplitBar
            parts={[
              { label: 'Right', value: q.correct, color: PRESENT },
              { label: 'Wrong', value: q.attempted - q.correct, color: ABSENT },
              { label: 'Not tried', value: untried, color: NEUTRAL },
            ]}
          />
        </Card>
      )}
      {q.by_subject.length > 0 && (
        <Card>
          <CardHead icon="library-outline" title="By subject" sub="Right out of answered" />
          {q.by_subject.map((sb, i) => (
            <PctRow
              key={sb.subject}
              label={quietCaps(sb.subject)}
              pct={sb.accuracy ?? 0}
              low={sb.accuracy != null && sb.accuracy < PASS_MARK}
              meta={`${sb.correct} of ${sb.attempted} right`}
              isLast={i === q.by_subject.length - 1}
            />
          ))}
        </Card>
      )}
    </>
  );
};

// ── Fees ─────────────────────────────────────────────────────────────────────
const INSTALLMENT_TONE: Record<string, 'good' | 'bad' | 'accent' | 'neutral'> = {
  paid: 'good',
  overdue: 'bad',
  partial: 'accent',
  due: 'neutral',
};

const FeesTab = ({ fees, navigation }: { fees: FeeDashboard | null | undefined; navigation: any }) => {
  if (fees === undefined) {
    return (
      <View style={s.loadingCard}>
        <Skeleton width="100%" height={180} radius={16} />
      </View>
    );
  }
  if (!fees) {
    return <Hero kicker="Fees" value="Not available" caption="Your fee details couldn’t be loaded. Pull down to try again." />;
  }
  const sum = fees.summary;
  const cleared = Math.round(sum.cleared_percent ?? 0);

  // Payments, month by month, for the last six months.
  const payMonths = [5, 4, 3, 2, 1, 0].map(n => moment().subtract(n, 'months').format('YYYY-MM'));
  const paidIn = (m: string) =>
    (fees.overall_payments ?? [])
      .filter(p => (p.payment_date ?? p.date ?? '').slice(0, 7) === m)
      .reduce((n, p) => n + Number(p.amount || 0), 0);
  const perMonth = payMonths.map(m => ({ m, amount: paidIn(m) }));
  const most = Math.max(1, ...perMonth.map(p => p.amount));

  const parts = [
    { label: 'Academic', paid: sum.academic_paid, due: sum.academic_due },
    { label: 'Transport', paid: sum.transport_paid, due: sum.transport_due },
  ].filter(p => p.due > 0 || p.paid > 0);

  return (
    <>
      <Hero
        kicker="Fees cleared"
        value={`${cleared}%`}
        band={sum.remaining > 0 ? `${inr(sum.remaining)} to pay` : 'All paid'}
        caption={`${inr(sum.total_paid)} paid of ${inr(sum.total_due)}`}
        stats={[
          { label: 'Remaining', value: inr(sum.remaining), low: sum.remaining > 0 },
          { label: 'Late fee', value: inr(sum.total_penalties) },
          { label: 'Concession', value: inr(sum.concession) },
        ]}
      />
      {parts.length > 0 && (
        <Card>
          <CardHead icon="pie-chart-outline" title="Paid, by fee" action="Open" onAction={() => navigation.navigate('Fees')} />
          {parts.map((p, i) => (
            <PctRow
              key={p.label}
              label={p.label}
              pct={p.due > 0 ? Math.round((p.paid / p.due) * 100) : 100}
              value={`${inr(p.paid)} / ${inr(p.due)}`}
              meta={p.due - p.paid > 0 ? `${inr(p.due - p.paid)} left` : 'Paid in full'}
              isLast={i === parts.length - 1}
            />
          ))}
        </Card>
      )}
      <Card>
        <CardHead icon="bar-chart-outline" title="Payments" sub="Paid each month, last six months" />
        <Columns
          max={most}
          format={v => (v >= 1000 ? `₹${Math.round(v / 100) / 10}k` : v > 0 ? `₹${v}` : '0')}
          data={perMonth.map(p => ({ key: p.m, label: monthShort(p.m), value: p.amount }))}
        />
      </Card>
      {(fees.academic?.upcoming?.length ?? 0) > 0 && (
        <Card>
          <CardHead icon="receipt-outline" title="Installments" sub="Academic fee" />
          {fees.academic.upcoming.map((it, i) => (
            <LineRow
              key={`${it.serial}-${i}`}
              title={it.label}
              meta={[it.due_date ? `Due ${moment(it.due_date).format('D MMM YYYY')}` : null, it.days_overdue > 0 ? `${it.days_overdue} days late` : null]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                <View style={s.trail}>
                  <Text style={s.trailValue}>{inr(it.payable || it.outstanding || it.amount)}</Text>
                  <Pill text={it.status.charAt(0).toUpperCase() + it.status.slice(1)} tone={INSTALLMENT_TONE[it.status] ?? 'neutral'} />
                </View>
              }
              isLast={i === fees.academic.upcoming.length - 1}
            />
          ))}
        </Card>
      )}
    </>
  );
};

// ── Timetable ────────────────────────────────────────────────────────────────
const TimetableTab = ({ data, navigation }: { data: Data; navigation: any }) => {
  const t = data.timetable;
  if (t.periods === 0) {
    return <Hero kicker="Timetable" value="No periods yet" caption="Your class’s week appears here once the timetable is set." />;
  }
  const most = Math.max(1, ...t.by_day.map(d => d.periods));
  const busiest = [...t.by_day].sort((a, b) => b.periods - a.periods)[0];
  const subjects = t.by_subject ?? [];
  const hours = Math.floor(t.minutes / 60);
  const mins = t.minutes % 60;

  return (
    <>
      <Hero
        kicker="Periods a week"
        value={String(t.periods)}
        caption={t.minutes > 0 ? `${hours} h${mins ? ` ${mins} min` : ''} of classes a week${data.class ? ` · ${data.class}` : ''}` : data.class}
        stats={[
          { label: 'Subjects', value: String(subjects.length) },
          { label: 'Busiest day', value: busiest ? busiest.day : '—' },
          { label: 'A day, on average', value: String(Math.round((t.periods / Math.max(1, t.by_day.filter(d => d.periods > 0).length)) * 10) / 10) },
        ]}
      />
      <Card>
        <CardHead icon="bar-chart-outline" title="Periods by day" action="Timetable" onAction={() => navigation.navigate('Timetable')} />
        <Columns max={most} format={v => String(v)} selected={busiest?.day} data={t.by_day.map(d => ({ key: d.day, label: d.day, value: d.periods }))} />
      </Card>
      {subjects.length > 0 && (
        <Card>
          <CardHead icon="library-outline" title="By subject" sub="Periods a week, and their share of the week" />
          {subjects.map((sb, i) => (
            <PctRow
              key={sb.name}
              label={quietCaps(sb.name)}
              pct={Math.round((sb.periods / t.periods) * 100)}
              value={plural(sb.periods, 'period')}
              meta={`${Math.round((sb.periods / t.periods) * 100)}% of the week`}
              isLast={i === subjects.length - 1}
            />
          ))}
        </Card>
      )}
    </>
  );
};

const __mk_s = () => StyleSheet.create({
  scroll: { paddingBottom: 32 },
  low: { color: theme.colors.danger },
  gap: { height: 6 },
  trail: { alignItems: 'flex-end', gap: 4 },
  trailValue: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  trailOn: { fontSize: 11, fontWeight: '600', color: theme.colors.primary },
  loading: { paddingVertical: 10 },
  loadingCard: { paddingHorizontal: 16, paddingTop: 12 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

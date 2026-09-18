import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { dashboardErrorMessage } from '../../api/dashboardApi';
import { getTeacherAnalytics, type TeacherAnalytics as Data } from '../../api/analyticsApi';
import {
  ABSENT,
  Card,
  CardHead,
  Columns,
  DashError,
  DashSkeleton,
  Initial,
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
} from '../home/dashboardUi';
import { ClassAttendanceRows } from '../home/dashTeacher';
import { FigureRow, Legend, LineChart } from './charts';
import { Hero, Tabs, changeText, monthShort, pctOrDash, plural } from './analyticsUi';

type Tab = 'overview' | 'attendance' | 'marks' | 'homework' | 'quiz' | 'timetable';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'marks', label: 'Marks' },
  { key: 'homework', label: 'Homework' },
  { key: 'quiz', label: 'Assignments' },
  { key: 'timetable', label: 'Timetable' },
];

// Today across the teacher's classes: present out of those marked.
const today = (d: Data) => {
  const rows = d.attendance.by_class;
  const present = rows.reduce((n, c) => n + c.present, 0);
  const marked = rows.reduce((n, c) => n + (c.marked ?? 0), 0);
  const roster = rows.reduce((n, c) => n + c.total, 0);
  const unmarked = rows.filter(c => !c.holiday && (c.marked ?? 0) === 0).length;
  return { present, marked, roster, unmarked, pct: marked > 0 ? Math.round((present / marked) * 100) : null };
};

// The class average across every class-subject's latest exam, weighted by students.
const classAverage = (d: Data, key: 'average' | 'previous_average') => {
  const rows = d.marks.class_performance.filter(p => p[key] != null);
  const n = rows.reduce((t, p) => t + p.students, 0);
  return n > 0 ? Math.round(rows.reduce((t, p) => t + (p[key] as number) * p.students, 0) / n) : null;
};

/**
 * A teacher's Analytics: an overview, then a tab each for their classes'
 * attendance (and their own), the marks in their subjects, the homework and
 * quiz questions they have set, and their week of periods — graphs over time,
 * class set against class, and each exam against the one before.
 */
const TeacherAnalytics = ({ navigation }: { navigation: any }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getTeacherAnalytics());
    } catch (e: any) {
      console.log('[getTeacherAnalytics] Error:', e?.response?.status, e?.message);
      setError(dashboardErrorMessage(e));
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);
  useFocusLoad(load);

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
        return <AttendanceTab data={data} navigation={navigation} />;
      case 'marks':
        return <MarksTab data={data} navigation={navigation} />;
      case 'homework':
        return <HomeworkTab data={data} navigation={navigation} />;
      case 'quiz':
        return <QuizTab data={data} navigation={navigation} />;
      case 'timetable':
        return <TimetableTab data={data} navigation={navigation} />;
      default:
        return <Overview data={data} go={go} />;
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

export default TeacherAnalytics;

// ── Overview ─────────────────────────────────────────────────────────────────
const Overview = ({ data, go }: { data: Data; go: (t: Tab) => () => void }) => {
  const t = today(data);
  const avg = classAverage(data, 'average');
  const prevAvg = classAverage(data, 'previous_average');
  const up = data.marks.upload;
  const hw = data.homework;
  const week = data.attendance.week;
  const watch = data.attendance.watch;

  return (
    <>
      <KpiGrid
        items={[
          {
            icon: 'people-outline',
            label: 'Attendance',
            value: pctOrDash(t.pct),
            note: t.pct != null ? `${t.present} of ${t.marked} present today` : `${t.roster} students · not marked`,
            low: t.pct != null && t.pct < LOW_ATTENDANCE,
            onPress: go('attendance'),
          },
          {
            icon: 'stats-chart-outline',
            label: 'Class average',
            value: pctOrDash(avg),
            note: avg != null ? 'Latest exams, your subjects' : 'No marks yet',
            delta:
              avg != null && prevAvg != null
                ? { text: changeText(avg, prevAvg, 'previous') ?? '', good: avg >= prevAvg }
                : null,
            low: avg != null && avg < PASS_MARK,
            onPress: go('marks'),
          },
          {
            icon: 'create-outline',
            label: 'Marks entered',
            value: up ? `${up.done}/${up.total}` : '—',
            note: up ? up.exam_name ?? 'Current exam' : 'No exam under way',
            onPress: go('marks'),
          },
          {
            icon: 'book-outline',
            label: 'Homework done',
            value: pctOrDash(hw.completion),
            note: `${hw.total} set · ${hw.this_week} this week`,
            onPress: go('homework'),
          },
        ]}
      />

      {week.length > 0 && (
        <Card>
          <CardHead icon="bar-chart-outline" title="Attendance, last 7 days" sub="All your classes together" action="More" onAction={go('attendance')} />
          <Columns
            data={week.map(d => ({
              key: d.date,
              label: moment(d.date, 'YYYY-MM-DD').format('ddd'),
              sub: d.holiday ? 'Holiday' : moment(d.date, 'YYYY-MM-DD').format('D'),
              value: d.percentage,
              low: d.percentage != null && d.percentage < LOW_ATTENDANCE,
            }))}
          />
        </Card>
      )}

      {data.marks.exams.length > 0 && (
        <Card>
          <CardHead icon="trending-up-outline" title="Class average by exam" sub="Your subjects, all your classes" action="More" onAction={go('marks')} />
          <LineChart
            labels={data.marks.exams.map(e => e.exam_name || 'Exam')}
            subs={data.marks.exams.map(e => (e.date ? moment(e.date, 'YYYY-MM-DD').format('MMM') : null))}
            series={[{ key: 'avg', label: 'Average', points: data.marks.exams.map(e => e.average) }]}
          />
        </Card>
      )}

      {watch.total > 0 && (
        <Card>
          <CardHead icon="alert-circle-outline" title="Students to watch" sub={`${watch.total} under ${LOW_ATTENDANCE}% this month`} action="All" onAction={go('attendance')} />
          <WatchRows rows={watch.students.slice(0, 3)} more={0} />
        </Card>
      )}
    </>
  );
};

const WatchRows = ({ rows, more }: { rows: Data['attendance']['watch']['students']; more: number }) => (
  <>
    {rows.map((st, i) => (
      <LineRow
        key={`${st.name}-${st.class}-${i}`}
        lead={<Initial text={st.name} />}
        title={st.name || 'Student'}
        meta={[st.class, st.roll_no != null && st.roll_no !== '' ? `Roll ${st.roll_no}` : null, `${st.present_days} of ${st.working_days} days`]
          .filter(Boolean)
          .join(' · ')}
        trailing={<Text style={[s.trailValue, s.low]}>{st.percentage}%</Text>}
        isLast={i === rows.length - 1 && more === 0}
      />
    ))}
    {more > 0 && <Note>and {more} more</Note>}
  </>
);

// ── Attendance ───────────────────────────────────────────────────────────────
const AttendanceTab = ({ data, navigation }: { data: Data; navigation: any }) => {
  const a = data.attendance;
  const t = today(data);
  const me = data.my_attendance;
  const mine = me.this_month;

  if (a.by_class.length === 0) {
    return <Hero kicker="Attendance" value="No classes yet" caption="Your classes’ attendance appears here once you’re assigned classes with students." />;
  }

  return (
    <>
      <Hero
        kicker="Attendance today"
        value={t.pct != null ? `${t.pct}%` : 'Not marked'}
        low={t.pct != null && t.pct < LOW_ATTENDANCE}
        band={t.pct != null ? bandFor(t.pct) : null}
        caption={[
          t.pct != null ? `${t.present} of ${t.marked} students present` : `${t.roster} students in ${plural(a.by_class.length, 'class', 'classes')}`,
          t.unmarked > 0 ? `${plural(t.unmarked, 'class', 'classes')} not marked` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        stats={[
          { label: 'Students', value: String(a.total_students) },
          { label: 'Classes', value: String(a.by_class.length) },
          { label: 'Under 75%', value: String(a.watch.total), low: a.watch.total > 0 },
        ]}
      />

      <Card>
        <CardHead icon="people-outline" title="Today by class" action="Mark" onAction={() => navigation.navigate('MarkAttendance')} />
        <ClassAttendanceRows rows={a.by_class} />
      </Card>

      {a.week.length > 0 && (
        <Card>
          <CardHead icon="bar-chart-outline" title="Last 7 days" sub="Present out of marked, all classes" />
          <Columns
            data={a.week.map(d => ({
              key: d.date,
              label: moment(d.date, 'YYYY-MM-DD').format('ddd'),
              sub: d.holiday ? 'Holiday' : moment(d.date, 'YYYY-MM-DD').format('D MMM'),
              value: d.percentage,
              low: d.percentage != null && d.percentage < LOW_ATTENDANCE,
            }))}
          />
        </Card>
      )}

      {a.months.some(m => m.percentage != null) && (
        <Card>
          <CardHead icon="trending-up-outline" title="Six months" sub="All your classes together" />
          <LineChart labels={a.months.map(m => monthShort(m.month))} series={[{ key: 'all', label: 'Classes', points: a.months.map(m => m.percentage) }]} />
        </Card>
      )}

      {a.month_by_class.length > 0 && (
        <Card>
          <CardHead icon="podium-outline" title={`${moment().format('MMMM')}, class by class`} sub="Present so far, and school days marked" />
          {a.month_by_class.map((c, i) => {
            const behind = c.school_days - c.marked_days;
            return (
              <PctRow
                key={c.class}
                label={c.class}
                pct={c.percentage ?? 0}
                empty={c.percentage == null}
                value={c.percentage == null ? 'Not marked' : undefined}
                low={c.percentage != null && c.percentage < LOW_ATTENDANCE}
                tag={behind > 0 ? <Pill text={`${behind} ${behind === 1 ? 'day' : 'days'} unmarked`} tone="bad" /> : null}
                meta={`${plural(c.students, 'student')} · marked on ${c.marked_days} of ${plural(c.school_days, 'school day')}`}
                isLast={i === a.month_by_class.length - 1}
              />
            );
          })}
        </Card>
      )}

      <Card>
        <CardHead
          icon="alert-circle-outline"
          title="Students to watch"
          sub={a.watch.total > 0 ? `${a.watch.total} under ${LOW_ATTENDANCE}% this month` : `Everyone is at ${LOW_ATTENDANCE}% or above this month`}
        />
        <WatchRows rows={a.watch.students} more={Math.max(a.watch.total - a.watch.students.length, 0)} />
      </Card>

      {me.months.some(m => m.percentage != null) && (
        <Card>
          <CardHead
            icon="person-outline"
            title="My attendance"
            sub={mine?.percentage != null ? `${mine.percentage}% in ${moment(mine.month, 'YYYY-MM').format('MMMM')}` : 'Your own, as the school marks it'}
          />
          <LineChart labels={me.months.map(m => monthShort(m.month))} series={[{ key: 'me', label: 'Me', points: me.months.map(m => m.percentage) }]} />
          {!!mine && (
            <SplitBar
              parts={[
                { label: 'Present', value: mine.present, color: PRESENT },
                { label: 'Absent', value: mine.absent, color: ABSENT },
                { label: 'Holiday', value: mine.holiday, color: NEUTRAL },
              ]}
            />
          )}
        </Card>
      )}
    </>
  );
};

// ── Marks ────────────────────────────────────────────────────────────────────
const MarksTab = ({ data, navigation }: { data: Data; navigation: any }) => {
  const m = data.marks;
  const perf = m.class_performance;
  const avg = classAverage(data, 'average');
  const prevAvg = classAverage(data, 'previous_average');
  const students = perf.reduce((n, p) => n + p.students, 0);
  const passed = perf.reduce((n, p) => n + (p.passed ?? 0), 0);
  const absent = perf.reduce((n, p) => n + p.absent, 0);
  const grades = m.grades.filter(g => g.grade !== 'AB' || g.count > 0);
  const most = Math.max(1, ...grades.map(g => g.count));

  return (
    <>
      <Hero
        kicker="Class average · latest exams"
        value={avg != null ? `${avg}%` : 'No marks yet'}
        low={avg != null && avg < m.pass_percentage}
        band={avg != null ? bandFor(avg) : null}
        caption={
          avg != null
            ? [plural(perf.length, 'class and subject', 'classes and subjects'), changeText(avg, prevAvg, 'the exam before')]
                .filter(Boolean)
                .join(' · ')
            : 'Averages appear here once marks are saved for your subjects.'
        }
        stats={
          students > 0
            ? [
                { label: 'Passed', value: `${Math.round((passed / students) * 100)}%`, low: passed / students < 0.75 },
                { label: 'Students', value: String(students) },
                { label: 'Absent', value: String(absent), low: absent > 0 },
              ]
            : undefined
        }
      />

      {!!m.upload && (
        <Card>
          <CardHead
            icon="create-outline"
            title={`Marks entry · ${m.upload.exam_name ?? 'Current exam'}`}
            sub={`Complete for ${m.upload.done} of ${plural(m.upload.total, 'class and subject', 'classes and subjects')}`}
            action="Upload"
            onAction={() => navigation.navigate('UploadMarks')}
          />
          {m.upload.items.map((it, i) => {
            const pct = it.students > 0 ? Math.round((it.marks / it.students) * 100) : 0;
            return (
              <PctRow
                key={`${it.class}-${it.subject}`}
                label={`${it.class} · ${quietCaps(it.subject)}`}
                pct={pct}
                value={`${it.marks}/${it.students}`}
                empty={it.marks === 0}
                tag={it.students > 0 && it.marks >= it.students ? <Pill text="Done" tone="good" /> : null}
                meta={`Marks for ${it.marks} of ${plural(it.students, 'student')} · copies up for ${it.copies}`}
                isLast={i === m.upload!.items.length - 1}
              />
            );
          })}
        </Card>
      )}

      {m.exams.length > 0 && (
        <Card>
          <CardHead icon="trending-up-outline" title="Class average by exam" sub="Your subjects, all your classes" />
          <LineChart
            labels={m.exams.map(e => e.exam_name || 'Exam')}
            subs={m.exams.map(e => (e.date ? moment(e.date, 'YYYY-MM-DD').format('MMM') : null))}
            series={[{ key: 'avg', label: 'Average', points: m.exams.map(e => e.average) }]}
          />
        </Card>
      )}

      {perf.length > 0 && (
        <Card>
          <CardHead icon="podium-outline" title="Class performance" sub="Latest exam · the tick is the exam before" />
          <Legend items={[{ label: 'Latest exam', color: theme.colors.primary }, { label: 'Exam before', color: theme.colors.textSecondary }]} />
          {perf.map((p, i) => {
            const change = changeText(p.average, p.previous_average, p.previous_exam || 'previous');
            return (
              <PctRow
                key={`${p.class}-${p.subject}-${i}`}
                label={`${p.class} · ${quietCaps(p.subject)}`}
                pct={p.average}
                low={p.average < m.pass_percentage}
                mark={p.previous_average}
                tag={
                  p.previous_average != null ? (
                    <Pill text={`${p.average >= p.previous_average ? '▲' : '▼'} ${Math.abs(p.average - p.previous_average)}%`} tone={p.average >= p.previous_average ? 'good' : 'bad'} />
                  ) : null
                }
                meta={[
                  p.exam_name,
                  `high ${p.highest}% · low ${p.lowest}%`,
                  p.passed != null ? `${p.passed}/${p.students} passed` : plural(p.students, 'student'),
                  p.absent ? `${p.absent} absent` : null,
                  change,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                isLast={i === perf.length - 1}
              />
            );
          })}
        </Card>
      )}

      {grades.some(g => g.count > 0) && (
        <Card>
          <CardHead icon="ribbon-outline" title="Grades given" sub="Latest exam in each class and subject" />
          <Columns
            max={most}
            format={v => String(v)}
            selected={grades.reduce((a, b) => (b.count > a.count ? b : a), grades[0])?.grade}
            data={grades.map(g => ({ key: g.grade, label: g.grade, value: g.count, low: g.grade === 'F' || g.grade === 'AB' }))}
          />
        </Card>
      )}
    </>
  );
};

// ── Homework ─────────────────────────────────────────────────────────────────
const HomeworkTab = ({ data, navigation }: { data: Data; navigation: any }) => {
  const hw = data.homework;
  const most = Math.max(1, ...hw.weeks.map(w => w.set));
  const lastWeek = hw.weeks[hw.weeks.length - 2]?.set ?? 0;
  const thisWeek = hw.weeks[hw.weeks.length - 1]?.set ?? 0;
  return (
    <>
      <Hero
        kicker="Homework marked done"
        value={pctOrDash(hw.completion)}
        caption={hw.total > 0 ? `By students, across ${plural(hw.total, 'homework', 'homework')} you have set` : 'Homework you set, and how much of it students mark done, appears here.'}
        stats={[
          { label: 'Set in all', value: String(hw.total) },
          { label: 'This week', value: String(thisWeek) },
          { label: 'Last week', value: String(lastWeek) },
        ]}
      />
      <Card>
        <CardHead icon="bar-chart-outline" title="Week by week" sub="Homework set each week" action="Open" onAction={() => navigation.navigate('Homework')} />
        <Columns max={most} format={v => String(v)} data={hw.weeks.map(w => ({ key: w.week, label: w.label, value: w.set }))} />
      </Card>
      {hw.by_class.length > 0 && (
        <Card>
          <CardHead icon="people-outline" title="By class" sub="How much students have marked done" />
          {hw.by_class.map((c, i) => (
            <PctRow
              key={c.class}
              label={c.class || 'Class'}
              pct={c.percentage ?? 0}
              low={c.percentage != null && c.percentage < 50}
              meta={`${plural(c.set, 'homework', 'homework')} set · ${plural(c.students, 'student')} · ${c.done} marked done`}
              isLast={i === hw.by_class.length - 1}
            />
          ))}
        </Card>
      )}
    </>
  );
};

// ── Quiz ─────────────────────────────────────────────────────────────────────
const QuizTab = ({ data, navigation }: { data: Data; navigation: any }) => {
  const q = data.quiz;
  return (
    <>
      <Hero
        kicker="Assignments · students’ accuracy"
        value={pctOrDash(q.accuracy)}
        low={q.accuracy != null && q.accuracy < PASS_MARK}
        band={q.accuracy != null ? bandFor(q.accuracy) : null}
        caption={q.questions > 0 ? `On the ${plural(q.questions, 'question')} you have written` : 'Assignment questions you write, and how students answer them, appear here.'}
      >
        <FigureRow
          items={[
            { label: 'Questions', value: String(q.questions) },
            { label: 'Active', value: String(q.active) },
            { label: 'Answers', value: String(q.answers) },
            { label: 'Students', value: String(q.students) },
          ]}
        />
      </Hero>
      {q.by_class.length > 0 && (
        <Card>
          <CardHead icon="people-outline" title="By class" sub="Right out of answered" action="Open" onAction={() => navigation.navigate('Quiz')} />
          {q.by_class.map((c, i) => (
            <PctRow
              key={c.class}
              label={c.class}
              pct={c.accuracy ?? 0}
              empty={c.accuracy == null}
              value={c.accuracy == null ? 'No answers' : undefined}
              low={c.accuracy != null && c.accuracy < PASS_MARK}
              meta={`${plural(c.questions, 'question')} · ${plural(c.answers, 'answer')}`}
              isLast={i === q.by_class.length - 1}
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
    return <Hero kicker="Timetable" value="No periods yet" caption="Your week appears here once the timetable is set." />;
  }
  const most = Math.max(1, ...t.by_day.map(d => d.periods));
  const busiest = [...t.by_day].sort((a, b) => b.periods - a.periods)[0];
  const classes = t.by_class ?? [];
  const hours = Math.floor(t.minutes / 60);
  const mins = t.minutes % 60;

  return (
    <>
      <Hero
        kicker="Periods a week"
        value={String(t.periods)}
        caption={t.minutes > 0 ? `${hours} h${mins ? ` ${mins} min` : ''} of teaching a week` : null}
        stats={[
          { label: 'Classes', value: String(classes.length) },
          { label: 'Busiest day', value: busiest ? busiest.day : '—' },
          { label: 'A day, on average', value: String(Math.round((t.periods / Math.max(1, t.by_day.filter(d => d.periods > 0).length)) * 10) / 10) },
        ]}
      />
      <Card>
        <CardHead icon="bar-chart-outline" title="Periods by day" action="Timetable" onAction={() => navigation.navigate('Timetable')} />
        <Columns max={most} format={v => String(v)} selected={busiest?.day} data={t.by_day.map(d => ({ key: d.day, label: d.day, value: d.periods }))} />
      </Card>
      {classes.length > 0 && (
        <Card>
          <CardHead icon="people-outline" title="By class" sub="Periods a week with each class" />
          {classes.map((c, i) => (
            <PctRow
              key={c.name}
              label={c.name || 'Class'}
              pct={Math.round((c.periods / t.periods) * 100)}
              value={plural(c.periods, 'period')}
              meta={`${Math.round((c.periods / t.periods) * 100)}% of your week`}
              isLast={i === classes.length - 1}
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
  trailValue: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

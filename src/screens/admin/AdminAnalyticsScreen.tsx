import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader } from '../more/docUi';
import { dashboardErrorMessage } from '../../api/dashboardApi';
import { getAdminAnalytics, type AdminAnalyticsData as Data } from '../../api/adminDashboardApi';
import {
  COMPARE,
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
  PRESENT,
  PctRow,
  Pill,
  SplitBar,
  bandFor,
  deltaOf,
} from '../home/dashboardUi';
import { ClassAttendanceRows } from '../home/dashTeacher';
import { FigureRow, Legend, LineChart } from '../analytics/charts';
import { Hero, Tabs, changeText, inr, monthShort, pctOrDash, plural } from '../analytics/analyticsUi';
import { AwayRows, Caption, DayColumns, inrShort, listNames, sessionLabel, useAdminLinks } from './adminDashUi';

type Tab = 'overview' | 'attendance' | 'staff' | 'results' | 'fees' | 'homework' | 'admissions';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'staff', label: 'Teachers' },
  { key: 'results', label: 'Results' },
  { key: 'fees', label: 'Fees' },
  { key: 'homework', label: 'Homework' },
  { key: 'admissions', label: 'Admissions' },
];

const WEEKDAYS: Record<string, string> = {
  Mon: 'Mondays',
  Tue: 'Tuesdays',
  Wed: 'Wednesdays',
  Thu: 'Thursdays',
  Fri: 'Fridays',
  Sat: 'Saturdays',
};

const STUDENTS_VS_TEACHERS = [
  { label: 'Students', color: theme.colors.primary, line: true },
  { label: 'Teachers', color: COMPARE, line: true },
];

type Links = ReturnType<typeof useAdminLinks>;

// "▲ 4%" in a pill, green up and red down.
const ChangePill = ({ now, before }: { now: number; before: number | null | undefined }) =>
  before == null ? null : (
    <Pill text={`${now >= before ? '▲' : '▼'} ${Math.abs(now - before)}%`} tone={now >= before ? 'good' : 'bad'} />
  );

/**
 * The school's Analytics, as the student and teacher ones are drawn: a row of
 * tabs — Overview, Attendance, Teachers, Results, Fees, Homework and
 * Admissions — over cards of graphs and figures on the page's grey, each set
 * against something: the month or exam before, the class beside it, the
 * students beside the teachers.
 */
const AdminAnalyticsScreen = ({ navigation, route }: any) => {
  const [tab, setTab] = useState<Tab>(route?.params?.tab ?? 'overview');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const links = useAdminLinks(navigation);

  // The dashboard's cards open a tab of their own.
  const asked = route?.params?.tab as Tab | undefined;
  const askedAt = route?.params?.at;
  useEffect(() => {
    if (asked && TABS.some(t => t.key === asked)) setTab(asked);
  }, [asked, askedAt]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getAdminAnalytics());
    } catch (e: any) {
      console.log('[getAdminAnalytics] Error:', e?.response?.status, e?.message);
      setError(dashboardErrorMessage(e));
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);
  useFocusLoad(load);

  const go = (key: Tab) => () => setTab(key);
  const body = (() => {
    if (!data) return null;
    switch (tab) {
      case 'attendance':
        return <AttendanceTab data={data} links={links} />;
      case 'staff':
        return <StaffTab data={data} links={links} />;
      case 'results':
        return <ResultsTab data={data} links={links} />;
      case 'fees':
        return <FeesTab data={data} />;
      case 'homework':
        return <HomeworkTab data={data} links={links} />;
      case 'admissions':
        return <AdmissionsTab data={data} navigation={navigation} links={links} />;
      default:
        return <Overview data={data} go={go} />;
    }
  })();

  return (
    <View style={s.root}>
      <DocHeader
        title="Analytics"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {!data ? (
        error ? <DashError message={error} onRetry={load} /> : <DashSkeleton kpis={false} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {body}
        </ScrollView>
      )}
    </View>
  );
};

export default AdminAnalyticsScreen;

// ── Overview ─────────────────────────────────────────────────────────────────
const Overview = ({ data, go }: { data: Data; go: (t: Tab) => () => void }) => {
  const a = data.attendance;
  const months = a.months;
  const staffMonths = data.staff.months;
  const lastMonth = months[months.length - 2];
  const staffNow = staffMonths[staffMonths.length - 1];
  const staffBefore = staffMonths[staffMonths.length - 2];
  const f = data.fees.summary;
  const r = data.results.latest;
  const sc = data.school;
  const feeMost = Math.max(1, ...data.fees.months.map(m => m.amount));

  return (
    <>
      <KpiGrid
        items={[
          {
            icon: 'people-outline',
            label: 'Attendance',
            value: pctOrDash(a.this_month),
            note: `Students · ${moment().format('MMMM')}`,
            delta: deltaOf(a.this_month, a.last_month, lastMonth ? monthShort(lastMonth.month) : ''),
            low: a.this_month != null && a.this_month < LOW_ATTENDANCE,
            onPress: go('attendance'),
          },
          {
            icon: 'school-outline',
            label: 'Teachers',
            value: pctOrDash(staffNow?.percentage),
            note: `Days in · ${moment().format('MMMM')}`,
            delta: deltaOf(staffNow?.percentage, staffBefore?.percentage, staffBefore ? monthShort(staffBefore.month) : ''),
            low: staffNow?.percentage != null && staffNow.percentage < LOW_ATTENDANCE,
            onPress: go('staff'),
          },
          {
            icon: 'trophy-outline',
            label: 'School average',
            value: r ? `${r.average}%` : '—',
            note: r ? r.exam_name ?? 'Latest exam' : 'No marks yet',
            delta: r ? deltaOf(r.average, r.previous_average, 'exam before') : null,
            low: !!r && r.average < data.results.pass_percentage,
            onPress: go('results'),
          },
          {
            icon: 'wallet-outline',
            label: 'Fees collected',
            value: pctOrDash(f.rate),
            note: f.total_billable > 0 ? `${inrShort(f.total_collected)} of ${inrShort(f.total_billable)}` : 'No fees set yet',
            onPress: go('fees'),
          },
        ]}
      />

      {(months.some(m => m.percentage != null) || staffMonths.some(m => m.percentage != null)) && (
        <Card>
          <CardHead icon="trending-up-outline" title="Attendance trend" sub="Last six months, students and teachers" action="More" onAction={go('attendance')} />
          <LineChart
            labels={months.map(m => monthShort(m.month))}
            series={[
              { key: 'students', label: 'Students', points: months.map(m => m.percentage) },
              { key: 'teachers', label: 'Teachers', points: staffMonths.map(m => m.percentage), compare: true },
            ]}
          />
          <Legend items={STUDENTS_VS_TEACHERS} />
          <View style={s.gap} />
        </Card>
      )}

      {data.results.exams.length > 0 && (
        <Card>
          <CardHead icon="stats-chart-outline" title="Results trend" sub="School average, exam by exam" action="More" onAction={go('results')} />
          <LineChart
            labels={data.results.exams.map(e => e.exam_name || 'Exam')}
            subs={data.results.exams.map(e => (e.date ? moment(e.date, 'YYYY-MM-DD').format('MMM') : null))}
            series={[{ key: 'avg', label: 'Average', points: data.results.exams.map(e => e.average) }]}
          />
        </Card>
      )}

      <Card>
        <CardHead icon="cash-outline" title="Fees month by month" sub="What came in, academic and transport" action="More" onAction={go('fees')} />
        <Columns
          max={feeMost}
          format={inrShort}
          data={data.fees.months.map(m => ({ key: m.month, label: monthShort(m.month), value: m.amount }))}
        />
      </Card>

      <Card>
        <CardHead icon="business-outline" title="The school" sub={sessionLabel(sc.session)} />
        <FigureRow
          items={[
            { label: 'Students', value: String(sc.students) },
            { label: 'Teachers', value: String(sc.teachers) },
            { label: 'Classes', value: String(sc.classes) },
            { label: 'Sections', value: String(sc.sections) },
          ]}
        />
        <Note>
          {[plural(sc.subjects, 'subject'), sc.per_teacher != null ? `about ${sc.per_teacher} students to a teacher` : null]
            .filter(Boolean)
            .join(' · ')}
        </Note>
      </Card>
    </>
  );
};

// ── Attendance (students) ────────────────────────────────────────────────────
const AttendanceTab = ({ data, links }: { data: Data; links: Links }) => {
  const a = data.attendance;
  const t = a.today;
  const counted = a.weekdays.filter(w => w.percentage != null);
  const weakest = counted.length > 1 ? [...counted].sort((x, y) => (x.percentage ?? 0) - (y.percentage ?? 0))[0] : null;
  const more = Math.max(a.watch.total - a.watch.students.length, 0);

  if (a.by_class.length === 0) {
    return <Hero kicker="Attendance" value="No classes yet" caption="Attendance appears here once classes have students." />;
  }

  return (
    <>
      <Hero
        kicker="Students · today"
        value={t.holiday ? 'Holiday' : t.percentage != null ? `${t.percentage}%` : 'Not marked'}
        low={t.percentage != null && t.percentage < LOW_ATTENDANCE}
        band={!t.holiday && t.percentage != null ? bandFor(t.percentage) : null}
        caption={
          t.holiday
            ? 'No school today'
            : [
                t.percentage != null ? `${t.present} of ${t.marked} marked present` : `${t.students} students`,
                t.not_marked.length > 0 ? `${plural(t.not_marked.length, 'class', 'classes')} not marked` : null,
              ]
                .filter(Boolean)
                .join(' · ')
        }
        stats={[
          { label: moment().format('MMMM'), value: pctOrDash(a.this_month), low: a.this_month != null && a.this_month < LOW_ATTENDANCE },
          { label: 'Absent today', value: String(t.absent) },
          { label: 'Under 75% this month', value: String(a.watch.total), low: a.watch.total > 0 },
        ]}
      />

      <Card>
        <CardHead icon="people-outline" title="Today by class" sub={`${plural(a.by_class.length, 'class', 'classes')} · present out of marked`} action="Mark" onAction={links.open('attendance')} />
        <ClassAttendanceRows rows={a.by_class} />
      </Card>

      <Card>
        <CardHead icon="bar-chart-outline" title="Last 7 days" sub="Present out of marked, whole school" />
        <DayColumns days={a.week} />
      </Card>

      {a.months.some(m => m.percentage != null) && (
        <Card>
          <CardHead icon="trending-up-outline" title="Six months" sub="Students, month by month" />
          <LineChart labels={a.months.map(m => monthShort(m.month))} series={[{ key: 'all', label: 'Students', points: a.months.map(m => m.percentage) }]} />
        </Card>
      )}

      {a.month_by_class.length > 0 && (
        <Card>
          <CardHead icon="podium-outline" title={`${moment().format('MMMM')}, class by class`} sub="Present so far, and school days marked" />
          {a.month_by_class.map((c, i) => {
            const behind = Math.max(c.school_days - c.marked_days, 0);
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

      {counted.length > 0 && (
        <Card>
          <CardHead
            icon="calendar-outline"
            title="Weekday by weekday"
            sub={weakest ? `Six months · lowest on ${WEEKDAYS[weakest.day] ?? weakest.day}` : 'Six months'}
          />
          <Columns
            selected={weakest?.day}
            data={a.weekdays.map(w => ({ key: w.day, label: w.day, value: w.percentage, low: w.percentage != null && w.percentage < LOW_ATTENDANCE }))}
          />
        </Card>
      )}

      <Card>
        <CardHead
          icon="alert-circle-outline"
          title="Students to watch"
          sub={a.watch.total > 0 ? `${a.watch.total} under ${LOW_ATTENDANCE}% this month` : `Everyone is at ${LOW_ATTENDANCE}% or above this month`}
        />
        {a.watch.students.map((st, i) => (
          <LineRow
            key={`${st.name}-${st.class}-${i}`}
            lead={<Initial text={st.name} />}
            title={st.name || 'Student'}
            meta={[st.class, st.roll_no != null && st.roll_no !== '' ? `Roll ${st.roll_no}` : null, `${st.present_days} of ${st.working_days} days`]
              .filter(Boolean)
              .join(' · ')}
            trailing={<Text style={[s.trailValue, s.low]}>{st.percentage}%</Text>}
            isLast={i === a.watch.students.length - 1 && more === 0}
          />
        ))}
        {more > 0 && <Note>and {more} more</Note>}
      </Card>
    </>
  );
};

// ── Teachers ─────────────────────────────────────────────────────────────────
const StaffTab = ({ data, links }: { data: Data; links: Links }) => {
  const st = data.staff;
  const t = st.today;
  const inToday = t.present + t.half_day;
  const w = st.workload;
  const busiest = Math.max(1, ...w.by_teacher.map(x => x.periods));
  const away = st.month_by_teacher;

  if (st.total === 0) {
    return <Hero kicker="Teachers" value="No teachers yet" caption="Teachers’ attendance appears here once teachers are added." />;
  }

  return (
    <>
      <Hero
        kicker="Teachers · today"
        value={t.holiday ? 'Holiday' : t.percentage != null ? `${t.percentage}%` : 'Not marked'}
        low={t.percentage != null && t.percentage < LOW_ATTENDANCE}
        band={!t.holiday && t.percentage != null ? bandFor(t.percentage) : null}
        caption={
          t.holiday
            ? 'No school today'
            : t.marked > 0
            ? [`${inToday} of ${t.marked} marked are in`, t.half_day > 0 ? `${t.half_day} on a half day` : null].filter(Boolean).join(' · ')
            : `${plural(st.total, 'teacher')} · not marked yet`
        }
        stats={[
          { label: 'Teachers', value: String(st.total) },
          { label: 'Absent today', value: String(t.absent), low: t.absent > 0 },
          { label: 'Not marked', value: String(t.not_marked), low: !t.holiday && t.not_marked > 0 },
        ]}
      />

      {!t.holiday && (
        <Card>
          <CardHead icon="person-remove-outline" title="Away today" sub={st.absent.length > 0 ? plural(st.absent.length, 'teacher') : 'Nobody marked away'} action="Arrangement" onAction={links.open('arrangement')} />
          {st.absent.length > 0 ? (
            <AwayRows rows={st.absent} isLast={st.not_marked.length === 0 && st.arrangements.total === 0} />
          ) : (
            <Note>{t.marked > 0 ? 'Every teacher marked today is in.' : 'Teachers’ attendance hasn’t been marked today.'}</Note>
          )}
          {st.arrangements.total > 0 && (
            <LineRow
              title="Arrangements"
              meta={`${st.arrangements.covered} of ${plural(st.arrangements.total, 'period')} covered by a substitute`}
              trailing={
                st.arrangements.covered < st.arrangements.total ? (
                  <Pill text={`${st.arrangements.total - st.arrangements.covered} open`} tone="bad" />
                ) : (
                  <Pill text="All covered" tone="good" />
                )
              }
              isLast={st.not_marked.length === 0}
            />
          )}
          {st.not_marked.length > 0 && (
            <Text style={s.alert}>
              <Text style={s.alertStrong}>Not marked: </Text>
              {listNames(st.not_marked, 6)}
            </Text>
          )}
        </Card>
      )}

      <Card>
        <CardHead icon="bar-chart-outline" title="Last 7 days" sub="Teachers in, out of those marked" />
        <DayColumns days={st.week} />
      </Card>

      {st.months.some(m => m.percentage != null) && (
        <Card>
          <CardHead icon="trending-up-outline" title="Six months" sub="Teachers, with the students beside them" />
          <LineChart
            labels={st.months.map(m => monthShort(m.month))}
            series={[
              { key: 'teachers', label: 'Teachers', points: st.months.map(m => m.percentage) },
              { key: 'students', label: 'Students', points: data.attendance.months.map(m => m.percentage), compare: true },
            ]}
          />
          <Legend
            items={[
              { label: 'Teachers', color: theme.colors.primary, line: true },
              { label: 'Students', color: COMPARE, line: true },
            ]}
          />
          <View style={s.gap} />
        </Card>
      )}

      <Card>
        <CardHead
          icon="calendar-clear-outline"
          title={`${moment().format('MMMM')}, days away`}
          sub={away.total > 0 ? `${plural(away.total, 'teacher')} away at least once` : 'Nobody has been away this month'}
        />
        {away.teachers.map((x, i) => (
          <LineRow
            key={`${x.name}-${i}`}
            lead={<Initial text={x.name} />}
            title={x.name}
            meta={[
              x.absent > 0 ? `${plural(x.absent, 'day')} absent` : null,
              x.half_day > 0 ? `${plural(x.half_day, 'half day')}` : null,
              `of ${plural(x.working, 'day')} marked`,
            ]
              .filter(Boolean)
              .join(' · ')}
            trailing={
              <Text style={[s.trailValue, x.percentage != null && x.percentage < LOW_ATTENDANCE && s.low]}>{pctOrDash(x.percentage)}</Text>
            }
            isLast={i === away.teachers.length - 1 && away.total <= away.teachers.length}
          />
        ))}
        {away.total > away.teachers.length && <Note>and {away.total - away.teachers.length} more</Note>}
      </Card>

      {w.by_teacher.length > 0 && (
        <Card>
          <CardHead
            icon="time-outline"
            title="Periods a week"
            sub={[`${w.periods} on the timetable`, w.idle > 0 ? `${plural(w.idle, 'teacher')} with none` : null].filter(Boolean).join(' · ')}
            action="Timetable"
            onAction={links.open('timetable')}
          />
          {w.by_teacher.map((x, i) => {
            const h = Math.floor(x.minutes / 60);
            const m = x.minutes % 60;
            return (
              <PctRow
                key={`${x.name}-${i}`}
                label={x.name}
                pct={Math.round((x.periods / busiest) * 100)}
                value={plural(x.periods, 'period')}
                meta={x.minutes > 0 ? `${h} h${m ? ` ${m} min` : ''} a week` : null}
                isLast={i === w.by_teacher.length - 1}
              />
            );
          })}
        </Card>
      )}
    </>
  );
};

// ── Results ──────────────────────────────────────────────────────────────────
const ResultsTab = ({ data, links }: { data: Data; links: Links }) => {
  const r = data.results;
  const l = r.latest;
  const up = r.upload;
  const pass = r.pass_percentage;
  const grades = l ? l.grades.filter(g => g.grade !== 'AB' || g.count > 0) : [];
  const most = Math.max(1, ...grades.map(g => g.count));

  return (
    <>
      <Hero
        kicker={l ? `School average · ${l.exam_name ?? 'latest exam'}` : 'School average'}
        value={l ? `${l.average}%` : 'No marks yet'}
        low={!!l && l.average < pass}
        band={l ? bandFor(l.average) : null}
        caption={
          l
            ? [plural(l.students, 'student'), changeText(l.average, l.previous_average, l.previous_exam || 'the exam before')].filter(Boolean).join(' · ')
            : 'Averages appear here once marks are saved.'
        }
        stats={
          l && l.students > 0
            ? [
                { label: 'Passed', value: `${Math.round((l.passed / l.students) * 100)}%`, low: l.passed / l.students < 0.75 },
                { label: 'Papers', value: String(l.papers) },
                { label: 'Absent papers', value: String(l.absent), low: l.absent > 0 },
              ]
            : undefined
        }
      />

      {!!up && (
        <Card>
          <CardHead
            icon="create-outline"
            title={`Marks entry · ${up.exam_name ?? 'Current exam'}`}
            sub={`Complete for ${up.done} of ${plural(up.total, 'class subject')}`}
          />
          {up.by_class.map((c, i) => (
            <PctRow
              key={c.class}
              label={c.class}
              pct={c.expected > 0 ? Math.round((c.marks / c.expected) * 100) : 0}
              value={`${c.complete}/${c.subjects}`}
              empty={c.marks === 0}
              tag={c.complete >= c.subjects ? <Pill text="Done" tone="good" /> : null}
              meta={`${c.complete} of ${plural(c.subjects, 'subject')} complete · marks for ${c.marks} of ${c.expected} papers`}
              isLast={i === up.by_class.length - 1}
            />
          ))}
        </Card>
      )}

      {r.exams.length > 0 && (
        <Card>
          <CardHead icon="trending-up-outline" title="Exam by exam" sub="School average, every class and subject" />
          <LineChart
            labels={r.exams.map(e => e.exam_name || 'Exam')}
            subs={r.exams.map(e => (e.date ? moment(e.date, 'YYYY-MM-DD').format('MMM') : null))}
            series={[{ key: 'avg', label: 'Average', points: r.exams.map(e => e.average) }]}
          />
        </Card>
      )}

      {!!l && l.by_class.length > 0 && (
        <Card>
          <CardHead
            icon="podium-outline"
            title="Class by class"
            sub={l.previous_exam ? `The tick is ${l.previous_exam}` : l.exam_name}
            action="Performance"
            onAction={links.open('performance')}
          />
          {!!l.previous_exam && (
            <Legend items={[{ label: 'Latest exam', color: theme.colors.primary }, { label: 'Exam before', color: theme.colors.textSecondary }]} />
          )}
          {l.by_class.map((c, i) => (
            <PctRow
              key={c.class}
              label={c.class}
              pct={c.average}
              low={c.average < pass}
              mark={c.previous_average}
              tag={<ChangePill now={c.average} before={c.previous_average} />}
              meta={[`high ${c.highest}% · low ${c.lowest}%`, `${c.passed}/${c.students} passed`].join(' · ')}
              isLast={i === l.by_class.length - 1}
            />
          ))}
        </Card>
      )}

      {!!l && l.by_subject.length > 0 && (
        <Card>
          <CardHead icon="library-outline" title="Subject by subject" sub={`${l.exam_name ?? 'Latest exam'} · every class`} />
          {l.by_subject.map((sb, i) => (
            <PctRow
              key={sb.subject}
              label={quietCaps(sb.subject)}
              pct={sb.average}
              low={sb.average < pass}
              meta={`high ${sb.highest}% · low ${sb.lowest}% · ${plural(sb.papers, 'paper')}`}
              isLast={i === l.by_subject.length - 1}
            />
          ))}
        </Card>
      )}

      {grades.some(g => g.count > 0) && (
        <Card>
          <CardHead icon="ribbon-outline" title="Grades given" sub={`${l?.exam_name ?? 'Latest exam'}, paper by paper`} />
          <Columns
            max={most}
            format={v => String(v)}
            selected={grades.reduce((a, b) => (b.count > a.count ? b : a), grades[0])?.grade}
            data={grades.map(g => ({ key: g.grade, label: g.grade, value: g.count, low: g.grade === 'F' || g.grade === 'AB' }))}
          />
        </Card>
      )}

      {!!l && l.toppers.length > 0 && (
        <Card>
          <CardHead icon="star-outline" title="Toppers" sub={`${l.exam_name ?? 'Latest exam'} · all papers together`} />
          {l.toppers.map((tp, i) => (
            <LineRow
              key={`${tp.name}-${i}`}
              lead={<Initial text={String(i + 1)} />}
              title={tp.name || 'Student'}
              meta={tp.class}
              trailing={<Text style={s.trailValue}>{tp.percentage}%</Text>}
              isLast={i === l.toppers.length - 1}
            />
          ))}
        </Card>
      )}
    </>
  );
};

// ── Fees ─────────────────────────────────────────────────────────────────────
const FeesTab = ({ data }: { data: Data }) => {
  const fe = data.fees;
  const f = fe.summary;
  const p = fe.periods;
  const days = fe.days.slice(-7);
  const dayMost = Math.max(1, ...days.map(d => d.amount));
  const monthMost = Math.max(1, ...fe.months.map(m => m.amount));
  const week = days.reduce((n, d) => n + d.amount, 0);
  const payments = days.reduce((n, d) => n + d.count, 0);
  const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
  const academic = rate(f.academic_collected, f.academic_billable);
  const transport = rate(f.transport_collected, f.transport_billable);
  const ledger = fe.ledger;

  return (
    <>
      <Hero
        kicker="Fees collected · this session"
        value={pctOrDash(f.rate)}
        caption={
          f.total_billable > 0
            ? `${inr(f.total_collected)} of ${inr(f.total_billable)} · ${inr(f.total_due)} due`
            : 'Fees appear here once fee heads are set for classes.'
        }
        stats={[
          { label: 'Today', value: inrShort(p.today.amount) },
          { label: moment().format('MMMM'), value: inrShort(p.this_month.amount) },
          { label: 'Students with dues', value: String(f.with_dues), low: f.with_dues > 0 },
        ]}
      />

      <Card>
        <CardHead icon="layers-outline" title="Academic and transport" sub={`${plural(f.students, 'student')} · ${plural(f.riders, 'rider')} on the bus`} />
        <PctRow
          label="Academic"
          pct={academic ?? 0}
          empty={academic == null}
          value={academic == null ? 'Not set' : `${academic}%`}
          meta={f.academic_billable > 0 ? `${inr(f.academic_collected)} of ${inr(f.academic_billable)} · ${inr(f.academic_due)} due` : 'No academic fee heads yet'}
          isLast={f.riders === 0 && f.penalty_collected === 0}
        />
        {f.riders > 0 && (
          <PctRow
            label="Transport"
            pct={transport ?? 0}
            empty={transport == null}
            value={transport == null ? '—' : `${transport}%`}
            meta={`${inr(f.transport_collected)} of ${inr(f.transport_billable)} · ${inr(f.transport_due)} due`}
            isLast={f.penalty_collected === 0}
          />
        )}
        {f.penalty_collected > 0 && <Note>Late fees collected: {inr(f.penalty_collected)}</Note>}
      </Card>

      <Card>
        <CardHead icon="bar-chart-outline" title="Last 7 days" sub={`${inr(week)} in ${plural(payments, 'payment')}`} />
        <Columns
          max={dayMost}
          format={inrShort}
          data={days.map(d => ({
            key: d.date,
            label: moment(d.date, 'YYYY-MM-DD').format('ddd'),
            sub: moment(d.date, 'YYYY-MM-DD').format('D'),
            value: d.amount,
          }))}
        />
        <Caption>
          Yesterday {inrShort(p.yesterday.amount)} · this week {inrShort(p.this_week.amount)} · last month {inrShort(p.last_month.amount)}
        </Caption>
        <View style={s.gap} />
      </Card>

      <Card>
        <CardHead icon="trending-up-outline" title="Month by month" sub="Last six months" />
        <Columns
          max={monthMost}
          format={inrShort}
          data={fe.months.map(m => ({ key: m.month, label: monthShort(m.month), value: m.amount }))}
        />
      </Card>

      {fe.by_class.length > 0 && (
        <Card>
          <CardHead icon="podium-outline" title="Class by class" sub="Collected out of billed" />
          {fe.by_class.map((c, i) => (
            <PctRow
              key={c.class}
              label={c.class}
              pct={c.rate ?? 0}
              empty={c.rate == null}
              value={c.rate == null ? 'No fees set' : `${c.rate}%`}
              low={c.rate != null && c.rate < 50}
              meta={c.billable > 0 ? `${inr(c.collected)} of ${inr(c.billable)} · ${plural(c.students, 'student')}` : plural(c.students, 'student')}
              isLast={i === fe.by_class.length - 1}
            />
          ))}
        </Card>
      )}

      {fe.modes.length > 0 && (
        <Card>
          <CardHead icon="card-outline" title="How it was paid" sub="Every payment so far" />
          {fe.modes.map((m, i) => (
            <PctRow
              key={m.mode}
              label={m.mode}
              pct={m.share ?? 0}
              value={inrShort(m.amount)}
              meta={`${m.share ?? 0}% · ${plural(m.count, 'payment')}`}
              isLast={i === fe.modes.length - 1}
            />
          ))}
        </Card>
      )}

      {fe.top_due.length > 0 && (
        <Card>
          <CardHead icon="alert-circle-outline" title="Biggest dues" sub={`${plural(f.with_dues, 'student')} with fees left to pay`} />
          {fe.top_due.map((d, i) => (
            <LineRow
              key={`${d.name}-${d.admission_no}-${i}`}
              lead={<Initial text={d.name} />}
              title={d.name}
              meta={[d.class, d.admission_no ? `Adm ${d.admission_no}` : null, `paid ${inr(d.collected)} of ${inr(d.billable)}`]
                .filter(Boolean)
                .join(' · ')}
              trailing={<Text style={[s.trailValue, s.low]}>{inrShort(d.due)}</Text>}
              isLast={i === fe.top_due.length - 1}
            />
          ))}
        </Card>
      )}

      {fe.qr_pending > 0 && (
        <Card>
          <CardHead icon="qr-code-outline" title="QR payments" sub="Paid on the school’s QR, waiting to be checked" />
          <Note>
            {plural(fe.qr_pending, 'payment')} to approve or reject — Fees → QR Payments in the admin panel.
          </Note>
        </Card>
      )}

      <Card>
        <CardHead icon="calculator-outline" title="Ledger" sub="Credit and expense so far" />
        <FigureRow
          items={[
            { label: 'Credit', value: inrShort(ledger.credit) },
            { label: 'Expense', value: inrShort(ledger.expense) },
            { label: ledger.balance >= 0 ? 'Balance' : 'Short by', value: inrShort(Math.abs(ledger.balance)), low: ledger.balance < 0 },
          ]}
        />
      </Card>
    </>
  );
};

// ── Homework ─────────────────────────────────────────────────────────────────
const HomeworkTab = ({ data, links }: { data: Data; links: Links }) => {
  const hw = data.homework;
  const most = Math.max(1, ...hw.weeks.map(w => w.set));
  return (
    <>
      <Hero
        kicker="Homework marked done · this session"
        value={pctOrDash(hw.completion)}
        caption={
          hw.total > 0
            ? `By students, across ${plural(hw.total, 'homework', 'homework')} set by ${plural(hw.teachers, 'teacher')}`
            : 'Homework teachers set, and how much of it students mark done, appears here.'
        }
        stats={[
          { label: 'Set this session', value: String(hw.total) },
          { label: 'This week', value: String(hw.this_week) },
          { label: 'Last week', value: String(hw.last_week) },
        ]}
      />
      <Card>
        <CardHead icon="bar-chart-outline" title="Week by week" sub="Homework set each week" action="Open" onAction={links.open('homework')} />
        <Columns max={most} format={v => String(v)} data={hw.weeks.map(w => ({ key: w.week, label: w.label, value: w.set }))} />
      </Card>
      {hw.by_class.length > 0 && (
        <Card>
          <CardHead icon="people-outline" title="By class" sub="How much students have marked done" />
          {hw.by_class.map((c, i) => (
            <PctRow
              key={c.class}
              label={c.class}
              pct={c.percentage ?? 0}
              empty={c.percentage == null}
              low={c.percentage != null && c.percentage < 50}
              meta={`${plural(c.set, 'homework', 'homework')} set · ${plural(c.students, 'student')} · ${c.done} marked done`}
              isLast={i === hw.by_class.length - 1}
            />
          ))}
        </Card>
      )}
      {hw.by_teacher.length > 0 && (
        <Card>
          <CardHead icon="school-outline" title="By teacher" sub="Most set first · marked done by students" />
          {hw.by_teacher.map((x, i) => (
            <PctRow
              key={`${x.name}-${i}`}
              label={x.name}
              pct={x.percentage ?? 0}
              empty={x.percentage == null}
              low={x.percentage != null && x.percentage < 50}
              meta={`${plural(x.set, 'homework', 'homework')} set`}
              isLast={i === hw.by_teacher.length - 1}
            />
          ))}
        </Card>
      )}
    </>
  );
};

// ── Admissions ───────────────────────────────────────────────────────────────
const AdmissionsTab = ({ data, navigation, links }: { data: Data; navigation: any; links: Links }) => {
  const ad = data.admissions;
  const e = ad.enquiries;
  const most = Math.max(1, ...ad.months.map(m => m.count));
  const biggest = Math.max(1, ...ad.by_class.map(c => c.students));
  const openAdmissions = links.can('more')
    ? () => navigation.navigate('AdminMore', { screen: 'AdminAdmissions', initial: false })
    : undefined;

  return (
    <>
      <Hero
        kicker={`Students · ${sessionLabel(data.school.session) ?? 'this session'}`}
        value={String(ad.students)}
        caption={`${plural(ad.session_total, 'admission')} this session · ${ad.this_month} this month, ${ad.last_month} last month`}
        stats={[
          { label: 'Boys', value: String(ad.gender.boys) },
          { label: 'Girls', value: String(ad.gender.girls) },
          { label: 'Classes', value: String(data.school.classes) },
        ]}
      />

      {ad.months.length > 0 && (
        <Card>
          <CardHead icon="bar-chart-outline" title="Admissions month by month" sub="On the admission date the school recorded" />
          <Columns max={most} format={v => String(v)} data={ad.months.map(m => ({ key: m.month, label: monthShort(m.month), value: m.count }))} />
        </Card>
      )}

      {ad.by_class.length > 0 && (
        <Card>
          <CardHead icon="people-outline" title="Class by class" sub="Students in each class" action="Students" onAction={links.open('students')} />
          {ad.by_class.map((c, i) => (
            <PctRow
              key={c.class}
              label={c.class}
              pct={Math.round((c.students / biggest) * 100)}
              value={String(c.students)}
              meta={[
                c.sections > 0 ? plural(c.sections, 'section') : null,
                c.boys + c.girls > 0 ? `${c.boys} boys · ${c.girls} girls` : null,
              ]
                .filter(Boolean)
                .join(' · ') || null}
              isLast={i === ad.by_class.length - 1}
            />
          ))}
        </Card>
      )}

      <Card>
        <CardHead
          icon="clipboard-outline"
          title="Admission enquiries"
          sub={e.total > 0 ? `${e.total} in all · ${e.total > 0 ? Math.round((e.admitted / e.total) * 100) : 0}% admitted` : 'None yet'}
          action="Open"
          onAction={openAdmissions}
        />
        {e.total > 0 ? (
          <SplitBar
            parts={[
              { label: 'Admitted', value: e.admitted, color: PRESENT },
              { label: 'Pending', value: e.pending, color: theme.colors.primary },
              { label: 'Other', value: e.other, color: NEUTRAL },
            ]}
          />
        ) : (
          <Note>Admission enquiries appear here as they come in.</Note>
        )}
        {e.recent.map((q, i) => (
          <LineRow
            key={q.id}
            lead={<Initial text={q.name} />}
            title={q.name || 'Enquiry'}
            meta={[q.class, q.date ? moment(q.date, 'YYYY-MM-DD').format('D MMM') : null, 'Pending'].filter(Boolean).join(' · ')}
            onPress={openAdmissions}
            isLast={i === e.recent.length - 1}
          />
        ))}
      </Card>
    </>
  );
};

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 32 },
  gap: { height: 6 },
  low: { color: theme.colors.danger },
  trailValue: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  alert: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, paddingTop: 6, paddingBottom: 10 },
  alertStrong: { fontWeight: '600', color: theme.colors.danger },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment';
import TopBar from '../../../components/TopBar';
import AppRefreshControl from '../../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../../hooks/useRefresh';
import { theme, onThemeChange } from '../../../utils/theme';
import { quietCaps } from '../../../utils/quietCaps';
import {
  getTeacherDashboard,
  dashboardErrorMessage,
  type TeacherDashboard,
} from '../../../api/dashboardApi';
import {
  Card,
  CardHead,
  Chevron,
  Columns,
  DashError,
  DashSkeleton,
  Initial,
  KpiGrid,
  LOW_ATTENDANCE,
  LineRow,
  PASS_MARK,
  PageLine,
  PctRow,
  Pill,
  PeriodRow,
  clock12,
  periodStates,
} from '../dashboardUi';
import { ExamRows, examSoon } from '../dashExams';
import { Callout, ClassAttendanceRows, WatchRows, attendanceToday, className, weekAverage } from '../dashTeacher';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * A teacher's day at a glance: what is still to do (today's register), four
 * headline figures, then the day's periods, each class's attendance and the
 * week behind it, the students slipping under 75%, how the last exams went,
 * and the homework, exams and notices.
 */
const TeacherHomeScreen = () => {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<TeacherDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getTeacherDashboard());
    } catch (e: any) {
      console.log('[getTeacherDashboard] Error:', e?.response?.status, e?.message);
      setError(dashboardErrorMessage(e));
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  // Loads on arrival, and refreshes quietly on every return to the dashboard.
  useFocusLoad(load);

  const topBar = (
    <TopBar
      onAvatarPress={() => navigation.navigate('TeacherProfile')}
      onBellPress={() => navigation.navigate('Notifications', { role: 'teacher' })}
    />
  );

  if (!data) {
    return (
      <View style={s.root}>
        {topBar}
        {error ? <DashError message={error} onRetry={load} /> : <DashSkeleton />}
      </View>
    );
  }

  const { totals, notices } = data;
  const classes = data.today_classes ?? [];
  const states = periodStates(classes);
  const doneCount = states.filter(st => st === 'done').length;
  const nowIndex = states.indexOf('now');
  const nextIndex = states.indexOf('next');
  const byClass = data.class_attendance?.by_class ?? [];
  const today = attendanceToday(data);
  const homework = data.homework?.recent ?? [];
  const week = data.class_attendance?.week ?? [];
  const weekAvg = weekAverage(week);
  const watch = data.class_attendance?.watch;
  const performance = data.class_performance ?? [];
  const exams = data.exams?.upcoming ?? [];
  const students = totals?.total_students || today.roster;

  const toAnalytics = (tab?: string) => () => navigation.navigate('Analytics', { userRole: 'teacher', tab });
  const toMark = () => navigation.navigate('MarkAttendance');

  // "Friday, 23 October · 1 class · 46 students"
  const dateLine = [
    moment().format('dddd, D MMMM'),
    byClass.length > 0 ? plural(byClass.length, 'class', 'classes') : null,
    students > 0 ? plural(students, 'student') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // "Now · Class 10 A" · "Next at 11:30 AM" · "All done for today"
  const classesNote =
    classes.length === 0
      ? 'None today'
      : nowIndex >= 0
      ? `Now · ${classes[nowIndex].class ? className(classes[nowIndex].class) : quietCaps(classes[nowIndex].subject)}`
      : nextIndex >= 0
      ? `Next at ${clock12(classes[nextIndex].time)}`
      : 'All done for today';

  // The register still to take: one class by name, several by count.
  const pending = today.pending;
  const pendingText =
    pending.length === 1
      ? `${className(pending[0].class)} · ${plural(pending[0].total, 'student')}`
      : pending.map(c => className(c.class)).join(', ');

  return (
    <View style={s.root}>
      {topBar}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PageLine text={dateLine} />

        {pending.length > 0 && (
          <Callout
            icon="checkbox-outline"
            title={pending.length === 1 ? 'Attendance not marked' : `${pending.length} classes not marked`}
            text={pendingText}
            action="Mark now"
            onAction={toMark}
          />
        )}

        {/* The four numbers worth checking, each saying what it means */}
        <KpiGrid
          items={[
            {
              icon: 'time-outline',
              label: 'Classes today',
              value: classes.length > 0 ? `${doneCount}/${classes.length}` : 'None',
              muted: classes.length === 0,
              note: classesNote,
              onPress: () => navigation.navigate('Timetable'),
            },
            {
              icon: 'people-outline',
              label: 'Attendance',
              value: today.pct != null ? `${today.pct}%` : byClass.length > 0 ? 'Pending' : 'No classes',
              muted: today.pct == null,
              note:
                today.pct != null
                  ? `${today.present} of ${today.marked} present`
                  : weekAvg != null
                  ? `Week average ${weekAvg}%`
                  : 'Not marked yet',
              low: today.pct != null && today.pct < LOW_ATTENDANCE,
              onPress: today.pct == null && pending.length > 0 ? toMark : toAnalytics('attendance'),
            },
            {
              icon: 'book-outline',
              label: 'Homework',
              value: String(totals?.homework_count ?? 0),
              note: homework[0]?.date ? `Last set ${homework[0].date}` : 'None set yet',
              onPress: () => navigation.navigate('Homework'),
            },
            {
              icon: 'document-text-outline',
              label: 'Exams',
              value: String(totals?.upcoming_exams ?? exams.length),
              note: exams[0] ? examSoon(exams[0]) : 'None coming up',
              onPress: () => navigation.navigate('Exams'),
            },
          ]}
        />

        {/* Today's classes, against the clock */}
        {classes.length > 0 && (
          <Card>
            <CardHead
              icon="time-outline"
              title="Today's schedule"
              sub={`${plural(classes.length, 'period')} · ${doneCount} done`}
              action="Timetable"
              onAction={() => navigation.navigate('Timetable')}
            />
            {classes.map((c, i) => (
              <PeriodRow
                key={`${c.time}-${i}`}
                start={c.time}
                end={c.end_time}
                title={quietCaps(c.subject)}
                meta={[c.class ? className(c.class) : null, c.room ? `Room ${c.room}` : null].filter(Boolean).join(' · ')}
                state={states[i]}
                isFirst={i === 0}
                isLast={i === classes.length - 1}
              />
            ))}
          </Card>
        )}

        {/* Who is in today, class by class, and the week behind it */}
        {byClass.length > 0 && (
          <Card>
            <CardHead
              icon="people-outline"
              title="Attendance today"
              sub={
                today.pct != null
                  ? `${today.pct}% · ${today.present} of ${today.marked} present`
                  : `${plural(today.roster, 'student')} · not marked yet`
              }
              action="Details"
              onAction={toAnalytics('attendance')}
            />
            <ClassAttendanceRows rows={byClass} />
            {week.length > 0 && (
              <View style={s.weekBlock}>
                <View style={s.weekHead}>
                  <Text style={s.caption}>Last 7 days</Text>
                  {weekAvg != null && (
                    <Text style={[s.caption, s.captionStrong, weekAvg < LOW_ATTENDANCE && s.low]}>
                      Average {weekAvg}%
                    </Text>
                  )}
                </View>
                <Columns
                  height={56}
                  data={week.map(d => ({
                    key: d.date,
                    label: moment(d.date, 'YYYY-MM-DD').format('ddd'),
                    sub: d.holiday ? 'Off' : moment(d.date, 'YYYY-MM-DD').format('D'),
                    value: d.percentage,
                    low: d.percentage != null && d.percentage < LOW_ATTENDANCE,
                  }))}
                />
              </View>
            )}
          </Card>
        )}

        {/* The students slipping under 75% this month */}
        {!!watch && watch.total > 0 && (
          <Card>
            <CardHead
              icon="alert-circle-outline"
              title="Students to watch"
              sub={`${watch.total} under ${LOW_ATTENDANCE}% this month`}
              action="All"
              onAction={toAnalytics('attendance')}
            />
            <WatchRows rows={watch.students.slice(0, 3)} more={Math.max(watch.total - 3, 0)} />
          </Card>
        )}

        {/* Each class and subject's latest exam, against the one before */}
        {performance.length > 0 && (
          <Card>
            <CardHead
              icon="trophy-outline"
              title="Class performance"
              sub="Latest exam · the tick is the exam before"
              action="Details"
              onAction={toAnalytics('marks')}
            />
            {performance.slice(0, 4).map((p, i, list) => (
              <PctRow
                key={`${p.class}-${p.subject}-${i}`}
                label={`${className(p.class)} · ${quietCaps(p.subject)}`}
                pct={p.average}
                low={p.average < PASS_MARK}
                mark={p.previous_average}
                tag={
                  p.previous_average != null ? (
                    <Pill
                      text={`${p.average >= p.previous_average ? '▲' : '▼'} ${Math.abs(p.average - p.previous_average)}%`}
                      tone={p.average >= p.previous_average ? 'good' : 'bad'}
                    />
                  ) : null
                }
                meta={[p.exam_name, `high ${p.highest}% · low ${p.lowest}%`, p.passed != null ? `${p.passed}/${p.students} passed` : null]
                  .filter(Boolean)
                  .join(' · ')}
                isLast={i === list.length - 1}
              />
            ))}
          </Card>
        )}

        {homework.length > 0 && (
          <Card>
            <CardHead
              icon="book-outline"
              title="Assigned homework"
              sub={`${totals?.homework_count ?? homework.length} in all`}
              action="See all"
              onAction={() => navigation.navigate('Homework')}
            />
            {homework.map((hw, i) => {
              const done = typeof hw.done === 'number' ? hw.done : null;
              return (
                <LineRow
                  key={hw.id}
                  lead={<Initial text={quietCaps(hw.subject_name) || hw.title} />}
                  title={quietCaps(hw.title) || 'Homework'}
                  meta={[quietCaps(hw.subject_name), hw.class ? className(hw.class) : null, hw.date].filter(Boolean).join(' · ')}
                  trailing={
                    done != null && (hw.students ?? 0) > 0 ? (
                      <Pill text={`${done}/${hw.students} done`} tone={done >= (hw.students ?? 0) ? 'good' : 'neutral'} />
                    ) : null
                  }
                  onPress={() => navigation.navigate('Homework')}
                  isLast={i === homework.length - 1}
                />
              );
            })}
          </Card>
        )}

        {exams.length > 0 && (
          <Card>
            <CardHead
              icon="document-text-outline"
              title="Upcoming exams"
              sub={`${exams.length} scheduled`}
              action="See all"
              onAction={() => navigation.navigate('Exams')}
            />
            <ExamRows exams={exams} />
          </Card>
        )}

        {notices.length > 0 && (
          <Card>
            <CardHead icon="megaphone-outline" title="Notices" />
            {notices.map((n, i) => (
              <LineRow
                key={n.id}
                title={n.title || 'Notice'}
                meta={n.time}
                trailing={<Chevron />}
                onPress={() => navigation.navigate('Notifications', { role: 'teacher' })}
                isLast={i === notices.length - 1}
              />
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

export default TeacherHomeScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 28 },
  weekBlock: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caption: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },
  captionStrong: { fontWeight: '600', color: theme.colors.textPrimary },
  low: { color: theme.colors.danger },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

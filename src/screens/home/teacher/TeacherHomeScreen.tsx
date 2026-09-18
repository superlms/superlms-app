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
import { ClassAttendanceRows, attendanceToday } from '../dashTeacher';

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

  const { totals, profile, notices } = data;
  const classes = data.today_classes ?? [];
  const states = periodStates(classes);
  const doneCount = states.filter(st => st === 'done').length;
  const nowIndex = states.indexOf('now');
  const nextIndex = states.indexOf('next');
  const byClass = data.class_attendance?.by_class ?? [];
  const today = attendanceToday(data);
  const homework = data.homework?.recent ?? [];
  const week = data.class_attendance?.week ?? [];
  const performance = data.class_performance ?? [];
  const exams = data.exams?.upcoming ?? [];

  // "Friday, 18 September · EMP-012"
  const dateLine = [moment().format('dddd, D MMMM'), profile?.employee_id].filter(Boolean).join(' · ');

  // "Now: English, 10 A" · "Next at 11:30 AM" · "All done for today"
  const classesNote =
    classes.length === 0
      ? 'None today'
      : nowIndex >= 0
      ? `Now · ${classes[nowIndex].class || quietCaps(classes[nowIndex].subject)}`
      : nextIndex >= 0
      ? `Next at ${clock12(classes[nextIndex].time)}`
      : 'All done for today';

  return (
    <View style={s.root}>
      {topBar}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PageLine text={dateLine} />

        {/* The four numbers worth checking, each saying what it means */}
        <KpiGrid
          items={[
            {
              icon: 'time-outline',
              label: 'Classes today',
              value: classes.length > 0 ? `${doneCount}/${classes.length}` : '0',
              note: classesNote,
              onPress: () => navigation.navigate('Timetable'),
            },
            {
              icon: 'people-outline',
              label: 'Attendance',
              value: today.pct != null ? `${today.pct}%` : '—',
              note:
                today.pct != null
                  ? `${today.present} of ${today.marked} present`
                  : byClass.length > 0
                  ? 'Not marked yet'
                  : 'No classes assigned',
              low: today.pct != null && today.pct < LOW_ATTENDANCE,
              onPress: () => navigation.navigate('Analytics', { userRole: 'teacher' }),
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
              sub={`${classes.length} ${classes.length === 1 ? 'class' : 'classes'} · ${doneCount} done`}
              action="Timetable"
              onAction={() => navigation.navigate('Timetable')}
            />
            {classes.map((c, i) => (
              <PeriodRow
                key={`${c.time}-${i}`}
                start={c.time}
                end={c.end_time}
                title={quietCaps(c.subject)}
                meta={[c.class, c.room ? `Room ${c.room}` : null].filter(Boolean).join(' · ')}
                state={states[i]}
                isFirst={i === 0}
                isLast={i === classes.length - 1}
              />
            ))}
          </Card>
        )}

        {/* Who is in today, class by class */}
        {byClass.length > 0 && (
          <Card>
            <CardHead
              icon="people-outline"
              title="Attendance today"
              sub={
                today.pct != null
                  ? `${today.pct}% · ${today.present} of ${today.marked} present`
                  : `${today.roster} students · not marked yet`
              }
              action="Details"
              onAction={() => navigation.navigate('Analytics', { userRole: 'teacher' })}
            />
            <ClassAttendanceRows rows={byClass} />
            {week.length > 0 && (
              <>
                <Text style={s.caption}>Last 7 days, all classes</Text>
                <Columns
                  height={56}
                  data={week.map(d => ({
                    key: d.date,
                    label: moment(d.date, 'YYYY-MM-DD').format('ddd'),
                    sub: moment(d.date, 'YYYY-MM-DD').format('D'),
                    value: d.percentage,
                    low: d.percentage != null && d.percentage < LOW_ATTENDANCE,
                  }))}
                />
              </>
            )}
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
              onAction={() => navigation.navigate('Analytics', { userRole: 'teacher' })}
            />
            {performance.slice(0, 4).map((p, i, list) => (
              <PctRow
                key={`${p.class}-${p.subject}-${i}`}
                label={`${p.class} · ${quietCaps(p.subject)}`}
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
                  meta={[quietCaps(hw.subject_name), hw.class, hw.date].filter(Boolean).join(' · ')}
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
  caption: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted, marginTop: 10 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

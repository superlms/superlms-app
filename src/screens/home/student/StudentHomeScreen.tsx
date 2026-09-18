import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import moment from 'moment';
import TopBar from '../../../components/TopBar';
import VectorIcon from '../../../components/VectorIcon';
import AppRefreshControl from '../../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../../hooks/useRefresh';
import { theme, onThemeChange } from '../../../utils/theme';
import { quietCaps } from '../../../utils/quietCaps';
import {
  getStudentDashboard,
  dashboardErrorMessage,
  type StudentDashboard,
} from '../../../api/dashboardApi';
import {
  ABSENT,
  COMPARE,
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
  NEUTRAL,
  PASS_MARK,
  PRESENT,
  PageLine,
  PctRow,
  PeriodRow,
  SplitBar,
  WeekDays,
  bandFor,
  deltaOf,
  periodStates,
} from '../dashboardUi';
import { ExamRows, examSoon } from '../dashExams';
import { Legend, LineChart } from '../../analytics/charts';

const StudentHomeScreen = () => {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getStudentDashboard());
    } catch (e: any) {
      console.log('[getStudentDashboard] Error:', e?.response?.status, e?.message);
      setError(dashboardErrorMessage(e));
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  // Loads on arrival, and refreshes quietly on every return to the dashboard.
  useFocusLoad(load);

  const topBar = (
    <TopBar
      onAvatarPress={() => navigation.navigate('StudentProfile')}
      onBellPress={() => navigation.navigate('Notifications', { role: 'student' })}
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

  const { profile, attendance: att, performance: perf, homework, notices } = data;
  const exams = data.exams.upcoming;
  const periods = data.today_classes ?? [];
  const states = periodStates(periods);

  // Attendance this month, against last month when there is one to compare.
  const attPct = Math.round(att?.present_percentage ?? 0);
  const marked = (att?.working_days ?? 0) > 0;
  const lowAtt = marked && attPct < LOW_ATTENDANCE;
  const history = att?.history ?? [];
  const lastMonth = history.length >= 2 ? history[history.length - 2] : null;

  // Scores, and the latest exam against the one before.
  const hasScores = (perf?.total_max ?? 0) > 0 || (perf?.subject_wise?.length ?? 0) > 0;
  const overall = Math.round(perf?.overall_percentage ?? 0);
  const byExam = perf?.exams ?? [];
  const latest = byExam[byExam.length - 1];
  const before = byExam[byExam.length - 2];
  const subjects = (perf?.subject_wise ?? []).slice(0, 5);

  // Homework: what is still to do, when the server says what is done.
  const hasDone = typeof homework?.done === 'number';
  const pending = hasDone ? Math.max((homework.total ?? 0) - (homework.done as number), 0) : null;

  // "Friday, 18 September · 10th A · Roll 23"
  const today = [
    moment().format('dddd, D MMMM'),
    [profile?.standard, profile?.section].filter(Boolean).join(' '),
    profile?.roll_no != null && profile.roll_no !== '' ? `Roll ${profile.roll_no}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const monthName = moment(att?.month ?? undefined, 'YYYY-MM').format('MMMM');

  return (
    <View style={s.root}>
      {topBar}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PageLine text={today} />

        {/* The four numbers worth checking, each saying what it means */}
        <KpiGrid
          items={[
            {
              icon: 'calendar-outline',
              label: 'Attendance',
              value: marked ? `${attPct}%` : '—',
              note: marked ? `${att.present_days} of ${att.working_days} days` : 'Not marked yet',
              delta: marked ? deltaOf(attPct, lastMonth?.percentage, moment(lastMonth?.month, 'YYYY-MM').format('MMM')) : null,
              low: lowAtt,
              onPress: () => navigation.navigate('Attendance'),
            },
            {
              icon: 'stats-chart-outline',
              label: 'Avg score',
              value: hasScores ? `${overall}%` : '—',
              note: hasScores
                ? byExam.length > 0
                  ? `${bandFor(overall)} · ${byExam.length} ${byExam.length === 1 ? 'exam' : 'exams'}`
                  : bandFor(overall)
                : 'No marks yet',
              delta: latest && before ? deltaOf(latest.percentage, before.percentage, 'prev. exam') : null,
              low: hasScores && overall < PASS_MARK,
              onPress: () => navigation.navigate('Analytics', { userRole: 'student' }),
            },
            {
              icon: 'book-outline',
              label: 'Homework',
              value: String(pending ?? homework?.total ?? 0),
              note:
                pending == null
                  ? 'Assigned to your class'
                  : pending === 0
                  ? (homework?.total ?? 0) > 0
                    ? 'All done'
                    : 'Nothing assigned'
                  : `Pending · ${homework.done} of ${homework.total} done`,
              onPress: () => navigation.navigate('Homework'),
            },
            {
              icon: 'document-text-outline',
              label: 'Exams',
              value: String(exams.length),
              note: exams[0] ? examSoon(exams[0]) : 'None coming up',
              onPress: () => navigation.navigate('Exams'),
            },
          ]}
        />

        {/* Today's periods, against the clock */}
        {periods.length > 0 && (
          <Card>
            <CardHead
              icon="time-outline"
              title="Today's classes"
              sub={`${periods.length} ${periods.length === 1 ? 'period' : 'periods'} · ${
                states.filter(st => st === 'done').length
              } done`}
              action="Timetable"
              onAction={() => navigation.navigate('Timetable')}
            />
            {periods.map((p, i) => (
              <PeriodRow
                key={`${p.time}-${i}`}
                start={p.time}
                end={p.end_time}
                title={quietCaps(p.subject) || 'Period'}
                meta={p.teacher}
                state={states[i]}
                isFirst={i === 0}
                isLast={i === periods.length - 1}
              />
            ))}
          </Card>
        )}

        {/* This month in one bar, and the last seven days */}
        {!!att && (
          <Card>
            <CardHead
              icon="calendar-outline"
              title={`Attendance · ${monthName}`}
              sub={marked ? `${bandFor(attPct)} · ${att.working_days} working days so far` : 'Nothing marked this month yet'}
              action="Open"
              onAction={() => navigation.navigate('Attendance')}
            />
            {marked && (
              <>
                <View style={s.bigLine}>
                  <Text style={[s.big, lowAtt && s.bad]}>{attPct}%</Text>
                  <Text style={s.bigCaption}>present this month</Text>
                </View>
                <SplitBar
                  parts={[
                    { label: 'Present', value: att.present_days, color: PRESENT },
                    { label: 'Absent', value: att.absent_days, color: ABSENT },
                    ...(att.holiday_days != null ? [{ label: 'Holiday', value: att.holiday_days, color: NEUTRAL }] : []),
                  ]}
                />
              </>
            )}
            {att.week?.length > 0 && (
              <>
                <Text style={s.caption}>Last 7 days</Text>
                <WeekDays days={att.week} />
              </>
            )}
            {history.some(h => h.percentage != null) && (
              <>
                <Text style={s.caption}>Last 6 months</Text>
                <Columns
                  height={56}
                  data={history.map(h => ({
                    key: h.month,
                    label: moment(h.month, 'YYYY-MM').format('MMM'),
                    value: h.percentage,
                    low: h.percentage != null && h.percentage < LOW_ATTENDANCE,
                  }))}
                />
              </>
            )}
          </Card>
        )}

        {/* Scores: exam by exam, then subject by subject */}
        {hasScores && (
          <Card>
            <CardHead
              icon="trophy-outline"
              title="Performance"
              sub={[`${overall}% overall · ${bandFor(overall)}`, perf.class_average != null ? `class ${perf.class_average}%` : null]
                .filter(Boolean)
                .join(' · ')}
              action="Details"
              onAction={() => navigation.navigate('Analytics', { userRole: 'student' })}
            />
            {byExam.length >= 2 && (
              <>
                <Text style={s.caption}>Exam by exam</Text>
                <LineChart
                  height={80}
                  labels={byExam.map(e => e.exam_name || 'Exam')}
                  series={[
                    { key: 'you', label: 'You', points: byExam.map(e => e.percentage) },
                    { key: 'class', label: 'Class', points: byExam.map(e => e.class_average ?? null), compare: true },
                  ]}
                />
              </>
            )}
            <Text style={s.caption}>By subject</Text>
            {subjects.map((sp, i) => (
              <PctRow
                key={`${sp.subject_name}-${i}`}
                label={quietCaps(sp.subject_name) || 'Subject'}
                pct={Math.round(sp.percentage)}
                low={sp.percentage < PASS_MARK}
                mark={sp.class_average}
                meta={[
                  sp.max ? `${Math.round(sp.obtained ?? 0)} of ${Math.round(sp.max)} marks` : null,
                  sp.class_average != null ? `class ${sp.class_average}%` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                isLast={i === subjects.length - 1}
              />
            ))}
            {(subjects.some(sp => sp.class_average != null) || byExam.some(e => e.class_average != null)) && (
              <View style={s.legend}>
                <Legend
                  items={[
                    { label: 'You', color: theme.colors.primary, line: true },
                    { label: 'Class average', color: COMPARE, line: true },
                  ]}
                />
              </View>
            )}
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
            <ExamRows exams={exams} onPress={exam => navigation.navigate('ExamDetail', { examId: exam.id })} />
          </Card>
        )}

        {(homework?.recent?.length ?? 0) > 0 && (
          <Card>
            <CardHead
              icon="book-outline"
              title="Recent homework"
              sub={pending != null ? `${pending} pending of ${homework.total}` : `${homework.total} assigned`}
              action="See all"
              onAction={() => navigation.navigate('Homework')}
            />
            {homework.recent.map((hw, i) => (
              <LineRow
                key={hw.id}
                lead={<Initial text={quietCaps(hw.subject_name) || hw.title} />}
                title={quietCaps(hw.title) || 'Homework'}
                meta={[quietCaps(hw.subject_name), hw.date].filter(Boolean).join(' · ')}
                trailing={
                  hw.done === true ? (
                    <VectorIcon iconSet="Ionicons" iconName="checkmark-circle" size={20} color={theme.colors.success} />
                  ) : hw.done === false ? (
                    <VectorIcon iconSet="Ionicons" iconName="ellipse-outline" size={20} color={theme.colors.border} />
                  ) : null
                }
                onPress={() => navigation.navigate('Homework')}
                isLast={i === homework.recent.length - 1}
              />
            ))}
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
                onPress={() => navigation.navigate('Notifications', { role: 'student' })}
                isLast={i === notices.length - 1}
              />
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

export default StudentHomeScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 28 },
  bad: { color: theme.colors.danger },
  caption: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted, marginTop: 10 },
  bigLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  big: { fontSize: 28, fontWeight: '700', color: theme.colors.textPrimary },
  bigCaption: { fontSize: 13, color: theme.colors.textSecondary },
  legend: { paddingBottom: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

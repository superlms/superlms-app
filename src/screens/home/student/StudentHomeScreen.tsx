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
import { humanize } from '../../exam/examUi';
import {
  getStudentDashboard,
  dashboardErrorMessage,
  type StudentDashboard,
} from '../../../api/dashboardApi';
import {
  Chevron,
  DashError,
  DashSection,
  DashSkeleton,
  LOW_ATTENDANCE,
  LineRow,
  PASS_MARK,
  PctRow,
  StatStrip,
  Tag,
  WeekStrip,
} from '../dashboardUi';

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

  const attPct = Math.round(att?.present_percentage ?? 0);
  const lowAtt = attPct < LOW_ATTENDANCE;
  const hasScores = (perf?.total_max ?? 0) > 0 || (perf?.subject_wise?.length ?? 0) > 0;
  const overall = Math.round(perf?.overall_percentage ?? 0);
  const subjects = (perf?.subject_wise ?? []).slice(0, 5);

  // "Sunday, 13 September · 10th A · Roll 23"
  const today = [
    moment().format('dddd, D MMMM'),
    [profile?.standard, profile?.section].filter(Boolean).join(' '),
    profile?.roll_no != null && profile.roll_no !== '' ? `Roll ${profile.roll_no}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={s.root}>
      {topBar}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={s.today}>{today}</Text>

        {/* The four numbers worth checking, each opening its own screen */}
        <StatStrip
          stats={[
            {
              label: 'Attendance',
              value: `${attPct}%`,
              low: lowAtt,
              onPress: () => navigation.navigate('Attendance'),
            },
            {
              label: 'Avg score',
              value: hasScores ? `${overall}%` : '—',
              onPress: () => navigation.navigate('Analytics', { userRole: 'student' }),
            },
            {
              label: 'Homework',
              value: String(homework?.total ?? 0),
              onPress: () => navigation.navigate('Homework'),
            },
            {
              label: 'Exams',
              value: String(exams.length),
              onPress: () => navigation.navigate('Exams'),
            },
          ]}
        />

        {/* This month, and this week day by day */}
        {!!att && (
          <DashSection
            title={`Attendance · ${moment(att.month, 'YYYY-MM').format('MMMM')}`}
            action="Open"
            onAction={() => navigation.navigate('Attendance')}
          >
            <PctRow
              label="Present this month"
              pct={attPct}
              low={lowAtt}
              meta={`${att.present_days} present · ${att.absent_days} absent · ${att.working_days} working days`}
              isLast
            />
            {att.week?.length > 0 && (
              <>
                <Text style={s.caption}>This week</Text>
                <WeekStrip days={att.week} />
              </>
            )}
          </DashSection>
        )}

        {exams.length > 0 && (
          <DashSection title="Upcoming exams" action="See all" onAction={() => navigation.navigate('Exams')}>
            {exams.map((exam, i) => (
              <LineRow
                key={exam.id}
                title={exam.name}
                meta={[humanize(exam.type), exam.date_range].filter(Boolean).join(' · ')}
                trailing={<Tag text={exam.status} accent={exam.status === 'ongoing'} />}
                onPress={() => navigation.navigate('ExamDetail', { examId: exam.id })}
                isLast={i === exams.length - 1}
              />
            ))}
          </DashSection>
        )}

        {(homework?.recent?.length ?? 0) > 0 && (
          <DashSection title="Recent homework" action="See all" onAction={() => navigation.navigate('Homework')}>
            {homework.recent.map((hw, i) => (
              <LineRow
                key={hw.id}
                title={quietCaps(hw.title) || 'Homework'}
                meta={[quietCaps(hw.subject_name), hw.date].filter(Boolean).join(' · ')}
                onPress={() => navigation.navigate('Homework')}
                isLast={i === homework.recent.length - 1}
              />
            ))}
          </DashSection>
        )}

        {hasScores && (
          <DashSection
            title={`Scores · ${overall}% overall`}
            action="Details"
            onAction={() => navigation.navigate('Analytics', { userRole: 'student' })}
          >
            {subjects.map((sp, i) => (
              <PctRow
                key={`${sp.subject_name}-${i}`}
                label={quietCaps(sp.subject_name) || 'Subject'}
                pct={Math.round(sp.percentage)}
                low={sp.percentage < PASS_MARK}
                isLast={i === subjects.length - 1}
              />
            ))}
          </DashSection>
        )}

        {notices.length > 0 && (
          <DashSection title="Notices">
            {notices.map((n, i) => (
              <LineRow
                key={n.id}
                lead={
                  <VectorIcon iconSet="Ionicons" iconName="megaphone-outline" size={18} color={theme.colors.textSecondary} />
                }
                title={n.title || 'Notice'}
                meta={n.time}
                trailing={<Chevron />}
                onPress={() => navigation.navigate('Notifications', { role: 'student' })}
                isLast={i === notices.length - 1}
              />
            ))}
          </DashSection>
        )}
      </ScrollView>
    </View>
  );
};

export default StudentHomeScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 32 },
  today: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, paddingTop: 16 },
  caption: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6, marginBottom: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

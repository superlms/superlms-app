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
  getTeacherDashboard,
  dashboardErrorMessage,
  type TeacherDashboard,
} from '../../../api/dashboardApi';
import {
  Chevron,
  DashError,
  DashSection,
  DashSkeleton,
  LOW_ATTENDANCE,
  LineRow,
  PctRow,
  StatStrip,
  Tag,
} from '../dashboardUi';

// "14:05" — the timetable's own clock format, so times compare as strings.
const nowHHmm = () => moment().format('HH:mm');

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
  const byClass = data.class_attendance?.by_class ?? [];
  const overallAtt = Math.round(data.class_attendance?.overall_percentage ?? 0);
  const homework = data.homework?.recent ?? [];
  const exams = data.exams?.upcoming ?? [];

  // A class whose start time has passed is done; the first that has not is next.
  const cur = nowHHmm();
  const isDone = (t: string | null) => !!t && t < cur;
  const doneCount = classes.filter(c => isDone(c.time)).length;
  const nextIndex = classes.findIndex(c => !isDone(c.time));

  const present = byClass.reduce((sum, c) => sum + c.present, 0);
  const roster = byClass.reduce((sum, c) => sum + c.total, 0);

  // "Sunday, 13 September · EMP-012"
  const today = [moment().format('dddd, D MMMM'), profile?.employee_id].filter(Boolean).join(' · ');

  const clock = (t: string | null) => (t ? moment(t, 'HH:mm').format('h:mm A') : '—');

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
              label: 'Classes done',
              value: `${doneCount}/${classes.length}`,
              onPress: () => navigation.navigate('Timetable'),
            },
            {
              label: 'Students',
              value: String(totals?.total_students ?? 0),
              onPress: () => navigation.navigate('Analytics', { userRole: 'teacher' }),
            },
            {
              label: 'Homework',
              value: String(totals?.homework_count ?? 0),
              onPress: () => navigation.navigate('Homework'),
            },
            {
              label: 'Exams',
              value: String(totals?.upcoming_exams ?? 0),
              onPress: () => navigation.navigate('Exams'),
            },
          ]}
        />

        {/* Today's classes, against the clock */}
        {classes.length > 0 && (
          <DashSection title="Today's classes" action="Timetable" onAction={() => navigation.navigate('Timetable')}>
            {classes.map((c, i) => {
              const done = isDone(c.time);
              const next = i === nextIndex;
              return (
                <LineRow
                  key={`${c.time}-${i}`}
                  lead={<Text style={[s.time, done && s.timeDone, next && s.timeNext]}>{clock(c.time)}</Text>}
                  title={quietCaps(c.subject)}
                  meta={[c.class, c.room ? `Room ${c.room}` : null].filter(Boolean).join(' · ')}
                  muted={done}
                  trailing={next ? <Tag text="Next" accent /> : done ? <Tag text="Done" /> : null}
                  isLast={i === classes.length - 1}
                />
              );
            })}
          </DashSection>
        )}

        {/* Who is in today, class by class */}
        {byClass.length > 0 && (
          <DashSection
            title={`Attendance today · ${overallAtt}%`}
            action="Details"
            onAction={() => navigation.navigate('Analytics', { userRole: 'teacher' })}
          >
            <Text style={s.caption}>
              {present} of {roster} students present
            </Text>
            {byClass.map((c, i) => (
              <PctRow
                key={`${c.class}-${i}`}
                label={c.class}
                pct={Math.round(c.percentage)}
                low={c.percentage < LOW_ATTENDANCE}
                meta={`${c.present} of ${c.total} present`}
                isLast={i === byClass.length - 1}
              />
            ))}
          </DashSection>
        )}

        {homework.length > 0 && (
          <DashSection title="Assigned homework" action="See all" onAction={() => navigation.navigate('Homework')}>
            {homework.map((hw, i) => (
              <LineRow
                key={hw.id}
                title={quietCaps(hw.title) || 'Homework'}
                meta={[quietCaps(hw.subject_name), hw.class, hw.date].filter(Boolean).join(' · ')}
                onPress={() => navigation.navigate('Homework')}
                isLast={i === homework.length - 1}
              />
            ))}
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
                isLast={i === exams.length - 1}
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
                onPress={() => navigation.navigate('Notifications', { role: 'teacher' })}
                isLast={i === notices.length - 1}
              />
            ))}
          </DashSection>
        )}
      </ScrollView>
    </View>
  );
};

export default TeacherHomeScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 32 },
  today: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, paddingTop: 16 },
  caption: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 2 },

  // Class times, as their own column
  time: { width: 64, fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  timeDone: { color: theme.colors.textMuted },
  timeNext: { color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

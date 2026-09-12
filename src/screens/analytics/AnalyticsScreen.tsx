import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  getStudentDashboard,
  getTeacherDashboard,
  dashboardErrorMessage,
  type StudentDashboard,
  type TeacherDashboard,
} from '../../api/dashboardApi';
import { getMyAttendance, type MyAttendance } from '../../api/attendanceApi';
import {
  DashError,
  DashSection,
  InfoRows,
  LOW_ATTENDANCE,
  PASS_MARK,
  PctRow,
  bandFor,
} from '../home/dashboardUi';

const TITLE = 'Analytics';

/**
 * Analytics read as a document, the way attendance analytics already does: one
 * big figure and what it means, then the detail as plain rows with thin bars.
 * The only colour is a figure below the line — attendance under three quarters,
 * a score under the pass mark.
 */

const Loading = () => (
  <View style={s.loading}>
    <Skeleton width="30%" height={11} />
    <Skeleton width="35%" height={40} />
    <Skeleton width="60%" height={13} />
    <View style={s.loadingRows}>
      {[0, 1, 2, 3, 4].map(i => (
        <Skeleton key={i} width="100%" height={14} />
      ))}
    </View>
  </View>
);

// ── Student ──────────────────────────────────────────────────────────────────
const StudentAnalytics = () => {
  // The last three months, oldest first, opening on this one.
  const months = useMemo(
    () => [2, 1, 0].map(n => moment().subtract(n, 'months').format('YYYY-MM')),
    [],
  );
  const [month, setMonth] = useState(months[2]);
  const monthRef = useRef(month);

  const [dash, setDash] = useState<StudentDashboard | null>(null);
  const [att, setAtt] = useState<MyAttendance | null>(null);
  const [attLoading, setAttLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A response for a month that has since been left is dropped.
  const loadMonth = useCallback(async (key: string) => {
    setAttLoading(true);
    try {
      const a = await getMyAttendance(key);
      if (monthRef.current === key) setAtt(a);
    } catch (e: any) {
      console.log('[analytics myAttendance] Error:', e?.message);
      if (monthRef.current === key) setAtt(null);
    } finally {
      if (monthRef.current === key) setAttLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d] = await Promise.all([getStudentDashboard(), loadMonth(monthRef.current)]);
      setDash(d);
    } catch (e: any) {
      setError(dashboardErrorMessage(e));
    }
  }, [loadMonth]);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  const selectMonth = (key: string) => {
    if (key === monthRef.current) return;
    monthRef.current = key;
    setMonth(key);
    setAtt(null);
    loadMonth(key);
  };

  if (!dash) return error ? <DashError message={error} onRetry={load} /> : <Loading />;

  const perf = dash.performance;
  const subjects = perf?.subject_wise ?? [];
  const trend = perf?.trend ?? [];
  const hasScores = (perf?.total_max ?? 0) > 0 || subjects.length > 0;
  const overall = Math.round(perf?.overall_percentage ?? 0);

  const sum = att?.summary;
  const attPct = Math.round(sum?.present_percentage ?? 0);
  const holidays = sum?.holiday_days ?? Math.max((sum?.total_days ?? 0) - (sum?.working_days ?? 0), 0);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.scroll}
      refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Scores, in one number */}
      <View style={s.head}>
        <Text style={s.kicker}>YOUR SCORES</Text>
        {hasScores ? (
          <>
            <Text style={s.big}>{overall}%</Text>
            <Text style={s.band}>
              {bandFor(overall)}
              {perf.total_max > 0
                ? ` · ${Math.round(perf.total_obtained)} of ${Math.round(perf.total_max)} marks`
                : ''}
            </Text>
          </>
        ) : (
          <>
            <Text style={s.bigEmpty}>No marks yet</Text>
            <Text style={s.band}>Scores appear here once exam marks are published.</Text>
          </>
        )}
      </View>

      {subjects.length > 0 && (
        <DashSection title="By subject">
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

      {trend.length > 0 && (
        <DashSection title="Recent exams">
          {trend.map((t, i) => (
            <PctRow
              key={`${t.exam_name}-${i}`}
              label={t.exam_name || `Exam ${i + 1}`}
              pct={Math.round(t.percentage)}
              low={t.percentage < PASS_MARK}
              isLast={i === trend.length - 1}
            />
          ))}
        </DashSection>
      )}

      {/* Attendance, a month at a time */}
      <DashSection title="Attendance">
        <View style={s.tabs}>
          {months.map(key => {
            const active = key === month;
            return (
              <TouchableOpacity
                key={key}
                activeOpacity={0.6}
                onPress={() => selectMonth(key)}
                style={[s.tab, active && s.tabActive]}
              >
                <Text style={[s.tabText, active && s.tabTextActive]}>
                  {moment(key, 'YYYY-MM').format('MMMM')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {attLoading && !att ? (
          <View style={s.monthLoading}>
            <Skeleton width="100%" height={14} />
            <Skeleton width="70%" height={12} />
          </View>
        ) : !sum ? (
          <Text style={s.note}>Couldn’t load this month.</Text>
        ) : sum.working_days === 0 ? (
          <Text style={s.note}>Nothing has been marked for this month.</Text>
        ) : (
          <>
            <PctRow
              label={moment(month, 'YYYY-MM').format('MMMM YYYY')}
              pct={attPct}
              low={attPct < LOW_ATTENDANCE}
              meta={`${bandFor(attPct)} · ${sum.present_days} of ${sum.working_days} working days`}
            />
            <InfoRows
              rows={[
                ['Present', String(sum.present_days)],
                ['Absent', String(sum.absent_days)],
                ['Working days', String(sum.working_days)],
                ['Holidays', String(holidays)],
              ]}
            />
          </>
        )}
      </DashSection>
    </ScrollView>
  );
};

// ── Teacher ──────────────────────────────────────────────────────────────────
const TeacherAnalytics = () => {
  const [dash, setDash] = useState<TeacherDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDash(await getTeacherDashboard());
    } catch (e: any) {
      setError(dashboardErrorMessage(e));
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  if (!dash) return error ? <DashError message={error} onRetry={load} /> : <Loading />;

  const byClass = dash.class_attendance?.by_class ?? [];
  const overall = Math.round(dash.class_attendance?.overall_percentage ?? 0);
  const present = byClass.reduce((sum, c) => sum + c.present, 0);
  const roster = byClass.reduce((sum, c) => sum + c.total, 0);
  const totals = dash.totals;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[s.scroll, byClass.length === 0 && s.grow]}
      refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {byClass.length === 0 ? (
        <DocNoData
          icon="school-outline"
          title="No class data yet"
          subtitle="Class analytics appear once you’re assigned classes with students."
        />
      ) : (
        <>
          {/* Today, in one number */}
          <View style={s.head}>
            <Text style={s.kicker}>ATTENDANCE TODAY</Text>
            <Text style={[s.big, overall < LOW_ATTENDANCE && s.low]}>{overall}%</Text>
            <Text style={s.band}>
              {present} of {roster} students present across {byClass.length}{' '}
              {byClass.length === 1 ? 'class' : 'classes'}
            </Text>
          </View>

          <DashSection title="Summary">
            <InfoRows
              rows={[
                ['Students', String(totals?.total_students ?? 0)],
                ['Classes today', String(totals?.total_classes_today ?? 0)],
                ['Homework assigned', String(totals?.homework_count ?? 0)],
                ['Upcoming exams', String(totals?.upcoming_exams ?? 0)],
              ]}
            />
          </DashSection>

          <DashSection title="By class">
            {byClass.map((c, i) => (
              <PctRow
                key={`${c.class}-${i}`}
                label={c.class}
                pct={Math.round(c.percentage)}
                low={c.percentage < LOW_ATTENDANCE}
                meta={`${c.present} of ${c.total} present · ${Math.max(c.total - c.present, 0)} absent`}
                isLast={i === byClass.length - 1}
              />
            ))}
          </DashSection>
        </>
      )}
    </ScrollView>
  );
};

// ── Screen ───────────────────────────────────────────────────────────────────
const AnalyticsScreen = ({ navigation, route }: any) => {
  const role = route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      {role === 'teacher' ? <TeacherAnalytics /> : <StudentAnalytics />}
    </View>
  );
};

export default AnalyticsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },
  grow: { flexGrow: 1 },
  low: { color: theme.colors.danger },

  // Head
  head: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted },
  big: { fontSize: 40, fontWeight: '700', lineHeight: 48, color: theme.colors.textPrimary, marginTop: 4 },
  bigEmpty: { fontSize: 24, fontWeight: '700', lineHeight: 32, color: theme.colors.textPrimary, marginTop: 6 },
  band: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },

  // Month tabs
  tabs: { flexDirection: 'row', gap: 20, marginTop: 4, marginBottom: 2 },
  tab: { paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },
  monthLoading: { gap: 10, paddingVertical: 16 },
  note: { fontSize: 13, color: theme.colors.textMuted, paddingVertical: 14 },

  // Loading
  loading: { paddingHorizontal: 20, paddingTop: 24, gap: 10 },
  loadingRows: { marginTop: 26, gap: 16 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

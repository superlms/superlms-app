import React, { useCallback, useEffect, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { Chip } from '../../components/Charts';
import {
  getStudentDashboard,
  getTeacherDashboard,
  dashboardErrorMessage,
  subjectTheme,
  type StudentDashboard,
  type TeacherDashboard,
} from '../../api/dashboardApi';
import { getMyAttendance, type MyAttendance } from '../../api/attendanceApi';
import moment from 'moment';

const { width } = Dimensions.get('window');
type Role = 'student' | 'teacher';

// ─── Shared state views ────────────────────────────────────────────────────────
const Loading = () => (
  <View style={s.stateBox}>
    <ScreenSkeleton variant="dashboard" />
  </View>
);

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <View style={s.stateBox}>
    <View style={s.errorIconRing}>
      <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.danger} />
    </View>
    <Text style={s.errorTitle}>Couldn’t load analytics</Text>
    <Text style={s.errorSub}>{message}</Text>
    <TouchableOpacity style={s.retryBtn} onPress={onRetry} activeOpacity={0.85}>
      <VectorIcon iconSet="Ionicons" iconName="refresh" size={15} color={theme.colors.primary} />
      <Text style={s.retryText}>Retry</Text>
    </TouchableOpacity>
  </View>
);

// ─── Bar Chart ────────────────────────────────────────────────────────────────
const BarChart = ({ data, color, maxVal }: { data: { label: string; value: number }[]; color: string; maxVal: number }) => (
  <View style={bc.wrap}>
    {data.map((d, i) => {
      const pct = maxVal > 0 ? (d.value / maxVal) * 100 : 0;
      return (
        <View key={i} style={bc.col}>
          <Text style={bc.val}>{d.value}</Text>
          <View style={bc.barBg}>
            <View style={[bc.barFill, { height: `${pct}%` as any, backgroundColor: color }]} />
          </View>
          <Text style={bc.label}>{d.label}</Text>
        </View>
      );
    })}
  </View>
);
const __mk_bc = () => StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 130, paddingTop: 20 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  val: { fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary },
  barBg: { flex: 1, width: '65%', backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4 },
  label: { fontSize: 9, fontWeight: '600', color: theme.colors.textMuted, textAlign: 'center' },
});

// ─── Progress Ring (CSS-free approximation) ───────────────────────────────────
const Ring = ({ pct, color, size = 88 }: { pct: number; color: string; size?: number }) => {
  const stroke = 8;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: theme.colors.border }} />
      {pct > 0 && (
        <View style={{
          position: 'absolute', width: size, height: size, borderRadius: size / 2,
          borderWidth: stroke, borderColor: color,
          borderRightColor: pct < 25 ? 'transparent' : color,
          borderBottomColor: pct < 50 ? 'transparent' : color,
          borderLeftColor: pct < 75 ? 'transparent' : color,
          transform: [{ rotate: '-90deg' }],
        }} />
      )}
      <Text style={{ fontSize: size * 0.19, fontWeight: '900', color }}>{pct}%</Text>
      <Text style={{ fontSize: 9, color: theme.colors.textMuted, fontWeight: '600' }}>score</Text>
    </View>
  );
};

// ─── Stat Row ─────────────────────────────────────────────────────────────────
const StatRow = ({ icon, label, value, color, bg }: { icon: string; label: string; value: string; color: string; bg: string }) => (
  <View style={sr.row}>
    <View style={[sr.icon, { backgroundColor: bg }]}>
      <VectorIcon iconSet="Ionicons" iconName={icon} size={15} color={color} />
    </View>
    <Text style={sr.label}>{label}</Text>
    <Text style={[sr.value, { color }]}>{value}</Text>
  </View>
);
const __mk_sr = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  icon: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 12, color: theme.colors.textSecondary, fontWeight: '500' },
  value: { fontSize: 13, fontWeight: '800' },
});

// ─── Subject Progress Bar ─────────────────────────────────────────────────────
const SubjectBar = ({ name, pct, color }: { name: string; pct: number; color: string }) => (
  <View style={sb.row}>
    <View style={[sb.dot, { backgroundColor: color }]} />
    <Text style={sb.name}>{name}</Text>
    <View style={sb.barBg}>
      <View style={[sb.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
    <Text style={[sb.pct, { color }]}>{pct}%</Text>
  </View>
);
const __mk_sb = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, width: 76 },
  barBg: { flex: 1, height: 7, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  pct: { fontSize: 11, fontWeight: '800', width: 34, textAlign: 'right' },
});

// ─── Section Card ─────────────────────────────────────────────────────────────
const SectionCard = ({ icon, iconBg, iconColor, title, children }: any) => (
  <View style={s.card}>
    <View style={s.cardTitleRow}>
      <View style={[s.cardIcon, { backgroundColor: iconBg }]}>
        <VectorIcon iconSet="Ionicons" iconName={icon} size={15} color={iconColor} />
      </View>
      <Text style={s.cardTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

// ─── Student Analytics ────────────────────────────────────────────────────────
const MONTHS = [moment().subtract(2, 'months'), moment().subtract(1, 'months'), moment()];

const StudentAnalytics = () => {
  const [activeMonth, setActiveMonth] = useState(2);
  const [dash, setDash] = useState<StudentDashboard | null>(null);
  const [att, setAtt] = useState<MyAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMonth = useCallback(async (idx: number) => {
    try {
      const a = await getMyAttendance(MONTHS[idx].format('YYYY-MM'));
      setAtt(a);
    } catch (e: any) {
      console.log('[analytics myAttendance] Error:', e?.message);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d] = await Promise.all([getStudentDashboard(), loadMonth(2)]);
      setDash(d);
      setActiveMonth(2);
    } catch (e: any) {
      setError(dashboardErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [loadMonth]);

  useFocusLoad(load);

  const selectMonth = (i: number) => {
    setActiveMonth(i);
    loadMonth(i);
  };

  if (loading) return <Loading />;
  if (error || !dash) return <ErrorState message={error ?? 'No data.'} onRetry={load} />;

  const sum = att?.summary;
  const attPct = Math.round(sum?.present_percentage ?? 0);
  const attColor = attPct >= 75 ? '#16A34A' : '#DC2626';
  const perf = dash.performance;
  const overallPct = perf.overall_percentage;
  const subjects = perf.subject_wise.map(sp => ({
    subject: sp.subject_name ?? 'Subject',
    pct: sp.percentage,
    color: subjectTheme(sp.subject_name).color,
  }));
  const trend = perf.trend;
  const bestSubject = subjects.length
    ? subjects.reduce((b, x) => (x.pct > b.pct ? x : b)).subject
    : '—';

  return (
    <>
      {/* Overview */}
      <View style={s.row3}>
        {[
          { label: 'Attendance', value: `${attPct}%`,     icon: 'calendar',    color: attColor,  bg: attPct >= 75 ? '#DCFCE7' : '#FEE2E2' },
          { label: 'Avg Score',  value: `${overallPct}%`, icon: 'stats-chart', color: '#4F46E5', bg: '#E0E7FF' },
          { label: 'Homework',   value: String(dash.homework.total), icon: 'book', color: '#7C3AED', bg: '#EDE9FE' },
        ].map(c => (
          <View key={c.label} style={[s.overviewCard, { backgroundColor: c.bg }]}>
            <VectorIcon iconSet="Ionicons" iconName={c.icon} size={20} color={c.color} />
            <Text style={[s.overviewVal, { color: c.color }]}>{c.value}</Text>
            <Text style={s.overviewLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
        <Chip icon="stats-chart" label="Avg" value={`${overallPct}%`} color="#4F46E5" bg="#E0E7FF" />
        <Chip icon="ribbon" label="Best" value={bestSubject} color="#16A34A" bg="#DCFCE7" />
        <Chip icon="calendar" label="Attd" value={`${attPct}%`} color="#0EA5E9" bg="#E0F2FE" />
        <Chip icon="book" label="Homework" value={String(dash.homework.total)} color="#7C3AED" bg="#EDE9FE" />
      </ScrollView>

      {/* Recent exam scores */}
      {trend.length > 0 && (
        <SectionCard icon="pulse-outline" iconBg="#E0F2FE" iconColor="#0EA5E9" title="Recent Exam Scores">
          <BarChart
            data={trend.map((t, i) => ({ label: t.exam_name ? t.exam_name.slice(0, 6) : `E${i + 1}`, value: t.percentage }))}
            color="#0EA5E9" maxVal={100}
          />
        </SectionCard>
      )}

      {/* Attendance */}
      <SectionCard icon="calendar-outline" iconBg="#DCFCE7" iconColor="#16A34A" title="Attendance Overview">
        <View style={s.monthTabs}>
          {MONTHS.map((m, i) => (
            <TouchableOpacity key={i} style={[s.tab, activeMonth === i && s.tabActive]} onPress={() => selectMonth(i)}>
              <Text style={[s.tabText, activeMonth === i && s.tabTextActive]}>{m.format('MMM YY')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.ringRow}>
          <Ring pct={attPct} color={attColor} />
          <View style={{ flex: 1 }}>
            <StatRow icon="checkmark-circle" label="Present"      value={String(sum?.present_days ?? 0)} color="#16A34A" bg="#DCFCE7" />
            <StatRow icon="close-circle"     label="Absent"       value={String(sum?.absent_days ?? 0)}  color="#DC2626" bg="#FEE2E2" />
            <StatRow icon="calendar"         label="Working Days" value={String(sum?.working_days ?? 0)} color="#4F46E5" bg="#E0E7FF" />
            <StatRow icon="time"             label="Total Days"   value={String(sum?.total_days ?? 0)}   color="#D97706" bg="#FEF3C7" />
          </View>
        </View>
        <View style={s.divider} />
        <Text style={s.subTitle}>Monthly Breakdown</Text>
        <BarChart
          data={[
            { label: 'Present', value: sum?.present_days ?? 0 },
            { label: 'Absent',  value: sum?.absent_days ?? 0 },
            { label: 'Holiday', value: (sum?.total_days ?? 0) - (sum?.working_days ?? 0) },
          ]}
          color="#4F46E5" maxVal={sum?.total_days || 30}
        />
      </SectionCard>

      {/* Academic Performance */}
      {(subjects.length > 0 || overallPct > 0) && (
        <SectionCard icon="stats-chart-outline" iconBg="#E0E7FF" iconColor="#4F46E5" title="Academic Performance">
          <View style={s.ringRow}>
            <Ring pct={overallPct} color="#4F46E5" />
            <View style={{ flex: 1 }}>
              <StatRow icon="ribbon"       label="Obtained" value={`${Math.round(perf.total_obtained)}/${Math.round(perf.total_max)}`} color="#4F46E5" bg="#E0E7FF" />
              <StatRow icon="trending-up"  label="Overall"  value={`${overallPct}%`} color="#16A34A" bg="#DCFCE7" />
              <StatRow icon="library"      label="Subjects" value={String(subjects.length)} color="#D97706" bg="#FEF3C7" />
            </View>
          </View>
          {subjects.length > 0 && (
            <>
              <View style={s.divider} />
              <Text style={s.subTitle}>Subject-wise Performance</Text>
              <BarChart data={subjects.map(sp => ({ label: sp.subject.split(' ')[0].slice(0, 5), value: sp.pct }))} color="#4F46E5" maxVal={100} />
              <View style={s.divider} />
              <Text style={s.subTitle}>Subject Progress</Text>
              {subjects.map(sp => <SubjectBar key={sp.subject} name={sp.subject} pct={sp.pct} color={sp.color} />)}
            </>
          )}
        </SectionCard>
      )}
    </>
  );
};

// ─── Teacher Analytics ────────────────────────────────────────────────────────
const TeacherAnalytics = () => {
  const [activeClass, setActiveClass] = useState(0);
  const [dash, setDash] = useState<TeacherDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getTeacherDashboard();
      setDash(d);
      setActiveClass(0);
    } catch (e: any) {
      setError(dashboardErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusLoad(load);

  if (loading) return <Loading />;
  if (error || !dash) return <ErrorState message={error ?? 'No data.'} onRetry={load} />;

  const classData = dash.class_attendance.by_class;
  const totalStudents = dash.totals.total_students;
  const overallAtt = dash.class_attendance.overall_percentage;

  if (classData.length === 0) {
    return (
      <View style={s.stateBox}>
        <VectorIcon iconSet="Ionicons" iconName="school-outline" size={44} color={theme.colors.textMuted} />
        <Text style={s.errorTitle}>No class data yet</Text>
        <Text style={s.errorSub}>Class analytics will appear once you’re assigned classes with students.</Text>
      </View>
    );
  }

  const cls = classData[Math.min(activeClass, classData.length - 1)];
  const attPct = cls.percentage;
  const attColor = attPct >= 75 ? '#16A34A' : '#DC2626';

  return (
    <>
      {/* Overview */}
      <View style={s.row3}>
        {[
          { label: 'Total Students', value: String(totalStudents),      icon: 'people',   color: '#4F46E5', bg: '#E0E7FF' },
          { label: 'Avg Attendance', value: `${overallAtt}%`,           icon: 'calendar', color: '#16A34A', bg: '#DCFCE7' },
          { label: 'Classes',        value: String(classData.length),   icon: 'school',   color: '#D97706', bg: '#FEF3C7' },
        ].map(c => (
          <View key={c.label} style={[s.overviewCard, { backgroundColor: c.bg }]}>
            <VectorIcon iconSet="Ionicons" iconName={c.icon} size={20} color={c.color} />
            <Text style={[s.overviewVal, { color: c.color }]}>{c.value}</Text>
            <Text style={s.overviewLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
        <Chip icon="people" label="Students" value={String(totalStudents)} color="#0EA5E9" bg="#E0F2FE" />
        <Chip icon="calendar" label="Attd" value={`${overallAtt}%`} color="#16A34A" bg="#DCFCE7" />
        <Chip icon="school" label="Classes" value={String(classData.length)} color="#4F46E5" bg="#E0E7FF" />
        <Chip icon="document-text" label="Exams" value={String(dash.totals.upcoming_exams)} color="#D97706" bg="#FEF3C7" />
      </ScrollView>

      {/* Class-wise */}
      <SectionCard icon="school-outline" iconBg="#E0E7FF" iconColor="#4F46E5" title="Class-wise Analytics">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {classData.map((c, i) => (
            <TouchableOpacity key={i} style={[s.tab, activeClass === i && s.tabActive]} onPress={() => setActiveClass(i)}>
              <Text style={[s.tabText, activeClass === i && s.tabTextActive]}>{c.class}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={s.ringRow}>
          <Ring pct={attPct} color={attColor} />
          <View style={{ flex: 1 }}>
            <StatRow icon="people"           label="Total Students" value={String(cls.total)}                 color="#4F46E5" bg="#E0E7FF" />
            <StatRow icon="checkmark-circle" label="Present Today"  value={String(cls.present)}               color="#16A34A" bg="#DCFCE7" />
            <StatRow icon="close-circle"     label="Absent Today"   value={String(Math.max(cls.total - cls.present, 0))} color="#DC2626" bg="#FEE2E2" />
            <StatRow icon="stats-chart"      label="Attendance"     value={`${cls.percentage}%`}              color="#D97706" bg="#FEF3C7" />
          </View>
        </View>
      </SectionCard>

      {/* Attendance by class */}
      <SectionCard icon="calendar-outline" iconBg="#DCFCE7" iconColor="#16A34A" title="Attendance by Class">
        <BarChart data={classData.map(c => ({ label: c.class.replace('Class ', ''), value: c.percentage }))} color="#16A34A" maxVal={100} />
        <View style={s.divider} />
        {classData.map((c, i) => {
          const col = c.percentage >= 75 ? '#16A34A' : '#DC2626';
          return <SubjectBar key={i} name={c.class} pct={c.percentage} color={col} />;
        })}
      </SectionCard>

      {/* Homework + exams */}
      <SectionCard icon="book-outline" iconBg="#EDE9FE" iconColor="#7C3AED" title="Workload">
        <View style={s.row3}>
          {[
            { label: 'Homework', value: String(dash.totals.homework_count), color: '#7C3AED', bg: '#EDE9FE' },
            { label: 'Exams',    value: String(dash.totals.upcoming_exams), color: '#4F46E5', bg: '#E0E7FF' },
            { label: 'Classes',  value: String(dash.totals.total_classes_today), color: '#D97706', bg: '#FEF3C7' },
          ].map(c => (
            <View key={c.label} style={[s.miniCard, { backgroundColor: c.bg }]}>
              <Text style={[s.miniVal, { color: c.color }]}>{c.value}</Text>
              <Text style={s.miniLabel}>{c.label}</Text>
            </View>
          ))}
        </View>
      </SectionCard>
    </>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const AnalyticsScreen = () => {
  const route = useRoute<any>();
  const role: Role = route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  // The analytics data is fetched inside the child views, so pull-to-refresh
  // remounts them (via a changing key) to re-run their loaders.
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setReloadKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 900);
  }, []);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      <Header title="Analytics" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* Hero */}
        <View style={s.hero}>
          <View style={[s.heroIcon, { backgroundColor: role === 'teacher' ? '#1E293B' : theme.colors.primary }]}>
            <VectorIcon iconSet="Ionicons" iconName="bar-chart" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>{role === 'teacher' ? 'Teacher Analytics' : 'Student Analytics'}</Text>
            <Text style={s.heroSub}>{role === 'teacher' ? 'Class performance & attendance overview' : 'Your academic & attendance summary'}</Text>
          </View>
          <View style={[s.roleBadge, { backgroundColor: role === 'teacher' ? '#1E293B' : theme.colors.primaryLight }]}>
            <Text style={[s.roleBadgeText, { color: role === 'teacher' ? '#fff' : theme.colors.primary }]}>
              {role === 'teacher' ? '👨🏫 Teacher' : '🎓 Student'}
            </Text>
          </View>
        </View>

        {role === 'student' ? (
          <StudentAnalytics key={reloadKey} />
        ) : (
          <TeacherAnalytics key={reloadKey} />
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

export default AnalyticsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, gap: 14, paddingBottom: 30 },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border,
    padding: theme.spacing.md, elevation: 2,
  },
  heroIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  heroSub: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.full },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },

  chipsRow: { gap: 8, paddingVertical: 2 },
  row3: { flexDirection: 'row', gap: 8 },
  overviewCard: { flex: 1, borderRadius: theme.radius.md, padding: 12, alignItems: 'center', gap: 5, elevation: 1 },
  overviewVal: { fontSize: 20, fontWeight: '900' },
  overviewLabel: { fontSize: 9, fontWeight: '700', color: theme.colors.textSecondary, textAlign: 'center' },

  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border,
    padding: theme.spacing.md, gap: 10, elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  subTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  divider: { height: 1, backgroundColor: theme.colors.border },

  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },

  monthTabs: { flexDirection: 'row', gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
  tabTextActive: { color: '#fff' },

  miniCard: { flex: 1, borderRadius: theme.radius.sm, padding: 10, alignItems: 'center', gap: 3 },
  miniVal: { fontSize: 18, fontWeight: '900' },
  miniLabel: { fontSize: 9, fontWeight: '700', color: theme.colors.textSecondary, textAlign: 'center' },

  // States
  stateBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  errorIconRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  errorTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  errorSub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: theme.colors.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 18, paddingVertical: 9, marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let bc = __mk_bc();
onThemeChange(() => { bc = __mk_bc(); });
let sr = __mk_sr();
onThemeChange(() => { sr = __mk_sr(); });
let sb = __mk_sb();
onThemeChange(() => { sb = __mk_sb(); });
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

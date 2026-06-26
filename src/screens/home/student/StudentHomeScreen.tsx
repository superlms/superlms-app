import React, { useCallback, useEffect, useState } from 'react';
import ScreenSkeleton from '../../../components/Skeleton';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import TopBar from '../../../components/TopBar';
import VectorIcon from '../../../components/VectorIcon';
import AppRefreshControl from '../../../components/AppRefreshControl';
import { useRefresh } from '../../../hooks/useRefresh';
import { theme, onThemeChange } from '../../../utils/theme';
import { Chip, ChartCard, Donut, HBar, WeekDots } from '../../../components/Charts';
import {
  getStudentDashboard,
  dashboardErrorMessage,
  subjectTheme,
  type StudentDashboard,
} from '../../../api/dashboardApi';
import moment from 'moment';

const { width } = Dimensions.get('window');

const weekDotStyle = (status: string) => {
  if (status === 'present') return { color: '#16A34A', bg: '#DCFCE7' };
  if (status === 'absent') return { color: '#DC2626', bg: '#FEE2E2' };
  return { color: theme.colors.textMuted, bg: '#F1F5F9' };
};

const examColors = (status: string) =>
  status === 'ongoing' ? { color: '#16A34A', bg: '#DCFCE7' } : { color: '#D97706', bg: '#FEF3C7' };

const StudentHomeScreen = () => {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await getStudentDashboard();
      setData(d);
    } catch (e: any) {
      console.log('[getStudentDashboard] Error:', e?.response?.status, e?.message);
      setError(dashboardErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh silently when returning to the dashboard.
  useFocusEffect(
    useCallback(() => {
      if (data) load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  const att = data?.attendance;
  const perf = data?.performance;
  const attendancePct = att?.present_percentage ?? 0;
  const overallPct = perf?.overall_percentage ?? 0;
  const upcomingExams = data?.exams.upcoming ?? [];
  const recentHW = data?.homework.recent ?? [];
  const notices = data?.notices ?? [];
  const subjectPerf = (perf?.subject_wise ?? []).slice(0, 5).map(sp => ({
    subject: sp.subject_name ?? 'Subject',
    pct: sp.percentage,
    color: subjectTheme(sp.subject_name).color,
  }));
  const week = (att?.week ?? []).map(d => ({ label: d.label, ...weekDotStyle(d.status) }));
  const profileSubtitle = data
    ? data.profile.standard && data.profile.section
      ? `${data.profile.standard}${data.profile.section}`
      : data.profile.standard ?? ''
    : '';

  if (loading) {
    return (
      <View style={s.root}>
        <TopBar
          onAvatarPress={() => navigation.navigate('StudentProfile')}
          onBellPress={() => navigation.navigate('Notifications', { role: 'student' })}
        />
        <View style={s.stateBox}>
          <ScreenSkeleton variant="dashboard" />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={s.root}>
        <TopBar
          onAvatarPress={() => navigation.navigate('StudentProfile')}
          onBellPress={() => navigation.navigate('Notifications', { role: 'student' })}
        />
        <View style={s.stateBox}>
          <View style={s.errorIconRing}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.danger} />
          </View>
          <Text style={s.errorTitle}>Couldn’t load dashboard</Text>
          <Text style={s.errorSub}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); load(); }} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="refresh" size={15} color={theme.colors.primary} />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <TopBar
        subtitle={profileSubtitle}
        subtitleIcon="school"
        onAvatarPress={() => navigation.navigate('StudentProfile')}
        onBellPress={() => navigation.navigate('Notifications', { role: 'student' })}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

        {/* ── Quick chips ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
          <Chip icon="stats-chart" label="Avg" value={`${overallPct}%`} color="#4F46E5" bg="#E0E7FF" />
          <Chip icon="calendar" label="Attd" value={`${attendancePct}%`} color="#16A34A" bg="#DCFCE7" />
          <Chip icon="book" label="Homework" value={String(data.homework.total)} color="#7C3AED" bg="#EDE9FE" />
          <Chip icon="document-text" label="Exams" value={String(upcomingExams.length)} color="#0EA5E9" bg="#E0F2FE" />
        </ScrollView>

        {/* ── Stats Scroll ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statsScroll}>
          {[
            { label: 'Present',  value: att!.present_days, color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle', sub: `${attendancePct}%` },
            { label: 'Absent',   value: att!.absent_days,  color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle',     sub: 'days' },
            { label: 'Working',  value: att!.working_days, color: '#D97706', bg: '#FEF3C7', icon: 'time',             sub: 'days' },
            { label: 'Homework', value: data.homework.total, color: '#7C3AED', bg: '#EDE9FE', icon: 'book',           sub: 'tasks' },
            { label: 'Exams',    value: upcomingExams.length, color: '#4F46E5', bg: '#E0E7FF', icon: 'document-text', sub: 'upcoming' },
          ].map(st => (
            <TouchableOpacity key={st.label} style={[s.statCard, { backgroundColor: st.bg }]} activeOpacity={0.8}>
              <View style={[s.statIconWrap, { backgroundColor: st.color + '22' }]}>
                <VectorIcon iconSet="Ionicons" iconName={st.icon} size={20} color={st.color} />
              </View>
              <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
              <Text style={[s.statSub, { color: st.color + 'AA' }]}>{st.sub}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Attendance Progress ── */}
        <View style={s.attCard}>
          <View style={s.attTop}>
            <View>
              <Text style={s.attTitle}>Monthly Attendance</Text>
              <Text style={s.attSub}>{moment(att!.month, 'YYYY-MM').format('MMMM YYYY')}</Text>
            </View>
            <View style={[s.attPctBadge, { backgroundColor: attendancePct >= 75 ? '#DCFCE7' : '#FEE2E2' }]}>
              <Text style={[s.attPct, { color: attendancePct >= 75 ? '#16A34A' : '#DC2626' }]}>{attendancePct}%</Text>
            </View>
          </View>
          <View style={s.attBarBg}>
            <View style={[s.attBarFill, {
              width: `${Math.min(attendancePct, 100)}%` as any,
              backgroundColor: attendancePct >= 75 ? '#16A34A' : '#DC2626',
            }]} />
          </View>
          <View style={s.attLegend}>
            {[
              { label: 'Present', val: att!.present_days, color: '#16A34A' },
              { label: 'Absent',  val: att!.absent_days,  color: '#DC2626' },
              { label: 'Working', val: att!.working_days, color: '#D97706' },
            ].map(l => (
              <View key={l.label} style={s.attLegendItem}>
                <View style={[s.attDot, { backgroundColor: l.color }]} />
                <Text style={s.attLegendText}>{l.label}: <Text style={{ color: l.color, fontWeight: '700' }}>{l.val}</Text></Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Upcoming Exams ── */}
        {upcomingExams.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Upcoming Exams</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Exams')} activeOpacity={0.7}>
                <Text style={s.seeAll}>See All →</Text>
              </TouchableOpacity>
            </View>
            <View style={s.sectionCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {upcomingExams.map(exam => {
                  const sc = examColors(exam.status);
                  return (
                    <TouchableOpacity key={exam.id} style={s.examCard} onPress={() => navigation.navigate('ExamDetail', { examId: exam.id })} activeOpacity={0.85}>
                      <View style={[s.examTop, { backgroundColor: sc.bg }]}>
                        <VectorIcon iconSet="Ionicons" iconName="document-text-outline" size={22} color={sc.color} />
                        <View style={[s.examStatusDot, { backgroundColor: sc.color }]} />
                      </View>
                      <View style={s.examBody}>
                        <Text style={s.examName}>{exam.name}</Text>
                        <Text style={s.examType}>{exam.type}</Text>
                        <View style={s.examDateRow}>
                          <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={11} color={theme.colors.textMuted} />
                          <Text style={s.examDate}>{exam.date_range}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}

        {/* ── Recent Homework ── */}
        {recentHW.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Recent Homework</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Homework')} activeOpacity={0.7}>
                <Text style={s.seeAll}>See All →</Text>
              </TouchableOpacity>
            </View>
            <View style={s.sectionCard}>
              {recentHW.map((hw, i) => {
                const st = subjectTheme(hw.subject_name);
                return (
                  <View key={hw.id} style={[s.hwCard, i < recentHW.length - 1 && s.rowDivider]}>
                    <View style={[s.hwIconWrap, { backgroundColor: st.color + '18' }]}>
                      <Text style={s.hwEmoji}>{st.icon}</Text>
                    </View>
                    <View style={s.hwContent}>
                      <Text style={s.hwTitle} numberOfLines={1}>{hw.title}</Text>
                      <Text style={s.hwSubject} numberOfLines={1}>{hw.subject_name}</Text>
                    </View>
                    {!!hw.date && (
                      <View style={[s.hwDueBadge, { backgroundColor: st.color + '18' }]}>
                        <Text style={[s.hwDueText, { color: st.color }]}>{hw.date}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Performance & This Week ── */}
        {(subjectPerf.length > 0 || overallPct > 0) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Performance Snapshot</Text>
            <ChartCard
              icon="stats-chart-outline"
              iconBg="#E0E7FF"
              iconColor="#4F46E5"
              title="Subject Performance"
              right={
                <TouchableOpacity onPress={() => navigation.navigate('Analytics', { userRole: 'student' })} activeOpacity={0.7}>
                  <Text style={s.seeAll}>Details →</Text>
                </TouchableOpacity>
              }
            >
              <View style={s.perfRow}>
                <Donut size={104} stroke={12} pct={overallPct} color="#4F46E5" label={`${overallPct}%`} sub="overall" />
                <View style={{ flex: 1, gap: 2 }}>
                  {subjectPerf.map(sp => (
                    <HBar key={sp.subject} label={sp.subject} value={sp.pct} color={sp.color} />
                  ))}
                </View>
              </View>
              {week.length > 0 && (
                <>
                  <View style={s.cardDivider} />
                  <Text style={s.miniHead}>This Week's Attendance</Text>
                  <WeekDots days={week} />
                </>
              )}
            </ChartCard>
          </View>
        )}

        {/* ── Notice Board ── */}
        {notices.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Notice Board</Text>
            <View style={s.sectionCard}>
              {notices.map((n, i) => (
                <TouchableOpacity key={n.id} style={[s.noticeCard, i < notices.length - 1 && s.rowDivider]} activeOpacity={0.8} onPress={() => navigation.navigate('Notifications', { role: 'student' })}>
                  <View style={[s.noticeIconWrap, { backgroundColor: theme.colors.primaryLight }]}>
                    <VectorIcon iconSet="Ionicons" iconName="megaphone-outline" size={18} color={theme.colors.primary} />
                  </View>
                  <View style={s.noticeContent}>
                    <Text style={s.noticeTitle} numberOfLines={2}>{n.title}</Text>
                    <Text style={s.noticeTime}>{n.time}</Text>
                  </View>
                  <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

export default StudentHomeScreen;

const CARD_W = width * 0.38;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 20 },

  // States
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  errorIconRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  errorTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  errorSub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 16 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: theme.colors.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 18, paddingVertical: 9, marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  // Hero
  hero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg, padding: theme.spacing.lg,
    borderWidth: 1, borderColor: theme.colors.border,
    elevation: 2,
  },
  heroLeft: { flex: 1, gap: 4 },
  heroGreeting: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },
  heroName: { fontSize: 22, fontWeight: '800', color: theme.colors.textPrimary },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '600', color: theme.colors.primary },
  heroAvatar: { alignItems: 'center', justifyContent: 'center' },
  heroAvatarText: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: theme.colors.primary,
    textAlign: 'center', textAlignVertical: 'center',
    fontSize: 18, fontWeight: '800', color: '#fff',
    lineHeight: 54,
  },
  heroAvatarRing: {
    position: 'absolute', width: 62, height: 62, borderRadius: 31,
    borderWidth: 2, borderColor: theme.colors.primaryLight,
  },

  // Quick chips
  chipsRow: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, gap: 8 },

  // Performance snapshot
  perfRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardDivider: { height: 1, backgroundColor: theme.colors.border },
  miniHead: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },

  // Stats scroll
  statsScroll: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, gap: 10 },
  statCard: {
    width: 90, borderRadius: theme.radius.md,
    padding: 12, alignItems: 'center', gap: 4,
    elevation: 1,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary },
  statSub: { fontSize: 9, fontWeight: '600' },

  // Attendance card
  attCard: {
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg, padding: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.border,
    gap: 10, elevation: 1,
  },
  attTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  attTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  attSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  attPctBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  attPct: { fontSize: 14, fontWeight: '800' },
  attBarBg: { height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' },
  attBarFill: { height: '100%', borderRadius: 4 },
  attLegend: { flexDirection: 'row', gap: 14 },
  attLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  attDot: { width: 7, height: 7, borderRadius: 4 },
  attLegendText: { fontSize: 11, color: theme.colors.textSecondary },

  // Section
  section: { marginTop: theme.spacing.lg, paddingHorizontal: theme.spacing.lg },
  sectionCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 10 },
  seeAll: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },

  // Quick actions
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qaItem: { width: '22%', alignItems: 'center', gap: 6 },
  qaIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 1 },
  qaLabel: { fontSize: 10.5, fontWeight: '700', color: theme.colors.textSecondary, textAlign: 'center' },

  // Exam cards (horizontal)
  examCard: {
    width: CARD_W, backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  examTop: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  examStatusDot: { width: 8, height: 8, borderRadius: 4 },
  examBody: { padding: 12, paddingTop: 0, gap: 3 },
  examName: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  examType: { fontSize: 11, color: theme.colors.textSecondary },
  examDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  examDate: { fontSize: 11, color: theme.colors.textMuted },

  // HW rows
  hwCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
  },
  hwIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hwEmoji: { fontSize: 18 },
  hwContent: { flex: 1 },
  hwTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  hwSubject: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  hwDueBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.full },
  hwDueText: { fontSize: 10, fontWeight: '700' },

  // Notice
  noticeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
  },
  noticeIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  noticeContent: { flex: 1 },
  noticeTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  noticeTime: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

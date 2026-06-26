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
import { Chip, ChartCard, Donut, MiniBars, StackedBar } from '../../../components/Charts';
import {
  getTeacherDashboard,
  dashboardErrorMessage,
  subjectTheme,
  type TeacherDashboard,
} from '../../../api/dashboardApi';

const { width } = Dimensions.get('window');

const nowHHmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const examColors = (status: string) =>
  status === 'ongoing' ? { color: '#16A34A', bg: '#DCFCE7' } : { color: '#D97706', bg: '#FEF3C7' };

const TeacherHomeScreen = () => {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<TeacherDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await getTeacherDashboard();
      setData(d);
    } catch (e: any) {
      console.log('[getTeacherDashboard] Error:', e?.response?.status, e?.message);
      setError(dashboardErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (data) load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  if (loading) {
    return (
      <View style={s.root}>
        <TopBar onAvatarPress={() => navigation.navigate('TeacherProfile')} onBellPress={() => navigation.navigate('Notifications', { role: 'teacher' })} />
        <View style={s.stateBox}>
          <ScreenSkeleton variant="dashboard" />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={s.root}>
        <TopBar onAvatarPress={() => navigation.navigate('TeacherProfile')} onBellPress={() => navigation.navigate('Notifications', { role: 'teacher' })} />
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

  const totals = data.totals;
  const overallAtt = data.class_attendance.overall_percentage;
  const byClass = data.class_attendance.by_class;
  const todayClasses = data.today_classes;
  const pendingHW = data.homework.recent;
  const upcomingExams = data.exams.upcoming;
  const notices = data.notices;

  const cur = nowHHmm();
  const isDone = (t: string | null) => !!t && t < cur;
  const doneClasses = todayClasses.filter(c => isDone(c.time)).length;
  const totalPresent = byClass.reduce((sum, c) => sum + c.present, 0);
  const totalRoster = byClass.reduce((sum, c) => sum + c.total, 0);
  const profileSubtitle = [data.profile.name, data.profile.employee_id].filter(Boolean).join(' · ');

  return (
    <View style={s.root}>
      <TopBar
        subtitle={profileSubtitle}
        subtitleIcon="ribbon"
        onAvatarPress={() => navigation.navigate('TeacherProfile')}
        onBellPress={() => navigation.navigate('Notifications', { role: 'teacher' })}
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
          <Chip icon="people" label="Students" value={String(totals.total_students)} color="#0EA5E9" bg="#E0F2FE" />
          <Chip icon="calendar" label="Attd" value={`${overallAtt}%`} color="#16A34A" bg="#DCFCE7" />
          <Chip icon="school" label="Classes" value={`${doneClasses}/${todayClasses.length}`} color="#4F46E5" bg="#E0E7FF" />
          <Chip icon="book" label="Homework" value={String(totals.homework_count)} color="#7C3AED" bg="#EDE9FE" />
          <Chip icon="document-text" label="Exams" value={String(totals.upcoming_exams)} color="#D97706" bg="#FEF3C7" />
        </ScrollView>

        {/* ── Stats Scroll ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statsScroll}>
          {[
            { label: 'Classes',  value: todayClasses.length, color: '#4F46E5', bg: '#E0E7FF', icon: 'school',          sub: 'today' },
            { label: 'Done',     value: doneClasses,         color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle', sub: 'classes' },
            { label: 'Students', value: totals.total_students, color: '#0EA5E9', bg: '#E0F2FE', icon: 'people',         sub: 'total' },
            { label: 'Homework', value: totals.homework_count, color: '#7C3AED', bg: '#EDE9FE', icon: 'book',           sub: 'assigned' },
            { label: 'Exams',    value: totals.upcoming_exams, color: '#D97706', bg: '#FEF3C7', icon: 'document-text',  sub: 'upcoming' },
          ].map(st => (
            <View key={st.label} style={[s.statCard, { backgroundColor: st.bg }]}>
              <View style={[s.statIconWrap, { backgroundColor: st.color + '22' }]}>
                <VectorIcon iconSet="Ionicons" iconName={st.icon} size={20} color={st.color} />
              </View>
              <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
              <Text style={[s.statSub, { color: st.color + 'AA' }]}>{st.sub}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ── Today's Classes Timeline ── */}
        {todayClasses.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Today's Classes</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Timetable')} activeOpacity={0.7}>
                <Text style={s.seeAll}>See All →</Text>
              </TouchableOpacity>
            </View>
            <View style={[s.sectionCard, s.timeline]}>
              {todayClasses.map((cls, i) => {
                const done = isDone(cls.time);
                return (
                  <View key={i} style={s.timelineRow}>
                    <View style={s.timelineLeft}>
                      <Text style={[s.timelineTime, done && s.timelineDone]}>{cls.time ?? '--'}</Text>
                      {i < todayClasses.length - 1 && <View style={[s.timelineLine, done && s.timelineLineDone]} />}
                    </View>
                    <View style={[s.timelineDot, done ? s.timelineDotDone : s.timelineDotPending]}>
                      {done && <VectorIcon iconSet="Ionicons" iconName="checkmark" size={10} color="#fff" />}
                    </View>
                    <View style={[s.timelineCard, done && s.timelineCardDone]}>
                      <View style={s.timelineCardLeft}>
                        <Text style={[s.timelineSubject, done && { color: theme.colors.textMuted }]}>{cls.subject}</Text>
                        <Text style={s.timelineMeta}>{cls.class}{cls.room ? ` · Room ${cls.room}` : ''}</Text>
                      </View>
                      {!done && (
                        <View style={s.upcomingBadge}>
                          <Text style={s.upcomingBadgeText}>Upcoming</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Assigned Homework ── */}
        {pendingHW.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Assigned Homework</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Homework')} activeOpacity={0.7}>
                <Text style={s.seeAll}>See All →</Text>
              </TouchableOpacity>
            </View>
            <View style={s.sectionCard}>
              {pendingHW.map((hw, i) => {
                const st = subjectTheme(hw.subject_name);
                return (
                  <View key={hw.id} style={[s.hwCard, i < pendingHW.length - 1 && s.rowDivider]}>
                    <View style={[s.hwIconWrap, { backgroundColor: st.color + '18' }]}>
                      <Text style={s.hwEmoji}>{st.icon}</Text>
                    </View>
                    <View style={s.hwContent}>
                      <Text style={s.hwTitle} numberOfLines={1}>{hw.title}</Text>
                      <Text style={s.hwSubject}>{[hw.subject_name, hw.class].filter(Boolean).join(' · ')}</Text>
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
            {upcomingExams.map(exam => {
              const sc = examColors(exam.status);
              return (
                <View key={exam.id} style={s.examCard}>
                  <View style={[s.examAccent, { backgroundColor: sc.color }]} />
                  <View style={s.examBody}>
                    <View style={s.examRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.examName}>{exam.name}</Text>
                        <Text style={s.examType}>{[exam.type, exam.academic_year].filter(Boolean).join(' · ')}</Text>
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                        <View style={[s.statusDot, { backgroundColor: sc.color }]} />
                        <Text style={[s.statusText, { color: sc.color }]}>{exam.status}</Text>
                      </View>
                    </View>
                    <View style={s.examDateRow}>
                      <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={12} color={theme.colors.textMuted} />
                      <Text style={s.examDate}>{exam.date_range}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
            </View>
          </View>
        )}

        {/* ── Class Attendance ── */}
        {byClass.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Class Attendance</Text>
            <ChartCard
              icon="bar-chart-outline"
              iconBg="#DCFCE7"
              iconColor="#16A34A"
              title="Today's Overview"
              right={
                <TouchableOpacity onPress={() => navigation.navigate('Analytics', { userRole: 'teacher' })} activeOpacity={0.7}>
                  <Text style={s.seeAll}>Details →</Text>
                </TouchableOpacity>
              }
            >
              <View style={s.attRow}>
                <Donut size={104} stroke={12} pct={overallAtt} color="#16A34A" label={`${overallAtt}%`} sub="present" />
                <View style={{ flex: 1 }}>
                  <StackedBar
                    segments={[
                      { label: 'Present', value: totalPresent, color: '#16A34A' },
                      { label: 'Absent', value: Math.max(totalRoster - totalPresent, 0), color: '#DC2626' },
                    ]}
                  />
                </View>
              </View>
              <View style={s.cardDivider} />
              <Text style={s.miniHead}>Attendance % by Class</Text>
              <MiniBars
                data={byClass.map(c => ({ label: c.class, value: c.percentage }))}
                maxVal={100}
                color="#16A34A"
                height={110}
              />
            </ChartCard>
          </View>
        )}

        {/* ── Notice Board ── */}
        {notices.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Notice Board</Text>
            <View style={s.sectionCard}>
              {notices.map((n, i) => (
                <TouchableOpacity key={n.id} style={[s.noticeCard, i < notices.length - 1 && s.rowDivider]} activeOpacity={0.8} onPress={() => navigation.navigate('Notifications', { role: 'teacher' })}>
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

export default TeacherHomeScreen;

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
    backgroundColor: '#1E293B',
    borderRadius: theme.radius.lg, padding: theme.spacing.lg,
    elevation: 4,
  },
  heroLeft: { flex: 1, gap: 6 },
  heroGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  heroName: { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  heroRight: { alignItems: 'center', justifyContent: 'center' },
  heroAvatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  heroAvatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroAvatarRing: {
    position: 'absolute', width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },

  // Quick chips
  chipsRow: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, gap: 8 },

  // Class attendance card
  attRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardDivider: { height: 1, backgroundColor: theme.colors.border },
  miniHead: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },

  // Stats
  statsScroll: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, gap: 10 },
  statCard: { width: 90, borderRadius: theme.radius.md, padding: 12, alignItems: 'center', gap: 4, elevation: 1 },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary },
  statSub: { fontSize: 9, fontWeight: '600' },

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

  // Timeline
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  timelineLeft: { width: 44, alignItems: 'center', paddingTop: 12 },
  timelineTime: { fontSize: 11, fontWeight: '700', color: theme.colors.textPrimary },
  timelineDone: { color: theme.colors.textMuted },
  timelineLine: { width: 2, flex: 1, backgroundColor: theme.colors.primary, marginTop: 4, minHeight: 24, opacity: 0.3 },
  timelineLineDone: { backgroundColor: theme.colors.success, opacity: 0.4 },
  timelineDot: { width: 20, height: 20, borderRadius: 10, marginTop: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineDotDone: { backgroundColor: theme.colors.success },
  timelineDotPending: { backgroundColor: theme.colors.primary },
  timelineCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border,
    padding: 10, marginBottom: 8,
  },
  timelineCardDone: { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
  timelineCardLeft: { flex: 1 },
  timelineSubject: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  timelineMeta: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  upcomingBadge: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full,
  },
  upcomingBadgeText: { fontSize: 10, fontWeight: '700', color: theme.colors.primary },

  // Quick actions
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qaItem: { width: '22%', alignItems: 'center', gap: 6 },
  qaIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 1 },
  qaLabel: { fontSize: 10.5, fontWeight: '700', color: theme.colors.textSecondary, textAlign: 'center' },

  // HW
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

  // Exam
  examCard: {
    flexDirection: 'row', overflow: 'hidden',
    borderRadius: theme.radius.sm, marginBottom: 8,
    backgroundColor: theme.colors.background,
  },
  examAccent: { width: 4 },
  examBody: { flex: 1, padding: 12, gap: 6 },
  examRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  examName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  examType: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  examDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  examDate: { fontSize: 12, color: theme.colors.textSecondary },

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

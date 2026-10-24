import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VectorIcon from '../../components/VectorIcon';
import TopBar from '../../components/TopBar';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { dashboardErrorMessage } from '../../api/dashboardApi';
import { getPanelHome, type PanelHome } from '../../api/adminPanelApi';
import { getAssistantStatus } from '../../api/assistantApi';
import { Card, CardHead, Chevron, DashError, KpiGrid, LineRow, Note, PageLine, PctRow, SOFT } from '../home/dashboardUi';
import { C, BarChart, Key, LineChart, inrAxis, inrFull } from './panelCharts';
import { CenterFigures, FootButton, PanelHomeSkeleton, Progress, SectionHeading, ValueLines } from './panelUi';
import { useAdminLinks } from './adminDashUi';
import { useAdminProfile } from './useAdminProfile';

/**
 * Super Assist's button: the sparkles alone, twinkling — every couple of
 * seconds they swell and tilt while a soft ring spreads out behind the button.
 */
const AssistButton = ({ onPress }: { onPress: () => void }) => {
  const twinkle = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(twinkle, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.delay(1100),
        ]),
        Animated.sequence([
          Animated.timing(ring, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.delay(800),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [twinkle, ring]);

  const iconMotion = {
    transform: [
      { scale: twinkle.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [1, 1.25, 0.95, 1] }) },
      { rotate: twinkle.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: ['0deg', '-15deg', '10deg', '0deg'] }) },
    ],
  };
  const ringMotion = {
    opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
  };

  return (
    <View style={s.assist}>
      <Animated.View pointerEvents="none" style={[s.assistRing, ringMotion]} />
      <TouchableOpacity
        style={s.assistButton}
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Super Assist"
      >
        <Animated.View style={iconMotion}>
          <VectorIcon iconSet="Ionicons" iconName="sparkles" size={18} color={theme.colors.white} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const num = (n: number) => Number(n || 0).toLocaleString('en-IN');

// The upcoming events' dots, as the panel colours them by kind.
const EVENT_COLORS: Record<string, string> = {
  blue: '#3B82F6',
  green: '#22C55E',
  red: '#EF4444',
  purple: '#A855F7',
  orange: '#F97316',
  indigo: '#6366F1',
  gray: '#6B7280',
};

// ── Search features ──────────────────────────────────────────────────────────
// The panel's "Search features…" list, as far as the app has the screen: a
// module of the sidebar, a page under More, or the notifications.
type Feature = { label: string; module?: string; more?: string; route?: string };

const FEATURES: Feature[] = [
  { label: 'Dashboard', module: 'dashboard' },
  { label: 'Class Management', module: 'standard' },
  { label: 'Student Management', module: 'students' },
  { label: 'Teacher Management', module: 'teachers' },
  { label: 'Announcements', module: 'announcement' },
  { label: 'Class Timetable', module: 'timetable' },
  { label: 'Teacher Arrangements', module: 'arrangement' },
  { label: 'Fee Management', module: 'fees' },
  { label: 'Homework', module: 'homework' },
  { label: 'Attendance', module: 'attendance' },
  { label: 'Syllabus', module: 'syllabus' },
  { label: 'School Calendar', module: 'calender' },
  { label: 'School Rules', more: 'AdminRules' },
  { label: 'Learning Content', module: 'content' },
  { label: 'Performance Reports', module: 'performance' },
  { label: 'Analytics', module: 'analytics' },
  { label: 'Assignments', module: 'quiz' },
  { label: 'Library', module: 'book' },
  { label: 'ID Cards', module: 'id-card' },
  { label: 'Admit Cards', module: 'admit-card' },
  { label: 'Exam Seating Plan', module: 'seating-plan' },
  { label: 'Exam Papers', module: 'exam-copy' },
  { label: 'Report Cards', module: 'report-card' },
  { label: 'Contact Admin', more: 'AdminContactAdmin' },
  { label: 'Rate LMS', more: 'AdminRateLms' },
  { label: 'Enquiries', module: 'enquiries' },
  { label: 'Notifications', route: 'Notifications' },
];

const RECENT_KEY = 'admin_recent_searches';
type Recent = { term: string; time: string };

// The panel's Quick Access tiles and Quick Links.
const QUICK: { label: string; module: string; icon: string }[] = [
  { label: 'Attendance', module: 'attendance', icon: 'checkbox-outline' },
  { label: 'Announcement', module: 'announcement', icon: 'megaphone-outline' },
  { label: 'Arrangements', module: 'arrangement', icon: 'swap-horizontal-outline' },
  { label: 'Fee', module: 'fees', icon: 'cash-outline' },
  { label: 'Homework', module: 'homework', icon: 'book-outline' },
  { label: 'Analytics', module: 'analytics', icon: 'bar-chart-outline' },
];

const LINKS: { label: string; module: string }[] = [
  { label: 'View All Students', module: 'students' },
  { label: 'View All Teachers', module: 'teachers' },
  { label: 'Manage Classes', module: 'standard' },
  { label: 'View Analytics', module: 'analytics' },
];

/**
 * The admin home: the web panel's Dashboard, figure for figure and in its
 * order, drawn the app's way — Overview (the counts and today's rates), Quick
 * Access, the Attendance Trend of students and of teachers over 30 days, Fee
 * Collection, and This Week (attendance day by day, the exam trend, recent
 * searches, upcoming events, queries, quick links and the LMS rating).
 */
const AdminDashboardScreen = ({ navigation }: any) => {
  const [data, setData] = useState<PanelHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Super Assist's button shows only where the assistant is switched on.
  const [assistant, setAssistant] = useState(false);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<Recent[]>([]);
  const profile = useAdminProfile();
  const { can, open } = useAdminLinks(navigation);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getPanelHome());
    } catch (e: any) {
      console.log('[getPanelHome] Error:', e?.response?.status, e?.message);
      setError(dashboardErrorMessage(e));
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  // Loads on arrival, and refreshes quietly on every return to the dashboard.
  useFocusLoad(load);

  useEffect(() => {
    getAssistantStatus()
      .then(st => setAssistant(!!st?.enabled))
      .catch(() => setAssistant(false));
    AsyncStorage.getItem(RECENT_KEY)
      .then(raw => setRecent(raw ? JSON.parse(raw) : []))
      .catch(() => setRecent([]));
  }, []);

  // Where a feature opens, or nothing when this admin may not open it.
  const go = (f: Feature): (() => void) | undefined => {
    if (f.module) return open(f.module);
    if (f.more) return can('more') ? () => navigation.navigate('AdminMore', { screen: f.more, initial: false }) : undefined;
    if (f.route) return () => navigation.navigate(f.route as string);
    return undefined;
  };

  const results = query.trim()
    ? FEATURES.filter(f => f.label.toLowerCase().includes(query.trim().toLowerCase()) && !!go(f))
    : [];

  const pickFeature = (f: Feature) => {
    const next = [{ term: f.label, time: new Date().toISOString() }, ...recent.filter(r => r.term !== f.label)].slice(0, 10);
    setRecent(next);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
    setQuery('');
    go(f)?.();
  };

  const clearRecent = () => {
    setRecent([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  };

  const assist = assistant ? <AssistButton onPress={() => navigation.navigate('AdminAssistant')} /> : null;

  // The student and teacher top bar, with the school in place of the person:
  // account switch, notifications, messages
  const topBar = (
    <TopBar
      school={profile?.organization ?? null}
      onBellPress={() => navigation.navigate('Notifications')}
      onMessagePress={() => navigation.navigate('ChatsList', { userRole: 'admin' })}
    />
  );

  if (!data) {
    return (
      <View style={s.root}>
        {topBar}
        {error ? (
          <DashError message={error} onRetry={load} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={false}>
            <PanelHomeSkeleton />
          </ScrollView>
        )}
        {assist}
      </View>
    );
  }

  const { overview: o, today: t, attendance_trend: trend, fee, week, exam, events, queries, rating } = data;
  const pick = trend.pick;
  const labels = trend.days.map(d => d.label);
  const latest = exam.latest;
  const rateLms = can('more') ? () => navigation.navigate('AdminMore', { screen: 'AdminRateLms', initial: false }) : undefined;

  return (
    <View style={s.root}>
      {topBar}

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PageLine text={data.date} />

        {/* Search features */}
        <View style={s.searchWrap}>
          <View style={s.search}>
            <VectorIcon iconSet="Ionicons" iconName="search-outline" size={17} color={theme.colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search features…"
              placeholderTextColor={theme.colors.textMuted}
              style={s.searchInput}
              returnKeyType="search"
              autoCorrect={false}
            />
            {!!query && (
              <TouchableOpacity hitSlop={10} onPress={() => setQuery('')}>
                <VectorIcon iconSet="Ionicons" iconName="close-circle" size={17} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {!!query.trim() && (
            <View style={s.results}>
              {results.length === 0 ? (
                <Text style={s.noResults}>No results for "{query.trim()}"</Text>
              ) : (
                results.map((f, i) => (
                  <TouchableOpacity
                    key={f.label}
                    style={[s.result, i < results.length - 1 && s.resultLine]}
                    activeOpacity={0.6}
                    onPress={() => pickFeature(f)}
                  >
                    <Text style={s.resultText}>{f.label}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        {/* ══ OVERVIEW ══ */}
        <SectionHeading title="Overview" />
        <KpiGrid
          items={[
            { icon: 'people-outline', label: 'Students', value: num(o.students), note: `${o.active_students} active`, onPress: open('students') },
            { icon: 'school-outline', label: 'Teachers', value: num(o.teachers), note: `${o.active_teachers} active`, onPress: open('teachers') },
            { icon: 'albums-outline', label: 'Classes', value: num(o.classes), note: 'across the school', onPress: open('standard') },
            { icon: 'book-outline', label: 'Subjects', value: num(o.subjects), note: 'currently taught', onPress: open('standard') },
          ]}
        />
        <Card>
          <PctRow
            label="Student Attendance"
            pct={t.student_pct}
            value={`${t.student_pct}%`}
            meta={`${t.students_present} of ${o.students} present`}
          />
          <PctRow
            label="Teacher Attendance"
            pct={t.teacher_pct}
            value={`${t.teacher_pct}%`}
            meta={`${t.teachers_present} of ${o.teachers} present`}
          />
          <PctRow
            label="Fee Collected Today"
            pct={t.collection_pct}
            value={inrFull(Math.round(t.fee_today))}
            meta={`${t.collection_pct}% of ${inrFull(Math.round(t.total_fee))} overall fee collected`}
            isLast
          />
        </Card>

        {/* ══ QUICK ACCESS ══ */}
        <SectionHeading title="Quick Access" />
        <View style={s.quick}>
          {QUICK.map(q => {
            const onPress = open(q.module);
            return (
              <TouchableOpacity
                key={q.label}
                style={[s.quickTile, !onPress && s.quickOff]}
                activeOpacity={0.7}
                disabled={!onPress}
                onPress={onPress}
              >
                <View style={s.quickIcon}>
                  <VectorIcon iconSet="Ionicons" iconName={q.icon} size={20} color={theme.colors.textSecondary} />
                </View>
                <Text style={s.quickLabel} numberOfLines={1}>
                  {q.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ══ ATTENDANCE TREND ══ */}
        <SectionHeading title="Attendance Trend" sub="Last 30 days" />
        <Card>
          <CardHead icon="people-outline" title="Students" />
          <Key items={[{ label: 'Present', color: C.emerald }, { label: 'Absent', color: C.red400 }]} />
          <LineChart
            labels={labels}
            integer
            sets={[
              { label: 'Present', data: trend.days.map(d => d.student_present), color: C.emerald, fill: C.emeraldFill },
              { label: 'Absent', data: trend.days.map(d => d.student_absent), color: C.red400, fill: C.red400Fill },
            ]}
            tip={i => ({
              title: labels[i],
              lines: [
                { text: `Present: ${trend.days[i].student_present}`, color: C.emerald },
                { text: `Absent: ${trend.days[i].student_absent}`, color: C.red400 },
              ],
            })}
          />
          <Text style={s.pickDate}>{pick?.date_label ?? '—'}</Text>
          <CenterFigures
            top={false}
            items={[
              { value: String(pick?.student_present ?? 0), label: 'Present', color: C.emerald600 },
              { value: String(pick?.student_absent ?? 0), label: 'Absent', color: C.red500 },
              { value: String(pick?.student_half ?? 0), label: 'Half', color: C.amber500 },
              { value: `${pick?.student_pct ?? 0}%`, label: 'Rate' },
            ]}
          />
        </Card>
        <Card>
          <CardHead icon="school-outline" title="Teachers" />
          <Key items={[{ label: 'Present', color: C.blue }, { label: 'Absent', color: C.amber400 }]} />
          <LineChart
            labels={labels}
            integer
            sets={[
              { label: 'Present', data: trend.days.map(d => d.teacher_present), color: C.blue, fill: C.blueFill },
              { label: 'Absent', data: trend.days.map(d => d.teacher_absent), color: C.amber400, fill: C.amberFill },
            ]}
            tip={i => ({
              title: labels[i],
              lines: [
                { text: `Present: ${trend.days[i].teacher_present}`, color: C.blue },
                { text: `Absent: ${trend.days[i].teacher_absent}`, color: C.amber400 },
              ],
            })}
          />
          <Text style={s.pickDate}>{pick?.date_label ?? '—'}</Text>
          <CenterFigures
            top={false}
            items={[
              { value: String(pick?.teacher_present ?? 0), label: 'Present', color: C.blue600 },
              { value: String(pick?.teacher_absent ?? 0), label: 'Absent', color: C.red500 },
              { value: String(pick?.teacher_half ?? 0), label: 'Half', color: C.amber500 },
              { value: `${pick?.teacher_pct ?? 0}%`, label: 'Rate' },
            ]}
          />
        </Card>

        {/* ══ FEE COLLECTION ══ */}
        <SectionHeading title="Fee Collection" />
        <Card>
          <CardHead icon="wallet-outline" title={`Collected · ${fee.range_label}`} />
          <Text style={s.bigMoney}>{inrFull(Math.round(fee.range_total))}</Text>
          <BarChart
            labels={fee.labels}
            sets={[{ label: 'Collected', data: fee.data, color: C.indigoBar }]}
            maxBar={34}
            yFormat={inrAxis}
            tip={i => ({ title: fee.labels[i], lines: [{ text: inrFull(fee.data[i]), color: C.indigoBar }] })}
          />
        </Card>
        <Card>
          <CardHead icon="pie-chart-outline" title="Overall" action="Manage" onAction={open('fees')} />
          <ValueLines
            rows={[
              { label: 'Collected', value: inrFull(Math.round(fee.collected)) },
              { label: 'Pending', value: inrFull(Math.round(fee.pending)) },
              { label: 'Expected', value: inrFull(Math.round(fee.expected)), rule: true },
              { label: 'Collected today', value: inrFull(Math.round(fee.today)) },
            ]}
          />
          <Progress label="Progress" value={`${fee.progress}%`} pct={fee.progress} />
        </Card>

        {/* ══ THIS WEEK ══ */}
        <SectionHeading title="This Week" />
        <Card>
          <CardHead icon="calendar-outline" title="Attendance · Last 7 Days" action="Open" onAction={open('attendance')} />
          <View style={s.table}>
            <View style={s.tr}>
              <Text style={[s.th, s.tdDay]}>DAY</Text>
              <Text style={[s.th, s.tdPair]}>STUDENTS</Text>
              <Text style={[s.th, s.tdPair, s.tdRule]}>TEACHERS</Text>
            </View>
            <View style={[s.tr, s.trHead]}>
              <Text style={[s.thSub, s.tdDay]} />
              <Text style={[s.thSub, s.td]}>Present</Text>
              <Text style={[s.thSub, s.td]}>Absent</Text>
              <Text style={[s.thSub, s.td, s.tdRule]}>Present</Text>
              <Text style={[s.thSub, s.td]}>Absent</Text>
            </View>
            {week.map((d, i) => (
              <View key={d.date} style={[s.tr, i < week.length - 1 && s.trLine]}>
                <Text style={[s.tdText, s.tdDay, s.tdDayText]}>{d.day}</Text>
                <Text style={[s.tdText, s.td]}>{d.student_present}</Text>
                <Text style={[s.tdText, s.td]}>{d.student_absent}</Text>
                <Text style={[s.tdText, s.td, s.tdRule]}>{d.teacher_present}</Text>
                <Text style={[s.tdText, s.td]}>{d.teacher_absent}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Exam Performance Trend */}
        <Card>
          <CardHead
            icon="trending-up-outline"
            title="Exam Performance Trend"
            sub={`Students' overall average, exam by exam${exam.trend.length > 0 ? ` · last ${exam.trend.length} exam${exam.trend.length === 1 ? '' : 's'}` : ''}`}
            action="Open"
            onAction={open('performance')}
          />
          {exam.trend.length > 0 && latest ? (
            <>
              <Text style={s.kicker} numberOfLines={1}>
                LATEST · {latest.exam.toUpperCase()}
              </Text>
              <View style={s.latestLine}>
                <Text style={s.bigPct}>{latest.avg}%</Text>
                <Text
                  style={[
                    s.delta,
                    { color: exam.delta > 0 ? C.emerald600 : exam.delta < 0 ? C.red500 : theme.colors.textMuted },
                  ]}
                >
                  {exam.delta > 0
                    ? `▲ ${exam.delta} pts vs previous`
                    : exam.delta < 0
                    ? `▼ ${Math.abs(exam.delta)} pts vs previous`
                    : 'No change vs previous'}
                </Text>
              </View>
              <Key items={[{ label: 'Average %', color: C.violet }, { label: 'Pass %', color: C.emerald400 }]} />
              <LineChart
                labels={exam.trend.map(e => e.label)}
                max={100}
                step={20}
                yFormat={v => `${v}%`}
                sets={[
                  { label: 'Average %', data: exam.trend.map(e => e.avg), color: C.violet, fill: C.violetFill, point: 3 },
                  { label: 'Pass %', data: exam.trend.map(e => e.pass_pct), color: C.emerald400, dashed: true },
                ]}
                tip={i => {
                  const m = exam.trend[i];
                  return {
                    title: m.exam,
                    lines: [
                      { text: `Average %: ${m.avg}%`, color: C.violet },
                      { text: `Pass %: ${m.pass_pct}%`, color: C.emerald400 },
                    ],
                    footer: `${m.date} · ${m.passed} of ${m.students} students passed · ${m.papers} papers`,
                  };
                }}
              />
              <CenterFigures
                items={[
                  { value: `${exam.avg}%`, label: 'Overall avg' },
                  { value: `${latest.pass_pct}%`, label: 'Latest pass rate', color: C.emerald600 },
                  { value: String(latest.students), label: 'Students' },
                ]}
              />
            </>
          ) : (
            <View style={s.empty}>
              <Text style={s.emptyText}>No exam marks recorded yet.</Text>
              <Text style={s.emptySub}>The trend appears once marks are uploaded against an exam.</Text>
            </View>
          )}
        </Card>

        {/* Recent searches */}
        {recent.length > 0 && (
          <Card>
            <CardHead icon="time-outline" title="Recent Searches" action="Clear all" onAction={clearRecent} />
            {recent.map((r, i) => (
              <LineRow
                key={r.term}
                title={r.term}
                meta={moment(r.time).fromNow()}
                trailing={<Chevron />}
                onPress={() => setQuery(r.term)}
                isLast={i === recent.length - 1}
              />
            ))}
          </Card>
        )}

        {/* Upcoming events */}
        <Card>
          <CardHead icon="calendar-number-outline" title="Upcoming Events" action="Calendar" onAction={open('calender')} />
          {events.length > 0 ? (
            <View style={s.events}>
              <View style={s.eventsRail} />
              {events.map((e, i) => (
                <View key={`${e.title}-${i}`} style={[s.event, i === events.length - 1 && s.eventLast]}>
                  <View style={[s.eventDot, { backgroundColor: EVENT_COLORS[e.color] ?? EVENT_COLORS.gray }]} />
                  <View style={s.eventBody}>
                    <View style={s.eventHead}>
                      <Text style={s.eventTitle} numberOfLines={2}>
                        {e.title}
                      </Text>
                      <Text style={s.eventDate}>{e.formatted_date}</Text>
                    </View>
                    {!!e.description && (
                      <Text style={s.eventText} numberOfLines={1}>
                        {e.description}
                      </Text>
                    )}
                    <Text style={s.eventText} numberOfLines={1}>
                      {[
                        e.is_all_day ? 'All Day' : e.start_time ? `${e.start_time}${e.end_time ? ` – ${e.end_time}` : ''}` : null,
                        e.location,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Note>No upcoming events</Note>
          )}
        </Card>

        {/* Queries */}
        <Card>
          <CardHead icon="chatbubbles-outline" title="Queries" />
          <ValueLines
            rows={[
              { label: 'Students', value: String(queries.students) },
              { label: 'Teachers', value: String(queries.teachers) },
              { label: 'Website', value: String(queries.website) },
            ]}
          />
        </Card>

        {/* Quick links */}
        <Card>
          <CardHead icon="link-outline" title="Quick Links" />
          {LINKS.filter(l => !!open(l.module)).map((l, i, all) => (
            <LineRow key={l.label} title={l.label} trailing={<Chevron />} onPress={open(l.module)} isLast={i === all.length - 1} />
          ))}
        </Card>

        {/* LMS rating */}
        <Card>
          <CardHead icon="star-outline" title="LMS Rating" sub={`${rating.average.toFixed(1)} / 5`} />
          {rating.latest ? (
            <>
              <View style={s.ratingHead}>
                <View style={s.stars}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <VectorIcon
                      key={n}
                      iconSet="Ionicons"
                      iconName="star"
                      size={14}
                      color={n <= (rating.latest?.rating ?? 0) ? '#FACC15' : '#E5E7EB'}
                    />
                  ))}
                </View>
                <Text style={s.ratingDate}>{rating.latest.date}</Text>
              </View>
              {!!rating.latest.feedback && (
                <Text style={s.feedback} numberOfLines={2}>
                  {rating.latest.feedback}
                </Text>
              )}
              <FootButton label="View Ratings" onPress={rateLms} />
            </>
          ) : (
            <>
              <Note>No ratings yet</Note>
              <FootButton label="Rate LMS" onPress={rateLms} />
            </>
          )}
        </Card>
      </ScrollView>

      {assist}
    </View>
  );
};

export default AdminDashboardScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 96 },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },
  results: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  result: { paddingHorizontal: 14, paddingVertical: 12 },
  resultLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  resultText: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  noResults: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 14 },

  // Quick access
  quick: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  quickTile: {
    width: '31.4%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  quickOff: { opacity: 0.45 },
  quickIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: SOFT },
  quickLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },

  // Trend
  pickDate: { fontSize: 11, color: theme.colors.textMuted, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, marginTop: 4 },

  // Fee
  bigMoney: { fontSize: 24, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 2, marginBottom: 4 },

  // Week table
  table: { paddingTop: 4, paddingBottom: 4 },
  tr: { flexDirection: 'row', alignItems: 'center' },
  trHead: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  trLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  th: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, color: theme.colors.textMuted, textAlign: 'center', paddingTop: 6 },
  thSub: { fontSize: 10, color: theme.colors.textMuted, textAlign: 'center', paddingBottom: 6, paddingTop: 2 },
  tdDay: { width: 52, textAlign: 'left' },
  tdPair: { flex: 2 },
  td: { flex: 1 },
  tdRule: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.border },
  tdText: { fontSize: 14, color: theme.colors.textPrimary, textAlign: 'center', paddingVertical: 9 },
  tdDayText: { fontWeight: '500', textAlign: 'left' },

  // Exam trend
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: theme.colors.textMuted, marginTop: 4 },
  latestLine: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 2, marginBottom: 6, flexWrap: 'wrap' },
  bigPct: { fontSize: 24, fontWeight: '700', color: theme.colors.textPrimary },
  delta: { fontSize: 12, fontWeight: '600' },
  empty: { paddingVertical: 22, alignItems: 'center', gap: 4 },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary },
  emptySub: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },

  // Events
  events: { paddingTop: 6, paddingBottom: 8, paddingLeft: 4 },
  eventsRail: { position: 'absolute', left: 7, top: 12, bottom: 14, width: StyleSheet.hairlineWidth * 2, backgroundColor: theme.colors.border },
  event: { flexDirection: 'row', gap: 14, paddingBottom: 16 },
  eventLast: { paddingBottom: 4 },
  eventDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, marginLeft: -2, borderWidth: 2, borderColor: theme.colors.card },
  eventBody: { flex: 1, gap: 2 },
  eventHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  eventTitle: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  eventDate: { fontSize: 11, color: theme.colors.textMuted },
  eventText: { fontSize: 12, color: theme.colors.textMuted },

  // Rating
  ratingHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 },
  stars: { flexDirection: 'row', gap: 2 },
  ratingDate: { fontSize: 12, color: theme.colors.textMuted },
  feedback: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, marginTop: 8 },

  // Super Assist, at the bottom right: a round button with the sparkles alone
  assist: { position: 'absolute', right: 16, bottom: 16, width: 48, height: 48 },
  assistRing: { position: 'absolute', top: 0, left: 0, width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primary },
  assistButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

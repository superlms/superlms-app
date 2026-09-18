import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import TopBar from '../../components/TopBar';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { dashboardErrorMessage } from '../../api/dashboardApi';
import { getAdminHome, type AdminHome } from '../../api/adminDashboardApi';
import { getAssistantStatus } from '../../api/assistantApi';
import {
  ABSENT,
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
  MiniStats,
  NEUTRAL,
  Note,
  PRESENT,
  PageLine,
  PctRow,
  Pill,
  SplitBar,
  deltaOf,
} from '../home/dashboardUi';
import { ExamRows } from '../home/dashExams';
import { FigureRow } from '../analytics/charts';
import { inr, pctOrDash, plural } from '../analytics/analyticsUi';
import { AwayRows, Caption, DayColumns, inrShort, listNames, sessionLabel, useAdminLinks } from './adminDashUi';
import { useAdminProfile } from './useAdminProfile';

/**
 * The admin home, drawn as the student and teacher dashboards are: white cards
 * on the page's grey, four headline figures two by two, then today's
 * attendance (students and teachers), fees, the latest results, exams,
 * admissions, notices and what happened last. Every card opens its part of
 * Analytics, or the module itself.
 */
const AdminDashboardScreen = ({ navigation }: any) => {
  const [data, setData] = useState<AdminHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  // LMS Assist's button shows only where the assistant is switched on.
  const [assistant, setAssistant] = useState(false);
  const profile = useAdminProfile();
  const { open } = useAdminLinks(navigation);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getAdminHome());
    } catch (e: any) {
      console.log('[getAdminHome] Error:', e?.response?.status, e?.message);
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
  }, []);

  // A tab of Analytics; `at` opens it again when the same tab is asked for twice.
  const analytics = (tab: string) => () => navigation.navigate('AdminAnalytics', { tab, at: Date.now() });

  const assist = assistant ? (
    <TouchableOpacity style={s.assist} activeOpacity={0.85} onPress={() => navigation.navigate('AdminAssistant')}>
      <VectorIcon iconSet="Ionicons" iconName="sparkles" size={18} color={theme.colors.white} />
      <Text style={s.assistText}>LMS Assist</Text>
    </TouchableOpacity>
  ) : null;

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
        {error ? <DashError message={error} onRetry={load} /> : <DashSkeleton />}
        {assist}
      </View>
    );
  }

  const { school, attendance, staff, fees, results, exams, admissions, notices, activity } = data;
  const t = attendance.today;
  const prev = attendance.previous;
  const st = staff.today;
  const f = fees.summary;
  const unmarked = Math.max(t.students - t.marked, 0);
  const inToday = st.present + st.half_day;

  // "vs yesterday", "vs Thu"
  const prevLabel = prev
    ? moment(prev.date, 'YYYY-MM-DD').isSame(moment().subtract(1, 'day'), 'day')
      ? 'yesterday'
      : moment(prev.date, 'YYYY-MM-DD').format('ddd')
    : '';

  // The best and the weakest class in the latest exam.
  const ranked = results ? [...results.by_class].sort((a, b) => b.average - a.average) : [];
  const best = ranked[0];
  const weakest = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  const dayMost = Math.max(1, ...fees.days.map(d => d.amount));

  return (
    <View style={s.root}>
      {topBar}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PageLine text={[moment().format('dddd, D MMMM'), sessionLabel(school.session)].filter(Boolean).join(' · ')} />

        {/* The four numbers worth checking, each saying what it means */}
        <KpiGrid
          items={[
            {
              icon: 'people-outline',
              label: 'Students',
              value: String(school.students),
              note:
                admissions.this_month > 0
                  ? `${admissions.this_month} admitted this month`
                  : `${plural(school.classes, 'class', 'classes')} · ${plural(school.sections, 'section')}`,
              onPress: open('students'),
            },
            {
              icon: 'checkmark-done-outline',
              label: 'Attendance',
              value: t.holiday ? 'Holiday' : pctOrDash(t.percentage),
              note: t.holiday
                ? 'No school today'
                : t.percentage != null
                ? `${t.present} of ${t.marked} present`
                : 'Not marked yet',
              delta: t.holiday ? null : deltaOf(t.percentage, prev?.percentage, prevLabel),
              low: t.percentage != null && t.percentage < LOW_ATTENDANCE,
              onPress: analytics('attendance'),
            },
            {
              icon: 'school-outline',
              label: 'Teachers in',
              value: st.holiday ? 'Holiday' : st.marked > 0 ? `${inToday}/${school.teachers}` : '—',
              note: st.holiday
                ? 'No school today'
                : st.marked === 0
                ? 'Not marked yet'
                : st.absent + st.half_day > 0
                ? [st.absent > 0 ? `${st.absent} absent` : null, st.half_day > 0 ? `${st.half_day} half day` : null]
                    .filter(Boolean)
                    .join(' · ')
                : 'Everyone marked is in',
              low: st.percentage != null && st.percentage < LOW_ATTENDANCE,
              onPress: analytics('staff'),
            },
            {
              icon: 'wallet-outline',
              label: 'Fees collected',
              value: pctOrDash(f.rate),
              note: f.total_billable > 0 ? `${inrShort(f.total_collected)} of ${inrShort(f.total_billable)}` : 'No fees set yet',
              delta: fees.periods.today.amount > 0 ? { text: `+ ${inrShort(fees.periods.today.amount)} today`, good: true } : null,
              onPress: analytics('fees'),
            },
          ]}
        />

        {/* Students in today, and the classes still to mark */}
        <Card>
          <CardHead
            icon="people-outline"
            title="Attendance today"
            sub={
              t.holiday
                ? 'Holiday'
                : t.percentage != null
                ? `${t.percentage}% · ${t.present} of ${t.marked} present`
                : `${t.students} students · not marked yet`
            }
            action="Details"
            onAction={analytics('attendance')}
          />
          {t.holiday ? (
            <Note>Today is a holiday.</Note>
          ) : (
            <SplitBar
              parts={[
                { label: 'Present', value: t.present, color: PRESENT },
                { label: 'Absent', value: t.absent, color: ABSENT },
                { label: 'Not marked', value: unmarked, color: NEUTRAL },
              ]}
            />
          )}
          {!t.holiday && t.not_marked.length > 0 && (
            <Text style={s.alert}>
              <Text style={s.alertStrong}>
                {plural(t.not_marked.length, 'class', 'classes')} not marked:{' '}
              </Text>
              {listNames(t.not_marked)}
            </Text>
          )}
          {attendance.week.length > 0 && (
            <>
              <Caption>Last 7 days, whole school</Caption>
              <DayColumns days={attendance.week} height={56} />
            </>
          )}
        </Card>

        {/* Teachers in today, who is away, and the periods to cover */}
        <Card>
          <CardHead
            icon="school-outline"
            title="Teachers today"
            sub={
              st.holiday
                ? 'Holiday'
                : st.marked > 0
                ? [`${inToday} of ${school.teachers} in`, st.not_marked > 0 ? `${st.not_marked} not marked` : null]
                    .filter(Boolean)
                    .join(' · ')
                : `${plural(school.teachers, 'teacher')} · not marked yet`
            }
            action="Details"
            onAction={analytics('staff')}
          />
          {st.holiday ? (
            <Note>Today is a holiday.</Note>
          ) : st.marked === 0 ? (
            <Note>Teachers’ attendance hasn’t been marked today.</Note>
          ) : staff.absent.length === 0 ? (
            <Note>Every teacher marked today is in.</Note>
          ) : (
            <AwayRows rows={staff.absent} limit={5} isLast={staff.arrangements.total === 0} />
          )}
          {staff.arrangements.total > 0 && (
            <LineRow
              title="Arrangements"
              meta={`${staff.arrangements.covered} of ${plural(staff.arrangements.total, 'period')} covered today`}
              trailing={
                staff.arrangements.covered < staff.arrangements.total ? (
                  <Pill text={`${staff.arrangements.total - staff.arrangements.covered} open`} tone="bad" />
                ) : (
                  <Pill text="All covered" tone="good" />
                )
              }
              onPress={open('arrangement')}
              isLast
            />
          )}
        </Card>

        {/* What has come in, against what is billed */}
        <Card>
          <CardHead
            icon="wallet-outline"
            title="Fee collection"
            sub={f.total_billable > 0 ? `${pctOrDash(f.rate)} of ${inr(f.total_billable)} billed` : 'This session'}
            action="Details"
            onAction={analytics('fees')}
          />
          <PctRow
            label="Collected"
            pct={f.rate ?? 0}
            empty={f.rate == null}
            value={inr(f.total_collected)}
            meta={
              f.total_due > 0
                ? `${inr(f.total_due)} still due · ${plural(f.with_dues, 'student')} with dues`
                : f.total_billable > 0
                ? 'Nothing left to collect'
                : null
            }
            isLast
          />
          <MiniStats
            items={[
              { label: 'Today', value: inrShort(fees.periods.today.amount) },
              { label: 'This week', value: inrShort(fees.periods.this_week.amount) },
              { label: 'This month', value: inrShort(fees.periods.this_month.amount) },
            ]}
          />
          {fees.days.length > 0 && (
            <>
              <Caption>Last 7 days</Caption>
              <Columns
                height={56}
                max={dayMost}
                format={inrShort}
                data={fees.days.map(d => ({
                  key: d.date,
                  label: moment(d.date, 'YYYY-MM-DD').format('ddd'),
                  sub: moment(d.date, 'YYYY-MM-DD').format('D'),
                  value: d.amount,
                }))}
              />
            </>
          )}
          {fees.qr_pending > 0 && (
            <Text style={s.alert}>
              <Text style={s.alertStrong}>{plural(fees.qr_pending, 'QR payment')}</Text> waiting to be checked
            </Text>
          )}
        </Card>

        {/* The latest exam, against the one before */}
        {!!results && (
          <Card>
            <CardHead
              icon="trophy-outline"
              title="Latest results"
              sub={[results.exam_name, results.previous_exam ? `the tick is ${results.previous_exam}` : null].filter(Boolean).join(' · ')}
              action="Details"
              onAction={analytics('results')}
            />
            <PctRow
              label="School average"
              pct={results.average}
              low={results.average < results.pass_percentage}
              mark={results.previous_average}
              tag={
                results.previous_average != null ? (
                  <Pill
                    text={`${results.average >= results.previous_average ? '▲' : '▼'} ${Math.abs(results.average - results.previous_average)}%`}
                    tone={results.average >= results.previous_average ? 'good' : 'bad'}
                  />
                ) : null
              }
              meta={`${results.passed} of ${plural(results.students, 'student')} passed`}
              isLast={!best}
            />
            {!!best && (
              <PctRow
                label={`Best · ${best.class}`}
                pct={best.average}
                mark={best.previous_average}
                meta={`${best.passed}/${best.students} passed · high ${best.highest}%`}
                isLast={!weakest}
              />
            )}
            {!!weakest && (
              <PctRow
                label={`Lowest · ${weakest.class}`}
                pct={weakest.average}
                low={weakest.average < results.pass_percentage}
                mark={weakest.previous_average}
                meta={`${weakest.passed}/${weakest.students} passed · low ${weakest.lowest}%`}
                isLast
              />
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
              onAction={open('exam')}
            />
            <ExamRows exams={exams} />
          </Card>
        )}

        {/* Who joined, and who is asking to */}
        <Card>
          <CardHead
            icon="person-add-outline"
            title="Admissions"
            sub={sessionLabel(school.session)}
            action="Details"
            onAction={analytics('admissions')}
          />
          <FigureRow
            items={[
              { label: 'This month', value: String(admissions.this_month) },
              { label: 'Last month', value: String(admissions.last_month) },
              { label: 'This session', value: String(admissions.session_total) },
            ]}
          />
          {admissions.enquiries_pending > 0 && (
            <LineRow
              title="Enquiries waiting"
              meta="Admission enquiries still to be answered"
              trailing={<Pill text={String(admissions.enquiries_pending)} tone="accent" />}
              onPress={
                open('more') ? () => navigation.navigate('AdminMore', { screen: 'AdminAdmissions', initial: false }) : undefined
              }
              isLast
            />
          )}
        </Card>

        {notices.length > 0 && (
          <Card>
            <CardHead icon="megaphone-outline" title="Notices" action="See all" onAction={open('announcement')} />
            {notices.map((n, i) => (
              <LineRow
                key={n.id}
                title={n.title || 'Notice'}
                meta={[n.type === 'user' ? 'Students' : n.type === 'teacher' ? 'Teachers' : n.type === 'all' ? 'Everyone' : null, n.time]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={open('announcement') ? <Chevron /> : null}
                onPress={open('announcement')}
                isLast={i === notices.length - 1}
              />
            ))}
          </Card>
        )}

        {activity.length > 0 && (
          <Card>
            <CardHead icon="time-outline" title="Recent activity" sub="Admissions and fees, latest first" />
            {activity.map((a, i) => (
              <LineRow
                key={`${a.kind}-${i}`}
                lead={<Initial text={a.title} />}
                title={a.title || '—'}
                meta={[a.text, a.time].filter(Boolean).join(' · ')}
                trailing={a.amount != null ? <Text style={s.amount}>{inr(a.amount)}</Text> : null}
                isLast={i === activity.length - 1}
              />
            ))}
          </Card>
        )}
      </ScrollView>

      {assist}
    </View>
  );
};

export default AdminDashboardScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 96 },
  alert: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, paddingTop: 2, paddingBottom: 10 },
  alertStrong: { fontWeight: '600', color: theme.colors.danger },
  amount: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },

  // LMS Assist, at the bottom right
  assist: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  assistText: { color: theme.colors.white, fontSize: 14, fontWeight: '600' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

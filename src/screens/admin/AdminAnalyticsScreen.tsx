import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { dashboardErrorMessage } from '../../api/dashboardApi';
import {
  assignPanelArrangement,
  getPanelAnalytics,
  type PanelAnalytics as Data,
  type PanelAnalyticsFilters as Filters,
  type PanelBars,
  type PanelRanker,
} from '../../api/adminPanelApi';
import { Card, CardHead, DashError, KpiGrid, LineRow, Note, PageLine } from '../home/dashboardUi';
import { C, BarChart, Doughnut, HBarChart, Key, LineChart, inrAxis, inrFull } from './panelCharts';
import {
  Avatar,
  CenterFigures,
  Filter,
  PanelAnalyticsSkeleton,
  Progress,
  RankBar,
  SectionHeading,
  StatCells,
  Tag,
  ValueLines,
  bandColor,
} from './panelUi';
import { useAdminLinks } from './adminDashUi';

const num = (n: number) => Number(n || 0).toLocaleString('en-IN');
const money = (n: number) => inrFull(Math.round(Number(n) || 0));

// The WhatsApp kinds' colours, and how far a message got, as the panel draws them.
const WA_COLORS: Record<string, string> = {
  absent_alert: C.rose,
  fee_received: 'rgba(16,185,129,0.75)',
  credentials: 'rgba(99,102,241,0.75)',
  welcome: C.slate,
};
const WA_BAR: Record<string, string> = { read: '#10B981', delivered: '#3B82F6', sent: '#9CA3AF', failed: '#EF4444' };
const WA_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  read: { label: 'Read', color: '#047857', bg: '#ECFDF5' },
  delivered: { label: 'Delivered', color: '#1D4ED8', bg: '#EFF6FF' },
  sent: { label: 'Sent', color: '#4B5563', bg: '#F3F4F6' },
  failed: { label: 'Not delivered', color: '#B91C1C', bg: '#FEF2F2' },
};
const ENQUIRY_TAG: Record<string, { color: string; bg: string }> = {
  Responded: { color: '#047857', bg: '#ECFDF5' },
  Pending: { color: '#B45309', bg: '#FFFBEB' },
  New: { color: '#0369A1', bg: '#F0F9FF' },
};

/**
 * The school's Analytics: the web panel's page, figure for figure and in its
 * order, drawn the app's way — Key Metrics; Attendance (the 30-day rate trend,
 * today's student split, each month's volume and the class ranking); Student
 * Performance (the top and bottom ten by exam marks, by class and section);
 * Admissions & Enquiries; Fee (by class, recovery, and transport by class and
 * route); WhatsApp; and Operations (today's absent teachers' periods, to cover).
 */
const AdminAnalyticsScreen = ({ navigation }: any) => {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const filters = useRef<Filters>({});
  const links = useAdminLinks(navigation);

  // Operations: the teacher picked for each period, and the one just saved.
  const [chosen, setChosen] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getPanelAnalytics(filters.current));
    } catch (e: any) {
      console.log('[getPanelAnalytics] Error:', e?.response?.status, e?.message);
      setError(dashboardErrorMessage(e));
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);
  useFocusLoad(load);

  // A filter changed: read the page again with it.
  const refilter = async (next: Filters) => {
    filters.current = { ...filters.current, ...next };
    setBusy(true);
    try {
      await load();
    } finally {
      setBusy(false);
    }
  };

  const assign = async (id: number) => {
    const teacher = chosen[id];
    if (!teacher) return;
    setSaving(id);
    try {
      await assignPanelArrangement(id, teacher);
      setSaved(true);
      await load();
    } catch (e: any) {
      AppAlert.alert('Arrangement', e?.response?.data?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Analytics"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={busy ? <ActivityIndicator size="small" color={theme.colors.primary} /> : undefined}
      />
      {!data ? (
        error ? (
          <DashError message={error} onRetry={load} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={false}>
            <PanelAnalyticsSkeleton />
          </ScrollView>
        )
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <PageLine text={data.date} />
          <Card>
            <CenterFigures
              top={false}
              items={[
                { value: num(data.stats.totalStudents), label: 'Students' },
                { value: `${data.kpis.student_rate}%`, label: 'Attendance' },
                { value: `${data.kpis.collect_rate}%`, label: 'Collected' },
              ]}
            />
          </Card>

          <KeyMetrics data={data} />
          <Attendance data={data} />
          <Performance data={data} onFilter={refilter} />
          <Admissions data={data} onFilter={refilter} navigation={navigation} canEnquiries={links.can('enquiries')} />
          <Fee data={data} />
          <WhatsApp data={data} onFilter={refilter} />
          <Operations
            data={data}
            chosen={chosen}
            onChoose={(id, t) => setChosen(c => ({ ...c, [id]: t }))}
            saving={saving}
            saved={saved}
            onAssign={assign}
          />
        </ScrollView>
      )}
    </View>
  );
};

export default AdminAnalyticsScreen;

// ── Key Metrics ──────────────────────────────────────────────────────────────
// Eight tiles: Fee Collection is the share of the whole fee (academic +
// transport + Last Year Dues) that has come in; the three after it are what
// that whole fee is made of.
const KeyMetrics = ({ data }: { data: Data }) => {
  const k = data.kpis;
  const d = k.student_delta;
  return (
    <>
      <SectionHeading title="Key Metrics" />
      <KpiGrid
        items={[
          {
            icon: 'people-outline',
            label: 'Student Attendance',
            value: `${k.student_rate}%`,
            note: !k.student_marked ? 'Not marked yet today' : d === 0 ? '0% vs yesterday' : null,
            delta: k.student_marked && d !== 0 ? { text: `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}% vs yesterday`, good: d > 0 } : null,
          },
          { icon: 'school-outline', label: 'Teacher Attendance', value: `${k.teacher_rate}%`, note: 'Today' },
          { icon: 'wallet-outline', label: 'Fee Collection', value: `${k.collect_rate}%`, note: `of ${money(data.fee.stats.totalFee)} total fee` },
          { icon: 'book-outline', label: 'Academic Fee', value: money(k.academic_fee), note: 'total' },
          { icon: 'bus-outline', label: 'Transport Fee', value: money(k.transport_fee), note: 'total' },
          { icon: 'time-outline', label: 'Last Year Dues', value: money(k.last_year_dues), note: 'total' },
          { icon: 'alert-circle-outline', label: 'Unpaid Students', value: num(k.unpaid_students), note: 'no payment yet', low: true },
          { icon: 'person-add-outline', label: 'New Admissions', value: num(k.new_admissions), note: 'last 30 days' },
        ]}
      />
    </>
  );
};

// ── Attendance ───────────────────────────────────────────────────────────────
const Attendance = ({ data }: { data: Data }) => {
  const a = data.attendance;
  const t = a.daily_trend;
  const split = a.split;
  const marked = split.present + split.absent;
  const m = a.monthly;

  return (
    <>
      <SectionHeading title="Attendance" />

      <Card>
        <CardHead icon="trending-up-outline" title="Attendance Rate Trend" sub="Daily % · last 30 days" />
        <Key items={[{ label: 'Students', color: C.emerald }, { label: 'Teachers', color: C.blue }]} />
        <LineChart
          labels={t.labels}
          max={100}
          yFormat={v => `${v}%`}
          sets={[
            { label: 'Students', data: t.student, color: C.emerald, fill: C.emeraldFill },
            { label: 'Teachers', data: t.teacher, color: C.blue },
          ]}
          tip={i => {
            const lines = [];
            if (t.student[i] != null)
              lines.push({ text: `Students: ${t.student[i]}% · Present ${num(t.studentPresent[i])} · Absent ${num(t.studentAbsent[i])}`, color: C.emerald });
            if (t.teacher[i] != null)
              lines.push({ text: `Teachers: ${t.teacher[i]}% · Present ${num(t.teacherPresent[i])} · Absent ${num(t.teacherAbsent[i])}`, color: C.blue });
            return lines.length ? { title: t.labels[i], lines } : { title: t.labels[i], lines: [{ text: 'Nobody marked' }] };
          }}
        />
      </Card>

      {/* Student split: today's students, present against absent */}
      <Card>
        <CardHead icon="pie-chart-outline" title="Student Split" sub={`Today · ${data.today_label}`} />
        {marked > 0 ? (
          <Doughnut
            parts={[
              { label: 'Present', value: split.present, color: C.emeraldPie },
              { label: 'Absent', value: split.absent, color: C.redPie },
            ]}
            tip={i =>
              i === 0
                ? `Present: ${split.presentPct}% (${num(split.present)})`
                : `Absent: ${split.absentPct}% (${num(split.absent)})`
            }
          />
        ) : (
          <Note>Student attendance is not marked yet today.</Note>
        )}
        <CenterFigures
          items={[
            { value: `${split.presentPct}%`, label: `Present · ${num(split.present)}`, color: C.emerald600 },
            { value: `${split.absentPct}%`, label: `Absent · ${num(split.absent)}`, color: C.red500 },
          ]}
        />
      </Card>

      {/* Volume: each month's average attendance %, from 1 April of the session */}
      {(
        [
          ['Student Attendance Volume', m.student, C.emeraldBar, C.emerald],
          ['Teacher Attendance Volume', m.teacher, C.blueBar, C.blue],
        ] as const
      ).map(([title, series, bar, key]) => (
        <Card key={title}>
          <CardHead icon="bar-chart-outline" title={title} sub={`Average of the days' % per month · from ${m.from}`} />
          <Key items={[{ label: 'Attendance %', color: key }]} />
          <BarChart
            labels={m.labels}
            sets={[{ label: 'Attendance', data: series as (number | null)[], color: bar }]}
            max={100}
            yFormat={v => `${v}%`}
            tip={i => (series[i] == null ? null : { lines: [{ text: `${series[i]}%` }] })}
          />
        </Card>
      ))}

      {/* Class-wise ranking */}
      <Card>
        <CardHead icon="podium-outline" title="Class-wise Attendance Ranking" sub="Average of each day's attendance % · overall" />
        {a.class_rank.length > 0 ? (
          a.class_rank.map((r, i) => (
            <RankBar
              key={`${r.name}-${i}`}
              rank={i + 1}
              label={r.name}
              pct={r.pct}
              color={bandColor(r.pct, 85, 70)}
              isLast={i === a.class_rank.length - 1}
            />
          ))
        ) : (
          <Note>No attendance recorded yet.</Note>
        )}
      </Card>
    </>
  );
};

// ── Student Performance ──────────────────────────────────────────────────────
const RankerRows = ({ list, tone }: { list: PanelRanker[]; tone: string }) => (
  <>
    {list.map((st, i) => (
      <View key={`${st.rank}-${i}`} style={[s.ranker, i < list.length - 1 && s.rowLine]}>
        <Text style={s.rankerNo}>{st.rank}</Text>
        <Avatar uri={st.photo} name={st.name} />
        <View style={s.rankerBody}>
          <Text style={s.rankerName} numberOfLines={1}>
            {st.name}
          </Text>
          <Text style={s.rankerMeta} numberOfLines={1}>
            {st.class} · {st.section}
          </Text>
        </View>
        <View style={s.rankerScore}>
          <Text style={[s.rankerPct, { color: tone }]}>{st.score}%</Text>
          <Text style={s.rankerMarks}>
            {Number(st.obtained)} / {Number(st.max)}
          </Text>
        </View>
      </View>
    ))}
  </>
);

const Performance = ({ data, onFilter }: { data: Data; onFilter: (f: Filters) => void }) => {
  const p = data.performance;
  return (
    <>
      <SectionHeading title="Student Performance" />
      <View style={s.filters}>
        <Filter
          title="Class"
          value={p.class ?? ''}
          options={[{ label: 'All Classes', value: '' }, ...p.standards.map(c => ({ label: c.name, value: c.id }))]}
          onChange={v => onFilter({ class: v === '' ? null : Number(v), section: null })}
        />
        {p.sections.length > 0 && (
          <Filter
            title="Section"
            value={p.section ?? ''}
            options={[{ label: 'All Sections', value: '' }, ...p.sections.map(c => ({ label: c.name, value: c.id }))]}
            onChange={v => onFilter({ section: v === '' ? null : Number(v) })}
          />
        )}
      </View>

      {/* Ranked on exam marks: the first ten and the last ten */}
      {(
        [
          ['Top 10 Rankers', p.top, C.emerald600, 'trophy-outline'],
          ['Bottom 10 Rankers', p.bottom, C.red500, 'trending-down-outline'],
        ] as const
      ).map(([title, list, tone, icon]) => (
        <Card key={title}>
          <CardHead icon={icon} title={title} />
          {list.length > 0 ? (
            <RankerRows list={list as PanelRanker[]} tone={tone} />
          ) : (
            <Note>{p.top.length ? 'Everyone with exam marks is in the top 10.' : 'No exam marks for the selected filters.'}</Note>
          )}
        </Card>
      ))}
    </>
  );
};

// ── Admissions & Enquiries ───────────────────────────────────────────────────
const Admissions = ({
  data,
  onFilter,
  navigation,
  canEnquiries,
}: {
  data: Data;
  onFilter: (f: Filters) => void;
  navigation: any;
  canEnquiries: boolean;
}) => {
  const ad = data.admissions;
  const tr = ad.trend;
  const e = data.enquiries.stats;
  const shownDates = tr.labels.length;

  return (
    <>
      <SectionHeading title="Admissions & Enquiries" />

      <Card>
        <CardHead
          icon="person-add-outline"
          title="Admissions Trend"
          sub={`${num(ad.total)} admission${ad.total === 1 ? '' : 's'} · ${
            tr.dates > shownDates ? `the last ${shownDates} admission dates` : 'counted on admission date'
          }`}
        />
        <View style={s.filters}>
          <Filter
            title="School year"
            value={ad.year}
            options={ad.years.map(y => ({ label: `Apr ${y} – Mar ${y + 1}`, value: y }))}
            onChange={v => onFilter({ admission_year: Number(v) })}
          />
        </View>
        {/* One bar for each date students were admitted on, its number over it */}
        <BarChart
          labels={tr.labels}
          sets={[{ label: 'Admissions', data: tr.data, color: C.violetBar }]}
          maxBar={30}
          integer
          rotate={tr.labels.length > 4}
          values={v => num(v)}
          tip={i => ({ title: tr.labels[i], lines: [{ text: `Admissions: ${tr.data[i]}`, color: C.violetBar }] })}
        />
        {ad.total === 0 && (
          <Note>
            Nothing recorded for this school year — try an earlier one. Students with no admission date are counted on the
            day their record was created.
          </Note>
        )}
      </Card>

      {/* Enquiry funnel + the latest */}
      <Card>
        <CardHead icon="funnel-outline" title="Enquiry Funnel" />
        <CenterFigures
          top={false}
          items={[
            { value: String(e.total), label: 'Total' },
            { value: String(e.responded), label: 'Responded', color: C.emerald600 },
            { value: String(e.pending), label: 'Pending', color: C.amber600 },
          ]}
        />
        <Text style={s.centerNote}>
          {e.student} student · {e.teacher} teacher · {e.website} website
        </Text>
        <Progress label="Response rate" value={`${e.rate}%`} pct={e.rate} color="#10B981" />
        <Text style={s.caption}>LATEST ENQUIRIES</Text>
        {data.enquiries.latest.length > 0 ? (
          data.enquiries.latest.map((q, i) => {
            const tag = ENQUIRY_TAG[q.status] ?? ENQUIRY_TAG.New;
            return (
              <LineRow
                key={`${q.name}-${i}`}
                lead={<Avatar name={q.name} size={32} />}
                title={q.name}
                meta={`${q.source} · ${q.time}`}
                trailing={<Tag text={q.status} color={tag.color} bg={tag.bg} />}
                onPress={
                  canEnquiries
                    ? () => navigation.navigate('AdminEnquiries', { screen: 'AdminEnquiriesHome', params: { tab: q.tab } })
                    : undefined
                }
                isLast={i === data.enquiries.latest.length - 1}
              />
            );
          })
        ) : (
          <Note>No enquiries yet.</Note>
        )}
      </Card>
    </>
  );
};

// ── Fee ──────────────────────────────────────────────────────────────────────
const ClassBars = ({ bars, colors }: { bars: PanelBars; colors: [string, string] }) => (
  <BarChart
    labels={bars.labels}
    sets={[
      { label: 'Collected', data: bars.collected, color: colors[0] },
      { label: 'Remaining', data: bars.remaining, color: colors[1] },
    ]}
    yFormat={inrAxis}
    tip={i => ({
      title: bars.labels[i],
      lines: [
        { text: `Collected: ${inrFull(bars.collected[i])}`, color: colors[0] },
        { text: `Remaining: ${inrFull(bars.remaining[i])}`, color: colors[1] },
      ],
    })}
  />
);

const Fee = ({ data }: { data: Data }) => {
  const f = data.fee;
  const tf = f.transport;
  return (
    <>
      <SectionHeading title="Fee" />
      <Card>
        <StatCells
          items={[
            { label: 'Total Fee', value: money(f.stats.totalFee) },
            { label: 'Collected', value: money(f.stats.collected), color: C.emerald600 },
            { label: 'Remaining', value: money(f.stats.remaining), color: C.red500 },
            { label: 'Transport Fee', value: money(f.stats.transportFee) },
          ]}
        />
      </Card>

      <Card>
        <CardHead icon="bar-chart-outline" title="Fee Collection by Class" sub="Collected vs remaining" />
        <Key items={[{ label: 'Collected', color: C.emerald }, { label: 'Remaining', color: C.red400 }]} />
        <ClassBars bars={f.by_class} colors={[C.emeraldBar, C.redBar]} />
      </Card>

      <Card>
        <CardHead icon="speedometer-outline" title="Recovery Rate by Class" />
        {f.rate_by_class.length > 0 ? (
          f.rate_by_class.map((r, i) => (
            <Progress key={`${r.name}-${i}`} label={r.name} value={`${r.pct}%`} pct={r.pct} color={bandColor(r.pct, 80, 50)} />
          ))
        ) : (
          <Note>No fee data available.</Note>
        )}
      </Card>

      {/* Transport: billed off the route's monthly fee, so a pair of its own */}
      <Card>
        <CardHead icon="bus-outline" title="Transport Fee" sub={`${tf.rate}% recovered · ${tf.riders} riders`} />
        <ValueLines
          rows={[
            { label: 'Expected', value: money(tf.expected) },
            { label: 'Collected', value: money(tf.collected) },
            { label: 'Remaining', value: money(tf.remaining) },
          ]}
        />
      </Card>

      <Card>
        <CardHead icon="bar-chart-outline" title="Transport Fee by Class" sub="Collected vs remaining" />
        <Key items={[{ label: 'Collected', color: 'rgb(14,165,233)' }, { label: 'Remaining', color: 'rgb(251,146,60)' }]} />
        {f.transport_class.labels.length > 0 ? (
          <ClassBars bars={f.transport_class} colors={[C.sky, C.orange]} />
        ) : (
          <Note>No transport riders assigned yet.</Note>
        )}
      </Card>

      <Card>
        <CardHead icon="git-branch-outline" title="Transport Fee by Route" sub="Collected vs remaining · fare × each student's months" />
        <Key items={[{ label: 'Collected', color: 'rgb(14,165,233)' }, { label: 'Remaining', color: 'rgb(251,146,60)' }]} />
        {f.transport_route.labels.length > 0 ? (
          <HBarChart
            labels={f.transport_route.labels}
            sets={[
              { label: 'Collected', data: f.transport_route.collected, color: C.sky },
              { label: 'Remaining', data: f.transport_route.remaining, color: C.orange },
            ]}
            format={inrAxis}
            tip={i => ({
              title: f.transport_route.labels[i],
              lines: [
                { text: `Collected: ${inrFull(f.transport_route.collected[i])}`, color: C.sky },
                { text: `Remaining: ${inrFull(f.transport_route.remaining[i])}`, color: C.orange },
              ],
            })}
          />
        ) : (
          <Note>No transport routes yet.</Note>
        )}
      </Card>
    </>
  );
};

// ── WhatsApp ─────────────────────────────────────────────────────────────────
// The school's messages, to read: the last 30 days or a month — each kind day
// by day, what the charged ones came to, delivery and the messages themselves.
const WhatsApp = ({ data, onFilter }: { data: Data; onFilter: (f: Filters) => void }) => {
  const wa = data.whatsapp;
  if (!wa) return null;
  const list = wa.messages;
  const filtered = wa.feature !== '' || wa.status !== '';

  return (
    <>
      <SectionHeading title="WhatsApp" />

      <Card>
        <Text style={s.waLine}>
          {wa.switches.map((sw, i) => (
            <Text key={sw.key}>
              {sw.label}: <Text style={[s.waOn, { color: sw.on ? C.emerald600 : theme.colors.textMuted }]}>{sw.on ? 'On' : 'Off'}</Text>
              {i < wa.switches.length - 1 ? <Text style={s.waDot}> · </Text> : null}
            </Text>
          ))}
        </Text>
        <Text style={s.waRate}>{wa.rate} a message · not charged when it is not delivered</Text>
        <View style={s.filtersInCard}>
          <Filter
            title="Period"
            value={wa.period}
            options={wa.periods.map(p => ({ label: p.label, value: p.value }))}
            onChange={v => onFilter({ wa_period: String(v), wa_shown: 25 })}
          />
        </View>
      </Card>

      <Card>
        <StatCells items={wa.tiles} />
      </Card>

      <Card>
        <CardHead icon="chatbubble-ellipses-outline" title="Messages a Day" sub={`${wa.label} · ${wa.daily.avg} a day on average`} />
        <Key items={wa.daily.kinds.map(k => ({ label: k.label, color: WA_COLORS[k.key] ?? C.slate }))} />
        <BarChart
          labels={wa.daily.labels}
          stacked
          integer
          maxBar={22}
          sets={wa.daily.kinds.map(k => ({ label: k.label, data: k.data, color: WA_COLORS[k.key] ?? C.slate }))}
          tip={i => ({
            title: wa.daily.labels[i],
            lines: wa.daily.kinds
              .filter(k => (k.data[i] ?? 0) > 0)
              .map(k => ({ text: `${k.label}: ${k.data[i]}`, color: WA_COLORS[k.key] ?? C.slate })),
            footer: `Total: ${wa.daily.kinds.reduce((sum, k) => sum + (k.data[i] ?? 0), 0)}`,
          })}
        />
      </Card>

      <Card>
        <CardHead icon="checkmark-done-outline" title="Delivery" />
        {wa.delivery.map(d => (
          <Progress key={d.key} label={d.label} value={`${num(d.count)} (${d.share}%)`} pct={d.share} color={WA_BAR[d.key] ?? C.gray400} />
        ))}
        <ValueLines
          rows={[{ label: 'Busiest day', value: wa.busiest ? `${wa.busiest.label} · ${num(wa.busiest.count)}` : '—', rule: true }]}
        />
      </Card>

      <Card>
        <CardHead icon="list-outline" title={`Messages · ${wa.label}`} sub={num(list.count)} />
        <View style={s.filtersInCard}>
          <Filter
            title="Kind"
            value={wa.feature}
            options={[{ label: 'All kinds', value: '' }, ...wa.daily.kinds.map(k => ({ label: k.label, value: k.key }))]}
            onChange={v => onFilter({ wa_feature: String(v), wa_shown: 25 })}
          />
          <Filter
            title="Status"
            value={wa.status}
            options={[
              { label: 'All statuses', value: '' },
              ...Object.entries(WA_STATUS).map(([key, st]) => ({ label: st.label, value: key })),
            ]}
            onChange={v => onFilter({ wa_status: String(v), wa_shown: 25 })}
          />
        </View>
        {list.count === 0 ? (
          <Note>
            No messages in {wa.period === '' ? 'the last 30 days' : wa.label}
            {filtered ? ' for this filter' : ''}.
          </Note>
        ) : (
          <>
            {list.rows.map((m, i) => {
              const st = WA_STATUS[m.status] ?? { label: m.status, color: '#4B5563', bg: '#F3F4F6' };
              return (
                <View key={m.id} style={[s.msg, i < list.rows.length - 1 && s.rowLine]}>
                  <Text style={s.msgNo}>{i + 1}</Text>
                  <View style={s.msgBody}>
                    <View style={s.msgLine}>
                      <View style={[s.msgDot, { backgroundColor: WA_COLORS[m.feature] ?? C.gray400 }]} />
                      <Text style={s.msgKind} numberOfLines={1}>
                        {m.label}
                      </Text>
                      <Text style={[s.msgCharge, m.charged && s.msgCharged]}>{m.charge}</Text>
                    </View>
                    <Text style={s.msgMeta} numberOfLines={1}>
                      {[m.name || '—', m.phone].join(' · ')}
                    </Text>
                    <View style={s.msgLine}>
                      <Text style={[s.msgMeta, s.msgWhen]}>
                        {m.date} · {m.time}
                      </Text>
                      <Tag text={st.label} color={st.color} bg={st.bg} />
                    </View>
                    {m.status === 'failed' && !!m.error && (
                      <Text style={s.msgError} numberOfLines={2}>
                        {m.error}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
            {list.count > list.rows.length && (
              <TouchableOpacity style={s.more} activeOpacity={0.6} onPress={() => onFilter({ wa_shown: wa.shown + 50 })}>
                <Text style={s.moreText}>Show more ({num(list.count - list.rows.length)} more)</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </Card>
    </>
  );
};

// ── Operations ───────────────────────────────────────────────────────────────
const Operations = ({
  data,
  chosen,
  onChoose,
  saving,
  saved,
  onAssign,
}: {
  data: Data;
  chosen: Record<number, number>;
  onChoose: (id: number, teacher: number) => void;
  saving: number | null;
  saved: boolean;
  onAssign: (id: number) => void;
}) => {
  const { arrangements, available_teachers: teachers } = data.operations;
  const options = teachers.map(t => ({ label: t.name || `Teacher #${t.id}`, value: t.id }));
  return (
    <>
      <SectionHeading title="Operations" />
      <Card>
        <CardHead icon="swap-horizontal-outline" title="Today's Absent Teachers — Arrangement" sub={saved ? 'Saved' : null} />
        {arrangements.length > 0 ? (
          arrangements.map((a, i) => (
            <View key={a.id} style={[s.arr, i < arrangements.length - 1 && s.rowLine]}>
              <View style={s.arrHead}>
                <Text style={s.arrClass} numberOfLines={1}>
                  {a.class} · {a.section}
                </Text>
                <Tag
                  text={a.status === 'assigned' ? 'Assigned' : 'Pending'}
                  color={a.status === 'assigned' ? '#047857' : '#B45309'}
                  bg={a.status === 'assigned' ? '#ECFDF5' : '#FFFBEB'}
                />
              </View>
              <Text style={s.arrMeta} numberOfLines={1}>
                <Text style={s.arrAbsent}>{a.absent_teacher}</Text> · {a.time}
              </Text>
              <View style={s.arrPick}>
                <Filter title="Select Teacher" value={chosen[a.id] ?? ''} options={options} onChange={v => onChoose(a.id, Number(v))} />
                <TouchableOpacity
                  style={[s.assign, !chosen[a.id] && s.assignOff]}
                  activeOpacity={0.8}
                  disabled={!chosen[a.id] || saving === a.id}
                  onPress={() => onAssign(a.id)}
                >
                  {saving === a.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.assignText}>Assign</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Note>All teachers are present today — no arrangements needed.</Note>
        )}
      </Card>
    </>
  );
};

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 40 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },

  filters: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: -4 },
  filtersInCard: { flexDirection: 'row', gap: 10, marginTop: -6, marginBottom: 6 },

  // Rankers
  ranker: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rankerNo: { width: 22, fontSize: 12, color: theme.colors.textMuted },
  rankerBody: { flex: 1, minWidth: 0 },
  rankerName: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  rankerMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  rankerScore: { alignItems: 'flex-end' },
  rankerPct: { fontSize: 14, fontWeight: '700' },
  rankerMarks: { fontSize: 10, color: theme.colors.textMuted, marginTop: 1 },

  // Enquiries
  centerNote: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 4 },
  caption: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, color: theme.colors.textMuted, marginTop: 10 },

  // WhatsApp
  waLine: { fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
  waOn: { fontWeight: '700' },
  waDot: { color: theme.colors.border },
  waRate: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  msg: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  msgNo: { width: 20, fontSize: 12, color: theme.colors.textMuted, paddingTop: 1 },
  msgBody: { flex: 1, gap: 3, minWidth: 0 },
  msgLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  msgDot: { width: 8, height: 8, borderRadius: 4 },
  msgKind: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  msgCharge: { fontSize: 13, color: theme.colors.textMuted },
  msgCharged: { fontWeight: '700', color: theme.colors.textPrimary },
  msgMeta: { fontSize: 12, color: theme.colors.textMuted },
  msgWhen: { flex: 1 },
  msgError: { fontSize: 11, color: '#B91C1C' },
  more: { alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  moreText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

  // Operations
  arr: { paddingVertical: 10, gap: 3 },
  arrHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrClass: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  arrMeta: { fontSize: 12, color: theme.colors.textMuted },
  arrAbsent: { color: '#DC2626', fontWeight: '500' },
  arrPick: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  assign: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  assignOff: { opacity: 0.4 },
  assignText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

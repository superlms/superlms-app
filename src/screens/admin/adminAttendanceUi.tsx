import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import moment from 'moment';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import type { CardCounts, MonthCard, PersonCards, RecordStatus, Tally } from '../../api/adminAttendanceApi';

/**
 * Attendance's shared pieces, drawn as the student's Attendance draws a month:
 * a soft tint behind each day's number, the present-% large with a caption,
 * and the counts in a quiet line.
 */

export const TITLE = 'Attendance';

/** How a status reads and wears its tint — the student Attendance's colours. */
export const STATUS: Record<RecordStatus, { label: string; short: string; ink: string; fill: string | null; solid: string }> = {
  present: { label: 'Present', short: 'P', ink: '#15803D', fill: '#DCFCE7', solid: '#22C55E' },
  absent: { label: 'Absent', short: 'A', ink: '#B91C1C', fill: '#FEE2E2', solid: '#EF4444' },
  half_day: { label: 'Half day', short: 'HD', ink: '#B45309', fill: '#FEF3C7', solid: '#F59E0B' },
  holiday: { label: 'Holiday', short: 'H', ink: '#64748B', fill: '#F1F5F9', solid: '#64748B' },
  not_marked: { label: 'Not marked', short: '—', ink: '#94A3B8', fill: null, solid: '#94A3B8' },
};

export const LEGEND: RecordStatus[] = ['present', 'absent', 'half_day', 'holiday', 'not_marked'];

/** "24 Sep" for today's date is "Today". */
export const dayLabel = (date: string) =>
  date === moment().format('YYYY-MM-DD') ? 'Today' : moment(date).format('DD MMM YYYY');

/** The last 24 months, newest first, as the panel's month box offers them. */
export const monthOptions = (count = 24) =>
  Array.from({ length: count }, (_, i) => {
    const m = moment().startOf('month').subtract(i, 'months');
    return { key: m.format('YYYY-MM'), label: m.format('MMMM YYYY') };
  });

/** School years (April → March), the current one first, as the panel lists six. */
export const schoolYears = (count = 6) => {
  const start = moment().month() >= 3 ? moment().year() : moment().year() - 1;
  return Array.from({ length: count }, (_, i) => {
    const y = start - i;
    return { key: String(y), label: `Apr ${y} – Mar ${y + 1}` };
  });
};

/** A status as a small tinted word. */
export const StatusTag = ({ status }: { status: RecordStatus }) => {
  const m = STATUS[status] ?? STATUS.not_marked;
  return (
    <View style={[s.tag, { backgroundColor: m.fill ?? theme.colors.background }]}>
      <Text style={[s.tagText, { color: m.ink }]}>{m.label}</Text>
    </View>
  );
};

/** Present-% of those marked present, absent or half day — a half day counts half. */
export const dayPercent = (t: Pick<Tally, 'present' | 'absent' | 'half_day'>) => {
  const marked = t.present + t.absent + t.half_day;
  return marked > 0 ? Math.round(((t.present + 0.5 * t.half_day) / marked) * 1000) / 10 : 0;
};

//   92.5%  present on Thursday, 24 September
//   Total 12 · Present 10 · Absent 1 · Half day 1 · Holiday 0 · Not marked 0
export const DaySummary = ({ date, stats }: { date: string; stats: Tally }) => (
  <View style={s.summary}>
    <View style={s.pctRow}>
      <Text style={s.pct}>{dayPercent(stats)}%</Text>
      <Text style={s.pctCaption}>present on {moment(date).format('dddd, D MMMM')}</Text>
    </View>
    <Text style={s.counts}>
      {`Total ${stats.total} · Present ${stats.present} · Absent ${stats.absent} · Half day ${stats.half_day} · Holiday ${stats.holiday} · Not marked ${stats.not_marked}`}
    </Text>
    <Text style={s.note}>Sundays are a standing holiday.</Text>
  </View>
);

export const DaySummarySkeleton = () => (
  <View style={s.summary}>
    <View style={s.pctRow}>
      <Skeleton width={84} height={30} />
      <Skeleton width={150} height={13} />
    </View>
    <Skeleton width="92%" height={12} />
  </View>
);

/** What the tints mean, in a quiet row. */
export const Legend = ({ keys = LEGEND }: { keys?: RecordStatus[] }) => (
  <View style={s.legend}>
    {keys.map(k => (
      <View key={k} style={s.legendItem}>
        <View style={[s.legendDot, { backgroundColor: STATUS[k].fill ? STATUS[k].ink : theme.colors.border }]} />
        <Text style={s.legendText}>{STATUS[k].label}</Text>
      </View>
    ))}
  </View>
);

const countsLine = (c: CardCounts) =>
  `Present ${c.present} · Absent ${c.absent} · Half day ${c.half_day} · Holiday ${c.holiday} · Not marked ${c.not_marked}`;

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** One month: a Sunday-first calendar, its present-% and its counts. */
const MonthCardView = ({ card }: { card: MonthCard }) => {
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - 40) / 7);
  const day = Math.min(cell - 8, 36);

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>{card.label}</Text>
        <Text style={s.cardPct}>{card.counts.working ? `${card.pct}% present` : 'Nothing marked'}</Text>
      </View>
      <View style={s.grid}>
        {WEEK.map((d, i) => (
          <Text key={`w${i}`} style={[s.week, { width: cell }]}>{d}</Text>
        ))}
        {Array.from({ length: card.lead }).map((_, i) => (
          <View key={`b${i}`} style={{ width: cell, height: day + 6 }} />
        ))}
        {card.cells.map(c => {
          const m = c.in_period && c.status ? STATUS[c.status] : null;
          return (
            <View key={c.date} style={[s.cell, { width: cell, height: day + 6 }]}>
              <View style={[s.day, { width: day, height: day, borderRadius: day / 2 }, !!m?.fill && { backgroundColor: m.fill }]}>
                <Text style={[s.dayNum, { color: m ? m.ink : theme.colors.border }, c.status === 'present' && s.dayNumMarked]}>
                  {c.day}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={s.cardCounts}>{countsLine(card.counts)}</Text>
    </View>
  );
};

//   Asha Verma · Apr 2026 – Mar 2027
//   91.4%  present
//   Present 120 · Absent 4 · …
//   [April 2026] [May 2026] …   (newest first)
export const PersonMonths = ({ data }: { data: PersonCards }) => (
  <View>
    <View style={s.summary}>
      <Text style={s.person}>
        {data.person || TITLE}
        <Text style={s.period}>{`  ·  ${data.title}`}</Text>
      </Text>
      <View style={s.pctRow}>
        <Text style={s.pct}>{data.counts.percent}%</Text>
        <Text style={s.pctCaption}>present · {data.counts.working} working days</Text>
      </View>
      <Text style={s.counts}>{countsLine(data.counts)}</Text>
      <Text style={s.note}>Sundays are a standing holiday.</Text>
    </View>
    <Legend />
    {data.months.length === 0 ? (
      <Text style={s.empty}>Nothing to show for this period yet.</Text>
    ) : (
      [...data.months].reverse().map(m => <MonthCardView key={m.key} card={m} />)
    )}
  </View>
);

export const PersonMonthsSkeleton = () => (
  <View>
    <DaySummarySkeleton />
    <View style={s.skCards}>
      {[0, 1].map(i => (
        <Skeleton key={i} width="100%" height={250} radius={12} />
      ))}
    </View>
  </View>
);

const __mk_s = () => StyleSheet.create({
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 12, fontWeight: '600' },

  summary: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10, gap: 4 },
  pctRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  pct: { fontSize: 30, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 36 },
  pctCaption: { flex: 1, fontSize: 13, color: theme.colors.textMuted },
  counts: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18 },
  note: { fontSize: 11, color: theme.colors.textMuted },
  person: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  period: { fontSize: 13, fontWeight: '400', color: theme.colors.textMuted },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 20, paddingBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 12, color: theme.colors.textMuted },

  card: { marginHorizontal: 20, marginTop: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  cardPct: { fontSize: 12, color: theme.colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  week: { textAlign: 'center', fontSize: 11, fontWeight: '500', color: theme.colors.textMuted, paddingBottom: 6 },
  cell: { alignItems: 'center', justifyContent: 'center' },
  day: { alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 13 },
  dayNumMarked: { fontWeight: '600' },
  cardCounts: { fontSize: 11, color: theme.colors.textMuted, marginTop: 6 },
  empty: { fontSize: 13, color: theme.colors.textMuted, paddingHorizontal: 20, paddingTop: 16 },
  skCards: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

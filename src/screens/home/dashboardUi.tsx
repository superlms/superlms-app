import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * The pieces the two dashboards and Analytics are built from: white cards on
 * the page's quiet grey, each with a small accent icon and a plain heading; a
 * two-by-two of headline figures that each say what they mean; bars, columns
 * and a week of days for the numbers. One accent colour throughout — green and
 * red only where a day or a figure is good or needs a look.
 */

// Attendance below three quarters is worth a look, and so is a score below the
// usual pass mark.
export const LOW_ATTENDANCE = 75;
export const PASS_MARK = 35;

// Same banding as the attendance and performance screens.
export const bandFor = (pct: number): string => {
  if (pct >= 90) return 'Outstanding';
  if (pct >= 75) return 'Excellent';
  if (pct >= 60) return 'Good';
  if (pct >= 45) return 'Average';
  return 'Needs improvement';
};

export const GOOD = '#15803D';
export const BAD = '#DC2626';
// The soft grey of tracks, holidays and letter tiles — a step darker than the
// page, so it still reads on a white card.
export const SOFT = '#F1F5F9';
// What the student or class is compared with — the class, the month before.
export const COMPARE = '#94A3B8';

// "14:05" → "2:05 PM"
export const clock12 = (t?: string | null) => (t ? moment(t, 'HH:mm').format('h:mm A') : '');

// ── Card ─────────────────────────────────────────────────────────────────────
export const Card = ({ children, flush }: { children: React.ReactNode; flush?: boolean }) => (
  <View style={[s.card, flush && s.cardFlush]}>{children}</View>
);

//  [▣] Attendance · September                               Open ›
//      17 of 19 working days
export const CardHead = ({
  icon,
  title,
  sub,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  sub?: string | null;
  action?: string;
  onAction?: () => void;
}) => (
  <View style={s.cardHead}>
    <View style={s.cardIcon}>
      <VectorIcon iconSet="Ionicons" iconName={icon} size={16} color={theme.colors.primary} />
    </View>
    <View style={s.cardHeadText}>
      <Text style={s.cardTitle} numberOfLines={1}>
        {title}
      </Text>
      {!!sub && (
        <Text style={s.cardSub} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
    {!!action && !!onAction && (
      <TouchableOpacity style={s.cardAction} hitSlop={10} activeOpacity={0.6} onPress={onAction}>
        <Text style={s.cardActionText}>{action}</Text>
        <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={14} color={theme.colors.primary} />
      </TouchableOpacity>
    )}
  </View>
);

// A line under a heading or in an empty card.
export const Note = ({ children }: { children: React.ReactNode }) => <Text style={s.note}>{children}</Text>;

// ── Headline figures, two by two ─────────────────────────────────────────────
//   [▣] Attendance        [▣] Avg score
//   71%                   63%
//   10 of 14 days         Good · 2 exams
//   ▲ 2% vs August
export interface Kpi {
  icon: string;
  label: string;
  value: string;
  note?: string | null;
  /** "▲ 2% vs Aug" — good or not decides its colour. */
  delta?: { text: string; good: boolean } | null;
  low?: boolean;
  onPress?: () => void;
}

const KpiTile = ({ k }: { k: Kpi }) => {
  const body = (
    <>
      <View style={s.kpiHead}>
        <View style={s.kpiIcon}>
          <VectorIcon iconSet="Ionicons" iconName={k.icon} size={14} color={theme.colors.primary} />
        </View>
        <Text style={s.kpiLabel} numberOfLines={1}>
          {k.label}
        </Text>
      </View>
      <Text style={[s.kpiValue, k.low && s.bad]} numberOfLines={1}>
        {k.value}
      </Text>
      {!!k.note && (
        <Text style={s.kpiNote} numberOfLines={1}>
          {k.note}
        </Text>
      )}
      {!!k.delta && (
        <Text style={[s.kpiDelta, { color: k.delta.good ? GOOD : BAD }]} numberOfLines={1}>
          {k.delta.text}
        </Text>
      )}
    </>
  );
  return k.onPress ? (
    <TouchableOpacity style={s.kpi} activeOpacity={0.7} onPress={k.onPress}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={s.kpi}>{body}</View>
  );
};

export const KpiGrid = ({ items }: { items: Kpi[] }) => {
  const rows: Kpi[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={s.kpiGrid}>
      {rows.map((row, i) => (
        <View key={i} style={s.kpiRow}>
          {row.map(k => (
            <KpiTile key={k.label} k={k} />
          ))}
          {row.length === 1 && <View style={s.kpiSpacer} />}
        </View>
      ))}
    </View>
  );
};

// "▲ 4% vs August", or nothing when there is nothing to compare with.
export const deltaOf = (
  now: number | null | undefined,
  before: number | null | undefined,
  vs: string,
): Kpi['delta'] => {
  if (now == null || before == null) return null;
  const d = Math.round(now - before);
  if (d === 0) return { text: `Same as ${vs}`, good: true };
  return { text: `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}% vs ${vs}`, good: d > 0 };
};

// ── Figures in a row, inside a card ──────────────────────────────────────────
//   12          │ Science     │ 71%
//   Exams       │ Best        │ Attendance
export const MiniStats = ({
  items,
}: {
  items: { label: string; value: string; low?: boolean }[];
}) => (
  <View style={s.mini}>
    {items.map((it, i) => (
      <View key={it.label} style={[s.miniItem, i > 0 && s.miniDivider]}>
        <Text style={[s.miniValue, it.low && s.bad]} numberOfLines={1}>
          {it.value}
        </Text>
        <Text style={s.miniLabel} numberOfLines={2}>
          {it.label}
        </Text>
      </View>
    ))}
  </View>
);

// ── Section (the transport pay form keeps using this plain one) ──────────────
// A plain heading, with an optional link to the full screen, under a line.
export const DashSection = ({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) => (
  <>
    <View style={s.divider} />
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        {!!action && !!onAction && (
          <TouchableOpacity hitSlop={8} activeOpacity={0.6} onPress={onAction}>
            <Text style={s.sectionAction}>{action}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  </>
);

// ── A percentage as a bar, for the cards ─────────────────────────────────────
// `mark` draws a tick where something to compare with sits — the class average.
export const Meter = ({
  pct,
  low,
  empty,
  mark,
}: {
  pct: number;
  low?: boolean;
  empty?: boolean;
  mark?: number | null;
}) => (
  <View style={s.meterWrap}>
    <View style={s.meterBg}>
      {!empty && (
        <View
          style={[s.meterFill, { width: `${Math.max(2, Math.min(pct, 100))}%` as any }, low && s.meterFillLow]}
        />
      )}
    </View>
    {mark != null && <View style={[s.meterMark, { left: `${Math.max(0, Math.min(mark, 100))}%` as any }]} />}
  </View>
);

//   Mathematics                                      69%
//   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──────────────
//   72 of 105 marks
export const PctRow = ({
  label,
  pct,
  value,
  meta,
  low,
  empty,
  mark,
  tag,
  isLast,
}: {
  label: string;
  pct: number;
  /** What to show on the right instead of "69%". */
  value?: string;
  meta?: string | null;
  low?: boolean;
  /** Nothing to measure yet ("Not marked"): the value in grey over an empty bar. */
  empty?: boolean;
  /** A tick on the bar for what this is compared with (the class average). */
  mark?: number | null;
  tag?: React.ReactNode;
  isLast?: boolean;
}) => (
  <View style={[s.pctRow, !isLast && s.rowDivider]}>
    <View style={s.pctLine}>
      <Text style={s.pctLabel} numberOfLines={1}>
        {label}
      </Text>
      {tag}
      <Text style={[s.pctValue, low && s.bad, empty && s.pctValueEmpty]}>{value ?? `${pct}%`}</Text>
    </View>
    <Meter pct={pct} low={low} empty={empty} mark={mark} />
    {!!meta && <Text style={s.pctMeta}>{meta}</Text>}
  </View>
);

// ── Parts of a whole, as one bar and a key ───────────────────────────────────
//   ██████████████████████▌▌▌▌░░
//   ● Present 10   ● Absent 4   ● Holiday 5
export const SplitBar = ({ parts }: { parts: { label: string; value: number; color: string }[] }) => {
  const shown = parts.filter(p => p.value > 0);
  return (
    <View style={s.split}>
      <View style={s.splitBar}>
        {shown.length === 0 ? (
          <View style={[s.splitPart, s.splitEmpty]} />
        ) : (
          // (Reanimated's Babel plugin reads `x.value` inside a style as a shared
          // value, so the size is taken out first.)
          shown.map(({ label, value: size, color }) => (
            <View key={label} style={[s.splitPart, { flex: size, backgroundColor: color }]} />
          ))
        )}
      </View>
      <View style={s.legend}>
        {parts.map(p => (
          <View key={p.label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: p.color }]} />
            <Text style={s.legendText}>
              {p.label} <Text style={s.legendValue}>{p.value}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export const PRESENT = theme.colors.success;
export const ABSENT = theme.colors.danger;
export const NEUTRAL = '#CBD5E1';

// ── Columns over time ────────────────────────────────────────────────────────
//   71%   69%   —    82%
//   ▇▇    ▇▇         ██
//   Jun   Jul   Aug  Sep
export interface Column {
  key: string;
  label: string;
  sub?: string | null;
  value: number | null;
  low?: boolean;
}

export const Columns = ({
  data,
  selected,
  onSelect,
  height = 96,
  max = 100,
  format = v => `${v}%`,
}: {
  data: Column[];
  /** The column drawn in full colour; the rest are lighter. Defaults to the last. */
  selected?: string;
  onSelect?: (key: string) => void;
  height?: number;
  /** What a full column stands for — 100 for percentages, the largest count otherwise. */
  max?: number;
  format?: (v: number) => string;
}) => {
  const pick = selected ?? data[data.length - 1]?.key;
  const top = Math.max(max, 1);
  return (
    <View style={s.cols}>
      {data.map(c => {
        const on = c.key === pick;
        const fill = c.low ? theme.colors.danger : theme.colors.primary;
        const tall = `${Math.max(3, Math.min(((c.value ?? 0) / top) * 100, 100))}%`;
        const col = (
          <>
            <Text style={[s.colValue, on && s.colValueOn, c.low && on && s.bad]} numberOfLines={1}>
              {c.value == null ? '—' : format(c.value)}
            </Text>
            <View style={[s.colTrack, { height }]}>
              {c.value == null ? (
                <View style={s.colEmpty} />
              ) : (
                <View
                  style={[
                    s.colFill,
                    { height: tall as any, backgroundColor: on ? fill : fill + '40' },
                  ]}
                />
              )}
            </View>
            <Text style={[s.colLabel, on && s.colLabelOn]} numberOfLines={1}>
              {c.label}
            </Text>
            {!!c.sub && (
              <Text style={s.colSub} numberOfLines={1}>
                {c.sub}
              </Text>
            )}
          </>
        );
        return onSelect ? (
          <TouchableOpacity key={c.key} style={s.col} activeOpacity={0.6} onPress={() => onSelect(c.key)}>
            {col}
          </TouchableOpacity>
        ) : (
          <View key={c.key} style={s.col}>
            {col}
          </View>
        );
      })}
    </View>
  );
};

// ── The last seven days ──────────────────────────────────────────────────────
//   S    S    M    T    W    T    F
//  (12) (13) (14) (15) (16) (17) (18)
export const WeekDays = ({ days }: { days: { label: string; date?: string; status: string }[] }) => {
  const today = moment().format('YYYY-MM-DD');
  return (
    <View>
      <View style={s.week}>
        {days.map((d, i) => {
          const present = d.status === 'present';
          const absent = d.status === 'absent';
          const open = d.status === 'not_marked' || d.status === 'upcoming';
          const isToday = d.date === today;
          return (
            <View key={`${d.date ?? d.label}-${i}`} style={s.weekDay}>
              <Text style={[s.weekLetter, isToday && s.weekLetterToday]}>{d.label.slice(0, 1)}</Text>
              <View
                style={[
                  s.weekDot,
                  present && s.weekPresent,
                  absent && s.weekAbsent,
                  open && s.weekOpen,
                  isToday && s.weekToday,
                ]}
              >
                <Text style={[s.weekNum, present && s.weekNumPresent, absent && s.weekNumAbsent]}>
                  {d.date ? moment(d.date, 'YYYY-MM-DD').format('D') : '·'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={s.weekKey}>
        {[
          ['Present', s.weekPresent],
          ['Absent', s.weekAbsent],
          ['Holiday', null],
          ['Not marked', s.weekOpen],
        ].map(([label, style]) => (
          <View key={label as string} style={s.legendItem}>
            <View style={[s.weekKeyDot, style as any]} />
            <Text style={s.legendText}>{label as string}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ── A period of the day ──────────────────────────────────────────────────────
//   8:45 AM   ●  English                               NOW
//   9:30 AM   │  Anjali Sharma
export type PeriodState = 'done' | 'now' | 'next' | 'later';

export const PeriodRow = ({
  start,
  end,
  title,
  meta,
  state,
  isFirst,
  isLast,
}: {
  start: string | null;
  end?: string | null;
  title: string;
  meta?: string | null;
  state: PeriodState;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const done = state === 'done';
  const live = state === 'now';
  return (
    <View style={[s.period, live && s.periodNow]}>
      <View style={s.periodTime}>
        <Text style={[s.periodStart, done && s.muted, (live || state === 'next') && s.accent]}>
          {clock12(start) || '—'}
        </Text>
        {!!end && <Text style={s.periodEnd}>{clock12(end)}</Text>}
      </View>
      <View style={s.rail}>
        <View style={[s.railLine, isFirst && s.railLineFirst, isLast && s.railLineLast, isFirst && isLast && s.railLineNone]} />
        <View style={[s.railDot, done && s.railDotDone, live && s.railDotNow, state === 'next' && s.railDotNext]} />
      </View>
      <View style={s.periodBody}>
        <Text style={[s.periodTitle, done && s.muted]} numberOfLines={1}>
          {title}
        </Text>
        {!!meta && (
          <Text style={s.periodMeta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>
      {live ? <Pill text="Now" tone="accent" /> : state === 'next' ? <Pill text="Next" /> : null}
    </View>
  );
};

/**
 * Where each period stands against the clock: finished, running, the next to
 * start, or later. Without end times (older servers), a period runs 45 minutes
 * or until the next one starts, whichever is sooner.
 */
export const periodStates = (periods: { time: string | null; end_time?: string | null }[]): PeriodState[] => {
  const now = moment().format('HH:mm');
  const states: PeriodState[] = periods.map((p, i) => {
    if (!p.time || p.time > now) return 'later';
    const usual = moment(p.time, 'HH:mm').add(45, 'minutes').format('HH:mm');
    const next = periods[i + 1]?.time;
    const end = p.end_time ?? (next && next < usual ? next : usual);
    return end <= now ? 'done' : 'now';
  });
  const next = states.findIndex(st => st === 'later');
  if (next >= 0) states[next] = 'next';
  return states;
};

// ── Small pieces ─────────────────────────────────────────────────────────────
export const Pill = ({ text, tone = 'neutral' }: { text: string; tone?: 'accent' | 'good' | 'bad' | 'neutral' }) => (
  <View
    style={[
      s.pill,
      tone === 'accent' && s.pillAccent,
      tone === 'good' && s.pillGood,
      tone === 'bad' && s.pillBad,
    ]}
  >
    <Text
      style={[
        s.pillText,
        tone === 'accent' && s.accent,
        tone === 'good' && { color: GOOD },
        tone === 'bad' && { color: BAD },
      ]}
    >
      {text}
    </Text>
  </View>
);

//   25
//   SEP
export const DateBlock = ({ iso, accent }: { iso?: string | null; accent?: boolean }) => {
  const d = iso ? moment(iso.slice(0, 10), 'YYYY-MM-DD', true) : null;
  const ok = !!d && d.isValid();
  return (
    <View style={[s.dateBlock, accent && s.dateBlockAccent]}>
      <Text style={[s.dateDay, accent && s.accent]}>{ok ? d!.format('D') : '—'}</Text>
      <Text style={[s.dateMonth, accent && s.accent]}>{ok ? d!.format('MMM').toUpperCase() : ''}</Text>
    </View>
  );
};

// A letter in a soft square: a subject, a student.
export const Initial = ({ text }: { text?: string | null }) => (
  <View style={s.initial}>
    <Text style={s.initialText}>{(text ?? '').trim().slice(0, 1).toUpperCase() || '•'}</Text>
  </View>
);

// ── A plain row: something to lead with, a title and a line, and a trailing mark
export const LineRow = ({
  lead,
  title,
  meta,
  trailing,
  muted,
  metaLines = 1,
  onPress,
  isLast,
}: {
  lead?: React.ReactNode;
  title: string;
  meta?: string | null;
  trailing?: React.ReactNode;
  muted?: boolean;
  metaLines?: number;
  onPress?: () => void;
  isLast: boolean;
}) => {
  const body = (
    <>
      {lead}
      <View style={s.lineBody}>
        <Text style={[s.lineTitle, muted && s.muted]} numberOfLines={2}>
          {title}
        </Text>
        {!!meta && (
          <Text style={s.lineMeta} numberOfLines={metaLines}>
            {meta}
          </Text>
        )}
      </View>
      {trailing}
    </>
  );
  const style = [s.line, !isLast && s.rowDivider];
  return onPress ? (
    <TouchableOpacity style={style} activeOpacity={0.6} onPress={onPress}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={style}>{body}</View>
  );
};

export const Chevron = () => (
  <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
);

// ── Page ─────────────────────────────────────────────────────────────────────
// "Friday, 18 September · 5 A · Roll 23", over the cards.
export const PageLine = ({ text }: { text: string }) => <Text style={s.pageLine}>{text}</Text>;

// ── Loading / failing ────────────────────────────────────────────────────────
const SkCard = ({ rows = 3 }: { rows?: number }) => (
  <View style={[s.card, s.skCard]}>
    <View style={s.skHead}>
      <Skeleton width={30} height={30} radius={9} />
      <Skeleton width="40%" height={13} />
    </View>
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} width={i % 2 ? '75%' : '100%'} height={13} />
    ))}
  </View>
);

export const DashSkeleton = ({ kpis = true }: { kpis?: boolean }) => (
  <View>
    <View style={s.skLine}>
      <Skeleton width="55%" height={12} />
    </View>
    {kpis && (
      <View style={s.kpiGrid}>
        {[0, 1].map(r => (
          <View key={r} style={s.kpiRow}>
            {[0, 1].map(c => (
              <View key={c} style={[s.kpi, s.skKpi]}>
                <Skeleton width="60%" height={12} />
                <Skeleton width={56} height={24} />
                <Skeleton width="80%" height={11} />
              </View>
            ))}
          </View>
        ))}
      </View>
    )}
    <SkCard rows={4} />
    <SkCard rows={3} />
  </View>
);

export const DashError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <View style={s.centeredBox}>
    <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
    <Text style={s.errorText}>{message}</Text>
    <TouchableOpacity onPress={onRetry} hitSlop={10}>
      <Text style={s.linkText}>Try again</Text>
    </TouchableOpacity>
  </View>
);

const __mk_s = () => StyleSheet.create({
  bad: { color: BAD },
  accent: { color: theme.colors.primary },
  muted: { color: theme.colors.textMuted },

  // Card
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  cardFlush: { paddingBottom: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary + '12',
  },
  cardHeadText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardActionText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  note: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 19, paddingVertical: 10 },

  // Headline figures
  kpiGrid: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpi: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 14,
  },
  kpiSpacer: { flex: 1 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kpiIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary + '12',
  },
  kpiLabel: { flex: 1, fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  kpiValue: { fontSize: 24, fontWeight: '700', lineHeight: 30, color: theme.colors.textPrimary, marginTop: 10 },
  kpiNote: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  kpiDelta: { fontSize: 11, fontWeight: '600', marginTop: 4 },

  // Figures in a row
  mini: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    marginTop: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  miniItem: { flex: 1, paddingHorizontal: 10 },
  miniDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.border },
  miniValue: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  miniLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },

  // Plain section (transport pay form)
  divider: { height: 1, backgroundColor: theme.colors.divider },
  section: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  sectionAction: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },

  // Card bar
  meterWrap: { justifyContent: 'center' },
  meterBg: { height: 6, borderRadius: 3, backgroundColor: SOFT, overflow: 'hidden' },
  meterMark: {
    position: 'absolute',
    width: 2,
    height: 12,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: theme.colors.textSecondary,
  },
  meterFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.primary },
  meterFillLow: { backgroundColor: theme.colors.danger },
  pctRow: { paddingVertical: 11, gap: 7 },
  pctLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pctLabel: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  pctValue: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  pctValueEmpty: { fontWeight: '500', color: theme.colors.textMuted },
  pctMeta: { fontSize: 12, color: theme.colors.textMuted },

  // Parts of a whole
  split: { gap: 10, paddingVertical: 8 },
  splitBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  splitPart: { height: '100%' },
  splitEmpty: { flex: 1, backgroundColor: theme.colors.border },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: theme.colors.textSecondary },
  legendValue: { fontWeight: '600', color: theme.colors.textPrimary },

  // Columns
  cols: { flexDirection: 'row', gap: 8, paddingTop: 8, paddingBottom: 10 },
  col: { flex: 1, alignItems: 'center' },
  colValue: { fontSize: 11, fontWeight: '500', color: theme.colors.textMuted, marginBottom: 5 },
  colValueOn: { fontWeight: '700', color: theme.colors.textPrimary },
  colTrack: { width: '72%', maxWidth: 34, justifyContent: 'flex-end', alignItems: 'center' },
  colFill: { width: '100%', borderRadius: 6 },
  colEmpty: { width: '100%', height: 3, borderRadius: 2, backgroundColor: theme.colors.border },
  colLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 7 },
  colLabelOn: { fontWeight: '600', color: theme.colors.textPrimary },
  colSub: { fontSize: 10, color: theme.colors.textMuted, marginTop: 1 },

  // Week
  week: { flexDirection: 'row', paddingTop: 6 },
  weekDay: { flex: 1, alignItems: 'center', gap: 6 },
  weekLetter: { fontSize: 11, fontWeight: '500', color: theme.colors.textMuted },
  weekLetterToday: { color: theme.colors.primary, fontWeight: '700' },
  weekDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SOFT,
  },
  weekPresent: { backgroundColor: theme.colors.success + '26' },
  weekAbsent: { backgroundColor: theme.colors.danger + '22' },
  weekOpen: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  weekToday: { borderWidth: 1.5, borderColor: theme.colors.primary },
  weekNum: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  weekNumPresent: { color: GOOD },
  weekNumAbsent: { color: BAD },
  weekKey: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, paddingTop: 12, paddingBottom: 8 },
  weekKeyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: SOFT },

  // Periods
  period: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 12 },
  periodNow: { backgroundColor: theme.colors.primary + '0D' },
  periodTime: { width: 62, paddingVertical: 12 },
  periodStart: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  periodEnd: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  rail: { width: 12, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  railLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: theme.colors.border },
  railLineFirst: { top: '50%' },
  railLineLast: { bottom: '50%' },
  railLineNone: { width: 0 },
  railDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: theme.colors.textMuted,
    backgroundColor: theme.colors.card,
  },
  railDotDone: { borderColor: theme.colors.border, backgroundColor: theme.colors.border },
  railDotNow: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  railDotNext: { borderColor: theme.colors.primary },
  periodBody: { flex: 1, paddingVertical: 12, gap: 2 },
  periodTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  periodMeta: { fontSize: 12, color: theme.colors.textMuted },

  // Small pieces
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: SOFT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  pillAccent: { backgroundColor: theme.colors.primary + '14', borderColor: theme.colors.primary + '30' },
  pillGood: { backgroundColor: theme.colors.success + '1A', borderColor: theme.colors.success + '40' },
  pillBad: { backgroundColor: theme.colors.danger + '14', borderColor: theme.colors.danger + '33' },
  pillText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
  dateBlock: {
    width: 44,
    paddingVertical: 6,
    borderRadius: 11,
    alignItems: 'center',
    backgroundColor: SOFT,
  },
  dateBlockAccent: { backgroundColor: theme.colors.primary + '12' },
  dateDay: { fontSize: 17, fontWeight: '700', lineHeight: 21, color: theme.colors.textPrimary },
  dateMonth: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, color: theme.colors.textMuted },
  initial: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SOFT,
  },
  initialText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },

  // Plain rows
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  lineBody: { flex: 1, gap: 3 },
  lineTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  lineMeta: { fontSize: 12, color: theme.colors.textMuted },

  // Page
  pageLine: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, paddingTop: 14 },

  // Loading
  skLine: { paddingHorizontal: 20, paddingTop: 16 },
  skKpi: { gap: 10 },
  skCard: { gap: 12, paddingBottom: 16 },
  skHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

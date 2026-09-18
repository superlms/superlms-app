import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import { theme, onThemeChange } from '../../utils/theme';
import { BAD, COMPARE, GOOD, SOFT } from '../home/dashboardUi';

/**
 * Analytics' graphs, drawn with plain views: a line over time with what it is
 * compared with, bars side by side, columns of done-out-of-set, and a month as
 * a calendar. The accent is the student's or teacher's own figure; grey is what
 * it is set against; green and red only for days present and absent.
 *
 * (Reanimated's Babel plugin reads `x.value` inside a style as a shared value,
 * so sizes are worked out before they reach a style.)
 */

// ── Key ──────────────────────────────────────────────────────────────────────
//   ● You   ● Class average
export const Legend = ({ items }: { items: { label: string; color: string; line?: boolean }[] }) => (
  <View style={s.legend}>
    {items.map(it => (
      <View key={it.label} style={s.legendItem}>
        <View style={[it.line ? s.legendLine : s.legendDot, { backgroundColor: it.color }]} />
        <Text style={s.legendText}>{it.label}</Text>
      </View>
    ))}
  </View>
);

// ── A line over time ─────────────────────────────────────────────────────────
//        71%
//   62% ●───●  ●
//   ○───○───○        (class average)
//   Jul  Aug  Sep
export interface Series {
  key: string;
  label: string;
  points: (number | null)[];
  /** The figure being compared with: thinner, grey, no values written. */
  compare?: boolean;
}

export const LineChart = ({
  labels,
  subs,
  series,
  height = 120,
  max = 100,
  format = v => `${v}%`,
}: {
  labels: string[];
  subs?: (string | null)[];
  series: Series[];
  height?: number;
  max?: number;
  format?: (v: number) => string;
}) => {
  const [width, setWidth] = useState(0);
  const pad = 20; // room over the top point for its figure
  const n = Math.max(labels.length, 1);
  const col = width / n;
  const x = (i: number) => col * (i + 0.5);
  const y = (v: number) => pad + height - (Math.max(0, Math.min(v, max)) / Math.max(max, 1)) * height;

  const lines = series.map(se => {
    const color = se.compare ? COMPARE : theme.colors.primary;
    const thick = se.compare ? 1.5 : 2.5;
    const parts: React.ReactNode[] = [];
    se.points.forEach((p, i) => {
      if (p == null) return;
      // The stretch to the next point, when there is one.
      const q = se.points[i + 1];
      if (q != null && i + 1 < n) {
        const x1 = x(i);
        const y1 = y(p);
        const x2 = x(i + 1);
        const y2 = y(q);
        const len = Math.hypot(x2 - x1, y2 - y1);
        const angle = `${Math.atan2(y2 - y1, x2 - x1)}rad`;
        parts.push(
          <View
            key={`${se.key}-l${i}`}
            style={[
              s.segment,
              {
                left: (x1 + x2) / 2 - len / 2,
                top: (y1 + y2) / 2 - thick / 2,
                width: len,
                height: thick,
                backgroundColor: color,
                transform: [{ rotate: angle }],
              },
            ]}
          />,
        );
      }
    });
    se.points.forEach((p, i) => {
      if (p == null) return;
      const size = se.compare ? 6 : 9;
      parts.push(
        <View
          key={`${se.key}-d${i}`}
          style={[
            s.dot,
            {
              left: x(i) - size / 2,
              top: y(p) - size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: color,
              backgroundColor: se.compare ? color : theme.colors.card,
            },
          ]}
        />,
      );
      if (!se.compare) {
        parts.push(
          <Text key={`${se.key}-v${i}`} style={[s.pointValue, { left: x(i) - 24, top: y(p) - 19 }]}>
            {format(p)}
          </Text>,
        );
      }
    });
    return parts;
  });

  return (
    <View style={s.chart}>
      <View style={{ height: pad + height + 6 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {[0, 0.5, 1].map(f => (
          <View key={f} style={[s.grid, { top: y(max * f) }]} />
        ))}
        {width > 0 && lines}
      </View>
      <View style={s.axis}>
        {labels.map((l, i) => (
          <View key={`${l}-${i}`} style={s.axisCell}>
            <Text style={s.axisLabel} numberOfLines={1}>
              {l}
            </Text>
            {!!subs?.[i] && (
              <Text style={s.axisSub} numberOfLines={1}>
                {subs[i]}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

// ── Two figures side by side, row by row ─────────────────────────────────────
//   Science                                 81%  · class 63%
//   ████████████████████████████████████
//   ███████████████████████████
export interface CompareRow {
  key: string;
  label: string;
  mine: number | null;
  theirs: number | null;
  meta?: string | null;
  low?: boolean;
}

export const CompareBars = ({ rows, theirLabel = 'class' }: { rows: CompareRow[]; theirLabel?: string }) => (
  <View>
    {rows.map((r, i) => {
      const mine = `${Math.max(r.mine == null ? 0 : 2, Math.min(r.mine ?? 0, 100))}%`;
      const theirs = `${Math.max(r.theirs == null ? 0 : 2, Math.min(r.theirs ?? 0, 100))}%`;
      const diff = r.mine != null && r.theirs != null ? r.mine - r.theirs : null;
      return (
        <View key={r.key} style={[s.cmpRow, i < rows.length - 1 && s.rowDivider]}>
          <View style={s.cmpHead}>
            <Text style={s.cmpLabel} numberOfLines={1}>
              {r.label}
            </Text>
            <Text style={[s.cmpMine, r.low && s.bad]}>{r.mine == null ? '—' : `${r.mine}%`}</Text>
            {r.theirs != null && (
              <Text style={s.cmpTheirs}>
                {' '}
                · {theirLabel} {r.theirs}%
              </Text>
            )}
          </View>
          <View style={s.cmpTrack}>
            <View style={[s.cmpFill, { width: mine as any }, r.low && s.cmpFillLow]} />
          </View>
          <View style={s.cmpTrackThin}>
            <View style={[s.cmpFillThin, { width: theirs as any }]} />
          </View>
          {(!!r.meta || diff != null) && (
            <Text style={s.cmpMeta}>
              {[
                r.meta,
                diff != null && diff !== 0
                  ? `${Math.abs(diff)}% ${diff > 0 ? 'above' : 'below'} ${theirLabel}`
                  : diff === 0
                  ? `Level with ${theirLabel}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
        </View>
      );
    })}
  </View>
);

// ── Done out of set, week by week ────────────────────────────────────────────
//   2/3
//   ░░   ▓▓
//   ▓▓   ▓▓
//   7 Sep 14 Sep
export const ProgressColumns = ({
  data,
  height = 80,
}: {
  data: { key: string; label: string; total: number; done?: number }[];
  height?: number;
}) => {
  const most = Math.max(1, ...data.map(d => d.total));
  return (
    <View style={s.cols}>
      {data.map((d, i) => {
        const last = i === data.length - 1;
        const whole = `${d.total > 0 ? Math.max(4, (d.total / most) * 100) : 0}%`;
        const part = `${d.total > 0 && d.done != null ? (d.done / d.total) * 100 : 100}%`;
        return (
          <View key={d.key} style={s.col}>
            <Text style={[s.colValue, last && s.colValueOn]} numberOfLines={1}>
              {d.total === 0 ? '0' : d.done != null ? `${d.done}/${d.total}` : String(d.total)}
            </Text>
            <View style={[s.colTrack, { height }]}>
              {d.total === 0 ? (
                <View style={s.colEmpty} />
              ) : (
                <View style={[s.colWhole, { height: whole as any }]}>
                  <View style={[s.colPart, { height: part as any }, !last && s.colPartOld]} />
                </View>
              )}
            </View>
            <Text style={[s.colLabel, last && s.colLabelOn]} numberOfLines={1}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// ── A month as a calendar ────────────────────────────────────────────────────
//   M  T  W  T  F  S  S
//         1  2  3  4  5
//   6  7  8 …
export const MonthGrid = ({
  days,
  onPressDay,
}: {
  days: { date: string; status: string }[];
  onPressDay?: (date: string) => void;
}) => {
  if (days.length === 0) return null;
  const first = moment(days[0].date, 'YYYY-MM-DD');
  const lead = (first.isoWeekday() + 6) % 7; // blanks before the 1st, Monday first
  const cells: ({ date: string; status: string } | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const today = moment().format('YYYY-MM-DD');

  return (
    <View style={s.grid7}>
      <View style={s.gridRow}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Text key={i} style={s.gridHead}>
            {d}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={s.gridRow}>
          {row.map((c, i) => {
            if (!c) return <View key={i} style={s.gridCell} />;
            const present = c.status === 'present';
            const absent = c.status === 'absent';
            const holiday = c.status === 'holiday';
            const open = c.status === 'not_marked';
            const cell = (
              <View
                style={[
                  s.gridBox,
                  present && s.gridPresent,
                  absent && s.gridAbsent,
                  holiday && s.gridHoliday,
                  open && s.gridOpen,
                  c.date === today && s.gridToday,
                ]}
              >
                <Text
                  style={[
                    s.gridNum,
                    present && { color: GOOD },
                    absent && { color: BAD },
                    c.status === 'upcoming' && s.gridNumLater,
                  ]}
                >
                  {moment(c.date, 'YYYY-MM-DD').date()}
                </Text>
              </View>
            );
            return onPressDay ? (
              <TouchableOpacity key={i} style={s.gridCell} activeOpacity={0.6} onPress={() => onPressDay(c.date)}>
                {cell}
              </TouchableOpacity>
            ) : (
              <View key={i} style={s.gridCell}>
                {cell}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};

// ── A figure with its label, in a row of them ────────────────────────────────
//   ┌──────────┐ ┌──────────┐ ┌──────────┐
//   │ 12       │ │ 3        │ │ 67%      │
//   │ Attempted│ │ Correct  │ │ Accuracy │
//   └──────────┘ └──────────┘ └──────────┘
export const FigureRow = ({
  items,
}: {
  items: { label: string; value: string; low?: boolean; good?: boolean }[];
}) => (
  <View style={s.figures}>
    {items.map(it => (
      <View key={it.label} style={s.figure}>
        <Text style={[s.figureValue, it.low && s.bad, it.good && { color: GOOD }]} numberOfLines={1}>
          {it.value}
        </Text>
        <Text style={s.figureLabel} numberOfLines={2}>
          {it.label}
        </Text>
      </View>
    ))}
  </View>
);

const __mk_s = () => StyleSheet.create({
  bad: { color: BAD },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },

  // Key
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, paddingTop: 4, paddingBottom: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 14, height: 3, borderRadius: 2 },
  legendText: { fontSize: 12, color: theme.colors.textSecondary },

  // Line
  chart: { paddingTop: 6, paddingBottom: 8 },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  segment: { position: 'absolute', borderRadius: 2 },
  dot: { position: 'absolute', borderWidth: 2 },
  pointValue: {
    position: 'absolute',
    width: 48,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  axis: { flexDirection: 'row' },
  axisCell: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  axisLabel: { fontSize: 11, color: theme.colors.textSecondary },
  axisSub: { fontSize: 10, color: theme.colors.textMuted, marginTop: 1 },

  // Side by side
  cmpRow: { paddingVertical: 11, gap: 5 },
  cmpHead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 2 },
  cmpLabel: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, marginRight: 8 },
  cmpMine: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  cmpTheirs: { fontSize: 12, color: theme.colors.textMuted },
  cmpTrack: { height: 7, borderRadius: 4, backgroundColor: SOFT, overflow: 'hidden' },
  cmpFill: { height: '100%', borderRadius: 4, backgroundColor: theme.colors.primary },
  cmpFillLow: { backgroundColor: theme.colors.danger },
  cmpTrackThin: { height: 4, borderRadius: 2, backgroundColor: SOFT, overflow: 'hidden' },
  cmpFillThin: { height: '100%', borderRadius: 2, backgroundColor: COMPARE },
  cmpMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  // Done out of set
  cols: { flexDirection: 'row', gap: 6, paddingTop: 8, paddingBottom: 10 },
  col: { flex: 1, alignItems: 'center' },
  colValue: { fontSize: 10, fontWeight: '500', color: theme.colors.textMuted, marginBottom: 5 },
  colValueOn: { fontWeight: '700', color: theme.colors.textPrimary },
  colTrack: { width: '72%', maxWidth: 30, justifyContent: 'flex-end' },
  colWhole: { width: '100%', borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: theme.colors.primary + '26' },
  colPart: { width: '100%', backgroundColor: theme.colors.primary },
  colPartOld: { backgroundColor: theme.colors.primary + '99' },
  colEmpty: { width: '100%', height: 3, borderRadius: 2, backgroundColor: theme.colors.border },
  colLabel: { fontSize: 10, color: theme.colors.textMuted, marginTop: 7 },
  colLabelOn: { fontWeight: '600', color: theme.colors.textPrimary },

  // Calendar
  grid7: { paddingTop: 6, paddingBottom: 8, gap: 4 },
  gridRow: { flexDirection: 'row', gap: 4 },
  gridHead: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '500', color: theme.colors.textMuted },
  gridCell: { flex: 1, aspectRatio: 1 },
  gridBox: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
  },
  gridPresent: { backgroundColor: theme.colors.success + '26' },
  gridAbsent: { backgroundColor: theme.colors.danger + '22' },
  gridHoliday: { backgroundColor: SOFT },
  gridOpen: { borderWidth: 1, borderColor: theme.colors.border },
  gridToday: { borderWidth: 1.5, borderColor: theme.colors.primary },
  gridNum: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  gridNumLater: { fontWeight: '400', color: theme.colors.border },

  // Figures
  figures: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  figure: { flex: 1, backgroundColor: SOFT, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10 },
  figureValue: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  figureLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

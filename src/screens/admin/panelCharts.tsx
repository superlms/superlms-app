import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * The web panel's graphs (Chart.js there), drawn with plain views so the app
 * needs nothing new to ship: a line over time — filled underneath, dashed, with
 * gaps spanned — bars side by side, stacked or lying down, and a doughnut. Each
 * keeps the panel's colours, axis and what its tooltip says, which a tap on a
 * point or a bar shows here.
 *
 * (Reanimated's Babel plugin reads `x.value` inside a style as a shared value,
 * so sizes are worked out before they reach a style.)
 */

// The panel's colours (Tailwind's), as Chart.js draws them.
export const C = {
  emerald: 'rgb(16,185,129)',
  emeraldFill: 'rgba(16,185,129,0.10)',
  emeraldBar: 'rgba(16,185,129,0.75)',
  emeraldPie: 'rgba(16,185,129,0.85)',
  emerald400: 'rgb(52,211,153)',
  emerald600: '#059669',
  red400: 'rgb(248,113,113)',
  red400Fill: 'rgba(248,113,113,0.06)',
  redBar: 'rgba(239,68,68,0.6)',
  redPie: 'rgba(239,68,68,0.7)',
  red500: '#EF4444',
  blue: 'rgb(59,130,246)',
  blueFill: 'rgba(59,130,246,0.10)',
  blueBar: 'rgba(59,130,246,0.75)',
  blue600: '#2563EB',
  amber400: 'rgb(251,191,36)',
  amberFill: 'rgba(251,191,36,0.08)',
  amber500: '#F59E0B',
  amber600: '#D97706',
  indigoBar: 'rgba(99,102,241,0.7)',
  violet: 'rgb(139,92,246)',
  violetFill: 'rgba(139,92,246,0.12)',
  violetBar: 'rgba(139,92,246,0.7)',
  violet600: '#7C3AED',
  sky: 'rgba(14,165,233,0.75)',
  orange: 'rgba(251,146,60,0.7)',
  rose: 'rgba(244,63,94,0.75)',
  slate: 'rgba(148,163,184,0.8)',
  gray400: '#9CA3AF',
  grid: 'rgba(0,0,0,0.05)',
};

// ── Money and counts on an axis ──────────────────────────────────────────────
// ₹1,25,000 in a tooltip; ₹1.3L on an axis, where room is short.
export const inrFull = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN')}`;
export const inrAxis = (v: number) => {
  const a = Math.abs(v);
  const cut = (x: number) => String(Math.round(x * 10) / 10);
  if (a >= 1e7) return `₹${cut(v / 1e7)}Cr`;
  if (a >= 1e5) return `₹${cut(v / 1e5)}L`;
  if (a >= 1e3) return `₹${cut(v / 1e3)}K`;
  return `₹${Math.round(v)}`;
};
export const pctAxis = (v: number) => `${v}%`;

// ── Scale ────────────────────────────────────────────────────────────────────
// Ticks from 0 as Chart.js picks them: a round step (1, 2, 2.5 or 5 × 10ⁿ) and a
// top at or just over the largest value; or the max and step a chart asks for.
const scaleOf = (values: number[], max?: number, step?: number, integer?: boolean) => {
  let top: number;
  let by: number;
  if (max != null) {
    top = max;
    by = step ?? max / 5;
  } else {
    const most = Math.max(0, ...values.filter(v => Number.isFinite(v)));
    const raw = (most || 1) / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    by = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
    if (integer) by = Math.max(1, Math.ceil(by));
    top = Math.max(by, Math.ceil(most / by) * by);
  }
  const ticks: number[] = [];
  for (let t = 0; t <= top + by / 1000; t += by) ticks.push(Math.round(t * 1000) / 1000);
  return { top, ticks };
};

// Roughly how wide a label is at the axis' size.
const textWidth = (t: string, size = 10) => t.length * size * 0.56 + 6;

// Every k-th label, so the shown ones don't run into each other.
const skipEvery = (labels: string[], slot: number, size = 10) => {
  const widest = Math.max(0, ...labels.map(l => textWidth(l, size)));
  return slot > 0 ? Math.max(1, Math.ceil((widest + 6) / slot)) : 1;
};

// ── Tooltip ──────────────────────────────────────────────────────────────────
export interface Tip {
  title?: string | null;
  lines: { text: string; color?: string }[];
  footer?: string | null;
}

const TipBox = ({ tip, x, width, inline }: { tip: Tip; x: number; width: number; inline?: boolean }) => {
  const w = Math.min(width, 220);
  const left = Math.max(0, Math.min(x - w / 2, width - w));
  return (
    <View pointerEvents="none" style={inline ? [s.tip, s.tipInline] : [s.tip, { left, width: w }]}>
      {!!tip.title && <Text style={s.tipTitle}>{tip.title}</Text>}
      {tip.lines.map((l, i) => (
        <View key={i} style={s.tipLine}>
          {!!l.color && <View style={[s.tipSwatch, { backgroundColor: l.color }]} />}
          <Text style={s.tipText}>{l.text}</Text>
        </View>
      ))}
      {!!tip.footer && <Text style={s.tipFooter}>{tip.footer}</Text>}
    </View>
  );
};

// ── Frame: the y axis, the grid, the x labels and the tap layer ──────────────
const Y_PAD = 8; // room over the top tick

const Frame = ({
  height,
  ticks,
  top,
  yFormat,
  labels,
  xs,
  slot,
  rotate,
  pick,
  tip,
  children,
}: {
  height: number;
  ticks: number[];
  top: number;
  yFormat: (v: number) => string;
  labels: string[];
  /** Where each label sits across the plot, given its width. */
  xs: (w: number) => number[];
  slot: (w: number) => number;
  /** The labels slanted, all of them shown (the Admissions Trend). */
  rotate?: boolean;
  pick: { index: number | null; set: (i: number | null) => void };
  tip: (i: number) => Tip | null;
  children: (w: number, y: (v: number) => number) => React.ReactNode;
}) => {
  const [width, setWidth] = useState(0);
  const yW = Math.max(...ticks.map(t => textWidth(yFormat(t)))) + 2;
  const plotW = Math.max(0, width - yW);
  const y = (v: number) => Y_PAD + height - (Math.max(0, Math.min(v, top)) / (top || 1)) * height;
  const at = plotW > 0 ? xs(plotW) : [];
  const every = rotate ? 1 : skipEvery(labels, slot(plotW));
  const slant = rotate ? Math.min(Math.max(0, ...labels.map(l => textWidth(l, 9))), 74) : 0;

  const onPress = (e: any) => {
    if (!at.length) return;
    const lx = e.nativeEvent.locationX;
    let best = 0;
    at.forEach((x, i) => {
      if (Math.abs(x - lx) < Math.abs(at[best] - lx)) best = i;
    });
    pick.set(pick.index === best ? null : best);
  };

  const shown = pick.index != null ? tip(pick.index) : null;

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={s.frame}>
      <View style={s.frameRow}>
        <View style={{ width: yW, height: height + Y_PAD + 2 }}>
          {ticks.map(t => (
            <Text key={t} style={[s.yTick, { top: y(t) - 7 }]} numberOfLines={1}>
              {yFormat(t)}
            </Text>
          ))}
        </View>
        <View style={{ width: plotW, height: height + Y_PAD + 2 }}>
          {ticks.map(t => (
            <View key={t} style={[s.gridLine, { top: Math.round(y(t)) }]} />
          ))}
          {plotW > 0 && children(plotW, y)}
          {shown && pick.index != null && <TipBox tip={shown} x={at[pick.index] ?? 0} width={plotW} />}
          <Pressable style={StyleSheet.absoluteFill} onPress={onPress} />
        </View>
      </View>
      {rotate ? (
        <View style={{ marginLeft: yW, width: plotW, height: slant * 0.87 + 10 }}>
          {at.map((x, i) => (
            <Text
              key={i}
              numberOfLines={1}
              style={[
                s.xSlant,
                {
                  width: slant,
                  left: x - slant * 0.75,
                  top: 4 + slant * 0.433 - 6,
                  transform: [{ rotate: '-60deg' }],
                },
              ]}
            >
              {labels[i]}
            </Text>
          ))}
        </View>
      ) : (
        <View style={{ marginLeft: yW, width: plotW, height: 18 }}>
          {at.map((x, i) =>
            i % every === 0 ? (
              <Text
                key={i}
                numberOfLines={1}
                style={[s.xTick, { width: textWidth(labels[i] ?? '') + 4, left: x - (textWidth(labels[i] ?? '') + 4) / 2 }]}
              >
                {labels[i]}
              </Text>
            ) : null,
          )}
        </View>
      )}
    </View>
  );
};

// ── A line over time ─────────────────────────────────────────────────────────
export interface LineSet {
  label: string;
  data: (number | null)[];
  color: string;
  /** The colour under the line, down to 0 (fill: true). */
  fill?: string | null;
  dashed?: boolean;
  /** Point size (Chart.js pointRadius). */
  point?: number;
}

const segment = (key: string, x1: number, y1: number, x2: number, y2: number, color: string, thick: number) => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  return (
    <View
      key={key}
      pointerEvents="none"
      style={[
        s.abs,
        {
          left: (x1 + x2) / 2 - len / 2,
          top: (y1 + y2) / 2 - thick / 2,
          width: len,
          height: thick,
          borderRadius: thick / 2,
          backgroundColor: color,
          transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }],
        },
      ]}
    />
  );
};

// The area under one stretch of line: a block down to the axis and the
// triangle over it (a view's borders, one coloured and one clear, make it).
const area = (key: string, x1: number, y1: number, x2: number, y2: number, base: number, color: string) => {
  const l = Math.round(x1);
  const r = Math.round(x2);
  const w = r - l;
  if (w <= 0) return null;
  const hi = Math.round(Math.min(y1, y2));
  const lo = Math.round(Math.max(y1, y2));
  const parts = [
    <View key={`${key}-b`} pointerEvents="none" style={[s.abs, { left: l, width: w, top: lo, height: Math.max(0, Math.round(base) - lo), backgroundColor: color }]} />,
  ];
  if (lo - hi > 0) {
    const leftHigher = y1 < y2;
    parts.push(
      <View
        key={`${key}-t`}
        pointerEvents="none"
        style={[
          s.abs,
          {
            left: l,
            top: hi,
            width: 0,
            height: 0,
            borderBottomWidth: lo - hi,
            borderBottomColor: color,
            ...(leftHigher
              ? { borderRightWidth: w, borderRightColor: 'transparent' }
              : { borderLeftWidth: w, borderLeftColor: 'transparent' }),
          },
        ]}
      />,
    );
  }
  return parts;
};

export const LineChart = ({
  labels,
  sets,
  height = 180,
  max,
  step,
  yFormat = v => String(v),
  integer,
  tip,
}: {
  labels: string[];
  sets: LineSet[];
  height?: number;
  max?: number;
  step?: number;
  yFormat?: (v: number) => string;
  integer?: boolean;
  /** What a tap at a point says (Chart.js' tooltip). */
  tip: (i: number) => Tip | null;
}) => {
  const [index, setIndex] = useState<number | null>(null);
  const values = sets.flatMap(se => se.data.filter((v): v is number => v != null));
  const { top, ticks } = scaleOf(values, max, step, integer);
  const n = labels.length;
  const inset = 6;
  const xs = (w: number) =>
    labels.map((_, i) => (n > 1 ? inset + (i * (w - inset * 2)) / (n - 1) : w / 2));

  return (
    <Frame
      height={height}
      ticks={ticks}
      top={top}
      yFormat={yFormat}
      labels={labels}
      xs={xs}
      slot={w => (n > 1 ? (w - inset * 2) / (n - 1) : w)}
      pick={{ index, set: setIndex }}
      tip={tip}
    >
      {(w, y) => {
        const at = xs(w);
        const base = y(0);
        const out: React.ReactNode[] = [];
        // Fills first, so every line lies over them.
        sets.forEach((se, k) => {
          if (!se.fill) return;
          let prev: number | null = null;
          se.data.forEach((v, i) => {
            if (v == null) return;
            if (prev != null) out.push(area(`f${k}-${i}`, at[prev], y(se.data[prev] as number), at[i], y(v), base, se.fill as string));
            prev = i;
          });
        });
        sets.forEach((se, k) => {
          let prev: number | null = null;
          se.data.forEach((v, i) => {
            if (v == null) return;
            if (prev != null) {
              const x1 = at[prev];
              const y1 = y(se.data[prev] as number);
              const x2 = at[i];
              const y2 = y(v);
              if (se.dashed) {
                const len = Math.hypot(x2 - x1, y2 - y1);
                for (let d = 0; d < len; d += 7) {
                  const e = Math.min(d + 4, len);
                  out.push(
                    segment(`d${k}-${i}-${d}`, x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len, x1 + ((x2 - x1) * e) / len, y1 + ((y2 - y1) * e) / len, se.color, 2),
                  );
                }
              } else {
                out.push(segment(`l${k}-${i}`, x1, y1, x2, y2, se.color, 2));
              }
            }
            prev = i;
          });
        });
        sets.forEach((se, k) => {
          se.data.forEach((v, i) => {
            if (v == null) return;
            const r = (se.point ?? 2) + (index === i ? 2 : 0);
            out.push(
              <View
                key={`p${k}-${i}`}
                pointerEvents="none"
                style={[s.abs, { left: at[i] - r, top: y(v) - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: se.color }]}
              />,
            );
          });
        });
        return out;
      }}
    </Frame>
  );
};

// ── Bars ─────────────────────────────────────────────────────────────────────
export interface BarSet {
  label: string;
  data: (number | null)[];
  color: string;
}

export const BarChart = ({
  labels,
  sets,
  height = 180,
  max,
  step,
  yFormat = v => String(v),
  integer,
  stacked,
  maxBar = 44,
  values,
  rotate,
  tip,
}: {
  labels: string[];
  sets: BarSet[];
  height?: number;
  max?: number;
  step?: number;
  yFormat?: (v: number) => string;
  integer?: boolean;
  /** One bar a label, the sets one on another (Messages a Day). */
  stacked?: boolean;
  /** Chart.js maxBarThickness. */
  maxBar?: number;
  /** Each bar's figure over it (the Admissions Trend). */
  values?: (v: number) => string;
  rotate?: boolean;
  tip: (i: number) => Tip | null;
}) => {
  const [index, setIndex] = useState<number | null>(null);
  const n = labels.length;
  const totals = stacked
    ? labels.map((_, i) => sets.reduce((sum, se) => sum + (se.data[i] ?? 0), 0))
    : sets.flatMap(se => se.data.map(v => v ?? 0));
  const { top, ticks } = scaleOf(totals, max, step, integer);
  const xs = (w: number) => labels.map((_, i) => (w / Math.max(n, 1)) * (i + 0.5));

  return (
    <Frame
      height={height}
      ticks={ticks}
      top={top}
      yFormat={yFormat}
      labels={labels}
      xs={xs}
      slot={w => w / Math.max(n, 1)}
      rotate={rotate}
      pick={{ index, set: setIndex }}
      tip={tip}
    >
      {(w, y) => {
        const slot = w / Math.max(n, 1);
        const base = y(0);
        const k = stacked ? 1 : Math.max(sets.length, 1);
        const bw = Math.max(2, Math.min(maxBar, ((slot * 0.8) / k) * 0.9));
        const groupW = stacked ? bw : (slot * 0.8);
        const out: React.ReactNode[] = [];
        labels.forEach((_, i) => {
          const cx = slot * (i + 0.5);
          const on = index === i;
          if (stacked) {
            let acc = 0;
            sets.forEach((se, j) => {
              const v = se.data[i] ?? 0;
              if (v <= 0) return;
              const t = y(acc + v);
              const b = y(acc);
              acc += v;
              out.push(
                <View
                  key={`s${i}-${j}`}
                  pointerEvents="none"
                  style={[s.abs, s.bar, { left: cx - bw / 2, width: bw, top: t, height: Math.max(1, b - t), backgroundColor: se.color, opacity: index == null || on ? 1 : 0.55 }]}
                />,
              );
            });
          } else {
            sets.forEach((se, j) => {
              const v = se.data[i];
              if (v == null) return;
              const sub = groupW / k;
              const left = cx - groupW / 2 + sub * j + (sub - bw) / 2;
              const t = y(v);
              out.push(
                <View
                  key={`b${i}-${j}`}
                  pointerEvents="none"
                  style={[s.abs, s.bar, { left, width: bw, top: t, height: Math.max(v > 0 ? 1 : 0, base - t), backgroundColor: se.color, opacity: index == null || on ? 1 : 0.55 }]}
                />,
              );
              if (values) {
                out.push(
                  <Text key={`v${i}-${j}`} pointerEvents="none" style={[s.barValue, { left: left + bw / 2 - 24, top: t - 15 }]}>
                    {values(v)}
                  </Text>,
                );
              }
            });
          }
        });
        return out;
      }}
    </Frame>
  );
};

// ── Bars lying down, a row each (Transport Fee by Route) ─────────────────────
export const HBarChart = ({
  labels,
  sets,
  format,
  tip,
  maxHeight = 300,
}: {
  labels: string[];
  sets: BarSet[];
  format: (v: number) => string;
  tip: (i: number) => Tip | null;
  /** Taller than this, the rows scroll inside it (the card keeps its size). */
  maxHeight?: number;
}) => {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState<number | null>(null);
  const { top, ticks } = scaleOf(sets.flatMap(se => se.data.map(v => v ?? 0)));
  const labelW = Math.min(110, Math.max(...labels.map(l => textWidth(l))) + 4);
  const plotW = Math.max(0, width - labelW - 8);
  const x = (v: number) => (Math.max(0, Math.min(v, top)) / (top || 1)) * plotW;
  const row = 34;
  const bh = Math.min(12, (row * 0.8) / Math.max(sets.length, 1) * 0.9);
  const shown = index != null ? tip(index) : null;

  const rows = labels.map((l, i) => (
    <Pressable key={`${l}-${i}`} style={[s.hRow, { height: row }]} onPress={() => setIndex(index === i ? null : i)}>
      <Text style={[s.hLabel, { width: labelW }, index === i && s.hLabelOn]} numberOfLines={1}>
        {l}
      </Text>
      <View style={{ width: plotW, height: row, justifyContent: 'center', gap: 2 }}>
        {ticks.map(t => (
          <View key={t} style={[s.hGrid, { left: Math.round(x(t)) }]} />
        ))}
        {sets.map((se, j) => (
          <View
            key={j}
            style={[s.bar, { width: Math.max((se.data[i] ?? 0) > 0 ? 1 : 0, x(se.data[i] ?? 0)), height: bh, backgroundColor: se.color, opacity: index == null || index === i ? 1 : 0.55 }]}
          />
        ))}
      </View>
    </Pressable>
  ));

  return (
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {labels.length * row > maxHeight ? (
        <View style={{ height: maxHeight }}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
            {rows}
          </ScrollView>
        </View>
      ) : (
        rows
      )}
      <View style={{ marginLeft: labelW + 8, width: plotW, height: 18 }}>
        {ticks.map(t => (
          <Text key={t} numberOfLines={1} style={[s.xTick, { width: 48, left: x(t) - 24 }]}>
            {format(t)}
          </Text>
        ))}
      </View>
      {shown && <TipBox tip={shown} x={0} width={width} inline />}
    </View>
  );
};

// ── Doughnut ─────────────────────────────────────────────────────────────────
// Two parts of a ring, the first from the top round to the right, with the
// panel's key underneath; a tap on the ring or the key names a part.
export const Doughnut = ({
  parts,
  size = 150,
  cutout = 0.7,
  tip,
}: {
  parts: { label: string; value: number; color: string }[];
  size?: number;
  cutout?: number;
  tip: (i: number) => string;
}) => {
  const [index, setIndex] = useState<number | null>(null);
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const r = size / 2;
  const share = total > 0 ? parts[0].value / total : 0;
  const deg = share * 360;
  const hole = size * cutout;

  return (
    <View style={s.donutWrap}>
      <Pressable onPress={() => setIndex(index == null ? 0 : index + 1 < parts.length ? index + 1 : null)}>
        <View style={{ width: size, height: size }}>
          {/* The second part is the whole ring; the first is laid over it. */}
          <View style={[s.abs, { width: size, height: size, borderRadius: r, backgroundColor: parts[1]?.color ?? C.gray400 }]} />
          {deg > 0 && (
            <>
              {/* 0–180°: a left half-disc turning into the right half */}
              <View style={[s.abs, s.clip, { left: r, width: r, height: size }]}>
                <View
                  style={[
                    s.abs,
                    {
                      left: -r,
                      width: r,
                      height: size,
                      borderTopLeftRadius: r,
                      borderBottomLeftRadius: r,
                      backgroundColor: parts[0].color,
                      transformOrigin: 'right center',
                      transform: [{ rotate: `${Math.min(deg, 180)}deg` }],
                    },
                  ]}
                />
              </View>
              {/* 180–360°: a right half-disc turning into the left half */}
              {deg > 180 && (
                <View style={[s.abs, s.clip, { left: 0, width: r, height: size }]}>
                  <View
                    style={[
                      s.abs,
                      {
                        left: r,
                        width: r,
                        height: size,
                        borderTopRightRadius: r,
                        borderBottomRightRadius: r,
                        backgroundColor: parts[0].color,
                        transformOrigin: 'left center',
                        transform: [{ rotate: `${deg - 180}deg` }],
                      },
                    ]}
                  />
                </View>
              )}
            </>
          )}
          <View
            style={[
              s.abs,
              s.donutHole,
              { left: r - hole / 2, top: r - hole / 2, width: hole, height: hole, borderRadius: hole / 2 },
            ]}
          >
            {index != null && (
              <Text style={s.donutText} numberOfLines={3}>
                {tip(index)}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
      <View style={s.donutKey}>
        {parts.map((p, i) => (
          <Pressable key={p.label} style={s.donutKeyItem} onPress={() => setIndex(index === i ? null : i)} hitSlop={6}>
            <View style={[s.donutDot, { backgroundColor: p.color }]} />
            <Text style={[s.donutKeyText, index === i && s.hLabelOn]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

// ── Key ──────────────────────────────────────────────────────────────────────
//   ■ Present  ■ Absent
export const Key = ({ items }: { items: { label: string; color: string }[] }) => (
  <View style={s.key}>
    {items.map(it => (
      <View key={it.label} style={s.keyItem}>
        <View style={[s.keySwatch, { backgroundColor: it.color }]} />
        <Text style={s.keyText}>{it.label}</Text>
      </View>
    ))}
  </View>
);

const __mk_s = () => StyleSheet.create({
  abs: { position: 'absolute' },
  frame: { paddingTop: 4, paddingBottom: 6 },
  frameRow: { flexDirection: 'row' },
  yTick: { position: 'absolute', right: 4, fontSize: 10, color: theme.colors.textMuted, textAlign: 'right' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  xTick: { position: 'absolute', top: 3, fontSize: 10, color: theme.colors.textMuted, textAlign: 'center' },
  xSlant: { position: 'absolute', fontSize: 9, color: theme.colors.textMuted, textAlign: 'right' },
  bar: { borderRadius: 3 },
  barValue: { position: 'absolute', width: 48, textAlign: 'center', fontSize: 10, fontWeight: '600', color: '#374151' },

  tip: {
    position: 'absolute',
    top: 2,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.88)',
    gap: 3,
  },
  tipInline: { position: 'relative', top: 0, alignSelf: 'flex-start', marginTop: 6, maxWidth: '100%' },
  tipTitle: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  tipLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipSwatch: { width: 9, height: 9, borderRadius: 2 },
  tipText: { flexShrink: 1, fontSize: 11, color: '#FFFFFF' },
  tipFooter: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },

  hRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hLabel: { fontSize: 11, color: theme.colors.textSecondary, textAlign: 'right' },
  hLabelOn: { color: theme.colors.textPrimary, fontWeight: '600' },
  hGrid: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },

  clip: { top: 0, overflow: 'hidden' },
  donutWrap: { alignItems: 'center', paddingVertical: 8, gap: 12 },
  donutHole: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, paddingHorizontal: 8 },
  donutText: { fontSize: 11, lineHeight: 15, fontWeight: '600', color: theme.colors.textPrimary, textAlign: 'center' },
  donutKey: { flexDirection: 'row', gap: 16 },
  donutKeyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  donutDot: { width: 10, height: 10, borderRadius: 5 },
  donutKeyText: { fontSize: 12, color: theme.colors.textSecondary },

  key: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, paddingBottom: 4 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  keySwatch: { width: 10, height: 10, borderRadius: 2 },
  keyText: { fontSize: 11, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

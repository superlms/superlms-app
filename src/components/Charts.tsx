import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import VectorIcon from './VectorIcon';
import { theme, onThemeChange } from '../utils/theme';

// ─── Chip ────────────────────────────────────────────────────────────────────
export const Chip = ({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: string;
  label: string;
  value?: string;
  color: string;
  bg: string;
}) => (
  <View style={[c.chip, { backgroundColor: bg }]}>
    <VectorIcon iconSet="Ionicons" iconName={icon} size={13} color={color} />
    <Text style={[c.chipLabel, { color }]} numberOfLines={1}>
      {label}
      {value != null ? <Text style={c.chipValue}> {value}</Text> : null}
    </Text>
  </View>
);

// ─── Donut (arc progress ring, no SVG) ───────────────────────────────────────
export const Donut = ({
  size = 110,
  stroke = 12,
  pct = 0,
  color,
  track = theme.colors.border,
  label,
  sub,
}: {
  size?: number;
  stroke?: number;
  pct?: number;
  color: string;
  track?: string;
  label?: string;
  sub?: string;
}) => {
  const half = size / 2;
  const p = Math.min(Math.max(pct, 0), 100);
  const angle = (p / 100) * 360;

  const ring = {
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: stroke,
    position: 'absolute' as const,
  };

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Track */}
      <View style={[ring, { borderColor: track }]} />

      {/* Right half: fills 0–180° */}
      <View style={[d.clip, { width: half, height: size, right: 0 }]}>
        <View
          style={[
            ring,
            {
              left: -half,
              borderTopColor: color,
              borderRightColor: color,
              borderBottomColor: 'transparent',
              borderLeftColor: 'transparent',
              transform: [{ rotate: `${angle <= 180 ? angle - 180 : 0}deg` }],
            },
          ]}
        />
      </View>

      {/* Left half: fills 180–360° */}
      {angle > 180 && (
        <View style={[d.clip, { width: half, height: size, left: 0 }]}>
          <View
            style={[
              ring,
              {
                left: 0,
                borderBottomColor: color,
                borderLeftColor: color,
                borderTopColor: 'transparent',
                borderRightColor: 'transparent',
                transform: [{ rotate: `${angle - 360}deg` }],
              },
            ]}
          />
        </View>
      )}

      <View style={{ alignItems: 'center' }}>
        {label != null && (
          <Text style={{ fontSize: size * 0.22, fontWeight: '900', color }}>
            {label}
          </Text>
        )}
        {sub != null && <Text style={d.donutSub}>{sub}</Text>}
      </View>
    </View>
  );
};

// ─── Vertical mini bar chart ─────────────────────────────────────────────────
export const MiniBars = ({
  data,
  maxVal,
  color,
  height = 120,
  showValue = true,
}: {
  data: { label: string; value: number; color?: string }[];
  maxVal: number;
  color: string;
  height?: number;
  showValue?: boolean;
}) => (
  <View style={[mb.wrap, { height }]}>
    {data.map((dd, i) => {
      const pct = maxVal > 0 ? Math.max((dd.value / maxVal) * 100, 2) : 2;
      return (
        <View key={i} style={mb.col}>
          {showValue && <Text style={mb.val}>{dd.value}</Text>}
          <View style={mb.barBg}>
            <View
              style={[
                mb.barFill,
                { height: `${pct}%`, backgroundColor: dd.color ?? color },
              ]}
            />
          </View>
          <Text style={mb.label} numberOfLines={1}>
            {dd.label}
          </Text>
        </View>
      );
    })}
  </View>
);

// ─── Horizontal progress row ─────────────────────────────────────────────────
export const HBar = ({
  label,
  value,
  max = 100,
  color,
  suffix = '%',
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
  suffix?: string;
}) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={hb.row}>
      <View style={[hb.dot, { backgroundColor: color }]} />
      <Text style={hb.name} numberOfLines={1}>
        {label}
      </Text>
      <View style={hb.track}>
        <View style={[hb.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[hb.val, { color }]}>
        {value}
        {suffix}
      </Text>
    </View>
  );
};

// ─── Stacked horizontal bar + legend ─────────────────────────────────────────
export const StackedBar = ({
  segments,
  height = 14,
}: {
  segments: { label: string; value: number; color: string }[];
  height?: number;
}) => {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <View style={{ gap: 10 }}>
      <View style={[sbar.track, { height }]}>
        {segments.map((seg, i) => (
          <View
            key={i}
            style={{
              width: `${(seg.value / total) * 100}%`,
              backgroundColor: seg.color,
            }}
          />
        ))}
      </View>
      <View style={sbar.legend}>
        {segments.map((seg, i) => (
          <View key={i} style={sbar.legendItem}>
            <View style={[sbar.legendDot, { backgroundColor: seg.color }]} />
            <Text style={sbar.legendText}>
              {seg.label}{' '}
              <Text style={{ color: seg.color, fontWeight: '800' }}>
                {seg.value}
              </Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Week strip (day cells coloured by status) ───────────────────────────────
export const WeekDots = ({
  days,
}: {
  days: { label: string; color: string; bg: string }[];
}) => (
  <View style={wd.row}>
    {days.map((dd, i) => (
      <View key={i} style={[wd.cell, { backgroundColor: dd.bg }]}>
        <View style={[wd.dot, { backgroundColor: dd.color }]} />
        <Text style={wd.label}>{dd.label}</Text>
      </View>
    ))}
  </View>
);

// ─── Card wrapper with titled header ─────────────────────────────────────────
export const ChartCard = ({
  icon,
  iconBg,
  iconColor,
  title,
  right,
  children,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <View style={cc.card}>
    <View style={cc.head}>
      <View style={[cc.icon, { backgroundColor: iconBg }]}>
        <VectorIcon iconSet="Ionicons" iconName={icon} size={15} color={iconColor} />
      </View>
      <Text style={cc.title}>{title}</Text>
      {right}
    </View>
    {children}
  </View>
);

const __mk_c = () => StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
  },
  chipLabel: { fontSize: 12, fontWeight: '700' },
  chipValue: { fontWeight: '900' },
});

const __mk_d = () => StyleSheet.create({
  clip: { position: 'absolute', overflow: 'hidden' },
  donutSub: { fontSize: 9, color: theme.colors.textMuted, fontWeight: '700' },
});

const __mk_mb = () => StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 18 },
  col: { flex: 1, alignItems: 'center', gap: 5 },
  val: { fontSize: 10, fontWeight: '800', color: theme.colors.textSecondary },
  barBg: {
    flex: 1,
    width: '70%',
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});

const __mk_hb = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    width: 82,
  },
  track: {
    flex: 1,
    height: 7,
    backgroundColor: theme.colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
  val: { fontSize: 11, fontWeight: '800', width: 38, textAlign: 'right' },
});

const __mk_sbar = () => StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: theme.radius.full,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '500' },
});

const __mk_wd = () => StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary },
});

const __mk_cc = () => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 12,
    elevation: 2,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let c = __mk_c();
onThemeChange(() => { c = __mk_c(); });
let d = __mk_d();
onThemeChange(() => { d = __mk_d(); });
let mb = __mk_mb();
onThemeChange(() => { mb = __mk_mb(); });
let hb = __mk_hb();
onThemeChange(() => { hb = __mk_hb(); });
let sbar = __mk_sbar();
onThemeChange(() => { sbar = __mk_sbar(); });
let wd = __mk_wd();
onThemeChange(() => { wd = __mk_wd(); });
let cc = __mk_cc();
onThemeChange(() => { cc = __mk_cc(); });

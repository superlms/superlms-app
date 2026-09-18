import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import { theme, onThemeChange } from '../../utils/theme';
import { Card, MiniStats, Pill } from '../home/dashboardUi';

/**
 * What both roles' Analytics share: the row of tabs under the header, one per
 * part of the app, and the big figure each tab opens with.
 */

// ── Tabs ─────────────────────────────────────────────────────────────────────
//   (Overview)  Attendance   Exams   Homework   Quiz …
export const Tabs = <T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) => (
  <View style={s.tabsBar}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
      {tabs.map(t => {
        const on = t.key === active;
        return (
          <TouchableOpacity
            key={t.key}
            activeOpacity={0.7}
            onPress={() => onChange(t.key)}
            style={[s.tab, on && s.tabOn]}
          >
            <Text style={[s.tabText, on && s.tabTextOn]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
);

// ── The figure a tab opens with ──────────────────────────────────────────────
//   ATTENDANCE · LAST SIX MONTHS
//   69%  (Good)
//   46 of 67 working days present
//   ────────────────────────────────
//   71%        │ 2 days     │ 21
//   This month │ Streak     │ Absent
export const Hero = ({
  kicker,
  value,
  low,
  band,
  caption,
  stats,
  children,
}: {
  kicker: string;
  value: string;
  low?: boolean;
  band?: string | null;
  caption?: string | null;
  stats?: { label: string; value: string; low?: boolean }[];
  children?: React.ReactNode;
}) => (
  <Card flush>
    <Text style={s.kicker}>{kicker.toUpperCase()}</Text>
    <View style={s.heroLine}>
      <Text style={[s.big, low && s.low]} numberOfLines={1}>
        {value}
      </Text>
      {!!band && <Pill text={band} tone={low ? 'bad' : 'accent'} />}
    </View>
    {!!caption && <Text style={s.caption}>{caption}</Text>}
    {!!stats && stats.length > 0 && <MiniStats items={stats} />}
    {children}
  </Card>
);

// ── Words ────────────────────────────────────────────────────────────────────
export const monthShort = (m: string) => moment(m, 'YYYY-MM').format('MMM');
export const monthLong = (m: string) => moment(m, 'YYYY-MM').format('MMMM YYYY');
export const pctOrDash = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

// "▲ 4% vs Aug", "Level with class" — the change, in words, for a pill or a line.
export const changeText = (now: number | null | undefined, before: number | null | undefined, vs: string) => {
  if (now == null || before == null) return null;
  const d = Math.round(now - before);
  if (d === 0) return `Level with ${vs}`;
  return `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}% vs ${vs}`;
};

const __mk_s = () => StyleSheet.create({
  low: { color: theme.colors.danger },

  // Tabs
  tabsBar: {
    backgroundColor: theme.colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  tabs: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  tabOn: { backgroundColor: theme.colors.primary + '14', borderColor: theme.colors.primary + '40' },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextOn: { color: theme.colors.primary, fontWeight: '600' },

  // Hero
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  big: { fontSize: 34, fontWeight: '700', lineHeight: 42, color: theme.colors.textPrimary, flexShrink: 1 },
  caption: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, lineHeight: 19 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * The pieces the two dashboards and Analytics share: a strip of headline
 * numbers, sections on full-width lines, and rows that carry a percentage as a
 * thin bar. No tinted stat tiles, chips, donuts or emoji — the only colour is a
 * figure that needs attention.
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

// ── Headline numbers ─────────────────────────────────────────────────────────
//   89%        │ 64%        │ 7          │ 2
//   Attendance │ Avg score  │ Homework   │ Exams
export interface Stat {
  label: string;
  value: string;
  low?: boolean;
  onPress?: () => void;
}

export const StatStrip = ({ stats }: { stats: Stat[] }) => (
  <View style={s.stats}>
    {stats.map((st, i) => {
      const body = (
        <>
          <Text style={[s.statValue, st.low && s.low]} numberOfLines={1}>
            {st.value}
          </Text>
          <Text style={s.statLabel} numberOfLines={1}>
            {st.label}
          </Text>
        </>
      );
      const style = [s.stat, i > 0 && s.statDivider];
      return st.onPress ? (
        <TouchableOpacity key={st.label} style={style} activeOpacity={0.6} onPress={st.onPress}>
          {body}
        </TouchableOpacity>
      ) : (
        <View key={st.label} style={style}>
          {body}
        </View>
      );
    })}
  </View>
);

// ── Section ──────────────────────────────────────────────────────────────────
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

// ── A percentage as a thin bar ───────────────────────────────────────────────
export const Bar = ({ pct, low }: { pct: number; low?: boolean }) => (
  <View style={s.barBg}>
    <View
      style={[s.barFill, { width: `${Math.max(2, Math.min(pct, 100))}%` as any }, low && s.barFillLow]}
    />
  </View>
);

//   Mathematics                                            64%
//   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━───────────────────
//   320 of 500 marks
export const PctRow = ({
  label,
  pct,
  meta,
  low,
  isLast,
}: {
  label: string;
  pct: number;
  meta?: string | null;
  low?: boolean;
  isLast?: boolean;
}) => (
  <View style={[s.pctRow, !isLast && s.rowDivider]}>
    <View style={s.pctLine}>
      <Text style={s.pctLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[s.pctValue, low && s.low]}>{pct}%</Text>
    </View>
    <Bar pct={pct} low={low} />
    {!!meta && <Text style={s.pctMeta}>{meta}</Text>}
  </View>
);

// ── Label / value rows ───────────────────────────────────────────────────────
export const InfoRows = ({ rows }: { rows: [string, string][] }) => (
  <View>
    {rows.map(([label, value], i) => (
      <View key={label} style={[s.infoRow, i < rows.length - 1 && s.rowDivider]}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value}</Text>
      </View>
    ))}
  </View>
);

// ── A plain row: something to lead with, a title and a line, and a trailing mark
export const LineRow = ({
  lead,
  title,
  meta,
  trailing,
  muted,
  onPress,
  isLast,
}: {
  lead?: React.ReactNode;
  title: string;
  meta?: string | null;
  trailing?: React.ReactNode;
  muted?: boolean;
  onPress?: () => void;
  isLast: boolean;
}) => {
  const body = (
    <>
      {lead}
      <View style={s.lineBody}>
        <Text style={[s.lineTitle, muted && s.lineTitleMuted]} numberOfLines={2}>
          {title}
        </Text>
        {!!meta && (
          <Text style={s.lineMeta} numberOfLines={1}>
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

// ONGOING, NEXT, DONE — in small capitals, the accent only for what is live.
export const Tag = ({ text, accent }: { text: string; accent?: boolean }) => (
  <Text style={[s.tag, accent && s.tagAccent]}>{text.toUpperCase()}</Text>
);

export const Chevron = () => (
  <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
);

// ── This week's attendance ───────────────────────────────────────────────────
// Each school day as its initial, in a soft tint for how it went — the same
// reading as the attendance month grid.
export const WeekStrip = ({ days }: { days: { label: string; status: string }[] }) => (
  <View style={s.week}>
    {days.map((d, i) => {
      const present = d.status === 'present';
      const absent = d.status === 'absent';
      return (
        <View key={`${d.label}-${i}`} style={s.weekDay}>
          <View style={[s.weekDot, present && s.weekPresent, absent && s.weekAbsent]}>
            <Text style={[s.weekLetter, present && s.weekLetterPresent, absent && s.weekLetterAbsent]}>
              {d.label.slice(0, 1)}
            </Text>
          </View>
        </View>
      );
    })}
  </View>
);

// ── Loading / failing ────────────────────────────────────────────────────────
export const DashSkeleton = () => (
  <View>
    <View style={s.skHead}>
      <Skeleton width="55%" height={12} />
    </View>
    <View style={s.stats}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={[s.stat, i > 0 && s.statDivider, s.skStat]}>
          <Skeleton width={40} height={22} />
          <Skeleton width={56} height={11} />
        </View>
      ))}
    </View>
    {[0, 1].map(i => (
      <View key={i}>
        <View style={s.divider} />
        <View style={[s.section, s.skSection]}>
          <Skeleton width="35%" height={13} />
          <Skeleton width="100%" height={14} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="90%" height={14} />
        </View>
      </View>
    ))}
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
  low: { color: theme.colors.danger },

  // Headline numbers
  stats: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16 },
  stat: { flex: 1, paddingLeft: 14 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.border },
  statValue: { fontSize: 22, fontWeight: '600', lineHeight: 28, color: theme.colors.textPrimary },
  statLabel: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },

  // Section
  divider: { height: 1, backgroundColor: theme.colors.divider },
  section: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  sectionAction: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },

  // Bar rows
  barBg: { height: 4, borderRadius: 2, backgroundColor: theme.colors.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2, backgroundColor: theme.colors.primary },
  barFillLow: { backgroundColor: theme.colors.danger },
  pctRow: { paddingVertical: 12, gap: 7 },
  pctLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pctLabel: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  pctValue: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  pctMeta: { fontSize: 12, color: theme.colors.textMuted },

  // Label / value
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  infoLabel: { flex: 1, fontSize: 14, color: theme.colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },

  // Plain rows
  line: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  lineBody: { flex: 1, gap: 3 },
  lineTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  lineTitleMuted: { color: theme.colors.textMuted },
  lineMeta: { fontSize: 12, color: theme.colors.textMuted },
  tag: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },
  tagAccent: { color: theme.colors.primary },

  // Week
  week: { flexDirection: 'row', gap: 8, paddingTop: 4, paddingBottom: 8 },
  weekDay: { flex: 1, alignItems: 'center' },
  weekDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  weekPresent: { backgroundColor: theme.colors.success + '26' },
  weekAbsent: { backgroundColor: theme.colors.danger + '22' },
  weekLetter: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  weekLetterPresent: { color: '#15803D' },
  weekLetterAbsent: { color: theme.colors.danger },

  // Loading
  skHead: { paddingHorizontal: 20, paddingTop: 16 },
  skStat: { gap: 6 },
  skSection: { gap: 12, paddingBottom: 18 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

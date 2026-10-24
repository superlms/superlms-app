import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { Card, SOFT } from '../home/dashboardUi';
import Select, { type SelectOption } from '../../components/Select';
import { Skeleton } from '../../components/Skeleton';

/**
 * What the admin Dashboard and Analytics draw the web panel's sections with, in
 * the app's own look: the panel's quiet section headings, figures in a row or a
 * grid, label-and-value lines, a bar per row in the panel's green / amber / red,
 * and a compact dropdown for a filter.
 */

// ── Section heading ──────────────────────────────────────────────────────────
//   OVERVIEW ───────────────────────────────
//   Last 30 days
export const SectionHeading = ({ title, sub }: { title: string; sub?: string | null }) => (
  <View style={s.section}>
    <View style={s.sectionLine}>
      <Text style={s.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={s.sectionRule} />
    </View>
    {!!sub && <Text style={s.sectionSub}>{sub}</Text>}
  </View>
);

// ── Figures side by side, centred ────────────────────────────────────────────
//   21        1        0        87.5%
//   PRESENT   ABSENT   HALF     RATE
export const CenterFigures = ({
  items,
  top = true,
}: {
  items: { value: string; label: string; color?: string }[];
  /** A hairline over them, under a chart. */
  top?: boolean;
}) => (
  <View style={[s.figures, top && s.figuresTop]}>
    {items.map(it => (
      <View key={it.label} style={s.figure}>
        <Text style={[s.figureValue, !!it.color && { color: it.color }]} numberOfLines={1}>
          {it.value}
        </Text>
        <Text style={s.figureLabel} numberOfLines={2}>
          {it.label.toUpperCase()}
        </Text>
      </View>
    ))}
  </View>
);

// ── Figures in a grid, inside one card ───────────────────────────────────────
//   TOTAL FEE      │ COLLECTED
//   ₹3,49,400      │ ₹1,23,700
export const StatCells = ({
  items,
  columns = 2,
}: {
  items: { label: string; value: string; sub?: string | null; color?: string }[];
  columns?: number;
}) => {
  const rows: typeof items[] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View>
      {rows.map((row, r) => (
        <View key={r} style={[s.cellRow, r < rows.length - 1 && s.cellRowLine]}>
          {row.map((it, c) => (
            <View key={it.label} style={[s.cell, c > 0 && s.cellLine]}>
              <Text style={s.cellLabel} numberOfLines={1}>
                {it.label.toUpperCase()}
              </Text>
              <Text style={[s.cellValue, !!it.color && { color: it.color }]} numberOfLines={1} adjustsFontSizeToFit>
                {it.value}
              </Text>
              {!!it.sub && (
                <Text style={s.cellSub} numberOfLines={2}>
                  {it.sub}
                </Text>
              )}
            </View>
          ))}
          {row.length < columns && Array.from({ length: columns - row.length }).map((_, i) => <View key={`e${i}`} style={[s.cell, s.cellLine]} />)}
        </View>
      ))}
    </View>
  );
};

// ── A label and its value, line by line ──────────────────────────────────────
//   Collected                        ₹1,23,700
//   Pending                          ₹2,25,700
export const ValueLines = ({
  rows,
}: {
  rows: { label: string; value: string; rule?: boolean; color?: string }[];
}) => (
  <View style={s.values}>
    {rows.map(r => (
      <View key={r.label} style={[s.valueLine, r.rule && s.valueRule]}>
        <Text style={s.valueLabel}>{r.label}</Text>
        <Text style={[s.valueText, !!r.color && { color: r.color }]}>{r.value}</Text>
      </View>
    ))}
  </View>
);

// ── A thin bar with its label and figure ─────────────────────────────────────
//   Progress                                   35.4%
//   ━━━━━━━━━━━━━━━━━──────────────────────────────
export const Progress = ({
  label,
  pct,
  value,
  color = theme.colors.primary,
  sub,
}: {
  label?: string | null;
  pct: number;
  value?: string;
  color?: string;
  sub?: string | null;
}) => (
  <View style={s.progress}>
    {(!!label || !!value) && (
      <View style={s.progressHead}>
        <Text style={s.progressLabel}>{label}</Text>
        {!!value && <Text style={s.progressValue}>{value}</Text>}
      </View>
    )}
    <View style={s.track}>
      <View style={[s.fill, { width: `${Math.max(0, Math.min(pct, 100))}%` as any, backgroundColor: color }]} />
    </View>
    {!!sub && <Text style={s.progressSub}>{sub}</Text>}
  </View>
);

// ── A row of a ranking: its place, its name, a bar and the figure ────────────
//   1   Class 2      ━━━━━━━━━━━━━━━━━━━━━━━━──────   86.2%
export const RankBar = ({
  rank,
  label,
  pct,
  color,
  isLast,
}: {
  rank?: number;
  label: string;
  pct: number;
  color: string;
  isLast?: boolean;
}) => (
  <View style={[s.rank, !isLast && s.rankLine]}>
    {rank != null && <Text style={s.rankNo}>{rank}</Text>}
    <Text style={s.rankLabel} numberOfLines={1}>
      {label}
    </Text>
    <View style={s.rankTrack}>
      <View style={[s.fill, { width: `${Math.max(0, Math.min(pct, 100))}%` as any, backgroundColor: color }]} />
    </View>
    <Text style={s.rankPct}>{pct}%</Text>
  </View>
);

// The panel's bands: green, amber and red for a good, a middling and a low figure.
export const bandColor = (pct: number, good: number, fair: number) =>
  pct >= good ? '#10B981' : pct >= fair ? '#F59E0B' : '#EF4444';

// ── A photo, or the name's first letter ──────────────────────────────────────
export const Avatar = ({ uri, name, size = 36 }: { uri?: string | null; name?: string | null; size?: number }) =>
  uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: SOFT }} />
  ) : (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={s.avatarText}>{(name ?? '').trim().slice(0, 1).toUpperCase() || '•'}</Text>
    </View>
  );

// ── A small coloured word ────────────────────────────────────────────────────
export const Tag = ({ text, color, bg }: { text: string; color: string; bg: string }) => (
  <View style={[s.tag, { backgroundColor: bg }]}>
    <Text style={[s.tagText, { color }]} numberOfLines={1}>
      {text}
    </Text>
  </View>
);

// ── A filter's dropdown, compact ─────────────────────────────────────────────
export const Filter = ({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: string | number;
  options: SelectOption[];
  onChange: (v: string | number) => void;
}) => (
  <View style={s.filter}>
    <Select placeholder={title} value={value} options={options} onChange={onChange} plain />
  </View>
);

// ── A plain link at a card's foot ────────────────────────────────────────────
export const FootButton = ({ label, onPress }: { label: string; onPress?: () => void }) =>
  onPress ? (
    <TouchableOpacity style={s.foot} activeOpacity={0.7} onPress={onPress}>
      <Text style={s.footText}>{label}</Text>
    </TouchableOpacity>
  ) : null;


// ── Loading: the pages' own cards, greyed ────────────────────────────────────
const SkHeading = () => (
  <View style={s.section}>
    <View style={s.sectionLine}>
      <Skeleton width={90} height={10} />
      <View style={s.sectionRule} />
    </View>
  </View>
);

const SkKpis = ({ count }: { count: number }) => (
  <View style={s.skKpis}>
    {Array.from({ length: Math.ceil(count / 2) }).map((_, r) => (
      <View key={r} style={s.skKpiRow}>
        {[0, 1].map(c => (
          <View key={c} style={s.skKpi}>
            <View style={s.skKpiHead}>
              <Skeleton width={26} height={26} radius={8} />
              <Skeleton width="55%" height={11} />
            </View>
            <Skeleton width={64} height={22} />
            <Skeleton width="75%" height={10} />
          </View>
        ))}
      </View>
    ))}
  </View>
);

const SkHead = ({ sub = true }: { sub?: boolean }) => (
  <View style={s.skHead}>
    <Skeleton width={30} height={30} radius={9} />
    <View style={s.skHeadText}>
      <Skeleton width="45%" height={13} />
      {sub && <Skeleton width="65%" height={10} />}
    </View>
  </View>
);

// Columns of a graph, rising and falling as data would.
const SkChart = ({ height = 150, bars = 14 }: { height?: number; bars?: number }) => (
  <View style={[s.skChart, { height }]}>
    {Array.from({ length: bars }).map((_, i) => (
      <View key={i} style={s.skBarSlot}>
        <Skeleton width="100%" height={Math.round(height * (0.3 + 0.55 * Math.abs(Math.sin(i * 1.3 + 0.6))))} radius={3} />
      </View>
    ))}
  </View>
);

const SkLines = ({ rows }: { rows: number }) => (
  <View style={s.skLines}>
    {Array.from({ length: rows }).map((_, i) => (
      <View key={i} style={s.skLine}>
        <Skeleton width={i % 2 ? '38%' : '50%'} height={12} />
        <Skeleton width={56} height={12} />
      </View>
    ))}
  </View>
);

const SkBars = ({ rows }: { rows: number }) => (
  <View style={s.skLines}>
    {Array.from({ length: rows }).map((_, i) => (
      <View key={i} style={s.skBarRow}>
        <View style={s.skLine}>
          <Skeleton width={i % 2 ? '42%' : '55%'} height={12} />
          <Skeleton width={40} height={12} />
        </View>
        <Skeleton width="100%" height={6} radius={3} />
      </View>
    ))}
  </View>
);

const SkFigures = ({ count }: { count: number }) => (
  <View style={[s.figures, s.figuresTop]}>
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={[s.figure, s.skFigure]}>
        <Skeleton width={40} height={16} />
        <Skeleton width={46} height={9} />
      </View>
    ))}
  </View>
);

/** The Dashboard while it loads: date, search, Overview, Quick Access, the trends and the fee. */
export const PanelHomeSkeleton = () => (
  <View>
    <View style={s.skPage}>
      <Skeleton width="45%" height={11} />
    </View>
    <View style={s.skSearch}>
      <Skeleton width="100%" height={44} radius={12} />
    </View>
    <SkHeading />
    <SkKpis count={4} />
    <Card>
      <SkBars rows={3} />
    </Card>
    <SkHeading />
    <View style={s.skQuick}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={s.skQuickTile}>
          <Skeleton width={40} height={40} radius={10} />
          <Skeleton width="60%" height={10} />
        </View>
      ))}
    </View>
    <SkHeading />
    {[0, 1].map(i => (
      <Card key={i}>
        <SkHead sub={false} />
        <SkChart height={140} bars={18} />
        <SkFigures count={4} />
      </Card>
    ))}
    <SkHeading />
    <Card>
      <SkHead sub={false} />
      <Skeleton width={120} height={22} />
      <SkChart height={150} bars={20} />
    </Card>
    <Card>
      <SkHead sub={false} />
      <SkLines rows={4} />
    </Card>
  </View>
);

/** Analytics while it loads: the headline, Key Metrics, then the attendance graphs and ranking. */
export const PanelAnalyticsSkeleton = () => (
  <View>
    <View style={s.skPage}>
      <Skeleton width="45%" height={11} />
    </View>
    <Card>
      <SkFigures count={3} />
    </Card>
    <SkHeading />
    <SkKpis count={8} />
    <SkHeading />
    <Card>
      <SkHead />
      <SkChart height={170} bars={20} />
    </Card>
    <Card>
      <SkHead />
      <View style={s.skDonut}>
        <Skeleton width={150} height={150} radius={75} />
      </View>
      <SkFigures count={2} />
    </Card>
    {[0, 1].map(i => (
      <Card key={i}>
        <SkHead />
        <SkChart height={140} bars={7} />
      </Card>
    ))}
    <Card>
      <SkHead />
      <SkBars rows={5} />
    </Card>
  </View>
);

const __mk_s = () => StyleSheet.create({
  section: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 2 },
  sectionLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: theme.colors.textMuted },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  sectionSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  figures: { flexDirection: 'row', paddingVertical: 10 },
  figuresTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, marginTop: 6 },
  figure: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  figureValue: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  figureLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.4, color: theme.colors.textMuted, marginTop: 2, textAlign: 'center' },

  cellRow: { flexDirection: 'row' },
  cellRowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  cell: { flex: 1, paddingVertical: 12, paddingHorizontal: 4, minWidth: 0 },
  cellLine: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.border, paddingLeft: 12 },
  cellLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, color: theme.colors.textMuted },
  cellValue: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 5 },
  cellSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },

  values: { paddingVertical: 6 },
  valueLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 6 },
  valueRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, marginTop: 4, paddingTop: 10 },
  valueLabel: { fontSize: 14, color: theme.colors.textSecondary },
  valueText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },

  progress: { paddingVertical: 8, gap: 6 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 12, color: theme.colors.textMuted },
  progressValue: { fontSize: 12, fontWeight: '600', color: theme.colors.textPrimary },
  progressSub: { fontSize: 12, color: theme.colors.textMuted },
  track: { height: 6, borderRadius: 3, backgroundColor: SOFT, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },

  rank: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  rankLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rankNo: { width: 20, fontSize: 12, color: theme.colors.textMuted },
  rankLabel: { width: 92, fontSize: 13, color: theme.colors.textPrimary },
  rankTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: SOFT, overflow: 'hidden' },
  rankPct: { width: 52, textAlign: 'right', fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },

  avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: SOFT },
  avatarText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },

  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  tagText: { fontSize: 11, fontWeight: '600' },

  filter: { flex: 1, minWidth: 0 },

  foot: {
    marginTop: 8,
    marginBottom: 6,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  footText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  // Loading
  skPage: { paddingHorizontal: 20, paddingTop: 16 },
  skSearch: { paddingHorizontal: 16, paddingTop: 12 },
  skKpis: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  skKpiRow: { flexDirection: 'row', gap: 10 },
  skKpi: {
    flex: 1,
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  skKpiHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  skHeadText: { flex: 1, gap: 6 },
  skChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 8 },
  skBarSlot: { flex: 1 },
  skLines: { gap: 14, paddingVertical: 8 },
  skLine: { flexDirection: 'row', justifyContent: 'space-between' },
  skBarRow: { gap: 8 },
  skFigure: { gap: 6 },
  skQuick: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  skQuickTile: {
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
  skDonut: { alignItems: 'center', paddingVertical: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

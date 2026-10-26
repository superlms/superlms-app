import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { DateSheet, OptionSheet } from './adminFormUi';
import { DropPill } from './adminTransportUi';

/**
 * The pieces the admin Fee sections share, drawn as the Students list is: a
 * white page, a count over plain rows with a line between them, a small tile
 * at the head of a group. The panel's sub-tabs are the underlined strip
 * (UnderlineTabs), its grey "Filter by:" band is a row of pills under them,
 * and its cards are groups on the page — a heading row with its actions, the
 * lines numbered as the panel numbers them, and a Total.
 */

/** ₹1,234.50 — the panel's number_format(…, 2). */
export const rupees = (n?: number | string | null) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** ₹1,235 — the panel's number_format(…, 0). */
export const rupees0 = (n?: number | string | null) =>
  `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

/** 25 → "25%", 8.33 → "8.33%". */
export const pct = (n?: number | string | null) => `${Math.round(Number(n || 0) * 100) / 100}%`;

/** "2026-05-10" → "10 May 2026". */
export const dmy = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ── Header buttons, as the Students header has them ─────────────────────────
export const HeadBtn = ({ icon, onPress, busy, disabled }: { icon: string; onPress: () => void; busy?: boolean; disabled?: boolean }) => (
  <TouchableOpacity onPress={onPress} disabled={busy || disabled} hitSlop={10} activeOpacity={0.6} style={[s.headBtn, disabled && s.off]}>
    {busy ? (
      <ActivityIndicator size="small" color={theme.colors.primary} />
    ) : (
      <VectorIcon iconSet="Ionicons" iconName={icon} size={19} color={theme.colors.textPrimary} />
    )}
  </TouchableOpacity>
);

export const HeadActions = ({ children }: { children: React.ReactNode }) => <View style={s.headActions}>{children}</View>;

/** A worded header button — "Add Dues", "Waiver" — where an icon alone would not say it. */
export const HeadLink = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
  <TouchableOpacity onPress={onPress} disabled={disabled} hitSlop={8} activeOpacity={0.6} style={[s.headLink, disabled && s.off]}>
    <Text style={s.headLinkText}>{label}</Text>
  </TouchableOpacity>
);

// ── A form's repeating rows ─────────────────────────────────────────────────
/** "+ Add row" under a form's rows. */
export const AddRowButton = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity style={s.addRow} onPress={onPress} activeOpacity={0.6}>
    <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
    <Text style={s.addRowText}>{label}</Text>
  </TouchableOpacity>
);

/** × beside a row that can go. */
export const RemoveButton = ({ onPress, label = 'Remove' }: { onPress: () => void; label?: string }) => (
  <TouchableOpacity style={s.remove} onPress={onPress} hitSlop={8} activeOpacity={0.6} accessibilityLabel={label}>
    <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
  </TouchableOpacity>
);

/** A numbered row's head in a form: "#2" on the left, × on the right. */
export const RowHead = ({ title, sub, onRemove }: { title: string; sub?: string | null; onRemove?: () => void }) => (
  <View style={s.rowHead}>
    <Text style={s.rowHeadTitle}>{title}</Text>
    {!!sub && <Text style={s.rowHeadSub}>{sub}</Text>}
    <View style={s.flex} />
    {!!onRemove && <RemoveButton onPress={onRemove} />}
  </View>
);

// ── The grey "Filter by:" band: pills in a row ──────────────────────────────
export const Band = ({ children, note }: { children: React.ReactNode; note?: string | null }) => (
  <View style={s.band}>
    <View style={s.bandRow}>{children}</View>
    {!!note && <Text style={s.bandNote}>{note}</Text>}
  </View>
);

/** A pill that opens a list of choices — the panel's select in the band. */
export function PickPill<K extends string>({
  title,
  label,
  active,
  options,
  value,
  onPick,
  disabled,
}: {
  title: string;
  label: string;
  active?: boolean;
  options: { key: K; label: string; sub?: string }[];
  value: K | null;
  onPick: (k: K) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <View style={disabled && s.off} pointerEvents={disabled ? 'none' : 'auto'}>
        <DropPill label={label} active={active} onPress={() => setOpen(true)} />
      </View>
      <OptionSheet
        visible={open}
        title={title}
        options={options}
        selected={value !== null ? [value] : []}
        onPick={k => onPick(k as K)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/** "Clear" at the end of the band, as the panel has it once a filter is set. */
export const ClearPill = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={s.clear} onPress={onPress} activeOpacity={0.6} hitSlop={6}>
    <VectorIcon iconSet="Ionicons" iconName="close" size={12} color={theme.colors.danger} />
    <Text style={s.clearText}>Clear</Text>
  </TouchableOpacity>
);

// ── The figures a header strip carries ──────────────────────────────────────
//   Total: 12 · Academic: 12 · Transport: 0
export const Strip = ({ items }: { items: { label: string; value: string | number; color?: string }[] }) => (
  <Text style={s.strip}>
    {items.map((it, i) => (
      <Text key={it.label}>
        {i > 0 && <Text style={s.stripDot}>{'  ·  '}</Text>}
        {it.label}: <Text style={[s.stripValue, !!it.color && { color: it.color }]}>{String(it.value)}</Text>
      </Text>
    ))}
  </Text>
);

// ── A group's heading: a tile, its name, a line under it, and its actions ──
//   [▣]  CLASS 5 · A                          👁  ✎  🗑  ⤓
//        2026-27 · 4 fee heads
export interface GroupAction {
  icon: string;
  label: string;
  onPress: () => void;
  tone?: 'danger';
  busy?: boolean;
}

export const GroupHead = ({
  icon,
  letter,
  title,
  sub,
  badge,
  actions = [],
  first,
}: {
  icon?: string;
  letter?: string;
  title: string;
  sub?: string | null;
  /** A small word beside the title — "Monthly", "Inactive". */
  badge?: { text: string; tone?: 'accent' | 'muted' | 'danger' } | null;
  actions?: GroupAction[];
  first?: boolean;
}) => (
  <View style={[s.group, first && s.groupFirst]}>
    <View style={s.tile}>
      {letter ? (
        <Text style={s.tileLetter} numberOfLines={1}>{letter}</Text>
      ) : (
        <VectorIcon iconSet="Ionicons" iconName={icon ?? 'reader-outline'} size={17} color={theme.colors.primary} />
      )}
    </View>
    <View style={s.groupBody}>
      <View style={s.groupTitleRow}>
        <Text style={s.groupTitle} numberOfLines={1}>{title}</Text>
        {!!badge && (
          <Text
            style={[
              s.badge,
              badge.tone === 'accent' && s.badgeAccent,
              badge.tone === 'danger' && s.badgeDanger,
            ]}
          >
            {badge.text}
          </Text>
        )}
      </View>
      {!!sub && <Text style={s.groupSub} numberOfLines={2}>{sub}</Text>}
    </View>
    {actions.map(a => (
      <TouchableOpacity
        key={a.label}
        onPress={a.onPress}
        disabled={a.busy}
        hitSlop={6}
        activeOpacity={0.6}
        style={s.action}
        accessibilityLabel={a.label}
      >
        {a.busy ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <VectorIcon iconSet="Ionicons" iconName={a.icon} size={18} color={a.tone === 'danger' ? theme.colors.danger : theme.colors.textSecondary} />
        )}
      </TouchableOpacity>
    ))}
  </View>
);

// ── A numbered line of a group ──────────────────────────────────────────────
//   1   Tuition                                     ₹1,000.00
export const NumLine = ({
  n,
  label,
  sub,
  value,
  valueSub,
  tag,
  muted,
  tone,
  onPress,
  isLast,
}: {
  n?: number | string | null;
  label: string;
  sub?: string | null;
  value?: string | null;
  valueSub?: string | null;
  tag?: string | null;
  muted?: boolean;
  tone?: 'warn' | 'good' | 'bad';
  onPress?: () => void;
  isLast?: boolean;
}) => {
  const body = (
    <>
      {n !== undefined && n !== null && <Text style={s.lineN}>{String(n)}</Text>}
      <View style={s.lineBody}>
        <Text style={[s.lineLabel, muted && s.muted]} numberOfLines={2}>
          {label}
          {!!tag && <Text style={s.lineTag}>{`  ${tag.toUpperCase()}`}</Text>}
        </Text>
        {!!sub && <Text style={s.lineSub} numberOfLines={2}>{sub}</Text>}
      </View>
      {(!!value || !!valueSub) && (
        <View style={s.lineRight}>
          {!!value && (
            <Text
              style={[
                s.lineValue,
                muted && s.muted,
                tone === 'warn' && s.warn,
                tone === 'good' && s.good,
                tone === 'bad' && s.bad,
              ]}
            >
              {value}
            </Text>
          )}
          {!!valueSub && <Text style={s.lineValueSub}>{valueSub}</Text>}
        </View>
      )}
      {!!onPress && <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />}
    </>
  );
  const style = [s.line, !isLast && s.lineDivider];
  return onPress ? (
    <TouchableOpacity style={style} activeOpacity={0.6} onPress={onPress}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={style}>{body}</View>
  );
};

//   TOTAL                                           ₹1,250.00
export const TotalLine = ({ label = 'Total', value }: { label?: string; value: string }) => (
  <View style={s.total}>
    <Text style={s.totalLabel}>{label.toUpperCase()}</Text>
    <Text style={s.totalValue}>{value}</Text>
  </View>
);

// ── A status as a dot and its word ──────────────────────────────────────────
const DOT: Record<string, { color: string; word: string }> = {
  paid: { color: '#10B981', word: 'Paid' },
  partial: { color: '#F59E0B', word: 'Partial' },
  pending: { color: '#CBD5E1', word: 'Due' },
  na: { color: '#CBD5E1', word: '—' },
};
export const StatusDot = ({ status }: { status: string }) => {
  const d = DOT[status] ?? DOT.na;
  return (
    <View style={s.dotWrap}>
      <View style={[s.dot, { backgroundColor: d.color }]} />
      <Text style={s.dotText}>{d.word}</Text>
    </View>
  );
};

// ── The page's prompt before anything is picked ─────────────────────────────
export const Prompt = ({ icon, title, sub }: { icon: string; title: string; sub?: string }) => (
  <View style={s.prompt}>
    <View style={s.promptIcon}>
      <VectorIcon iconSet="Ionicons" iconName={icon} size={22} color={theme.colors.textMuted} />
    </View>
    <Text style={s.promptTitle}>{title}</Text>
    {!!sub && <Text style={s.promptSub}>{sub}</Text>}
  </View>
);

// ── Loading: group headings over numbered lines ─────────────────────────────
export const GroupsSkeleton = ({ groups = 2, lines = 4 }: { groups?: number; lines?: number }) => (
  <View style={s.pad}>
    {Array.from({ length: groups }, (_, g) => (
      <View key={g}>
        <View style={[s.group, g === 0 && s.groupFirst]}>
          <Skeleton width={30} height={30} radius={6} />
          <View style={s.skBody}>
            <Skeleton width={`${46 + ((g * 17) % 26)}%`} height={13} />
            <Skeleton width={`${30 + ((g * 11) % 20)}%`} height={11} />
          </View>
        </View>
        {Array.from({ length: lines }, (__, i) => (
          <View key={i} style={[s.line, i < lines - 1 && s.lineDivider]}>
            <Skeleton width={12} height={11} />
            <View style={s.lineBody}>
              <Skeleton width={`${40 + ((i * 13) % 30)}%`} height={12} />
            </View>
            <Skeleton width={64} height={12} />
          </View>
        ))}
      </View>
    ))}
  </View>
);

// ── A day, picked from a calendar, in an outlined box ──────────────────────
//   ╭─ Due Date * ──────────────────╮
//   │ 10 May 2026                📅 │
//   ╰───────────────────────────────╯
export const DateBox = ({
  label,
  value,
  onChange,
  required,
  error,
  half,
  maxDate,
  clearable,
}: {
  label: string;
  value: string; // YYYY-MM-DD or ''
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | null;
  half?: boolean;
  maxDate?: string;
  /** An × to empty it — for a date the form may leave blank. */
  clearable?: boolean;
}) => {
  const [open, setOpen] = React.useState(false);
  return (
    <View style={[s.dateField, half && s.flex]}>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen(true)} style={[s.dateBox, !!error && s.dateBoxError]}>
        <Text style={[s.dateText, !value && s.datePlaceholder]} numberOfLines={1}>
          {value ? dmy(value) : 'Pick a date'}
        </Text>
        {clearable && !!value ? (
          <TouchableOpacity hitSlop={8} onPress={() => onChange('')}>
            <VectorIcon iconSet="Ionicons" iconName="close" size={15} color={theme.colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={15} color={theme.colors.textMuted} />
        )}
      </TouchableOpacity>
      <View style={s.dateLabelWrap} pointerEvents="none">
        <Text style={[s.dateLabel, !!error && s.bad]} numberOfLines={1}>
          {label}
          {required && <Text style={s.bad}> *</Text>}
        </Text>
      </View>
      {!!error && <Text style={s.dateError}>{error}</Text>}
      <DateSheet visible={open} value={value || null} onPick={d => onChange(d)} onClose={() => setOpen(false)} title={label} maxDate={maxDate} />
    </View>
  );
};

// ── A form's foot: the save button stays in reach above the keyboard ───────
export const FormFoot = ({ children }: { children: React.ReactNode }) => <View style={s.foot}>{children}</View>;

/** A line of quiet text under a form block. */
export const Quiet = ({ children, tone }: { children: React.ReactNode; tone?: 'warn' | 'bad' | 'good' }) => (
  <Text style={[s.quiet, tone === 'warn' && s.warn, tone === 'bad' && s.bad, tone === 'good' && s.good]}>{children}</Text>
);

const __mk_s = () => StyleSheet.create({
  off: { opacity: 0.45 },
  pad: { paddingHorizontal: 20 },

  flex: { flex: 1 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  headLink: { paddingHorizontal: 2, paddingVertical: 6 },
  headLinkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 11,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary + '66',
  },
  addRowText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  remove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  rowHeadTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  rowHeadSub: { fontSize: 12, color: theme.colors.textMuted },

  band: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  bandRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  bandNote: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8, lineHeight: 17 },
  clear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.danger + '40',
  },
  clearText: { fontSize: 12, fontWeight: '600', color: theme.colors.danger },

  strip: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2, lineHeight: 18 },
  stripDot: { color: theme.colors.border },
  stripValue: { fontWeight: '700', color: theme.colors.textPrimary },

  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 22,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  groupFirst: { paddingTop: 12 },
  tile: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
  },
  tileLetter: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  groupBody: { flex: 1, gap: 2 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  groupSub: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 17 },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: theme.colors.textSecondary,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  badgeAccent: { color: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  badgeDanger: { color: theme.colors.danger, backgroundColor: theme.colors.danger + '14' },
  action: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  lineDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  lineN: { width: 22, fontSize: 11, color: theme.colors.textMuted, fontVariant: ['tabular-nums'] },
  lineBody: { flex: 1, gap: 2 },
  lineLabel: { fontSize: 14, color: theme.colors.textPrimary },
  lineTag: { fontSize: 10, fontWeight: '700', color: theme.colors.textMuted, letterSpacing: 0.6 },
  lineSub: { fontSize: 12, color: theme.colors.textMuted },
  lineRight: { alignItems: 'flex-end', gap: 2 },
  lineValue: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] },
  lineValueSub: { fontSize: 11, color: theme.colors.textMuted },
  muted: { color: theme.colors.textMuted },
  warn: { color: '#D97706' },
  good: { color: '#059669' },
  bad: { color: theme.colors.danger },

  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  totalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted },
  totalValue: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] },

  dotWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotText: { fontSize: 12, color: theme.colors.textSecondary },

  prompt: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 32, gap: 6 },
  promptIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    marginBottom: 6,
  },
  promptTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, textAlign: 'center' },
  promptSub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19 },

  skBody: { flex: 1, gap: 8 },

  foot: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  quiet: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18, marginTop: 10 },

  // A date box, drawn as the outlined fields are: the name set into the top border.
  dateField: { marginTop: 16 },
  dateBox: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
  },
  dateBoxError: { borderColor: theme.colors.danger },
  dateText: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  datePlaceholder: { color: theme.colors.textMuted + 'B3' },
  dateLabelWrap: { position: 'absolute', top: -8, left: 10, flexDirection: 'row' },
  dateLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 4,
  },
  dateError: { fontSize: 12, color: theme.colors.danger, marginTop: 5, marginLeft: 4 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

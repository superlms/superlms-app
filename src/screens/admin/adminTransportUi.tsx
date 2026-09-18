import React from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import type { YearMonthStatus } from '../../api/adminTransportApi';

/**
 * What the admin Transport pages share, drawn as a student's Transport pages
 * are: plain rows with a hairline under each (an icon or a photo, the title,
 * a line or two under it, a word on the right and a chevron), a search box as
 * Chats has it, and how the panel's month statuses read.
 */

export { formatINR, clock, InfoRow, Section } from '../transport/transportUi';

export const TITLE = 'Transportation';

export const VEHICLE_TYPES = ['Bus', 'Mini Bus', 'Van', 'Auto', 'Car', 'Other'];

export const initialsOf = (name?: string | null) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// The panel's month statuses, and how each reads.
export const MONTH_STATUS: Record<YearMonthStatus['status'], string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
  upcoming: 'Upcoming',
  not_used: 'Not used',
};

// ── A photo, or the initials in its place ────────────────────────────────────
export const Avatar = ({ uri, name, size = 40 }: { uri?: string | null; name?: string | null; size?: number }) =>
  uri ? (
    <Image source={{ uri }} style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]} />
  ) : (
    <View style={[s.avatar, s.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.initials, { fontSize: size * 0.35 }]}>{initialsOf(name)}</Text>
    </View>
  );

// ── Search, as Chats has it ──────────────────────────────────────────────────
export const SearchBar = ({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) => (
  <View style={s.searchRow}>
    <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
    <TextInput
      style={s.searchInput}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      value={value}
      onChangeText={onChangeText}
      returnKeyType="search"
    />
    {!!value && (
      <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
        <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>
    )}
  </View>
);

// ── A filter that opens a list: "All drivers ▾", filled once one is picked ──
export const DropPill = ({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[s.pill, active && s.pillActive]} activeOpacity={0.7} onPress={onPress}>
    <Text style={[s.pillText, active && s.pillTextActive]} numberOfLines={1}>
      {label}
    </Text>
    <VectorIcon
      iconSet="Ionicons"
      iconName="chevron-down"
      size={12}
      color={active ? theme.colors.primary : theme.colors.textMuted}
    />
  </TouchableOpacity>
);

// ── One row of a list ────────────────────────────────────────────────────────
//   (🚌)  Route 1 — North Zone                    Inactive  ›
//         Bus, Van · 07:30 AM – 02:00 PM
//         ₹1,200 a month · 24 students
export const ListRow = ({
  icon,
  photo,
  title,
  sub,
  meta,
  right,
  tone,
  onPress,
  isLast,
}: {
  icon?: string;
  /** A person's photo (or initials), in place of the icon. */
  photo?: { uri?: string | null; name?: string | null };
  title: string;
  sub?: string | null;
  meta?: string | null;
  right?: string | null;
  /** The word on the right: money settled, owed, or something switched off. */
  tone?: 'paid' | 'due' | 'muted';
  onPress?: () => void;
  isLast?: boolean;
}) => (
  <TouchableOpacity
    style={[s.row, !isLast && s.rowDivider]}
    activeOpacity={onPress ? 0.6 : 1}
    disabled={!onPress}
    onPress={onPress}
  >
    {photo ? (
      <Avatar uri={photo.uri} name={photo.name} />
    ) : icon ? (
      <View style={s.rowIcon}>
        <VectorIcon iconSet="Ionicons" iconName={icon} size={20} color={theme.colors.textSecondary} />
      </View>
    ) : null}
    <View style={s.rowBody}>
      <Text style={s.rowTitle} numberOfLines={1}>
        {title}
      </Text>
      {!!sub && (
        <Text style={s.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      )}
      {!!meta && (
        <Text style={s.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
      )}
    </View>
    {!!right && (
      <Text
        style={[
          s.rowRight,
          tone === 'paid' && s.paid,
          tone === 'due' && s.due,
          tone === 'muted' && s.muted,
        ]}
      >
        {right}
      </Text>
    )}
    {!!onPress && <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={15} color={theme.colors.textMuted} />}
  </TouchableOpacity>
);

// ── Loading: rows at the sizes of the real ones ─────────────────────────────
const TITLE_W = ['58%', '46%', '66%', '52%', '62%', '40%'];
const SUB_W = ['72%', '64%', '80%', '58%', '70%', '76%'];

export const ListSkeleton = ({ rows = 6, photo }: { rows?: number; photo?: boolean }) => (
  <View>
    {Array.from({ length: rows }, (_, i) => (
      <View key={i} style={[s.row, i < rows - 1 && s.rowDivider]}>
        {photo ? <Skeleton width={40} height={40} radius={20} /> : <View style={s.rowIcon}><Skeleton width={20} height={20} radius={6} /></View>}
        <View style={s.rowBody}>
          <View style={s.skTitle}>
            <Skeleton width={TITLE_W[i % TITLE_W.length]} height={13} />
          </View>
          <View style={s.skSub}>
            <Skeleton width={SUB_W[i % SUB_W.length]} height={11} />
          </View>
        </View>
      </View>
    ))}
  </View>
);

// ── Nothing loaded, and the call failed ──────────────────────────────────────
export const ErrorBox = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <View style={s.centeredBox}>
    <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
    <Text style={s.errorText}>{message}</Text>
    <TouchableOpacity onPress={onRetry} hitSlop={10}>
      <Text style={s.linkText}>Try again</Text>
    </TouchableOpacity>
  </View>
);

const __mk_s = () => StyleSheet.create({
  // Photo
  avatar: { backgroundColor: theme.colors.background },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primaryLight },
  initials: { fontWeight: '700', color: theme.colors.primary },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, padding: 0 },

  // Filter pill, as the list pills are drawn
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 200,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  pillText: { flexShrink: 1, fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },
  pillTextActive: { color: theme.colors.primary },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowIcon: { width: 22, alignItems: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowSub: { fontSize: 13, color: theme.colors.textSecondary },
  rowMeta: { fontSize: 12, color: theme.colors.textMuted },
  rowRight: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  paid: { color: theme.colors.success },
  due: { color: theme.colors.danger },
  muted: { color: theme.colors.textMuted, fontWeight: '500' },

  // Skeleton lines, at the heights of the real ones
  skTitle: { height: 20, justifyContent: 'center' },
  skSub: { height: 18, justifyContent: 'center' },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

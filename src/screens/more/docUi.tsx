import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../../components/Header';
import ScreenSkeleton from '../../components/Skeleton';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * Shared "announcement-style" building blocks for the More info screens
 * (About App, Privacy Policy, Terms of Use, Terms & Conditions,
 * Rules & Regulations, School Info).
 *
 * Visual language mirrors ViewAnnouncementScreen: a coloured accent strip on
 * top of every card, an uppercase section label, and justified body text.
 */

type IconSet = 'Ionicons' | 'Feather' | 'FontAwesome6' | 'MaterialCommunityIcons';

// ── Hero card (logo / icon + title + subtitle) ────────────────────────────────
export const DocHero = ({
  accent,
  icon,
  iconSet = 'Ionicons',
  logoUrl,
  title,
  subtitle,
}: {
  accent: string;
  icon?: string;
  iconSet?: IconSet;
  logoUrl?: string | null;
  title: string;
  subtitle?: string;
}) => (
  <View style={s.card}>
    <View style={[s.accentStrip, { backgroundColor: accent }]} />
    <View style={s.cardInner}>
      <View style={s.heroRow}>
        <View style={[s.heroIcon, { backgroundColor: accent + '18' }]}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={s.heroLogo} resizeMode="contain" />
          ) : (
            <VectorIcon iconSet={iconSet as any} iconName={icon || 'document-text-outline'} size={28} color={accent} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>{title}</Text>
          {!!subtitle && <Text style={[s.heroSub, { color: accent }]}>{subtitle}</Text>}
        </View>
      </View>
    </View>
  </View>
);

// ── Generic card with accent strip + optional uppercase label ──────────────────
export const DocCard = ({
  accent,
  label,
  children,
  noPadInner,
}: {
  accent: string;
  label?: string;
  children: React.ReactNode;
  noPadInner?: boolean;
}) => (
  <View style={s.card}>
    <View style={[s.accentStrip, { backgroundColor: accent }]} />
    <View style={noPadInner ? s.cardInnerTight : s.cardInner}>
      {!!label && <Text style={s.sectionLabel}>{label}</Text>}
      {children}
    </View>
  </View>
);

export const DocBody = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.bodyText}>{children}</Text>
);

// ── A tappable row: icon box + title (+ sub) + trailing icon ───────────────────
export const DocRow = ({
  iconBg,
  icon,
  iconSet = 'Feather',
  title,
  sub,
  trailingIcon,
  trailingIconSet = 'Ionicons',
  trailingColor,
  onPress,
  isLast,
}: {
  iconBg: string;
  icon: string;
  iconSet?: IconSet;
  title: string;
  sub?: string;
  trailingIcon?: string;
  trailingIconSet?: IconSet;
  trailingColor?: string;
  onPress?: () => void;
  isLast?: boolean;
}) => (
  <TouchableOpacity
    style={[s.row, !isLast && s.rowBorder]}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
  >
    <View style={[s.rowIcon, { backgroundColor: iconBg }]}>
      <VectorIcon iconSet={iconSet as any} iconName={icon} size={18} color="#fff" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.rowTitle} numberOfLines={2}>{title}</Text>
      {!!sub && <Text style={s.rowSub}>{sub}</Text>}
    </View>
    {!!trailingIcon && (
      <View style={s.rowTrailing}>
        <VectorIcon
          iconSet={trailingIconSet as any}
          iconName={trailingIcon}
          size={16}
          color={trailingColor || theme.colors.textMuted}
        />
      </View>
    )}
  </TouchableOpacity>
);

// ── Horizontal people strip (core team / management) ───────────────────────────
export interface DocPerson {
  id: number;
  name: string;
  designation: string;
  photo_url: string | null;
  url?: string | null;
}

export const DocPeople = ({
  accent,
  people,
  onPressPerson,
}: {
  accent: string;
  people: DocPerson[];
  onPressPerson?: (p: DocPerson) => void;
}) => (
  <View style={s.peopleRow}>
    {people.map(p => {
      const tappable = !!onPressPerson && !!(p.url || p.photo_url);
      return (
        <TouchableOpacity
          key={p.id}
          style={s.personCard}
          activeOpacity={tappable ? 0.7 : 1}
          disabled={!tappable}
          onPress={tappable ? () => onPressPerson!(p) : undefined}
        >
          {p.photo_url ? (
            <Image source={{ uri: p.photo_url }} style={[s.personAvatar, { borderColor: accent }]} />
          ) : (
            <View style={[s.personAvatar, s.personAvatarFallback, { borderColor: accent, backgroundColor: accent + '18' }]}>
              <Text style={[s.personInitial, { color: accent }]}>{p.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={s.personName} numberOfLines={2}>{p.name}</Text>
          {!!p.designation && (
            <View style={[s.personChip, { backgroundColor: accent + '18' }]}>
              <Text style={[s.personChipText, { color: accent }]} numberOfLines={1}>{p.designation}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    })}
  </View>
);

export const DocFooter = ({ accent, text }: { accent: string; text: string }) => (
  <View style={s.footer}>
    <VectorIcon iconSet="Ionicons" iconName="time-outline" size={15} color={accent} />
    <Text style={s.footerText}>{text}</Text>
  </View>
);

export const DocEmpty = ({ text }: { text: string }) => (
  <View style={s.emptyBox}>
    <VectorIcon iconSet="Ionicons" iconName="document-outline" size={40} color={theme.colors.textMuted} />
    <Text style={s.emptyText}>{text}</Text>
  </View>
);

// Full "no data found" state (books / instructor style) shown inside the
// scroll so pull-to-refresh keeps working.
export const DocNoData = ({
  accent,
  icon = 'document-text-outline',
  iconSet = 'Ionicons',
  title = 'No data found',
  subtitle,
}: {
  accent: string;
  icon?: string;
  iconSet?: IconSet;
  title?: string;
  subtitle?: string;
}) => (
  <View style={s.noDataBox} /* transport-style empty state */>
    <View style={[s.noDataRing, { backgroundColor: accent + '18' }]}>
      <VectorIcon iconSet={iconSet as any} iconName={icon} size={38} color={accent} />
    </View>
    <Text style={s.noDataTitle}>{title}</Text>
    {!!subtitle && <Text style={s.noDataSub}>{subtitle}</Text>}
  </View>
);

// ── Shared loading / error full-screen states (include the Header) ─────────────
export const DocLoading = ({ title }: { title: string }) => (
  <View style={s.root}>
    <Header title={title} />
    <View style={s.center}>
      <ScreenSkeleton variant="doc" />
      <Text style={s.loadingText}>Loading…</Text>
    </View>
  </View>
);

export const DocError = ({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) => (
  <View style={s.root}>
    <Header title={title} />
    <View style={s.center}>
      <VectorIcon iconSet="Ionicons" iconName="alert-circle-outline" size={48} color={theme.colors.danger} />
      <Text style={s.errorText}>{message}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={onRetry}>
        <Text style={s.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const __mk_docStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
});

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 8 },
  errorText: { fontSize: 14, color: theme.colors.danger, textAlign: 'center' },
  retryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    marginTop: 8,
  },
  retryText: { color: '#fff', fontWeight: '700' },

  // Card
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  accentStrip: { height: 5 },
  cardInner: { padding: 18 },
  cardInnerTight: { paddingVertical: 4 },

  // Hero
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroLogo: { width: 48, height: 48, borderRadius: 12 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary, lineHeight: 26 },
  heroSub: { fontSize: 13, fontWeight: '600', lineHeight: 19, marginTop: 4 },

  // Section
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bodyText: { fontSize: 15, color: theme.colors.textPrimary, lineHeight: 25, textAlign: 'justify' },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowIcon: { width: 44, height: 44, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  rowSub: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600', marginTop: 2 },
  rowTrailing: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // People
  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 2 },
  personCard: { width: 92, alignItems: 'center', gap: 6 },
  personAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2 },
  personAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  personInitial: { fontSize: 22, fontWeight: '800' },
  personName: { fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'center' },
  personChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, maxWidth: '100%' },
  personChipText: { fontSize: 10, fontWeight: '700' },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  footerText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },

  // Empty (inline, inside a card)
  emptyBox: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  emptyText: { fontSize: 14, color: theme.colors.textMuted },

  // No data (full state inside scroll)
  noDataBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 24 },
  noDataRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noDataTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 6 },
  noDataSub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
export let docStyles = __mk_docStyles();
onThemeChange(() => { docStyles = __mk_docStyles(); });
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

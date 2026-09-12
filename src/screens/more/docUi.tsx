import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../../components/Header';
import ScreenSkeleton from '../../components/Skeleton';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * Shared building blocks for the More info screens (About App, School Info,
 * Rules & Regulations, Terms & Conditions, Privacy Policy, Terms of Use).
 *
 * Deliberately minimal: flat white cards with a hairline border, section
 * labels above the card, one brand tint for icons (no per-screen accent
 * colours, strips or shadows) and left-aligned body text.
 */

type IconSet = 'Ionicons' | 'Feather' | 'FontAwesome6' | 'MaterialCommunityIcons';

// ── Page intro (logo / icon + title + subtitle), sits on the page ─────────────
export const DocHero = ({
  icon,
  iconSet = 'Ionicons',
  logoUrl,
  title,
  subtitle,
}: {
  icon?: string;
  iconSet?: IconSet;
  logoUrl?: string | null;
  title: string;
  subtitle?: string;
}) => (
  <View style={s.hero}>
    <View style={s.heroIcon}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={s.heroLogo} resizeMode="contain" />
      ) : (
        <VectorIcon iconSet={iconSet as any} iconName={icon || 'document-text-outline'} size={24} color={theme.colors.primary} />
      )}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.heroTitle}>{title}</Text>
      {!!subtitle && <Text style={s.heroSub}>{subtitle}</Text>}
    </View>
  </View>
);

// ── Section: optional label above a flat card ─────────────────────────────────
export const DocCard = ({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) => (
  <View>
    {!!label && <Text style={s.sectionLabel}>{label}</Text>}
    <View style={s.card}>{children}</View>
  </View>
);

export const DocBody = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.bodyText}>{children}</Text>
);

// ── A tappable row: icon + title (+ sub) + trailing icon ──────────────────────
export const DocRow = ({
  icon,
  iconSet = 'Feather',
  title,
  sub,
  trailingIcon,
  trailingIconSet = 'Ionicons',
  onPress,
  isLast,
}: {
  icon: string;
  iconSet?: IconSet;
  title: string;
  sub?: string;
  trailingIcon?: string;
  trailingIconSet?: IconSet;
  onPress?: () => void;
  isLast?: boolean;
}) => (
  <TouchableOpacity
    style={[s.row, !isLast && s.rowBorder]}
    onPress={onPress}
    activeOpacity={onPress ? 0.6 : 1}
    disabled={!onPress}
  >
    <View style={s.rowIcon}>
      <VectorIcon iconSet={iconSet as any} iconName={icon} size={16} color={theme.colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.rowTitle} numberOfLines={2}>{title}</Text>
      {!!sub && <Text style={s.rowSub}>{sub}</Text>}
    </View>
    {!!trailingIcon && (
      <VectorIcon
        iconSet={trailingIconSet as any}
        iconName={trailingIcon}
        size={16}
        color={theme.colors.textMuted}
      />
    )}
  </TouchableOpacity>
);

// ── People grid (core team / management) ──────────────────────────────────────
export interface DocPerson {
  id: number;
  name: string;
  designation: string;
  photo_url: string | null;
  url?: string | null;
}

export const DocPeople = ({
  people,
  onPressPerson,
}: {
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
          activeOpacity={tappable ? 0.6 : 1}
          disabled={!tappable}
          onPress={tappable ? () => onPressPerson!(p) : undefined}
        >
          {p.photo_url ? (
            <Image source={{ uri: p.photo_url }} style={s.personAvatar} />
          ) : (
            <View style={[s.personAvatar, s.personAvatarFallback]}>
              <Text style={s.personInitial}>{p.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={s.personName} numberOfLines={2}>{p.name}</Text>
          {!!p.designation && (
            <Text style={s.personRole} numberOfLines={1}>{p.designation}</Text>
          )}
        </TouchableOpacity>
      );
    })}
  </View>
);

export const DocFooter = ({ text }: { text: string }) => (
  <Text style={s.footerText}>{text}</Text>
);

export const DocEmpty = ({ text }: { text: string }) => (
  <View style={s.emptyBox}>
    <VectorIcon iconSet="Ionicons" iconName="document-outline" size={40} color={theme.colors.textMuted} />
    <Text style={s.emptyText}>{text}</Text>
  </View>
);

// Full "no data found" state shown inside the scroll so pull-to-refresh keeps
// working.
export const DocNoData = ({
  icon = 'document-text-outline',
  iconSet = 'Ionicons',
  title = 'No data found',
  subtitle,
}: {
  icon?: string;
  iconSet?: IconSet;
  title?: string;
  subtitle?: string;
}) => (
  <View style={s.noDataBox}>
    <View style={s.noDataIcon}>
      <VectorIcon iconSet={iconSet as any} iconName={icon} size={28} color={theme.colors.textMuted} />
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
      <VectorIcon iconSet="Ionicons" iconName="alert-circle-outline" size={40} color={theme.colors.danger} />
      <Text style={s.errorText}>{message}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={onRetry}>
        <Text style={s.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const __mk_docStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 40, gap: 20 },
});

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { fontSize: 13, color: theme.colors.textMuted, marginTop: 8 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: theme.radius.full,
    marginTop: 4,
  },
  retryText: { color: theme.colors.primary, fontWeight: '600' },

  // Intro
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroLogo: { width: 40, height: 40 },
  heroTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 24 },
  heroSub: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, marginTop: 2 },

  // Section
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
    marginLeft: 2,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  bodyText: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 22, marginVertical: 12 },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  rowSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },

  // People
  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 12 },
  personCard: { width: 88, alignItems: 'center', gap: 4 },
  personAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.background },
  personAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  personInitial: { fontSize: 20, fontWeight: '600', color: theme.colors.textSecondary },
  personName: { fontSize: 12, fontWeight: '600', color: theme.colors.textPrimary, textAlign: 'center' },
  personRole: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'center' },

  // Footer
  footerText: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },

  // Empty (inline, inside a card)
  emptyBox: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  emptyText: { fontSize: 14, color: theme.colors.textMuted },

  // No data (full state inside scroll)
  noDataBox: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 24 },
  noDataIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  noDataTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 4 },
  noDataSub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
export let docStyles = __mk_docStyles();
onThemeChange(() => { docStyles = __mk_docStyles(); });
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

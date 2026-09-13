import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../../components/Header';
import { Skeleton } from '../../components/Skeleton';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * Shared building blocks for the More info screens (About App, School Info,
 * Rules & Regulations, Terms & Conditions, Privacy Policy, Terms of Use).
 *
 * Minimal, document-style layout on a plain white page: headings and readable
 * body text separated by whitespace, while list data (contacts, documents,
 * team, links) sits in one plain bordered container with inset hairline
 * separators. No accent strips, shadows or coloured icon boxes.
 */

type IconSet = 'Ionicons' | 'Feather' | 'FontAwesome6' | 'MaterialCommunityIcons';

// "Last updated 12 Sep 2026", or undefined when the date is missing/invalid.
export const lastUpdated = (date?: string | null) => {
  if (!date) return undefined;
  const d = new Date(date);
  if (isNaN(d.getTime())) return undefined;
  return `Last updated ${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
};

// ── Screen header: compact 50px bar, with a thin line under it that separates it
// from the white page ──────────────────────────────────────────────────────────
export const DocHeader = ({
  title,
  onBackPress,
  rightIcon,
  onRightPress,
}: {
  title: string;
  onBackPress?: () => void;
  rightIcon?: string;
  onRightPress?: () => void;
}) => (
  <Header
    title={title}
    onBackPress={onBackPress}
    rightIcon={rightIcon}
    onRightPress={onRightPress}
    divider
    height={50}
  />
);

// ── Page intro: optional logo, title, subtitle and a small meta line ──────────
// Renders nothing when there's nothing to say (the header already names the
// page, so screens don't repeat it here).
export const DocIntro = ({
  logoUrl,
  title,
  subtitle,
  meta,
}: {
  logoUrl?: string | null;
  title?: string;
  subtitle?: string;
  meta?: string;
}) => {
  if (!logoUrl && !title && !subtitle && !meta) return null;
  return (
    <View>
      {!!logoUrl && <Image source={{ uri: logoUrl }} style={s.introLogo} resizeMode="contain" />}
      {!!title && <Text style={s.introTitle}>{title}</Text>}
      {!!subtitle && <Text style={s.introSub}>{subtitle}</Text>}
      {!!meta && <Text style={s.introMeta}>{meta}</Text>}
    </View>
  );
};

// ── Section: a heading and its content ────────────────────────────────────────
export const DocSection = ({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) => (
  <View>
    {!!title && <Text style={s.sectionTitle}>{title}</Text>}
    {children}
  </View>
);

export const DocBody = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.bodyText}>{children}</Text>
);

// ── Container for list data (DocRow / DocPeople) ──────────────────────────────
export const DocList = ({ children }: { children: React.ReactNode }) => (
  <View style={s.list}>{children}</View>
);

// ── List row: plain icon, title (+ sub), trailing icon, inset separator ───────
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
    style={s.row}
    onPress={onPress}
    activeOpacity={onPress ? 0.6 : 1}
    disabled={!onPress}
  >
    <View style={s.rowIcon}>
      <VectorIcon iconSet={iconSet as any} iconName={icon} size={18} color={theme.colors.textSecondary} />
    </View>
    <View style={[s.rowMain, !isLast && s.rowBorder]}>
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
    </View>
  </TouchableOpacity>
);

// ── People rows (core team / management) ──────────────────────────────────────
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
  <View>
    {people.map((p, i) => {
      const tappable = !!onPressPerson && !!(p.url || p.photo_url);
      return (
        <TouchableOpacity
          key={p.id}
          style={s.row}
          activeOpacity={tappable ? 0.6 : 1}
          disabled={!tappable}
          onPress={tappable ? () => onPressPerson!(p) : undefined}
        >
          {p.photo_url ? (
            <Image source={{ uri: p.photo_url }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitial}>{p.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={[s.rowMain, i < people.length - 1 && s.rowBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{p.name}</Text>
              {!!p.designation && (
                <Text style={s.rowSub} numberOfLines={1}>{p.designation}</Text>
              )}
            </View>
            {tappable && (
              <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
            )}
          </View>
        </TouchableOpacity>
      );
    })}
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
  <View style={s.noData}>
    <VectorIcon iconSet={iconSet as any} iconName={icon} size={32} color={theme.colors.textMuted} />
    <Text style={s.noDataTitle}>{title}</Text>
    {!!subtitle && <Text style={s.noDataSub}>{subtitle}</Text>}
  </View>
);

// ── Shared loading / error full-screen states (include the header) ─────────────
export const DocLoading = ({ title }: { title: string }) => (
  <View style={s.root}>
    <DocHeader title={title} />
    <View style={s.loading}>
      <Skeleton width="55%" height={20} />
      <Skeleton width="35%" height={12} />
      <View style={s.loadingBlock}>
        {['100%', '100%', '92%', '100%', '64%'].map((w, i) => (
          <Skeleton key={i} width={w} height={12} />
        ))}
      </View>
    </View>
  </View>
);

// ── Page skeleton: the header, then the page's own shape ─────────────────────
// Each More screen says what its page holds — the intro (logo, title, subtitle,
// "Last updated"), how many text sections, and any bordered lists (contact
// rows, people, documents) — and gets boxes at the height of the text they
// stand in for, so nothing moves when the page arrives. It shows on the first
// load and while pulling to refresh.
const SK_HEAD_W = [120, 96, 140, 110];
const SK_BODY_W = ['100%', '96%', '98%', '62%'];
const SK_ROW_W = ['64%', '52%', '70%'];

export const DocSkeleton = ({
  title,
  intro = {},
  sections = 3,
  lists = [],
}: {
  title: string;
  intro?: { logo?: boolean; title?: boolean; subtitle?: boolean; meta?: boolean };
  sections?: number;
  /** Bordered lists after the sections; `people` rows lead with a round photo. */
  lists?: { rows: number; people?: boolean }[];
}) => {
  const hasIntro = intro.logo || intro.title || intro.subtitle || intro.meta;

  return (
    <View style={s.root}>
      <DocHeader title={title} />
      <View style={docStyles.scroll}>
        {hasIntro && (
          <View>
            {intro.logo && <Skeleton width={56} height={56} radius={12} style={s.skLogo} />}
            {intro.title && (
              <View style={[s.skLine, s.skIntroTitle]}>
                <Skeleton width="58%" height={18} />
              </View>
            )}
            {intro.subtitle && (
              <View style={[s.skLine, s.skIntroSub]}>
                <Skeleton width="44%" height={11} />
              </View>
            )}
            {intro.meta && (
              <View style={[s.skLine, s.skIntroMeta]}>
                <Skeleton width={130} height={9} />
              </View>
            )}
          </View>
        )}

        {Array.from({ length: sections }, (_, i) => (
          <View key={`section${i}`}>
            <View style={[s.skLine, s.skSectionTitle]}>
              <Skeleton width={SK_HEAD_W[i % SK_HEAD_W.length]} height={14} />
            </View>
            {SK_BODY_W.map((w, j) => (
              <View key={j} style={[s.skLine, s.skBodyLine]}>
                <Skeleton width={w} height={12} />
              </View>
            ))}
          </View>
        ))}

        {lists.map((list, i) => (
          <View key={`list${i}`}>
            <View style={[s.skLine, s.skSectionTitle]}>
              <Skeleton width={90} height={14} />
            </View>
            <View style={s.list}>
              {Array.from({ length: list.rows }, (_, r) => (
                <View key={r} style={s.row}>
                  {list.people ? (
                    <Skeleton width={40} height={40} radius={20} />
                  ) : (
                    <View style={s.rowIcon}>
                      <Skeleton width={18} height={18} radius={4} />
                    </View>
                  )}
                  <View style={[s.rowMain, r < list.rows - 1 && s.rowBorder]}>
                    <View style={s.skRowText}>
                      <View style={[s.skLine, s.skRowTitle]}>
                        <Skeleton width={SK_ROW_W[r % SK_ROW_W.length]} height={12} />
                      </View>
                      <View style={[s.skLine, s.skRowSub]}>
                        <Skeleton width={60} height={9} />
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

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
    <DocHeader title={title} />
    <View style={s.center}>
      <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
      <Text style={s.errorText}>{message}</Text>
      <TouchableOpacity onPress={onRetry} hitSlop={10}>
        <Text style={s.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const __mk_docStyles = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 28 },
});

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  retryText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary, marginTop: 4 },

  loading: { padding: 20, gap: 10 },
  loadingBlock: { marginTop: 18, gap: 10 },

  // Page skeleton boxes, at the heights of the real lines: intro title 22/28,
  // subtitle 14/20, meta 12px, section heading 17px, body 15/24, list row title
  // 15px and sub 12px.
  skLine: { justifyContent: 'center' },
  skLogo: { marginBottom: 14 },
  skIntroTitle: { height: 28 },
  skIntroSub: { height: 20, marginTop: 4 },
  skIntroMeta: { height: 16, marginTop: 8 },
  skSectionTitle: { height: 23, marginBottom: 8 },
  skBodyLine: { height: 24 },
  skRowText: { flex: 1 },
  skRowTitle: { height: 20 },
  skRowSub: { height: 16, marginTop: 2 },

  // Intro
  introLogo: { width: 56, height: 56, marginBottom: 14 },
  introTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 28 },
  introSub: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20, marginTop: 4 },
  introMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 8 },

  // Section
  sectionTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 8 },
  bodyText: { fontSize: 15, lineHeight: 24, color: theme.colors.textPrimary },

  // List container
  list: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
  },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowIcon: { width: 22, alignItems: 'center' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowTitle: { fontSize: 15, color: theme.colors.textPrimary },
  rowSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  // People
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.background },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },

  // No data
  noData: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 6 },
  noDataTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 8 },
  noDataSub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
export let docStyles = __mk_docStyles();
onThemeChange(() => { docStyles = __mk_docStyles(); });
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppAlert } from '../../components/AppDialog';
import { downloadFile } from '../../api/pdfDownload';
import Header from '../../components/Header';
import { Skeleton, SkeletonIcon, SkeletonText } from '../../components/Skeleton';
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
  rightSlot,
}: {
  title: string;
  onBackPress?: () => void;
  rightIcon?: string;
  onRightPress?: () => void;
  /** Several right-side buttons, in place of rightIcon. */
  rightSlot?: React.ReactNode;
}) => (
  <Header
    title={title}
    onBackPress={onBackPress}
    rightIcon={rightIcon}
    onRightPress={onRightPress}
    rightSlot={rightSlot}
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
// As a skeleton, the heading and body are bars on the lines they take.
export const DocSection = ({
  title,
  children,
  skeleton,
}: {
  title?: string;
  children: React.ReactNode;
  skeleton?: boolean;
}) => (
  <View>
    {!!title &&
      (skeleton ? (
        <SkeletonText style={s.sectionTitle}>{title}</SkeletonText>
      ) : (
        <Text style={s.sectionTitle}>{title}</Text>
      ))}
    {children}
  </View>
);

export const DocBody = ({ children, skeleton }: { children: React.ReactNode; skeleton?: boolean }) =>
  skeleton ? (
    <SkeletonText style={s.bodyText}>{children}</SkeletonText>
  ) : (
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
  trailingBusy,
  onPress,
  isLast,
}: {
  icon: string;
  iconSet?: IconSet;
  title: string;
  sub?: string;
  trailingIcon?: string;
  trailingIconSet?: IconSet;
  /** A spinner in place of the trailing icon, e.g. while a download runs. */
  trailingBusy?: boolean;
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
      {trailingBusy ? (
        <ActivityIndicator size="small" color={theme.colors.textMuted} />
      ) : (
        !!trailingIcon && (
          <VectorIcon
            iconSet={trailingIconSet as any}
            iconName={trailingIcon}
            size={16}
            color={theme.colors.textMuted}
          />
        )
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
// working. As a skeleton, its icon is a box and its title and subtitle bars on
// the lines they take.
export const DocNoData = ({
  icon = 'document-text-outline',
  iconSet = 'Ionicons',
  title = 'No data found',
  subtitle,
  skeleton,
}: {
  icon?: string;
  iconSet?: IconSet;
  title?: string;
  subtitle?: string;
  skeleton?: boolean;
}) => (
  <View style={s.noData}>
    {skeleton ? (
      <SkeletonIcon iconSet={iconSet} iconName={icon} size={32} />
    ) : (
      <VectorIcon iconSet={iconSet as any} iconName={icon} size={32} color={theme.colors.textMuted} />
    )}
    {skeleton ? (
      <SkeletonText style={s.noDataTitle}>{title}</SkeletonText>
    ) : (
      <Text style={s.noDataTitle}>{title}</Text>
    )}
    {!!subtitle &&
      (skeleton ? (
        <SkeletonText style={s.noDataSub}>{subtitle}</SkeletonText>
      ) : (
        <Text style={s.noDataSub}>{subtitle}</Text>
      ))}
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
// "Last updated"), its text sections, and any bordered lists (contact rows,
// people, documents) — and gets boxes at the height of the text they stand in
// for, so nothing moves when the page arrives. It shows on the first load and
// while pulling to refresh.
//
// A document page (terms, policies) passes `shape`: its sections as they read,
// the heading's and each line's length in characters. Those lines are wrapped
// to the screen's width and drawn line for line, blank lines included, down to
// the bottom of the screen.
const SK_HEAD_W = [120, 96, 140, 110];
const SK_BODY_W = ['100%', '96%', '98%', '62%'];
const SK_ROW_W = ['64%', '52%', '70%'];
// The wrapped lines of a paragraph before its last one run nearly to the edge.
const SK_FULL_W = ['100%', '95%', '98%', '92%', '97%'];

/** A text section's shape, in characters: the heading's length and each line's (0 for a blank line). */
export interface DocShape {
  head: number;
  lines: number[];
}

// The shape of a page's text sections as they read. The first few sections are
// plenty to fill a screen.
export const docShapeOf = (sections: { head?: string | null; desc?: string | null }[]): DocShape[] =>
  sections.slice(0, 4).map(sec => ({
    head: (sec.head ?? '').trim().length,
    lines: (sec.desc ?? '').split('\n').slice(0, 60).map(line => line.trim().length),
  }));

// Paragraphs of ordinary length, for a school page never loaded on this phone.
export const DOC_FALLBACK_SHAPE: DocShape[] = [
  { head: 14, lines: [236, 0, 188] },
  { head: 11, lines: [96, 142, 120, 88] },
  { head: 16, lines: [210, 0, 164] },
  { head: 12, lines: [130, 175, 64] },
  { head: 15, lines: [220, 0, 150] },
];

const shapeCache: Record<string, DocShape[]> = {};

/**
 * The skeleton shape for a page whose text is the school's own (Rules, School
 * Info): the shape of what it held the last time it loaded on this phone, or
 * `fallback` before then. Pass what loads to `remember`.
 */
export const useDocShape = (key: string, fallback: DocShape[]) => {
  const [shape, setShape] = useState<DocShape[]>(shapeCache[key] ?? fallback);

  useEffect(() => {
    if (shapeCache[key]) return;
    AsyncStorage.getItem(`doc_shape:${key}`)
      .then(raw => {
        const saved = raw ? JSON.parse(raw) : null;
        if (Array.isArray(saved) && saved.length > 0) {
          shapeCache[key] = saved;
          setShape(saved);
        }
      })
      .catch(() => {});
  }, [key]);

  const remember = useCallback(
    (next: DocShape[]) => {
      if (next.length === 0) return;
      shapeCache[key] = next;
      setShape(next);
      AsyncStorage.setItem(`doc_shape:${key}`, JSON.stringify(next)).catch(() => {});
    },
    [key],
  );

  return [shape, remember] as const;
};

// The name a document is saved under: its title, with the file's own extension.
const documentFileName = (title: string, url: string, fileType?: string | null) => {
  const ext = url.split('?')[0].match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? (fileType || 'pdf');
  const base = title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Document';
  return `${base}.${String(ext).toLowerCase()}`;
};

/**
 * Documents on the More pages download rather than open: `download` saves the
 * file to the phone's Downloads (the share sheet on iOS) and says so;
 * `downloading` is the key of the row whose spinner should show meanwhile.
 */
export const useDocumentDownload = () => {
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (key: string, title: string, url: string, fileType?: string | null) => {
    if (downloading) return;
    setDownloading(key);
    try {
      const fileName = documentFileName(title, url, fileType);
      await downloadFile(url, fileName);
      if (Platform.OS === 'android') AppAlert.alert('Downloaded', `${fileName} is saved in Downloads.`);
    } catch (e: any) {
      console.log('[download] ❌', e?.message);
      AppAlert.alert('Could not download', 'Please check your connection and try again.');
    } finally {
      setDownloading(null);
    }
  };

  return { downloading, download };
};

// About how wide one character is: body 15px, section heading 17px semibold,
// intro title 22px bold, intro subtitle 14px, hero name 20px bold, hero line 13px.
const CHAR_W = { body: 7.6, head: 9.5, title: 13.5, subtitle: 7.2, heroName: 12.5, heroLine: 6.6 };
// Heights on the page: header bar, top padding, gap between blocks, a section
// heading with its margin, one body line.
const SK_H = { header: 50, top: 16, gap: 28, head: 31, line: 24 };

// A paragraph's lines wrapped to the screen: one width per drawn line, null for a blank line.
const wrapLines = (lines: number[], perLine: number) => {
  const rows: (string | null)[] = [];
  lines.forEach(len => {
    if (len <= 0) {
      rows.push(null);
      return;
    }
    const count = Math.ceil(len / perLine);
    for (let i = 1; i < count; i++) rows.push(SK_FULL_W[rows.length % SK_FULL_W.length]);
    const rest = len - (count - 1) * perLine;
    rows.push(`${Math.max(12, Math.round((rest / perLine) * 100))}%`);
  });
  return rows;
};

export const DocSkeleton = ({
  title,
  intro = {},
  sections = 3,
  shape,
  hero,
  lists = [],
}: {
  title: string;
  /**
   * A centred head instead of the intro: the logo, the name (its length in
   * characters, when known), the lines under it — how many, or each one's
   * length in characters — and a full-width rule.
   */
  hero?: { logo?: boolean; name?: number; lines?: number | number[] };
  /** The intro's parts; a number for the title or subtitle is its length in characters. */
  intro?: { logo?: boolean; title?: boolean | number; subtitle?: boolean | number; meta?: boolean };
  /** How many text sections, for a page without a `shape`. */
  sections?: number;
  shape?: DocShape[];
  /** Bordered lists after the sections; `people` rows lead with a round photo. */
  lists?: { rows: number; people?: boolean }[];
}) => {
  const { width, height } = useWindowDimensions();
  const textW = width - 40;
  const hasIntro = !!(intro.logo || intro.title || intro.subtitle || intro.meta);
  const introW = (part: boolean | number | undefined, charW: number, fallback: string) =>
    typeof part === 'number' ? Math.min(part * charW, textW) : fallback;

  // The hero's lines as drawn: one row each, or each wrapped to the width.
  const heroW = width - 50;
  const heroPerLine = Math.max(10, Math.floor(heroW / CHAR_W.heroLine));
  const heroLines: (number | string)[][] = !hero?.lines
    ? []
    : typeof hero.lines === 'number'
      ? Array.from({ length: hero.lines }, (_, i) => [i % 2 === 0 ? '64%' : '84%'])
      : hero.lines.map(len => {
          const count = Math.max(1, Math.ceil(len / heroPerLine));
          return Array.from({ length: count }, (_, r) =>
            r < count - 1
              ? Math.round(heroW * 0.94)
              : Math.min((len - (count - 1) * heroPerLine) * CHAR_W.heroLine, heroW),
          );
        });

  // The shaped sections, cut off once they pass the bottom of the screen.
  const shaped: { head: number; rows: (string | null)[] }[] = [];
  if (shape) {
    const perLine = Math.max(20, Math.floor(textW / CHAR_W.body));
    let room = height - SK_H.header - SK_H.top;
    // Hero: top padding, logo, name, each line with its rows, bottom padding, rule.
    if (hero) {
      room -= 28 + (hero.logo ? 96 : 0) + 41 + 24 + 1;
      heroLines.forEach(rows => (room -= 6 + 19 * rows.length));
    }
    if (intro.logo) room -= 70;
    if (intro.title) room -= 28;
    if (intro.subtitle) room -= 24;
    if (intro.meta) room -= 24;

    for (const sec of shape) {
      if (room <= 0) break;
      room -= (hasIntro || shaped.length > 0 ? SK_H.gap : 0) + SK_H.head;
      const rows: (string | null)[] = [];
      for (const row of wrapLines(sec.lines, perLine)) {
        if (room <= 0) break;
        rows.push(row);
        room -= SK_H.line;
      }
      shaped.push({ head: Math.min(sec.head * CHAR_W.head, textW), rows });
    }
  }

  return (
    <View style={s.skRoot}>
      <DocHeader title={title} />
      {hero && (
        <>
          <View style={docStyles.hero}>
            {hero.logo && <Skeleton width={96} height={96} radius={14} />}
            <View style={[s.skLine, s.skHeroName]}>
              <Skeleton width={hero.name ? Math.min(hero.name * CHAR_W.heroName, heroW) : '56%'} height={18} />
            </View>
            {heroLines.map((rows, i) => (
              <View key={i} style={s.skHeroText}>
                {rows.map((w, r) => (
                  <View key={r} style={[s.skLine, s.skHeroRow]}>
                    <Skeleton width={w} height={11} />
                  </View>
                ))}
              </View>
            ))}
          </View>
          <View style={docStyles.rule} />
        </>
      )}
      <View style={docStyles.scroll}>
        {hasIntro && (
          <View>
            {intro.logo && <Skeleton width={56} height={56} radius={12} style={s.skLogo} />}
            {!!intro.title && (
              <View style={[s.skLine, s.skIntroTitle]}>
                <Skeleton width={introW(intro.title, CHAR_W.title, '58%')} height={18} />
              </View>
            )}
            {!!intro.subtitle && (
              <View style={[s.skLine, s.skIntroSub]}>
                <Skeleton width={introW(intro.subtitle, CHAR_W.subtitle, '44%')} height={11} />
              </View>
            )}
            {intro.meta && (
              <View style={[s.skLine, s.skIntroMeta]}>
                <Skeleton width={130} height={9} />
              </View>
            )}
          </View>
        )}

        {shape
          ? shaped.map((sec, i) => (
              <View key={`shape${i}`}>
                <View style={[s.skLine, s.skSectionTitle]}>
                  <Skeleton width={sec.head} height={14} />
                </View>
                {sec.rows.map((w, j) => (
                  <View key={j} style={[s.skLine, s.skBodyLine]}>
                    {w !== null && <Skeleton width={w} height={12} />}
                  </View>
                ))}
              </View>
            ))
          : Array.from({ length: sections }, (_, i) => (
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

  // A page that opens on a centred head (School Info): the logo, the name, short
  // lines under it, then a full-width rule.
  // 25 on each side, so the address and contact lines sit clear of the edges.
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 24, paddingHorizontal: 25 },
  heroLogo: { width: 96, height: 96 },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: 14,
  },
  heroLine: { fontSize: 13, lineHeight: 19, color: theme.colors.textMuted, textAlign: 'center', marginTop: 6 },
  heroLink: { color: theme.colors.primary, fontWeight: '500' },
  rule: { height: 1, backgroundColor: theme.colors.divider },

  // A small centred note at the foot of a page ("Last updated …").
  footnote: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },
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
  // Runs past the bottom of the screen, clipped there.
  skRoot: { flex: 1, backgroundColor: theme.colors.card, overflow: 'hidden' },
  skLine: { justifyContent: 'center' },
  skLogo: { marginBottom: 14 },
  skIntroTitle: { height: 28 },
  skIntroSub: { height: 20, marginTop: 4 },
  skIntroMeta: { height: 16, marginTop: 8 },
  skHeroName: { alignSelf: 'stretch', alignItems: 'center', height: 27, marginTop: 14 },
  skHeroText: { alignSelf: 'stretch', marginTop: 6 },
  skHeroRow: { alignItems: 'center', height: 19 },
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

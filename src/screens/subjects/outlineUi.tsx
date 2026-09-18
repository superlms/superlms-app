import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton, SkeletonIcon, SkeletonText } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader, DocNoData } from '../more/docUi';
import { getChapters, type SyllabusChapter, type TeacherCombo } from '../../api/contentApi';
import { plural } from './subjectsUi';
import { SubjectIcon } from './subjectIcon';
import { useChapters, type ChaptersState } from './useChapters';

/**
 * A subject's chapters as a page — shared by Subjects, Syllabus and Study
 * Content, so all three read the same once a subject has been picked.
 *
 * The subject's icon, its name and how much it holds, then the chapters as a
 * numbered outline on hairlines, without their descriptions. A chapter opens to
 * show its topics on one line under its name, separated by dots.
 */

// "10th A" — the class half of a teacher's class-and-subject pair.
export const comboClass = (c: TeacherCombo) =>
  [c.standardName, c.sectionName].filter(Boolean).join(' ');

// "Mathematics · 10th A"
export const comboLabel = (c: TeacherCombo) => {
  const cls = comboClass(c);
  return cls ? `${c.subjectName} · ${cls}` : c.subjectName;
};

export const comboChapters = (c: TeacherCombo) =>
  getChapters({ standard_id: c.standardId, section_id: c.sectionId, subject_id: c.subjectId });

// The chapter number column and the gap after it — topics line up with the
// chapter's name by adding the two.
const NO_COL = 24;
const GAP = 14;

// ── Topic ────────────────────────────────────────────────────────────────────
//   1.2   Newton's Laws                                   (right)
export const TopicLine = ({
  label,
  name,
  muted,
  right,
  onPress,
  divider,
  skeleton,
}: {
  label: string;
  name: string;
  muted?: boolean;
  right?: React.ReactNode;
  onPress?: () => void;
  /** A hairline under the topic, to set it off from the next one. */
  divider?: boolean;
  /** The number and name as bars as long as their words; nothing to press. */
  skeleton?: boolean;
}) => {
  const style = [s.topic, divider && s.topicDivider];
  if (skeleton) {
    return (
      <View style={style}>
        <SkeletonText style={s.topicNo}>{label}</SkeletonText>
        <View style={s.topicNameBox}>
          <SkeletonText style={s.topicNameText}>{quietCaps(name)}</SkeletonText>
        </View>
        {right}
      </View>
    );
  }
  const body = (
    <>
      <Text style={s.topicNo}>{label}</Text>
      <Text style={[s.topicName, muted && s.topicMuted]}>{quietCaps(name)}</Text>
      {right}
    </>
  );
  return onPress ? (
    <TouchableOpacity style={style} activeOpacity={0.6} onPress={onPress}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={style}>{body}</View>
  );
};

// ── Chapter ──────────────────────────────────────────────────────────────────
//   1   Motion and Laws                                    ⌄
//       3 topics
//       Introduction to Motion · Newton's Laws · Friction
export const ChapterRow = ({
  number,
  chapter,
  open,
  onToggle,
  isLast,
  expandable,
  trailing,
  showDescription,
  skeleton,
  children,
}: {
  number: number;
  chapter: SyllabusChapter;
  open: boolean;
  onToggle: () => void;
  isLast: boolean;
  /** Defaults to "has topics": a chapter with nothing in it does not offer to open. */
  expandable?: boolean;
  /** Replaces the chevron — a spinner while the chapter is being changed. */
  trailing?: React.ReactNode;
  /** The chapter's description under its name — only where it is being edited. */
  showDescription?: boolean;
  /** What the chapter opens onto; its topics on one line, dot-separated, by default. */
  children?: React.ReactNode;
  /** Every line a bar as long as its words, the arrow a grey box. */
  skeleton?: boolean;
}) => {
  const count = chapter.topics.length;
  const canOpen = expandable ?? count > 0;
  const Line = skeleton ? SkeletonText : Text;

  return (
    <View style={[!isLast && s.rowDivider]}>
      <TouchableOpacity style={s.chapter} activeOpacity={0.6} onPress={onToggle} disabled={!canOpen || skeleton}>
        <Line style={s.chapterNo}>{number}</Line>
        <View style={s.body}>
          <Line style={s.chapterName}>{quietCaps(chapter.name)}</Line>
          {showDescription && !!chapter.description && (
            <Text style={s.chapterDesc} numberOfLines={open ? undefined : 1}>
              {chapter.description}
            </Text>
          )}
          <Line style={s.meta}>{count > 0 ? plural(count, 'topic') : 'No topics yet'}</Line>
        </View>
        {trailing ??
          (canOpen &&
            (skeleton ? (
              <SkeletonIcon iconName={open ? 'chevron-up' : 'chevron-down'} size={16} style={s.chevron} />
            ) : (
              <VectorIcon
                iconSet="Ionicons"
                iconName={open ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.colors.textMuted}
                style={s.chevron}
              />
            )))}
      </TouchableOpacity>

      {open && canOpen && (
        <View style={s.topics}>
          {children ?? (
            <Line style={s.topicsInline}>
              {chapter.topics.map(topic => quietCaps(topic.name)).join('  ·  ')}
            </Line>
          )}
        </View>
      )}
    </View>
  );
};

// ── Loading ──────────────────────────────────────────────────────────────────
// The page line for line: the subject's icon, name and size, then each
// chapter's number, name, topic count and arrow — a row per chapter there was,
// or four before the first load.
const OutlineSkeleton = ({ rows }: { rows: number }) => {
  const n = rows > 0 ? Math.min(rows, 10) : 4;
  return (
    <View style={s.fill}>
      <View style={s.head}>
        <Skeleton width={39} height={39} radius={8} />
        <View style={[s.headText, s.skHeadText]}>
          <Skeleton width="55%" height={22} />
          <Skeleton width="40%" height={13} />
        </View>
      </View>
      <View style={s.divider} />
      <View style={s.list}>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={[s.chapter, i < n - 1 && s.rowDivider]}>
            <View style={s.skNo}>
              <Skeleton width={12} height={15} />
            </View>
            <View style={s.skeletonBody}>
              <Skeleton width="60%" height={15} />
              <Skeleton width="22%" height={12} />
            </View>
            <Skeleton width={14} height={14} />
          </View>
        ))}
      </View>
    </View>
  );
};

// The page drawn from its own chapters: the subject's icon as a grey tile, its
// name and size, then each chapter's number, name and topic count as bars as
// long as their words — and, for a chapter left open, its topics the same way.
const DrawnOutline = ({
  chapters,
  title,
  size,
  openIds,
  renderTopics,
  chapterExpandable,
}: {
  chapters: SyllabusChapter[];
  title: string;
  size: string;
  openIds: number[];
  renderTopics?: ChapterOutlineProps['renderTopics'];
  chapterExpandable?: (chapter: SyllabusChapter) => boolean;
}) => (
  <ScrollView style={s.fill} showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
    <View style={s.head}>
      <Skeleton width={39} height={39} radius={8} />
      <View style={s.headText}>
        <SkeletonText style={s.title}>{title}</SkeletonText>
        <SkeletonText style={s.size}>{size}</SkeletonText>
      </View>
    </View>
    <View style={s.divider} />
    <View style={s.list}>
      {chapters.map((chapter, i) => (
        <ChapterRow
          key={chapter.id}
          number={i + 1}
          chapter={chapter}
          open={openIds.includes(chapter.id)}
          onToggle={() => {}}
          isLast={i === chapters.length - 1}
          expandable={chapterExpandable?.(chapter)}
          skeleton
        >
          {renderTopics?.(chapter, i + 1, true)}
        </ChapterRow>
      ))}
    </View>
  </ScrollView>
);

/**
 * What a chapter keeps for the next load's skeleton: names and order, and for
 * each topic only which kinds of material it has — not the material itself.
 */
export const keepChapters = (chapters: SyllabusChapter[]): SyllabusChapter[] =>
  chapters.map(c => ({
    id: c.id,
    name: c.name,
    description: null,
    subjectId: c.subjectId,
    order: c.order,
    topics: c.topics.map(t => ({
      id: t.id,
      name: t.name,
      order: t.order,
      content: t.content?.trim() ? '·' : null,
      imageUrl: t.imageUrl ? '·' : null,
      pdfUrl: t.pdfUrl ? '·' : null,
      link: t.link?.trim() ? '·' : null,
    })),
  }));

// "10th A · 6 chapters · 24 topics · 3 with material"
const sizeLine = (
  chapters: SyllabusChapter[],
  subtitle?: string | null,
  summaryExtra?: (chapters: SyllabusChapter[]) => string | null,
) => {
  const topicCount = chapters.reduce((sum, c) => sum + c.topics.length, 0);
  return [
    subtitle,
    chapters.length === 0 ? 'No chapters yet' : plural(chapters.length, 'chapter'),
    chapters.length > 0 ? plural(topicCount, 'topic') : null,
    chapters.length > 0 ? summaryExtra?.(chapters) : null,
  ]
    .filter(Boolean)
    .join(' · ');
};

// ── The page ─────────────────────────────────────────────────────────────────
export interface ChapterOutlineProps {
  outline: ChaptersState;
  /** The subject's name. */
  title: string;
  /** Said ahead of the counts — the class, on a teacher's screens. */
  subtitle?: string | null;
  image?: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  emptyChapters: { title: string; subtitle: string };
  /** One more thing to say after the counts, e.g. how much has material. */
  summaryExtra?: (chapters: SyllabusChapter[]) => string | null;
  /** What an open chapter shows; its topics as plain lines by default. `skeleton` while drawn loading. */
  renderTopics?: (chapter: SyllabusChapter, number: number, skeleton?: boolean) => React.ReactNode;
  chapterExpandable?: (chapter: SyllabusChapter) => boolean;
  renderTrailing?: (chapter: SyllabusChapter) => React.ReactNode;
  /** Chapter descriptions under their names — only where the syllabus is edited. */
  showDescriptions?: boolean;
  /**
   * The chapters to draw as the skeleton while loading — those on screen, or
   * those kept from last time (OutlineScreen's `keep`). A plain skeleton without.
   */
  drawn?: SyllabusChapter[];
}

export const ChapterOutline = ({
  outline,
  title,
  subtitle,
  image,
  refreshing,
  onRefresh,
  emptyChapters,
  summaryExtra,
  renderTopics,
  chapterExpandable,
  renderTrailing,
  showDescriptions,
  drawn,
}: ChapterOutlineProps) => {
  const { chapters, error, load, openIds, toggle } = outline;

  if (chapters === null && error) {
    return (
      <View style={s.centeredBox}>
        <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity onPress={load} hitSlop={10}>
          <Text style={s.linkText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // The first load and a pull to refresh show the skeleton; coming back to the
  // page refetches quietly, without blanking it.
  if (chapters === null || refreshing) {
    return drawn ? (
      <DrawnOutline
        chapters={drawn}
        title={title}
        size={sizeLine(drawn, subtitle, summaryExtra)}
        openIds={openIds}
        renderTopics={renderTopics}
        chapterExpandable={chapterExpandable}
      />
    ) : (
      <OutlineSkeleton rows={chapters?.length ?? 0} />
    );
  }

  const size = sizeLine(chapters, subtitle, summaryExtra);

  return (
    <ScrollView
      style={s.fill}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[s.scroll, chapters.length === 0 && s.grow]}
      refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* The subject, and how much of it there is */}
      <View style={s.head}>
        <SubjectIcon image={image} size={39} />
        <View style={s.headText}>
          {/* The subject's name as the school typed it in the admin panel */}
          <Text style={s.title}>{title}</Text>
          <Text style={s.size}>{size}</Text>
        </View>
      </View>
      <View style={s.divider} />

      {chapters.length === 0 ? (
        <DocNoData icon="albums-outline" title={emptyChapters.title} subtitle={emptyChapters.subtitle} />
      ) : (
        <View style={s.list}>
          {chapters.map((chapter, i) => (
            <ChapterRow
              key={chapter.id}
              number={i + 1}
              chapter={chapter}
              open={openIds.includes(chapter.id)}
              onToggle={() => toggle(chapter.id)}
              isLast={i === chapters.length - 1}
              expandable={chapterExpandable?.(chapter)}
              trailing={renderTrailing?.(chapter)}
              showDescription={showDescriptions}
            >
              {renderTopics?.(chapter, i + 1)}
            </ChapterRow>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

// ── A whole detail screen: header, then the page ─────────────────────────────
export const OutlineScreen = ({
  navigation,
  headerTitle,
  rightIcon,
  onRightPress,
  rightSlot,
  renderExtra,
  fetchChapters,
  keep,
  ...page
}: Omit<ChapterOutlineProps, 'outline' | 'refreshing' | 'onRefresh' | 'drawn'> & {
  navigation: any;
  headerTitle: string;
  rightIcon?: string;
  onRightPress?: () => void;
  /** Several header buttons, in place of rightIcon. */
  rightSlot?: React.ReactNode;
  /** Drawn after the page with its chapters to hand — e.g. a sheet that adds to them. */
  renderExtra?: (outline: ChaptersState) => React.ReactNode;
  fetchChapters: () => Promise<SyllabusChapter[]>;
  /**
   * Keep the chapters on this phone under `name` (keepChapters), and while the
   * page loads draw it from them — or from `sample` before its first load.
   */
  keep?: { name: string; sample: SyllabusChapter[] };
}) => {
  const outline = useChapters(fetchChapters);
  const { refreshing, onRefresh } = useRefresh(outline.load);
  const [last, remember] = useLastLoaded<SyllabusChapter[]>(keep?.name ?? null);

  useFocusLoad(outline.load);

  const keepName = keep?.name;
  useEffect(() => {
    if (keepName && outline.chapters) remember(keepChapters(outline.chapters));
  }, [keepName, outline.chapters, remember]);

  const drawn = keep ? outline.chapters ?? (Array.isArray(last) ? last : keep.sample) : undefined;

  return (
    <View style={s.root}>
      <DocHeader
        title={headerTitle}
        onBackPress={() => navigation.goBack()}
        rightIcon={rightIcon}
        onRightPress={onRightPress}
        rightSlot={rightSlot}
      />
      <ChapterOutline outline={outline} refreshing={refreshing} onRefresh={onRefresh} drawn={drawn} {...page} />
      {renderExtra?.(outline)}
    </View>
  );
};

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  scroll: { paddingBottom: 40 },
  grow: { flexGrow: 1 },

  // Head
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
  },
  headText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 29, color: theme.colors.textPrimary },
  size: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },

  divider: { height: 1, backgroundColor: theme.colors.divider },

  // Chapters
  list: { paddingHorizontal: 20 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  chapter: { flexDirection: 'row', alignItems: 'flex-start', gap: GAP, paddingVertical: 14 },
  chapterNo: { width: NO_COL, fontSize: 15, fontWeight: '600', lineHeight: 20, color: theme.colors.textMuted },
  body: { flex: 1, gap: 3 },
  chapterName: { fontSize: 15, fontWeight: '500', lineHeight: 20, color: theme.colors.textPrimary },
  chapterDesc: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  meta: { fontSize: 12, color: theme.colors.textMuted },
  chevron: { marginTop: 2 },

  // Topics, set in under the chapter's name
  topics: { marginLeft: NO_COL + GAP, paddingBottom: 12 },
  topicsInline: { fontSize: 14, lineHeight: 22, color: theme.colors.textSecondary },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  topicDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  topicNo: { width: 34, fontSize: 13, lineHeight: 20, color: theme.colors.textMuted },
  topicName: { flex: 1, fontSize: 14, lineHeight: 20, color: theme.colors.textPrimary },
  topicMuted: { color: theme.colors.textSecondary },
  topicNameBox: { flex: 1 },
  topicNameText: { fontSize: 14, lineHeight: 20 },

  // Loading
  skeletonBody: { flex: 1, gap: 8 },
  skNo: { width: NO_COL },
  skHeadText: { gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader, DocNoData } from '../more/docUi';
import { getChapters, type SyllabusChapter, type TeacherCombo } from '../../api/contentApi';
import { plural, resolveFileUrl } from './subjectsUi';
import { useChapters, type ChaptersState } from './useChapters';

/**
 * A subject's chapters as a page — shared by Subjects, Syllabus and Study
 * Content, so all three read the same once a subject has been picked.
 *
 * The subject's icon, its name and how much it holds, then the chapters as a
 * numbered outline on hairlines. A chapter opens to show its topics under its
 * name as 1.1, 1.2 …
 */

// "10th A" — the class half of a teacher's class-and-subject pair.
export const comboClass = (c: TeacherCombo) =>
  [c.standardName, c.sectionName].filter(Boolean).join(' ');

// "Mathematics · 10th A"
export const comboLabel = (c: TeacherCombo) => {
  const cls = comboClass(c);
  return cls ? `${quietCaps(c.subjectName)} · ${cls}` : quietCaps(c.subjectName);
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
}: {
  label: string;
  name: string;
  muted?: boolean;
  right?: React.ReactNode;
  onPress?: () => void;
}) => {
  const body = (
    <>
      <Text style={s.topicNo}>{label}</Text>
      <Text style={[s.topicName, muted && s.topicMuted]}>{quietCaps(name)}</Text>
      {right}
    </>
  );
  return onPress ? (
    <TouchableOpacity style={s.topic} activeOpacity={0.6} onPress={onPress}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={s.topic}>{body}</View>
  );
};

// ── Chapter ──────────────────────────────────────────────────────────────────
//   1   Motion and Laws                                    ⌄
//       3 topics
//         1.1   Introduction to Motion
export const ChapterRow = ({
  number,
  chapter,
  open,
  onToggle,
  isLast,
  expandable,
  trailing,
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
  /** What the chapter opens onto; its topics as plain lines by default. */
  children?: React.ReactNode;
}) => {
  const count = chapter.topics.length;
  const canOpen = expandable ?? count > 0;

  return (
    <View style={[!isLast && s.rowDivider]}>
      <TouchableOpacity style={s.chapter} activeOpacity={0.6} onPress={onToggle} disabled={!canOpen}>
        <Text style={s.chapterNo}>{number}</Text>
        <View style={s.body}>
          <Text style={s.chapterName}>{quietCaps(chapter.name)}</Text>
          {!!chapter.description && (
            <Text style={s.chapterDesc} numberOfLines={open ? undefined : 1}>
              {chapter.description}
            </Text>
          )}
          <Text style={s.meta}>{count > 0 ? plural(count, 'topic') : 'No topics yet'}</Text>
        </View>
        {trailing ??
          (canOpen && (
            <VectorIcon
              iconSet="Ionicons"
              iconName={open ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.colors.textMuted}
              style={s.chevron}
            />
          ))}
      </TouchableOpacity>

      {open && canOpen && (
        <View style={s.topics}>
          {children ??
            chapter.topics.map((topic, i) => (
              <TopicLine key={topic.id} label={`${number}.${i + 1}`} name={topic.name} />
            ))}
        </View>
      )}
    </View>
  );
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
  /** What an open chapter shows; its topics as plain lines by default. */
  renderTopics?: (chapter: SyllabusChapter, number: number) => React.ReactNode;
  chapterExpandable?: (chapter: SyllabusChapter) => boolean;
  renderTrailing?: (chapter: SyllabusChapter) => React.ReactNode;
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
}: ChapterOutlineProps) => {
  const [imgFailed, setImgFailed] = useState(false);
  const { chapters, error, load, openIds, toggle } = outline;

  if (chapters === null) {
    return error ? (
      <View style={s.centeredBox}>
        <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity onPress={load} hitSlop={10}>
          <Text style={s.linkText}>Try again</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={s.loading}>
        <Skeleton width="45%" height={22} />
        <Skeleton width="30%" height={12} />
        <View style={s.loadingRows}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={s.skeletonRow}>
              <Skeleton width={14} height={14} />
              <View style={s.skeletonBody}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="25%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const imageUrl = resolveFileUrl(image);
  const topicCount = chapters.reduce((sum, c) => sum + c.topics.length, 0);
  const size = [
    subtitle,
    chapters.length === 0 ? 'No chapters yet' : plural(chapters.length, 'chapter'),
    chapters.length > 0 ? plural(topicCount, 'topic') : null,
    chapters.length > 0 ? summaryExtra?.(chapters) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScrollView
      style={s.fill}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[s.scroll, chapters.length === 0 && s.grow]}
      refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* The subject, and how much of it there is */}
      <View style={s.head}>
        {!!imageUrl && !imgFailed && (
          <View style={s.headIcon}>
            <Image
              source={{ uri: imageUrl }}
              style={s.headImage}
              resizeMode="contain"
              onError={() => setImgFailed(true)}
            />
          </View>
        )}
        <View style={s.headText}>
          <Text style={s.title}>{quietCaps(title)}</Text>
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
  fetchChapters,
  ...page
}: Omit<ChapterOutlineProps, 'outline' | 'refreshing' | 'onRefresh'> & {
  navigation: any;
  headerTitle: string;
  rightIcon?: string;
  onRightPress?: () => void;
  fetchChapters: () => Promise<SyllabusChapter[]>;
}) => {
  const outline = useChapters(fetchChapters);
  const { refreshing, onRefresh } = useRefresh(outline.load);

  useFocusLoad(outline.load);

  return (
    <View style={s.root}>
      <DocHeader
        title={headerTitle}
        onBackPress={() => navigation.goBack()}
        rightIcon={rightIcon}
        onRightPress={onRightPress}
      />
      <ChapterOutline outline={outline} refreshing={refreshing} onRefresh={onRefresh} {...page} />
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
  headIcon: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headImage: { width: 34, height: 34 },
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
  topic: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  topicNo: { width: 34, fontSize: 13, lineHeight: 20, color: theme.colors.textMuted },
  topicName: { flex: 1, fontSize: 14, lineHeight: 20, color: theme.colors.textPrimary },
  topicMuted: { color: theme.colors.textSecondary },

  // Loading
  loading: { padding: 20, gap: 10 },
  loadingRows: { marginTop: 22, gap: 22 },
  skeletonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: GAP },
  skeletonBody: { flex: 1, gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

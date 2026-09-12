import React, { useCallback, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  getChapters,
  contentErrorMessage,
  type SyllabusChapter,
} from '../../api/contentApi';
import { plural, resolveFileUrl } from './subjectsUi';

const TITLE = 'Subject';

// ── One chapter ──────────────────────────────────────────────────────────────
//   1   Motion and Laws                                    ⌄
//       3 topics
//         1.1   Introduction to Motion
//         1.2   Newton's Laws
const ChapterRow = ({
  number,
  chapter,
  open,
  onToggle,
  isLast,
}: {
  number: number;
  chapter: SyllabusChapter;
  open: boolean;
  onToggle: () => void;
  isLast: boolean;
}) => {
  const count = chapter.topics.length;

  return (
    <View style={[!isLast && s.rowDivider]}>
      {/* A chapter with no topics has nothing to open, and does not offer to. */}
      <TouchableOpacity style={s.chapter} activeOpacity={0.6} onPress={onToggle} disabled={count === 0}>
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
        {count > 0 && (
          <VectorIcon
            iconSet="Ionicons"
            iconName={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.colors.textMuted}
            style={s.chevron}
          />
        )}
      </TouchableOpacity>

      {open && count > 0 && (
        <View style={s.topics}>
          {chapter.topics.map((topic, i) => (
            <View key={topic.id} style={s.topic}>
              <Text style={s.topicNo}>{`${number}.${i + 1}`}</Text>
              <Text style={s.topicName}>{quietCaps(topic.name)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const SubjectDetailsScreen = ({ navigation, route }: any) => {
  const subjectId: number = route?.params?.subjectId;
  const subjectName = quietCaps(route?.params?.subjectName ?? 'Subject');
  const subjectImage = resolveFileUrl(route?.params?.subjectImage);
  const [imgFailed, setImgFailed] = useState(false);

  // null until the first load lands.
  const [chapters, setChapters] = useState<SyllabusChapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<number[]>([]);
  // The first chapter with topics opens on arrival — once, so a refetch on
  // coming back does not undo what the reader has opened and closed since.
  const openedOnArrival = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await getChapters({ subject_id: subjectId });
      setChapters(list);
      if (!openedOnArrival.current) {
        openedOnArrival.current = true;
        const first = list.find(c => c.topics.length > 0);
        if (first) setOpenIds([first.id]);
      }
    } catch (e: any) {
      console.log('[SubjectDetails] Error:', e?.response?.status, e?.message);
      // A failed refresh keeps whatever was already on screen.
      setError(contentErrorMessage(e));
    }
  }, [subjectId]);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  const toggle = (id: number) =>
    setOpenIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  if (chapters === null) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        {error ? (
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
        )}
      </View>
    );
  }

  const topicCount = chapters.reduce((sum, c) => sum + c.topics.length, 0);
  const size =
    chapters.length === 0
      ? 'No chapters yet'
      : [plural(chapters.length, 'chapter'), plural(topicCount, 'topic')].join(' · ');

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, chapters.length === 0 && s.grow]}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* The subject, and how much of it there is */}
        <View style={s.head}>
          {!!subjectImage && !imgFailed && (
            <View style={s.headIcon}>
              <Image
                source={{ uri: subjectImage }}
                style={s.headImage}
                resizeMode="contain"
                onError={() => setImgFailed(true)}
              />
            </View>
          )}
          <View style={s.headText}>
            <Text style={s.title}>{subjectName}</Text>
            <Text style={s.size}>{size}</Text>
          </View>
        </View>
        <View style={s.divider} />

        {chapters.length === 0 ? (
          <DocNoData
            icon="albums-outline"
            title="No chapters yet"
            subtitle={`Chapters for ${subjectName} will appear here once your teacher adds them.`}
          />
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
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default SubjectDetailsScreen;

// The chapter number column and the gap after it — topics line up with the
// chapter's name by adding the two.
const NO_COL = 24;
const GAP = 14;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
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
  topic: { flexDirection: 'row', paddingVertical: 6 },
  topicNo: { width: 36, fontSize: 13, lineHeight: 20, color: theme.colors.textMuted },
  topicName: { flex: 1, fontSize: 14, lineHeight: 20, color: theme.colors.textPrimary },

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

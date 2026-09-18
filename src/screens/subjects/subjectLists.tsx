import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton, SkeletonIcon, SkeletonText } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  getStudentSubjects,
  getTeacherSubjects,
  getChapters,
  contentErrorMessage,
  type StudentSubject,
  type SyllabusChapter,
  type TeacherCombo,
} from '../../api/contentApi';
import { plural } from './subjectsUi';
import { comboClass } from './outlineUi';
import { SubjectIcon } from './subjectIcon';

/**
 * The first screen of Subjects, Syllabus and Study Content: the subjects as
 * plain rows, each opening onto that subject's chapters — except a student's
 * Subjects, which is the list alone.
 */

// ── One subject ──────────────────────────────────────────────────────────────
//   (icon)  English                                          >
//           10 chapters · 24 topics
// Without onPress the row opens nothing, and has no arrow.
export const SubjectRow = ({
  image,
  title,
  meta,
  isLast,
  onPress,
  trailing,
  skeleton,
}: {
  image?: string | null;
  title: string;
  meta?: string | null;
  isLast: boolean;
  onPress?: () => void;
  /** Shown at the row's end, before any arrow — a subject's score, say. */
  trailing?: React.ReactNode;
  /** The icon a grey tile, the name and size bars as long as their words. */
  skeleton?: boolean;
}) => {
  const Line = skeleton ? SkeletonText : Text;
  const body = (
    <>
      {skeleton ? <Skeleton width={30} height={30} radius={6} /> : <SubjectIcon image={image} size={30} />}

      <View style={s.body}>
        <Line style={s.name} numberOfLines={1}>
          {title}
        </Line>
        {!!meta && (
          <Line style={s.meta} numberOfLines={1}>
            {meta}
          </Line>
        )}
      </View>

      {trailing}

      {!!onPress &&
        (skeleton ? (
          <SkeletonIcon iconName="chevron-forward" size={13} />
        ) : (
          <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
        ))}
    </>
  );

  return onPress ? (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider]}
      activeOpacity={0.6}
      onPress={onPress}
      disabled={skeleton}
    >
      {body}
    </TouchableOpacity>
  ) : (
    <View style={[s.row, !isLast && s.rowDivider]}>{body}</View>
  );
};

interface Item {
  key: string;
  image?: string | null;
  title: string;
  meta?: string | null;
  onPress?: () => void;
}

/** What a row says, kept so the list can draw itself as a skeleton next time. */
export interface KeptSubject {
  key: string;
  title: string;
  meta?: string | null;
}

/**
 * A list that keeps what it held on this phone (under `name`) and, while it
 * loads, draws itself from that — or from `sample` before its first load.
 */
export interface KeepList {
  name: string;
  sample: KeptSubject[];
}

const toKept = (items: Item[]): KeptSubject[] => items.map(({ key, title, meta }) => ({ key, title, meta }));

// The rows a loading list draws: those on screen, else those it held last time, else the sample.
const useDrawn = (keep: KeepList | undefined, loaded: boolean, items: Item[]) => {
  const [last, remember] = useLastLoaded<KeptSubject[]>(keep?.name ?? null);
  const kept = loaded ? toKept(items) : null;
  const keptKey = kept ? JSON.stringify(kept) : null;

  const keepName = keep?.name;
  useEffect(() => {
    if (keepName && keptKey) remember(JSON.parse(keptKey));
  }, [keepName, keptKey, remember]);

  if (!keep) return undefined;
  if (kept && kept.length > 0) return kept;
  return Array.isArray(last) && last.length > 0 ? last : keep.sample;
};

// ── Loading ──────────────────────────────────────────────────────────────────
// The list line for line: the count, then each subject's icon tile, name, size
// and arrow (where rows open) — a row per subject there was, or five before the
// first load.
// The list drawn from its own rows: the count, then each subject's icon as a
// grey tile, and its name and line as bars as long as their words.
const DrawnSkeleton = ({ rows, arrows }: { rows: KeptSubject[]; arrows: boolean }) => (
  <View style={s.list}>
    <View style={s.countBox}>
      <SkeletonText style={s.countText}>{plural(rows.length, 'subject')}</SkeletonText>
    </View>
    {rows.map((r, i) => (
      <SubjectRow
        key={r.key}
        title={r.title}
        meta={r.meta}
        isLast={i === rows.length - 1}
        onPress={arrows ? () => {} : undefined}
        skeleton
      />
    ))}
  </View>
);

const ListSkeleton = ({ rows, arrows }: { rows: number; arrows: boolean }) => {
  const n = rows > 0 ? Math.min(rows, 10) : 5;
  return (
    <View style={s.list}>
      <View style={s.skeletonCount}>
        <Skeleton width={70} height={12} />
      </View>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={[s.row, i < n - 1 && s.rowDivider]}>
          <Skeleton width={30} height={30} radius={6} />
          <View style={s.skeletonBody}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="35%" height={12} />
          </View>
          {arrows && <Skeleton width={8} height={13} />}
        </View>
      ))}
    </View>
  );
};

const ListBody = ({
  loading,
  refreshing,
  onRefresh,
  error,
  onRetry,
  items,
  openable,
  empty,
  drawn,
}: {
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  error: string | null;
  onRetry: () => void;
  items: Item[];
  /** Whether the rows open onto anything — the skeleton draws their arrows. */
  openable: boolean;
  empty: { title: string; subtitle: string };
  /** The rows to draw as the skeleton (see KeepList); a plain one without. */
  drawn?: KeptSubject[];
}) => {
  // The first load and a pull to refresh show the skeleton; coming back to the
  // list refetches quietly, without blanking it.
  if (refreshing || (loading && items.length === 0)) {
    return drawn ? (
      <DrawnSkeleton rows={drawn} arrows={openable} />
    ) : (
      <ListSkeleton rows={items.length} arrows={openable} />
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={s.centeredBox}>
        <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity onPress={onRetry} hitSlop={10}>
          <Text style={s.linkText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={i => i.key}
      contentContainerStyle={[s.list, items.length === 0 && s.listEmpty]}
      showsVerticalScrollIndicator={false}
      refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        items.length > 0 ? <Text style={s.count}>{plural(items.length, 'subject')}</Text> : null
      }
      ListEmptyComponent={<DocNoData icon="albums-outline" title={empty.title} subtitle={empty.subtitle} />}
      renderItem={({ item, index }) => (
        <SubjectRow
          image={item.image}
          title={item.title}
          meta={item.meta}
          isLast={index === items.length - 1}
          onPress={item.onPress}
        />
      )}
    />
  );
};

// ── A student's subjects ─────────────────────────────────────────────────────
export interface SubjectWithChapters extends StudentSubject {
  chapters: SyllabusChapter[];
}

// "10 chapters · 24 topics", or "No chapters yet".
export const chapterSize = (chapters: SyllabusChapter[]) => {
  if (chapters.length === 0) return 'No chapters yet';
  const topics = chapters.reduce((sum, c) => sum + c.topics.length, 0);
  return [plural(chapters.length, 'chapter'), topics > 0 ? plural(topics, 'topic') : null]
    .filter(Boolean)
    .join(' · ');
};

export const StudentSubjectList = ({
  navigation,
  title,
  metaFor = sub => chapterSize(sub.chapters),
  onOpen,
  keep,
}: {
  navigation: any;
  title: string;
  metaFor?: (subject: SubjectWithChapters) => string | null;
  /** Leave out for a list that opens nothing. */
  onOpen?: (subject: SubjectWithChapters) => void;
  /** Draw the loading list from what it held last time (see KeepList). */
  keep?: KeepList;
}) => {
  const [subjects, setSubjects] = useState<SubjectWithChapters[]>([]);
  const [loading, setLoading] = useState(true);
  // The list on screen came from the school.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Subjects + all of the student's chapters (auto-scoped to their class),
      // then group the chapters under each subject for the counts.
      const [subs, chapters] = await Promise.all([getStudentSubjects(), getChapters({})]);
      const bySubject = new Map<number, SyllabusChapter[]>();
      chapters.forEach(c => {
        if (c.subjectId == null) return;
        const list = bySubject.get(c.subjectId) ?? [];
        list.push(c);
        bySubject.set(c.subjectId, list);
      });
      setSubjects(subs.map(sub => ({ ...sub, chapters: bySubject.get(sub.id) ?? [] })));
      setLoaded(true);
    } catch (e: any) {
      console.log('[StudentSubjectList] Error:', e?.response?.status, e?.message);
      setError(contentErrorMessage(e));
      setSubjects([]);
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  const items: Item[] = subjects.map(sub => ({
    key: String(sub.id),
    image: sub.image,
    // The name as the school typed it in the admin panel.
    title: sub.name,
    meta: metaFor(sub),
    onPress: onOpen ? () => onOpen(sub) : undefined,
  }));
  const drawn = useDrawn(keep, loaded, items);

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />
      <ListBody
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        error={error}
        onRetry={load}
        items={items}
        openable={!!onOpen}
        empty={{ title: 'No subjects yet', subtitle: 'No subjects have been assigned to your class.' }}
        drawn={drawn}
      />
    </View>
  );
};

// ── A teacher's class-and-subject pairs ──────────────────────────────────────
export const TeacherSubjectList = ({
  navigation,
  title,
  onOpen,
  keep,
}: {
  navigation: any;
  title: string;
  onOpen: (combo: TeacherCombo) => void;
  /** Draw the loading list from what it held last time (see KeepList). */
  keep?: KeepList;
}) => {
  const [combos, setCombos] = useState<TeacherCombo[]>([]);
  const [loading, setLoading] = useState(true);
  // The list on screen came from the school.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCombos(await getTeacherSubjects());
      setLoaded(true);
    } catch (e: any) {
      console.log('[TeacherSubjectList] Error:', e?.response?.status, e?.message);
      setError(contentErrorMessage(e));
      setCombos([]);
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  const items: Item[] = combos.map(c => ({
    key: c.key,
    image: c.subjectImage,
    title: c.subjectName,
    meta: comboClass(c) || null,
    onPress: () => onOpen(c),
  }));
  const drawn = useDrawn(keep, loaded, items);

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />
      <ListBody
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        error={error}
        onRetry={load}
        items={items}
        openable
        empty={{ title: 'No subjects assigned', subtitle: 'You don’t teach any class and subject yet.' }}
        drawn={drawn}
      />
    </View>
  );
};

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },
  countBox: { paddingTop: 12, paddingBottom: 2 },
  countText: { fontSize: 12 },

  // Row — the subject's own coloured icon tile, then its name and size
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },

  // Loading
  skeletonBody: { flex: 1, gap: 8 },
  skeletonCount: { paddingTop: 13, paddingBottom: 3 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

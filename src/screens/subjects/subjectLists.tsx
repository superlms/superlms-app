import React, { useCallback, useState } from 'react';
import {
  FlatList,
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
 * plain rows, each opening onto that subject's chapters.
 */

// ── One subject ──────────────────────────────────────────────────────────────
//   (icon)  English                                          >
//           10 chapters · 24 topics
export const SubjectRow = ({
  image,
  title,
  meta,
  isLast,
  onPress,
}: {
  image?: string | null;
  title: string;
  meta?: string | null;
  isLast: boolean;
  onPress: () => void;
}) => (
    <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onPress}>
      <SubjectIcon image={image} />

      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>
          {title}
        </Text>
        {!!meta && (
          <Text style={s.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>

      <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
    </TouchableOpacity>
);

interface Item {
  key: string;
  image?: string | null;
  title: string;
  meta?: string | null;
  onPress: () => void;
}

const ListBody = ({
  loading,
  refreshing,
  onRefresh,
  error,
  onRetry,
  items,
  empty,
}: {
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  error: string | null;
  onRetry: () => void;
  items: Item[];
  empty: { title: string; subtitle: string };
}) => {
  // Coming back to the list refetches quietly, without blanking it.
  if (loading && !refreshing && items.length === 0) {
    return (
      <View style={s.list}>
        {[0, 1, 2, 3, 4].map(i => (
          <View key={i} style={[s.row, i < 4 && s.rowDivider]}>
            <Skeleton width={40} height={40} radius={theme.radius.sm} />
            <View style={s.skeletonBody}>
              <Skeleton width="45%" height={14} />
              <Skeleton width="35%" height={12} />
            </View>
          </View>
        ))}
      </View>
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
}: {
  navigation: any;
  title: string;
  metaFor?: (subject: SubjectWithChapters) => string | null;
  onOpen: (subject: SubjectWithChapters) => void;
}) => {
  const [subjects, setSubjects] = useState<SubjectWithChapters[]>([]);
  const [loading, setLoading] = useState(true);
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
    } catch (e: any) {
      console.log('[StudentSubjectList] Error:', e?.response?.status, e?.message);
      setError(contentErrorMessage(e));
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  const items: Item[] = subjects.map(sub => ({
    key: String(sub.id),
    image: sub.image,
    title: quietCaps(sub.name),
    meta: metaFor(sub),
    onPress: () => onOpen(sub),
  }));

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
        empty={{ title: 'No subjects yet', subtitle: 'No subjects have been assigned to your class.' }}
      />
    </View>
  );
};

// ── A teacher's class-and-subject pairs ──────────────────────────────────────
export const TeacherSubjectList = ({
  navigation,
  title,
  onOpen,
}: {
  navigation: any;
  title: string;
  onOpen: (combo: TeacherCombo) => void;
}) => {
  const [combos, setCombos] = useState<TeacherCombo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCombos(await getTeacherSubjects());
    } catch (e: any) {
      console.log('[TeacherSubjectList] Error:', e?.response?.status, e?.message);
      setError(contentErrorMessage(e));
      setCombos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  const items: Item[] = combos.map(c => ({
    key: c.key,
    image: c.subjectImage,
    title: quietCaps(c.subjectName),
    meta: comboClass(c) || null,
    onPress: () => onOpen(c),
  }));

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
        empty={{ title: 'No subjects assigned', subtitle: 'You don’t teach any class and subject yet.' }}
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

  // Row — the subject's own coloured icon tile, then its name and size
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },

  // Loading
  skeletonBody: { flex: 1, gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

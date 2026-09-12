import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
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
  getChapters,
  contentErrorMessage,
  type SyllabusChapter,
} from '../../api/contentApi';
import { plural, resolveFileUrl } from './subjectsUi';

const TITLE = 'Subjects';

interface SubjectRow {
  id: number;
  name: string;
  image: string | null;
  chapters: SyllabusChapter[];
}

// ── One subject ──────────────────────────────────────────────────────────────
//   (icon)  English                                          >
//           10 chapters · 24 topics
const SubjectItem = ({
  item,
  isLast,
  onPress,
}: {
  item: SubjectRow;
  isLast: boolean;
  onPress: () => void;
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = resolveFileUrl(item.image);
  const chapters = item.chapters.length;
  const topics = item.chapters.reduce((sum, c) => sum + c.topics.length, 0);

  const meta =
    chapters === 0
      ? 'No chapters yet'
      : [plural(chapters, 'chapter'), topics > 0 ? plural(topics, 'topic') : null]
          .filter(Boolean)
          .join(' · ');

  return (
    <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onPress}>
      <View style={s.iconSlot}>
        {imageUrl && !imgFailed ? (
          <Image
            source={{ uri: imageUrl }}
            style={s.icon}
            resizeMode="contain"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <VectorIcon iconSet="Ionicons" iconName="albums-outline" size={20} color={theme.colors.textMuted} />
        )}
      </View>

      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>
          {quietCaps(item.name)}
        </Text>
        <Text style={s.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>

      <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
};

const SubjectsScreen = ({ navigation }: any) => {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Subjects + all of the student's chapters (auto-scoped to their class),
      // then group the chapters under each subject for the counts.
      const [subs, chapters] = await Promise.all([
        getStudentSubjects(),
        getChapters({}),
      ]);
      const bySubject = new Map<number, SyllabusChapter[]>();
      chapters.forEach(c => {
        if (c.subjectId == null) return;
        const list = bySubject.get(c.subjectId) ?? [];
        list.push(c);
        bySubject.set(c.subjectId, list);
      });
      setSubjects(
        subs.map(sub => ({
          id: sub.id,
          name: sub.name,
          image: sub.image ?? null,
          chapters: bySubject.get(sub.id) ?? [],
        })),
      );
    } catch (e: any) {
      console.log('[SubjectsScreen] Error:', e?.response?.status, e?.message);
      setError(contentErrorMessage(e));
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} />

      {/* Coming back to the list refetches quietly, without blanking it. */}
      {loading && !refreshing && subjects.length === 0 ? (
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
      ) : error && subjects.length === 0 ? (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={[s.list, subjects.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            subjects.length > 0 ? <Text style={s.count}>{plural(subjects.length, 'subject')}</Text> : null
          }
          ListEmptyComponent={
            <DocNoData
              icon="albums-outline"
              title="No subjects yet"
              subtitle="No subjects have been assigned to your class."
            />
          }
          renderItem={({ item, index }) => (
            <SubjectItem
              item={item}
              isLast={index === subjects.length - 1}
              onPress={() =>
                navigation.navigate('SubjectDetails', {
                  subjectId: item.id,
                  subjectName: item.name,
                  subjectImage: item.image,
                })
              }
            />
          )}
        />
      )}
    </View>
  );
};

export default SubjectsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },

  // Row — the subject's own icon on the page's grey, then its name and size
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconSlot: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 26, height: 26 },
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

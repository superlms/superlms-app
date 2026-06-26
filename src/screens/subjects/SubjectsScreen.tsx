import React, { useCallback, useEffect, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import constant from '../../utils/constant';
import {
  getStudentSubjects,
  getChapters,
  contentErrorMessage,
  subjectStyle,
  type SyllabusChapter,
} from '../../api/contentApi';

// Subject images come from the same host as the API but outside the /api/v1 prefix.
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

interface SubjectRow {
  id: number;
  name: string;
  color: string;
  image: string | null;
  chapters: SyllabusChapter[];
}

// ─── Subject card ─────────────────────────────────────────────────────────────
const SubjectCard = ({ item, onPress }: { item: SubjectRow; onPress: () => void }) => {
  const totalTopics = item.chapters.reduce((sum, c) => sum + c.topics.length, 0);
  const imageUrl = resolveFileUrl(item.image);
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!imageUrl && !imgFailed;
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[s.accentBar, { backgroundColor: item.color }]} />
      <View style={s.cardInner}>
        <View style={s.cardTop}>
          <View style={[s.iconWrap, { backgroundColor: item.color + '20' }]}>
            {showImage ? (
              <Image
                source={{ uri: imageUrl }}
                style={s.iconImage}
                resizeMode="contain"
                onError={() => setImgFailed(true)}
              />
            ) : (
              // Fallback when the subject has no image: a clean book vector icon
              <VectorIcon
                iconSet="Ionicons"
                iconName="book"
                size={20}
                color={item.color}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{item.name}</Text>
            <Text style={s.cardSubtitle} numberOfLines={1}>
              Tap to view chapters & topics
            </Text>
          </View>
          <View style={s.chevronWrap}>
            <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </View>
        </View>

        <View style={s.pillsRow}>
          <View style={[s.pill, { backgroundColor: item.color + '15' }]}>
            <VectorIcon iconSet="Ionicons" iconName="book-outline" size={12} color={item.color} />
            <Text style={[s.pillText, { color: item.color }]}>
              {item.chapters.length} Chapter{item.chapters.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={s.pill}>
            <VectorIcon iconSet="Ionicons" iconName="document-text-outline" size={12} color={theme.colors.primary} />
            <Text style={s.pillText}>
              {totalTopics} Topic{totalTopics !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>
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
        subs.map(sub => {
          const style = subjectStyle(sub.id);
          return {
            id: sub.id,
            name: sub.name,
            color: style.color,
            image: sub.image ?? null,
            chapters: bySubject.get(sub.id) ?? [],
          };
        }),
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
      <Header title="Subjects" />

      {loading ? (
        <View style={s.stateBox}>
          <ScreenSkeleton variant="list" />
        </View>
      ) : error ? (
        <View style={s.stateBox}>
          <View style={s.errorIconRing}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.danger} />
          </View>
          <Text style={s.emptyTitle}>Couldn’t load subjects</Text>
          <Text style={s.emptySub}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="refresh" size={15} color={theme.colors.primary} />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={subjects}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            <>
              <Text style={s.sectionTitle}>All Subjects</Text>
              <Text style={s.sectionDesc}>Tap a subject to explore its chapters and topics.</Text>
            </>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <VectorIcon iconSet="Ionicons" iconName="book-outline" size={44} color={theme.colors.textMuted} />
              <Text style={s.emptyTitle}>No subjects yet</Text>
              <Text style={s.emptySub}>No subjects have been assigned to your class.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <SubjectCard
              item={item}
              onPress={() =>
                navigation.navigate('SubjectDetails', {
                  subjectId: item.id,
                  subjectName: item.name,
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
  root: { flex: 1, backgroundColor: theme.colors.background },
  list: { padding: theme.spacing.lg, paddingBottom: 32 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, marginBottom: 16 },

  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
    marginBottom: 14,
  },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: theme.spacing.md, gap: 10 },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconImage: { width: 28, height: 28 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  chevronWrap: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },

  // States
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  errorIconRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textSecondary },
  emptySub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 24, lineHeight: 19 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: theme.colors.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 18, paddingVertical: 9, marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

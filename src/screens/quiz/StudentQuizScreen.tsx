import React, { useCallback, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import {
  getStudentSubjects,
  getChapters,
  contentErrorMessage,
  subjectStyle,
  type StudentSubject,
  type SyllabusChapter,
  type SyllabusTopic,
} from '../../api/contentApi';

const PRIMARY = theme.colors.primary;

const SubjectThumb = ({ image, color, fallback }: { image?: string | null; color: string; fallback: string }) =>
  image ? (
    <Image source={{ uri: image }} style={s.thumb} />
  ) : (
    <View style={[s.iconWrap, { backgroundColor: color + '20' }]}>
      <Text style={{ fontSize: 20 }}>{fallback}</Text>
    </View>
  );

const SubjectDropdown = ({
  subjects,
  selected,
  onSelect,
}: {
  subjects: StudentSubject[];
  selected: StudentSubject;
  onSelect: (sub: StudentSubject) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={[s.dropWrap, open && { zIndex: 99 }]}>
      <TouchableOpacity style={s.dropBtn} onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
        <View style={s.dropLeft}>
          <Text style={s.dropIcon}>{subjectStyle(selected.id).icon}</Text>
          <Text style={s.dropSelected} numberOfLines={1}>{selected.name}</Text>
        </View>
        <VectorIcon iconSet="Ionicons" iconName={open ? 'chevron-up' : 'chevron-down'} size={18} color={PRIMARY} />
      </TouchableOpacity>
      {open && (
        <View style={s.dropList}>
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
            {subjects.map(sub => (
              <TouchableOpacity
                key={sub.id}
                style={[s.dropItem, sub.id === selected.id && s.dropItemActive]}
                onPress={() => {
                  onSelect(sub);
                  setOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={s.dropIcon}>{subjectStyle(sub.id).icon}</Text>
                <Text style={[s.dropItemText, sub.id === selected.id && s.dropItemTextActive]} numberOfLines={1}>
                  {sub.name}
                </Text>
                {sub.id === selected.id && (
                  <VectorIcon iconSet="Ionicons" iconName="checkmark" size={16} color={PRIMARY} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const StudentQuizScreen = ({ navigation }: any) => {
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [selectedSub, setSelectedSub] = useState<StudentSubject | null>(null);
  const [chapters, setChapters] = useState<SyllabusChapter[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  const color = selectedSub ? subjectStyle(selectedSub.id).color : PRIMARY;
  const icon = selectedSub ? subjectStyle(selectedSub.id).icon : '📘';
  const totalTopics = chapters.reduce((sum, c) => sum + c.topics.length, 0);

  const loadChapters = useCallback(async (subjectId: number) => {
    setChaptersLoading(true);
    try {
      const list = await getChapters({ subject_id: subjectId });
      setChapters(list);
      setExpandedId(list[0]?.id ?? null);
    } catch (e: any) {
      console.log('[getChapters] Error:', e?.response?.status, e?.message);
      setChapters([]);
    } finally {
      setChaptersLoading(false);
    }
  }, []);

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const subs = await getStudentSubjects();
      setSubjects(subs);
      if (subs.length > 0) {
        setSelectedSub(prev => {
          const keep = prev && subs.find(x => x.id === prev.id);
          const next = keep ?? subs[0];
          loadChapters(next.id);
          return next;
        });
      }
    } catch (e: any) {
      console.log('[getStudentSubjects] Error:', e?.response?.status, e?.message);
      setError(contentErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [loadChapters]);

  const { refreshing, onRefresh } = useRefresh(loadSubjects);
  useFocusLoad(loadSubjects);

  const selectSubject = (sub: StudentSubject) => {
    setSelectedSub(sub);
    setChapters([]);
    setExpandedId(null);
    loadChapters(sub.id);
  };

  const openAttempt = (chapter: SyllabusChapter, topic: SyllabusTopic) =>
    navigation.navigate('AttemptQuiz', {
      chapterId: chapter.id,
      topicId: topic.id,
      topicName: topic.name,
      chapterName: chapter.name,
      subjectName: selectedSub?.name,
      subjectColor: color,
    });

  return (
    <View style={s.root}>
      <Header title="Quiz" onBackPress={() => navigation.goBack()} />

      {loading ? (
        <View style={s.stateBox}>
          <ScreenSkeleton variant="list" />
        </View>
      ) : error ? (
        <View style={s.stateBox}>
          <View style={s.errorIconRing}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.danger} />
          </View>
          <Text style={s.emptyTitle}>Couldn’t load quiz</Text>
          <Text style={s.emptySubText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadSubjects} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="refresh" size={15} color={PRIMARY} />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !selectedSub ? (
        <View style={s.stateBox}>
          <VectorIcon iconSet="Ionicons" iconName="help-circle-outline" size={44} color={theme.colors.textMuted} />
          <Text style={s.emptyTitle}>No Subjects Yet</Text>
          <Text style={s.emptySubText}>No subjects have been assigned to your class yet.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <SubjectDropdown subjects={subjects} selected={selectedSub} onSelect={selectSubject} />

          <View style={s.card}>
            <View style={[s.accentBar, { backgroundColor: color }]} />
            <View style={s.cardInner}>
              <View style={s.cardTop}>
                <SubjectThumb image={selectedSub.detailImage || selectedSub.image} color={color} fallback={icon} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{selectedSub.name}</Text>
                  <Text style={s.cardSubtitle} numberOfLines={1}>Pick a topic to start a quiz</Text>
                </View>
                <View style={[s.countBadge, { backgroundColor: color + '15' }]}>
                  <Text style={[s.countBadgeText, { color }]}>{totalTopics} top</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={s.card}>
            <View style={[s.accentBar, { backgroundColor: color }]} />
            <View style={s.cardInner}>
              <View style={s.cardTop}>
                <View style={[s.iconWrap, { backgroundColor: color + '20' }]}>
                  <VectorIcon iconSet="Ionicons" iconName="help-circle-outline" size={20} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Chapters & Topics</Text>
                  <Text style={s.cardSubtitle}>Tap a topic to attempt its quiz</Text>
                </View>
              </View>

              {chaptersLoading ? (
                <View style={s.chaptersLoading}>
                  <ActivityIndicator size="small" color={color} />
                </View>
              ) : chapters.length === 0 ? (
                <View style={s.empty}>
                  <VectorIcon iconSet="Ionicons" iconName="book-outline" size={44} color={theme.colors.textMuted} />
                  <Text style={s.emptyTitle}>No Quizzes Yet</Text>
                  <Text style={s.emptySubText}>Your teacher hasn't added any quiz for {selectedSub.name} yet.</Text>
                </View>
              ) : (
                chapters.map((chapter, i) => {
                  const expanded = expandedId === chapter.id;
                  return (
                    <View key={chapter.id}>
                      <TouchableOpacity
                        style={[s.chapterRow, !expanded && i < chapters.length - 1 && s.rowBorder]}
                        onPress={() => setExpandedId(expanded ? null : chapter.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[s.chapterBadge, { backgroundColor: color }]}>
                          <Text style={s.chapterBadgeText}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.chapterName} numberOfLines={1}>{chapter.name}</Text>
                          <Text style={s.chapterMeta}>
                            {chapter.topics.length} topic{chapter.topics.length !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        <View style={[s.expandBtn, expanded && { backgroundColor: color + '18' }]}>
                          <VectorIcon
                            iconSet="Ionicons"
                            iconName={expanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={expanded ? color : theme.colors.textMuted}
                          />
                        </View>
                      </TouchableOpacity>

                      {expanded && (
                        <View style={[s.topicsBox, i < chapters.length - 1 && s.rowBorder]}>
                          {chapter.topics.length === 0 ? (
                            <View style={s.noTopics}>
                              <VectorIcon iconSet="Ionicons" iconName="document-outline" size={16} color={theme.colors.textMuted} />
                              <Text style={s.noTopicsText}>No topics added yet</Text>
                            </View>
                          ) : (
                            chapter.topics.map((topic, ti) => (
                              <TouchableOpacity
                                key={topic.id}
                                style={[s.topicRow, ti === chapter.topics.length - 1 && { borderBottomWidth: 0 }]}
                                onPress={() => openAttempt(chapter, topic)}
                                activeOpacity={0.7}
                              >
                                <View style={[s.topicIndexBadge, { backgroundColor: color + '18' }]}>
                                  <Text style={[s.topicIndexText, { color }]}>{ti + 1}</Text>
                                </View>
                                <Text style={s.topicName} numberOfLines={1}>{topic.name}</Text>
                                <View style={[s.playBtn, { backgroundColor: color + '15' }]}>
                                  <VectorIcon iconSet="Ionicons" iconName="play" size={12} color={color} />
                                </View>
                              </TouchableOpacity>
                            ))
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default StudentQuizScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: 32, gap: 14 },

  dropWrap: { zIndex: 99 },
  dropBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: theme.colors.border, elevation: 2,
  },
  dropLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dropIcon: { fontSize: 18 },
  dropSelected: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  dropList: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md, marginTop: 4,
    borderWidth: 1, borderColor: theme.colors.border, elevation: 5, overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  dropItemActive: { backgroundColor: theme.colors.primaryLight },
  dropItemText: { flex: 1, fontSize: 14, color: theme.colors.textSecondary, fontWeight: '500' },
  dropItemTextActive: { color: PRIMARY, fontWeight: '700' },

  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden', elevation: 2,
  },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: theme.spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 40, height: 40, borderRadius: theme.radius.sm, backgroundColor: theme.colors.background },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  countBadge: { borderRadius: theme.radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  countBadgeText: { fontSize: 13, fontWeight: '800' },

  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, marginTop: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  chapterBadge: { width: 34, height: 34, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  chapterBadgeText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  chapterName: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  chapterMeta: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '500', marginTop: 2 },
  expandBtn: {
    width: 30, height: 30, borderRadius: theme.radius.sm,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background,
  },

  topicsBox: {
    backgroundColor: theme.colors.background, borderRadius: theme.radius.sm,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 6,
  },
  topicRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  topicIndexBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  topicIndexText: { fontSize: 10, fontWeight: '800' },
  topicName: { flex: 1, fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },
  playBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  noTopics: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  noTopicsText: { fontSize: 12, color: theme.colors.textMuted, fontStyle: 'italic' },

  empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textSecondary },
  emptySubText: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  chaptersLoading: { paddingVertical: 24, alignItems: 'center' },
  errorIconRing: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5,
    borderColor: PRIMARY, borderRadius: theme.radius.full, paddingHorizontal: 18, paddingVertical: 9, marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

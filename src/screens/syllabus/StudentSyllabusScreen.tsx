import React, { useCallback, useEffect, useState } from 'react';
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
} from '../../api/contentApi';

const PRIMARY = theme.colors.primary;

// ─── Subject Dropdown (shared template) ───────────────────────────────────────
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
      <TouchableOpacity
        style={s.dropBtn}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.8}
      >
        <View style={s.dropLeft}>
          <Text style={s.dropIcon}>{subjectStyle(selected.id).icon}</Text>
          <Text style={s.dropSelected}>{selected.name}</Text>
        </View>
        <VectorIcon
          iconSet="Ionicons"
          iconName={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={PRIMARY}
        />
      </TouchableOpacity>

      {open && (
        <View style={s.dropList}>
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
              <Text
                style={[
                  s.dropItemText,
                  sub.id === selected.id && s.dropItemTextActive,
                ]}
              >
                {sub.name}
              </Text>
              {sub.id === selected.id && (
                <VectorIcon
                  iconSet="Ionicons"
                  iconName="checkmark"
                  size={16}
                  color={PRIMARY}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const StudentSyllabusScreen = ({ navigation }: any) => {
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
  const activeChapters = chapters.filter(c => c.topics.length > 0).length;

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
        setSelectedSub(subs[0]);
        await loadChapters(subs[0].id);
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

  return (
    <View style={s.root}>
      <Header title="Syllabus" onBackPress={() => navigation.goBack()} />

      {loading ? (
        <View style={s.stateBox}>
          <ScreenSkeleton variant="list" />
        </View>
      ) : error ? (
        <View style={s.stateBox}>
          <View style={s.errorIconRing}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.danger} />
          </View>
          <Text style={s.emptyTitle}>Couldn’t load syllabus</Text>
          <Text style={s.emptySubText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadSubjects} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="refresh" size={15} color={PRIMARY} />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !selectedSub ? (
        <View style={s.stateBox}>
          <VectorIcon iconSet="Ionicons" iconName="book-outline" size={44} color={theme.colors.textMuted} />
          <Text style={s.emptyTitle}>No Subjects Yet</Text>
          <Text style={s.emptySubText}>No subjects have been assigned to your class yet.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <SubjectDropdown subjects={subjects} selected={selectedSub} onSelect={selectSubject} />

          {/* ── Subject overview card ── */}
          <View style={s.card}>
            <View style={[s.accentBar, { backgroundColor: color }]} />
            <View style={s.cardInner}>
              <View style={s.cardTop}>
                {selectedSub.detailImage || selectedSub.image ? (
                  <Image
                    source={{ uri: selectedSub.detailImage || selectedSub.image! }}
                    style={s.thumb}
                  />
                ) : (
                  <View style={[s.iconWrap, { backgroundColor: color + '20' }]}>
                    <Text style={s.iconEmoji}>{icon}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{selectedSub.name}</Text>
                  <Text style={s.cardSubtitle} numberOfLines={1}>
                    Syllabus overview
                  </Text>
                </View>
                <View style={[s.countBadge, { backgroundColor: color + '15' }]}>
                  <Text style={[s.countBadgeText, { color }]}>
                    {chapters.length} ch
                  </Text>
                </View>
              </View>

              {/* Stats footer */}
              <View style={s.tableFooter}>
                <View style={s.footerItem}>
                  <View style={[s.footerDot, { backgroundColor: color }]} />
                  <Text style={s.footerLabel}>Chapters</Text>
                  <Text style={s.footerValue}>{chapters.length}</Text>
                </View>
                <View style={s.footerDivider} />
                <View style={s.footerItem}>
                  <View style={[s.footerDot, { backgroundColor: '#0EA5E9' }]} />
                  <Text style={s.footerLabel}>Topics</Text>
                  <Text style={s.footerValue}>{totalTopics}</Text>
                </View>
                <View style={s.footerDivider} />
                <View style={s.footerItem}>
                  <View style={[s.footerDot, { backgroundColor: '#16A34A' }]} />
                  <Text style={s.footerLabel}>Active</Text>
                  <Text style={s.footerValue}>{activeChapters}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Chapters card ── */}
          <View style={s.card}>
            <View style={[s.accentBar, { backgroundColor: color }]} />
            <View style={s.cardInner}>
              <View style={s.cardTop}>
                <View style={[s.iconWrap, { backgroundColor: color + '20' }]}>
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="book-outline"
                    size={20}
                    color={color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Chapters & Topics</Text>
                  <Text style={s.cardSubtitle}>
                    {chapters.length} chapters · {totalTopics} topics
                  </Text>
                </View>
              </View>

              {chaptersLoading ? (
                <View style={s.chaptersLoading}>
                  <ActivityIndicator size="small" color={color} />
                </View>
              ) : chapters.length === 0 ? (
                <View style={s.empty}>
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="book-outline"
                    size={44}
                    color={theme.colors.textMuted}
                  />
                  <Text style={s.emptyTitle}>No Chapters Yet</Text>
                  <Text style={s.emptySubText}>
                    Your teacher hasn't added any chapters for {selectedSub.name} yet.
                  </Text>
                </View>
              ) : (
                chapters.map((chapter, i) => {
                  const expanded = expandedId === chapter.id;
                  return (
                    <View key={chapter.id}>
                      <TouchableOpacity
                        style={[
                          s.chapterRow,
                          !expanded && i < chapters.length - 1 && s.rowBorder,
                        ]}
                        onPress={() => setExpandedId(expanded ? null : chapter.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[s.chapterBadge, { backgroundColor: color }]}>
                          <Text style={s.chapterBadgeText}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.chapterName}>{chapter.name}</Text>
                          <Text style={s.chapterMeta}>
                            {chapter.topics.length} topic
                            {chapter.topics.length !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        <View
                          style={[
                            s.expandBtn,
                            expanded && { backgroundColor: color + '18' },
                          ]}
                        >
                          <VectorIcon
                            iconSet="Ionicons"
                            iconName={expanded ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={expanded ? color : theme.colors.textMuted}
                          />
                        </View>
                      </TouchableOpacity>

                      {/* Expanded topics */}
                      {expanded && (
                        <View
                          style={[
                            s.topicsBox,
                            i < chapters.length - 1 && s.rowBorder,
                          ]}
                        >
                          {chapter.topics.length === 0 ? (
                            <View style={s.noTopics}>
                              <VectorIcon
                                iconSet="Ionicons"
                                iconName="document-outline"
                                size={16}
                                color={theme.colors.textMuted}
                              />
                              <Text style={s.noTopicsText}>No topics added yet</Text>
                            </View>
                          ) : (
                            chapter.topics.map((topic, ti) => (
                              <View
                                key={topic.id}
                                style={[
                                  s.topicRow,
                                  ti === chapter.topics.length - 1 && {
                                    borderBottomWidth: 0,
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    s.topicIndexBadge,
                                    { backgroundColor: color + '18' },
                                  ]}
                                >
                                  <Text style={[s.topicIndexText, { color }]}>
                                    {ti + 1}
                                  </Text>
                                </View>
                                <Text style={s.topicName}>{topic.name}</Text>
                              </View>
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

export default StudentSyllabusScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: 32, gap: 14 },

  // Dropdown (shared template)
  dropWrap: { zIndex: 99 },
  dropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 2,
  },
  dropLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropIcon: { fontSize: 18 },
  dropSelected: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  dropList: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 5,
    overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropItemActive: { backgroundColor: theme.colors.primaryLight },
  dropItemText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  dropItemTextActive: { color: PRIMARY, fontWeight: '700' },

  // Card (shared template)
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: theme.spacing.md },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 20 },
  thumb: { width: 40, height: 40, borderRadius: theme.radius.sm, backgroundColor: theme.colors.background },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  countBadge: {
    borderRadius: theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  countBadgeText: { fontSize: 13, fontWeight: '800' },

  // Stats footer (shared template)
  tableFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  footerDot: { width: 7, height: 7, borderRadius: 4 },
  footerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  footerValue: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.colors.textPrimary,
  },
  footerDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.border,
  },

  // Chapter rows
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  chapterBadge: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterBadgeText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  chapterName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  chapterMeta: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  expandBtn: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },

  // Topics (expanded)
  topicsBox: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  topicIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicIndexText: { fontSize: 10, fontWeight: '800' },
  topicName: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },

  // No topics
  noTopics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  noTopicsText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  emptySubText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  // States
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  chaptersLoading: { paddingVertical: 24, alignItems: 'center' },
  errorIconRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: theme.radius.full,
    paddingHorizontal: 18, paddingVertical: 9, marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

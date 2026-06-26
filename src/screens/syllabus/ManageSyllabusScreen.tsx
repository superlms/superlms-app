import React, { useCallback, useEffect, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import {
  getTeacherSubjects,
  getChapters,
  createChapter,
  updateChapter,
  deleteChapter,
  createTopic,
  updateTopic,
  deleteTopic,
  contentErrorMessage,
  subjectStyle,
  type TeacherCombo,
  type SyllabusChapter,
  type SyllabusTopic,
} from '../../api/contentApi';

const PRIMARY = theme.colors.primary;

// ─── Combo (class + subject) Dropdown ─────────────────────────────────────────
const ComboDropdown = ({
  combos,
  selected,
  onSelect,
}: {
  combos: TeacherCombo[];
  selected: TeacherCombo;
  onSelect: (c: TeacherCombo) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={[s.dropWrap, open && { zIndex: 99 }]}>
      <TouchableOpacity style={s.dropBtn} onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
        <View style={s.dropLeft}>
          <Text style={s.dropIcon}>{subjectStyle(selected.subjectId).icon}</Text>
          <Text style={s.dropSelected} numberOfLines={1}>{selected.label}</Text>
        </View>
        <VectorIcon iconSet="Ionicons" iconName={open ? 'chevron-up' : 'chevron-down'} size={18} color={PRIMARY} />
      </TouchableOpacity>
      {open && (
        <View style={s.dropList}>
          <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
            {combos.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[s.dropItem, c.key === selected.key && s.dropItemActive]}
                onPress={() => {
                  onSelect(c);
                  setOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={s.dropIcon}>{subjectStyle(c.subjectId).icon}</Text>
                <Text style={[s.dropItemText, c.key === selected.key && s.dropItemTextActive]} numberOfLines={1}>
                  {c.label}
                </Text>
                {c.key === selected.key && (
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

// ─── Name + Order modal — used for both chapter and topic ─────────────────────
const NameOrderModal = ({
  visible,
  title,
  subtitle,
  nameLabel,
  namePlaceholder,
  initialName,
  initialOrder,
  saving,
  accent,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  nameLabel: string;
  namePlaceholder: string;
  initialName: string;
  initialOrder: string;
  saving: boolean;
  accent: string;
  onClose: () => void;
  onSubmit: (name: string, order: number) => void;
}) => {
  const [name, setName] = useState(initialName);
  const [order, setOrder] = useState(initialOrder);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setOrder(initialOrder);
    }
  }, [visible, initialName, initialOrder]);

  const submit = () => {
    if (!name.trim() || saving) return;
    onSubmit(name.trim(), parseInt(order, 10) || 0);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.modalSheet}>
          <View style={s.modalHandle} />

          <View style={s.modalTitleRow}>
            <View style={[s.modalIconBox, { backgroundColor: accent + '22' }]}>
              <VectorIcon iconSet="Ionicons" iconName="create-outline" size={18} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>{title}</Text>
              <Text style={s.modalSub} numberOfLines={1}>{subtitle}</Text>
            </View>
          </View>

          <Text style={s.inputLabel}>{nameLabel}</Text>
          <TextInput
            style={s.modalInput}
            placeholder={namePlaceholder}
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={s.inputLabel}>Order</Text>
          <TextInput
            style={s.modalInput}
            placeholder="e.g. 1"
            placeholderTextColor={theme.colors.textMuted}
            value={order}
            onChangeText={t => setOrder(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />

          <View style={s.modalActions}>
            <TouchableOpacity style={s.modalCancelBtn} onPress={onClose} activeOpacity={0.8} disabled={saving}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modalAddBtn, { backgroundColor: accent }, (!name.trim() || saving) && { opacity: 0.6 }]}
              onPress={submit}
              activeOpacity={0.85}
              disabled={!name.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <VectorIcon iconSet="Ionicons" iconName="checkmark" size={16} color="#fff" />
                  <Text style={s.modalAddText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
type ChapterModalState = { mode: 'add' } | { mode: 'edit'; chapter: SyllabusChapter } | null;
type TopicModalState =
  | { mode: 'add'; chapter: SyllabusChapter }
  | { mode: 'edit'; chapter: SyllabusChapter; topic: SyllabusTopic }
  | null;

const ManageSyllabusScreen = ({ navigation, route }: any) => {
  const initialKey: string | undefined = route?.params?.comboKey;

  const [combos, setCombos] = useState<TeacherCombo[]>([]);
  const [selected, setSelected] = useState<TeacherCombo | null>(null);
  const [chapters, setChapters] = useState<SyllabusChapter[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [busyChapterId, setBusyChapterId] = useState<number | null>(null);

  const [chapterModal, setChapterModal] = useState<ChapterModalState>(null);
  const [topicModal, setTopicModal] = useState<TopicModalState>(null);
  const [saving, setSaving] = useState(false);

  const color = selected ? subjectStyle(selected.subjectId).color : PRIMARY;

  // ── Loaders ──────────────────────────────────────────────────────────────
  const loadChapters = useCallback(async (combo: TeacherCombo) => {
    setChaptersLoading(true);
    try {
      const list = await getChapters({
        standard_id: combo.standardId,
        section_id: combo.sectionId,
        subject_id: combo.subjectId,
      });
      setChapters(list);
      setExpandedId(list[0]?.id ?? null);
    } catch (e: any) {
      console.log('[getChapters] Error:', e?.response?.status, e?.message);
      setChapters([]);
    } finally {
      setChaptersLoading(false);
    }
  }, []);

  const loadCombos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getTeacherSubjects();
      setCombos(list);
      const start = list.find(c => c.key === initialKey) ?? list[0];
      if (start) {
        setSelected(start);
        await loadChapters(start);
      }
    } catch (e: any) {
      console.log('[getTeacherSubjects] Error:', e?.response?.status, e?.message);
      setError(contentErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [loadChapters, initialKey]);

  const { refreshing, onRefresh } = useRefresh(loadCombos);
  useFocusLoad(loadCombos);

  const selectCombo = (c: TeacherCombo) => {
    setSelected(c);
    setChapters([]);
    setExpandedId(null);
    loadChapters(c);
  };

  // ── Mutations ────────────────────────────────────────────────────────────
  const submitChapter = async (name: string, order: number) => {
    if (!selected || !chapterModal) return;
    setSaving(true);
    try {
      if (chapterModal.mode === 'add') {
        const created = await createChapter({
          standard_id: selected.standardId,
          section_id: selected.sectionId,
          subject_id: selected.subjectId,
          name,
          order,
        });
        setChapters(prev =>
          (prev.some(c => c.id === created.id) ? prev : [...prev, created]).sort(
            (a, b) => a.order - b.order || a.id - b.id,
          ),
        );
        setExpandedId(created.id);
      } else {
        const updated = await updateChapter(chapterModal.chapter.id, { name, order });
        setChapters(prev =>
          prev
            .map(c => (c.id === updated.id ? { ...c, name: updated.name, order: updated.order } : c))
            .sort((a, b) => a.order - b.order || a.id - b.id),
        );
      }
      setChapterModal(null);
    } catch (e: any) {
      Alert.alert('Error', contentErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteChapter = (chapter: SyllabusChapter) => {
    Alert.alert(
      'Delete Chapter',
      `Delete "${chapter.name}" and all its topics? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyChapterId(chapter.id);
            try {
              await deleteChapter(chapter.id);
              setChapters(prev => prev.filter(c => c.id !== chapter.id));
            } catch (e: any) {
              Alert.alert('Error', contentErrorMessage(e));
            } finally {
              setBusyChapterId(null);
            }
          },
        },
      ],
    );
  };

  const sortTopics = (topics: SyllabusTopic[]) =>
    [...topics].sort((a, b) => a.order - b.order || a.id - b.id);

  const submitTopic = async (name: string, order: number) => {
    if (!topicModal) return;
    setSaving(true);
    try {
      if (topicModal.mode === 'add') {
        const created = await createTopic(topicModal.chapter.id, name, order);
        setChapters(prev =>
          prev.map(c =>
            c.id === topicModal.chapter.id ? { ...c, topics: sortTopics([...c.topics, created]) } : c,
          ),
        );
      } else {
        const updated = await updateTopic(topicModal.topic.id, name, order);
        setChapters(prev =>
          prev.map(c =>
            c.id === topicModal.chapter.id
              ? { ...c, topics: sortTopics(c.topics.map(t => (t.id === updated.id ? updated : t))) }
              : c,
          ),
        );
      }
      setTopicModal(null);
    } catch (e: any) {
      Alert.alert('Error', contentErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteTopic = (chapter: SyllabusChapter, topic: SyllabusTopic) => {
    Alert.alert('Delete Topic', `Delete "${topic.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTopic(topic.id);
            setChapters(prev =>
              prev.map(c =>
                c.id === chapter.id ? { ...c, topics: c.topics.filter(t => t.id !== topic.id) } : c,
              ),
            );
          } catch (e: any) {
            Alert.alert('Error', contentErrorMessage(e));
          }
        },
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const renderBody = () => {
    if (loading) {
      return (
        <View style={s.stateBox}>
          <ScreenSkeleton variant="list" />
        </View>
      );
    }
    if (error) {
      return (
        <View style={s.stateBox}>
          <View style={s.errorIconRing}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.danger} />
          </View>
          <Text style={s.emptyTitle}>Couldn’t load syllabus</Text>
          <Text style={s.emptySubText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadCombos} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="refresh" size={15} color={PRIMARY} />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!selected) {
      return (
        <View style={s.stateBox}>
          <VectorIcon iconSet="Ionicons" iconName="library-outline" size={48} color={theme.colors.textMuted} />
          <Text style={s.emptyTitle}>No subjects assigned</Text>
          <Text style={s.emptySubText}>You don’t teach any class + subject yet.</Text>
        </View>
      );
    }

    return (
      <>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <ComboDropdown combos={combos} selected={selected} onSelect={selectCombo} />

          <View style={s.chapterCountRow}>
            <Text style={s.chapterCountTitle}>Chapters</Text>
            <View style={[s.chapterCountBadge, { backgroundColor: color + '18' }]}>
              <Text style={[s.chapterCountBadgeText, { color }]}>{chapters.length}</Text>
            </View>
          </View>

          {chaptersLoading ? (
            <View style={s.chaptersLoading}>
              <ActivityIndicator size="small" color={color} />
            </View>
          ) : chapters.length === 0 ? (
            <View style={s.empty}>
              <VectorIcon iconSet="Ionicons" iconName="book-outline" size={48} color={theme.colors.textMuted} />
              <Text style={s.emptyTitle}>No chapters yet</Text>
              <Text style={s.emptySubText}>Tap “Add New Chapter” to get started.</Text>
            </View>
          ) : (
            chapters.map((chapter, i) => {
              const expanded = expandedId === chapter.id;
              const busy = busyChapterId === chapter.id;
              return (
                <View key={chapter.id} style={s.chapterCard}>
                  <TouchableOpacity
                    style={s.chapterHeader}
                    onPress={() => setExpandedId(expanded ? null : chapter.id)}
                    activeOpacity={0.8}
                  >
                    <View style={s.chapterLeft}>
                      <View style={[s.chapterBadge, { backgroundColor: color }]}>
                        <Text style={s.chapterBadgeText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.chapterName} numberOfLines={1}>{chapter.name}</Text>
                        <Text style={s.chapterMeta}>
                          Order {chapter.order} · {chapter.topics.length} topic
                          {chapter.topics.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    {busy ? (
                      <ActivityIndicator size="small" color={color} />
                    ) : (
                      <VectorIcon
                        iconSet="Ionicons"
                        iconName={expanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={theme.colors.textMuted}
                      />
                    )}
                  </TouchableOpacity>

                  {expanded && (
                    <View style={s.chapterBody}>
                      <View style={s.chapterActions}>
                        <TouchableOpacity
                          style={[s.chapterActionBtn, { backgroundColor: color + '18' }]}
                          onPress={() => setChapterModal({ mode: 'edit', chapter })}
                          activeOpacity={0.8}
                        >
                          <VectorIcon iconSet="Ionicons" iconName="create-outline" size={15} color={color} />
                          <Text style={[s.chapterActionText, { color }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.chapterActionBtn, s.chapterActionDanger]}
                          onPress={() => confirmDeleteChapter(chapter)}
                          activeOpacity={0.8}
                        >
                          <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={15} color={theme.colors.danger} />
                          <Text style={[s.chapterActionText, { color: theme.colors.danger }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={s.topicsWrap}>
                        {chapter.topics.length === 0 && (
                          <Text style={s.noTopicsText}>No topics yet. Add one below.</Text>
                        )}
                        {chapter.topics.map((topic, ti) => (
                          <View key={topic.id} style={s.topicRow}>
                            <View style={[s.topicIndexBadge, { backgroundColor: color + '18' }]}>
                              <Text style={[s.topicIndexText, { color }]}>{ti + 1}</Text>
                            </View>
                            <Text style={s.topicName} numberOfLines={2}>{topic.name}</Text>
                            <Text style={s.topicOrder}>#{topic.order}</Text>
                            <TouchableOpacity
                              onPress={() => setTopicModal({ mode: 'edit', chapter, topic })}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => confirmDeleteTopic(chapter, topic)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <VectorIcon iconSet="Ionicons" iconName="close-circle-outline" size={17} color={theme.colors.danger} />
                            </TouchableOpacity>
                          </View>
                        ))}

                        <TouchableOpacity
                          style={[s.addTopicBtn, { borderColor: color }]}
                          onPress={() => setTopicModal({ mode: 'add', chapter })}
                          activeOpacity={0.8}
                        >
                          <VectorIcon iconSet="Ionicons" iconName="add" size={17} color={color} />
                          <Text style={[s.addTopicText, { color }]}>Add Topic</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <TouchableOpacity
          style={[s.fab, { backgroundColor: color, shadowColor: color }]}
          onPress={() => setChapterModal({ mode: 'add' })}
          activeOpacity={0.85}
        >
          <VectorIcon iconSet="Ionicons" iconName="add" size={20} color="#fff" />
          <Text style={s.fabText}>Add New Chapter</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <View style={s.root}>
      <Header title="Manage Syllabus" onBackPress={() => navigation.goBack()} />
      {renderBody()}

      {/* Chapter add / edit */}
      <NameOrderModal
        visible={!!chapterModal}
        title={chapterModal?.mode === 'edit' ? 'Edit Chapter' : 'Add New Chapter'}
        subtitle={selected?.label ?? ''}
        nameLabel="Chapter Name"
        namePlaceholder="e.g. Thermodynamics"
        initialName={chapterModal?.mode === 'edit' ? chapterModal.chapter.name : ''}
        initialOrder={
          chapterModal?.mode === 'edit'
            ? String(chapterModal.chapter.order)
            : String(chapters.length + 1)
        }
        saving={saving}
        accent={color}
        onClose={() => !saving && setChapterModal(null)}
        onSubmit={submitChapter}
      />

      {/* Topic add / edit */}
      <NameOrderModal
        visible={!!topicModal}
        title={topicModal?.mode === 'edit' ? 'Edit Topic' : 'Add Topic'}
        subtitle={topicModal ? `in ${topicModal.chapter.name}` : ''}
        nameLabel="Topic Name"
        namePlaceholder="e.g. Newton's Laws of Motion"
        initialName={topicModal?.mode === 'edit' ? topicModal.topic.name : ''}
        initialOrder={
          topicModal?.mode === 'edit'
            ? String(topicModal.topic.order)
            : topicModal
            ? String(topicModal.chapter.topics.length + 1)
            : '1'
        }
        saving={saving}
        accent={color}
        onClose={() => !saving && setTopicModal(null)}
        onSubmit={submitTopic}
      />
    </View>
  );
};

export default ManageSyllabusScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },

  // Dropdown
  dropWrap: { marginBottom: 16, zIndex: 99 },
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
  dropLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dropIcon: { fontSize: 18 },
  dropSelected: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
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
  dropItemText: { flex: 1, fontSize: 14, color: theme.colors.textSecondary, fontWeight: '500' },
  dropItemTextActive: { color: PRIMARY, fontWeight: '700' },

  // Chapter count
  chapterCountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  chapterCountTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary },
  chapterCountBadge: { minWidth: 26, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignItems: 'center' },
  chapterCountBadgeText: { fontSize: 12, fontWeight: '800' },

  // Chapter card
  chapterCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 2,
    overflow: 'hidden',
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  chapterLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  chapterBadge: { width: 34, height: 34, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  chapterBadgeText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  chapterName: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  chapterMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2, fontWeight: '500' },

  chapterBody: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  chapterActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  chapterActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  chapterActionDanger: { backgroundColor: '#FEE2E2' },
  chapterActionText: { fontSize: 12, fontWeight: '700' },

  topicsWrap: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 6 },
  noTopicsText: { fontSize: 12, color: theme.colors.textMuted, paddingVertical: 10, fontStyle: 'italic' },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  topicIndexBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  topicIndexText: { fontSize: 11, fontWeight: '800' },
  topicName: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, fontWeight: '500' },
  topicOrder: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '700' },
  addTopicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: theme.radius.sm,
  },
  addTopicText: { fontSize: 13, fontWeight: '700' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 999,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  fabText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // States
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  chaptersLoading: { paddingVertical: 30, alignItems: 'center' },
  errorIconRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  empty: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTitle: { fontSize: 16, color: theme.colors.textSecondary, fontWeight: '800' },
  emptySubText: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 24, lineHeight: 19 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: theme.radius.full,
    paddingHorizontal: 18, paddingVertical: 9, marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  modalIconBox: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '900', color: theme.colors.textPrimary },
  modalSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 },
  modalInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.textPrimary,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: theme.colors.textSecondary },
  modalAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: PRIMARY,
  },
  modalAddText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

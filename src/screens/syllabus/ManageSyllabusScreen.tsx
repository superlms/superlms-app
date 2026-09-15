import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  createChapter,
  updateChapter,
  deleteChapter,
  createTopic,
  updateTopic,
  deleteTopic,
  contentErrorMessage,
  type TeacherCombo,
  type SyllabusChapter,
  type SyllabusTopic,
} from '../../api/contentApi';
import { useChapters } from '../subjects/useChapters';
import {
  ChapterOutline,
  TopicLine,
  comboChapters,
  comboClass,
  comboLabel,
} from '../subjects/outlineUi';
import { AppAlert } from '../../components/AppDialog';

const TITLE = 'Manage Syllabus';

const byOrder = <X extends { order: number; id: number }>(list: X[]): X[] =>
  [...list].sort((a, b) => a.order - b.order || a.id - b.id);

// ─── Name + order sheet — used for both chapters and topics ───────────────────
const NameOrderModal = ({
  visible,
  title,
  subtitle,
  nameLabel,
  namePlaceholder,
  initialName,
  initialOrder,
  saving,
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

  const canSave = !!name.trim() && !saving;

  const submit = () => {
    if (!canSave) return;
    onSubmit(name.trim(), parseInt(order, 10) || 0);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet}>
          <Text style={s.sheetTitle}>{title}</Text>
          {!!subtitle && (
            <Text style={s.sheetSub} numberOfLines={1}>
              {subtitle}
            </Text>
          )}

          <Text style={s.fieldLabel}>{nameLabel}</Text>
          <TextInput
            style={s.field}
            placeholder={namePlaceholder}
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={s.fieldLabel}>Order</Text>
          <TextInput
            style={s.field}
            placeholder="e.g. 1"
            placeholderTextColor={theme.colors.textMuted}
            value={order}
            onChangeText={t => setOrder(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />

          <View style={s.sheetActions}>
            <TouchableOpacity
              style={[s.sheetBtn, s.sheetBtnGhost]}
              onPress={onClose}
              activeOpacity={0.7}
              disabled={saving}
            >
              <Text style={s.sheetBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.sheetBtn, s.sheetBtnPrimary, !canSave && s.btnDisabled]}
              onPress={submit}
              activeOpacity={0.85}
              disabled={!canSave}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={s.sheetBtnPrimaryText}>Save</Text>
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

// Opened from a class-and-subject's syllabus, so the subject is already chosen.
const ManageSyllabusScreen = ({ navigation, route }: any) => {
  const combo: TeacherCombo | undefined = route?.params?.combo;

  const outline = useChapters(() => (combo ? comboChapters(combo) : Promise.resolve([])));
  const { refreshing, onRefresh } = useRefresh(outline.load);

  useFocusLoad(outline.load);

  const [busyChapterId, setBusyChapterId] = useState<number | null>(null);
  const [chapterModal, setChapterModal] = useState<ChapterModalState>(null);
  const [topicModal, setTopicModal] = useState<TopicModalState>(null);
  const [saving, setSaving] = useState(false);

  const chapterCount = outline.chapters?.length ?? 0;

  // ── Mutations ────────────────────────────────────────────────────────────
  const submitChapter = async (name: string, order: number) => {
    if (!combo || !chapterModal) return;
    setSaving(true);
    try {
      if (chapterModal.mode === 'add') {
        const created = await createChapter({
          standard_id: combo.standardId,
          section_id: combo.sectionId,
          subject_id: combo.subjectId,
          name,
          order,
        });
        outline.setChapters(prev => {
          const list = prev ?? [];
          return byOrder(list.some(c => c.id === created.id) ? list : [...list, created]);
        });
        outline.openChapter(created.id);
      } else {
        const updated = await updateChapter(chapterModal.chapter.id, { name, order });
        outline.setChapters(prev =>
          byOrder(
            (prev ?? []).map(c =>
              c.id === updated.id ? { ...c, name: updated.name, order: updated.order } : c,
            ),
          ),
        );
      }
      setChapterModal(null);
    } catch (e: any) {
      AppAlert.alert('Error', contentErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteChapter = (chapter: SyllabusChapter) => {
    AppAlert.alert(
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
              outline.setChapters(prev => (prev ?? []).filter(c => c.id !== chapter.id));
            } catch (e: any) {
              AppAlert.alert('Error', contentErrorMessage(e));
            } finally {
              setBusyChapterId(null);
            }
          },
        },
      ],
    );
  };

  const submitTopic = async (name: string, order: number) => {
    if (!topicModal) return;
    setSaving(true);
    try {
      const chapterId = topicModal.chapter.id;
      if (topicModal.mode === 'add') {
        const created = await createTopic(chapterId, name, order);
        outline.setChapters(prev =>
          (prev ?? []).map(c =>
            c.id === chapterId ? { ...c, topics: byOrder([...c.topics, created]) } : c,
          ),
        );
      } else {
        const updated = await updateTopic(topicModal.topic.id, name, order);
        outline.setChapters(prev =>
          (prev ?? []).map(c =>
            c.id === chapterId
              ? { ...c, topics: byOrder(c.topics.map(t => (t.id === updated.id ? updated : t))) }
              : c,
          ),
        );
      }
      setTopicModal(null);
    } catch (e: any) {
      AppAlert.alert('Error', contentErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteTopic = (chapter: SyllabusChapter, topic: SyllabusTopic) => {
    AppAlert.alert('Delete Topic', `Delete "${topic.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTopic(topic.id);
            outline.setChapters(prev =>
              (prev ?? []).map(c =>
                c.id === chapter.id ? { ...c, topics: c.topics.filter(t => t.id !== topic.id) } : c,
              ),
            );
          } catch (e: any) {
            AppAlert.alert('Error', contentErrorMessage(e));
          }
        },
      },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (!combo) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <DocNoData
          icon="library-outline"
          title="No subject chosen"
          subtitle="Open a subject from the Syllabus screen to manage its chapters."
        />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ChapterOutline
        outline={outline}
        title={combo.subjectName}
        subtitle={comboClass(combo)}
        image={combo.subjectImage}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showDescriptions
        emptyChapters={{
          title: 'No chapters yet',
          subtitle: 'Add the first chapter with the button below.',
        }}
        // Every chapter opens here, even an empty one — that is where its first
        // topic gets added.
        chapterExpandable={() => true}
        renderTrailing={chapter =>
          busyChapterId === chapter.id ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : undefined
        }
        renderTopics={(chapter, number) => (
          <>
            {chapter.topics.length === 0 && <Text style={s.noTopics}>No topics yet.</Text>}

            {chapter.topics.map((topic, i) => (
              <TopicLine
                key={topic.id}
                label={`${number}.${i + 1}`}
                name={topic.name}
                right={
                  <View style={s.topicActions}>
                    <TouchableOpacity
                      hitSlop={8}
                      activeOpacity={0.6}
                      onPress={() => setTopicModal({ mode: 'edit', chapter, topic })}
                    >
                      <VectorIcon iconSet="Ionicons" iconName="create-outline" size={17} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      hitSlop={8}
                      activeOpacity={0.6}
                      onPress={() => confirmDeleteTopic(chapter, topic)}
                    >
                      <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                }
              />
            ))}

            <View style={s.chapterActions}>
              <TouchableOpacity hitSlop={8} activeOpacity={0.6} onPress={() => setTopicModal({ mode: 'add', chapter })}>
                <Text style={s.actionPrimary}>Add topic</Text>
              </TouchableOpacity>
              <TouchableOpacity hitSlop={8} activeOpacity={0.6} onPress={() => setChapterModal({ mode: 'edit', chapter })}>
                <Text style={s.action}>Edit chapter</Text>
              </TouchableOpacity>
              <TouchableOpacity hitSlop={8} activeOpacity={0.6} onPress={() => confirmDeleteChapter(chapter)}>
                <Text style={s.actionDanger}>Delete</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      />

      {outline.chapters !== null && (
        <View style={s.bar}>
          <TouchableOpacity style={s.addBtn} activeOpacity={0.85} onPress={() => setChapterModal({ mode: 'add' })}>
            <VectorIcon iconSet="Ionicons" iconName="add" size={18} color={theme.colors.white} />
            <Text style={s.addBtnText}>Add chapter</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Chapter add / edit */}
      <NameOrderModal
        visible={!!chapterModal}
        title={chapterModal?.mode === 'edit' ? 'Edit chapter' : 'New chapter'}
        subtitle={comboLabel(combo)}
        nameLabel="Chapter name"
        namePlaceholder="e.g. Thermodynamics"
        initialName={chapterModal?.mode === 'edit' ? chapterModal.chapter.name : ''}
        initialOrder={
          chapterModal?.mode === 'edit' ? String(chapterModal.chapter.order) : String(chapterCount + 1)
        }
        saving={saving}
        onClose={() => !saving && setChapterModal(null)}
        onSubmit={submitChapter}
      />

      {/* Topic add / edit */}
      <NameOrderModal
        visible={!!topicModal}
        title={topicModal?.mode === 'edit' ? 'Edit topic' : 'New topic'}
        subtitle={topicModal ? `In ${quietCaps(topicModal.chapter.name)}` : ''}
        nameLabel="Topic name"
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
        onClose={() => !saving && setTopicModal(null)}
        onSubmit={submitTopic}
      />
    </View>
  );
};

export default ManageSyllabusScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Inside an open chapter
  noTopics: { fontSize: 13, color: theme.colors.textMuted, paddingVertical: 6 },
  topicActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  chapterActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, paddingTop: 10 },
  actionPrimary: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  action: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  actionDanger: { fontSize: 13, fontWeight: '500', color: theme.colors.danger },

  // Add chapter
  bar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  addBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },

  // Sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 28,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  sheetSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 18, marginBottom: 8 },
  field: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  sheetBtn: { flex: 1, height: 46, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  sheetBtnGhost: { borderWidth: 1, borderColor: theme.colors.border },
  sheetBtnGhostText: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  sheetBtnPrimary: { backgroundColor: theme.colors.primary },
  sheetBtnPrimaryText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
  btnDisabled: { opacity: 0.5 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

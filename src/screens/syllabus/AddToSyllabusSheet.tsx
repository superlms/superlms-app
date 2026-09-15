import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import VectorIcon from '../../components/VectorIcon';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardHeight } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import {
  createChapter,
  createTopic,
  contentErrorMessage,
  type SyllabusChapter,
  type TeacherCombo,
} from '../../api/contentApi';
import { comboLabel } from '../subjects/outlineUi';

export type SyllabusAddKind = 'chapter' | 'topic';

const KINDS: { key: SyllabusAddKind; label: string }[] = [
  { key: 'chapter', label: 'Chapter' },
  { key: 'topic', label: 'Topic' },
];

/**
 * The + on a teacher's syllabus: first whether to add a chapter or a topic,
 * then its name and order — and, for a topic, the chapter it goes into.
 */
export const AddToSyllabusSheet = ({
  visible,
  combo,
  chapters,
  onClose,
  onAdded,
}: {
  visible: boolean;
  combo: TeacherCombo;
  chapters: SyllabusChapter[];
  onClose: () => void;
  onAdded: (kind: SyllabusAddKind, chapterId: number) => void;
}) => {
  const [kind, setKind] = useState<SyllabusAddKind>('chapter');
  const [chapterId, setChapterId] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState('');
  const [order, setOrder] = useState('');
  const [saving, setSaving] = useState(false);
  // The field being typed in wears the blue outline.
  const [focused, setFocused] = useState<'name' | 'order' | null>(null);

  const chapter = chapters.find(c => c.id === chapterId) ?? null;
  const chapterCount = useRef(chapters.length);
  chapterCount.current = chapters.length;

  // Each time it opens: a chapter, unnamed, after the last one.
  useEffect(() => {
    if (!visible) return;
    setKind('chapter');
    setChapterId(null);
    setPicking(false);
    setName('');
    setOrder(String(chapterCount.current + 1));
  }, [visible]);

  // Inside the popup the screen's insets can come through as zero — the
  // window's own insets, measured at launch, fill in.
  const contextInsets = useSafeAreaInsets();
  const insets = {
    top: Math.max(contextInsets.top, initialWindowMetrics?.insets.top ?? 0),
    bottom: Math.max(contextInsets.bottom, initialWindowMetrics?.insets.bottom ?? 0),
  };

  // The sheet rides up with the keyboard as it opens, instead of jumping.
  const keyboardHeight = useKeyboardHeight();
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, keyboardHeight.value - insets.bottom) }],
  }));

  // A chapter goes after the last chapter; a topic after its chapter's last topic.
  const switchKind = (next: SyllabusAddKind) => {
    setKind(next);
    setPicking(false);
    setOrder(String(next === 'chapter' ? chapters.length + 1 : (chapter?.topics.length ?? 0) + 1));
  };

  const pickChapter = (picked: SyllabusChapter) => {
    setChapterId(picked.id);
    setPicking(false);
    setOrder(String(picked.topics.length + 1));
  };

  const close = () => {
    if (!saving) onClose();
  };

  const canSave = !!name.trim() && !saving && (kind === 'chapter' || !!chapter);

  const submit = async () => {
    if (!canSave) return;
    const cleanName = name.trim();
    const cleanOrder = parseInt(order, 10) || 0;
    setSaving(true);
    try {
      if (kind === 'chapter') {
        const created = await createChapter({
          standard_id: combo.standardId,
          section_id: combo.sectionId,
          subject_id: combo.subjectId,
          name: cleanName,
          order: cleanOrder,
        });
        onAdded('chapter', created.id);
      } else if (chapter) {
        await createTopic(chapter.id, cleanName, cleanOrder);
        onAdded('topic', chapter.id);
      }
    } catch (e: any) {
      AppAlert.alert('Error', contentErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const isTopic = kind === 'topic';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <View style={s.backdrop}>
        {/* Tap outside to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[s.statusStrip, { height: insets.top }]} />

        <Animated.View style={liftStyle}>
          <View style={[s.sheet, { paddingBottom: insets.bottom + 28 }]}>
            <Text style={s.sheetTitle}>Add to syllabus</Text>
            <Text style={s.sheetSub} numberOfLines={1}>
              {comboLabel(combo)}
            </Text>

            {/* Chapter or topic */}
            <View style={s.segment}>
              {KINDS.map(k => {
                const active = kind === k.key;
                return (
                  <TouchableOpacity
                    key={k.key}
                    activeOpacity={0.7}
                    onPress={() => switchKind(k.key)}
                    style={[s.segmentItem, active && s.segmentItemActive]}
                  >
                    <Text style={[s.segmentText, active && s.segmentTextActive]}>{k.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* A topic's chapter */}
            {isTopic && (
              <>
                <Text style={s.fieldLabel}>Chapter</Text>
                {chapters.length === 0 ? (
                  <Text style={s.hint}>Add a chapter first — every topic goes into one.</Text>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[s.field, s.pickField, picking && s.fieldFocused]}
                      activeOpacity={0.7}
                      onPress={() => setPicking(p => !p)}
                    >
                      <Text style={[s.pickText, !chapter && s.placeholder]} numberOfLines={1}>
                        {chapter ? quietCaps(chapter.name) : 'Select chapter'}
                      </Text>
                      <VectorIcon
                        iconSet="Ionicons"
                        iconName={picking ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={theme.colors.textMuted}
                      />
                    </TouchableOpacity>

                    {picking && (
                      <ScrollView
                        style={s.pickList}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                      >
                        {chapters.map((c, i) => {
                          const active = c.id === chapterId;
                          return (
                            <TouchableOpacity
                              key={c.id}
                              style={[s.pickRow, i < chapters.length - 1 && s.pickRowDivider]}
                              activeOpacity={0.6}
                              onPress={() => pickChapter(c)}
                            >
                              <Text style={s.pickNo}>{i + 1}</Text>
                              <Text style={[s.pickRowText, active && s.pickRowTextActive]} numberOfLines={1}>
                                {quietCaps(c.name)}
                              </Text>
                              {active && (
                                <VectorIcon
                                  iconSet="Ionicons"
                                  iconName="checkmark"
                                  size={18}
                                  color={theme.colors.primary}
                                />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                  </>
                )}
              </>
            )}

            <Text style={s.fieldLabel}>{isTopic ? 'Topic name' : 'Chapter name'}</Text>
            <TextInput
              style={[s.field, focused === 'name' && s.fieldFocused]}
              placeholder={isTopic ? "e.g. Newton's Laws of Motion" : 'e.g. Thermodynamics'}
              placeholderTextColor={theme.colors.textMuted}
              value={name}
              onChangeText={setName}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
            />

            <Text style={s.fieldLabel}>Order</Text>
            <TextInput
              style={[s.field, focused === 'order' && s.fieldFocused]}
              placeholder="e.g. 1"
              placeholderTextColor={theme.colors.textMuted}
              value={order}
              onChangeText={t => setOrder(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              onFocus={() => setFocused('order')}
              onBlur={() => setFocused(null)}
            />

            <View style={s.sheetActions}>
              <TouchableOpacity
                style={[s.sheetBtn, s.sheetBtnGhost]}
                onPress={close}
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
                  <Text style={s.sheetBtnPrimaryText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const __mk_s = () => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  // The status bar's own colour over the dimmed backdrop.
  statusStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.statusBar,
  },

  // Sheet — as Manage Syllabus's chapter and topic sheet
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  sheetSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 18, marginBottom: 8 },
  // No fill — an outline in that grey, as Switch account's fields, blue while in use
  field: {
    borderWidth: 1,
    borderColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  fieldFocused: { borderColor: theme.colors.primary },
  hint: { fontSize: 14, lineHeight: 20, color: theme.colors.textMuted },

  // Chapter or topic — the app's segmented switch
  segment: {
    flexDirection: 'row',
    padding: 3,
    marginTop: 18,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentItemActive: { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
  segmentText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  segmentTextActive: { color: theme.colors.primary, fontWeight: '600' },

  // A topic's chapter: a field that opens onto the chapters, numbered
  pickField: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  placeholder: { color: theme.colors.textMuted },
  pickList: {
    maxHeight: 220,
    marginTop: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  pickRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  pickNo: { width: 20, fontSize: 14, fontWeight: '600', color: theme.colors.textMuted },
  pickRowText: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  pickRowTextActive: { color: theme.colors.primary, fontWeight: '600' },

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

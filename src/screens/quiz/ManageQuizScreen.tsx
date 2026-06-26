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
  getQuizzes,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  quizErrorMessage,
  type QuizQuestion,
} from '../../api/quizApi';

const PRIMARY = theme.colors.primary;
const LETTERS = ['A', 'B', 'C', 'D'];

// ─── Question editor (question + 4 options + correct + timer) ─────────────────
const QuestionModal = ({
  visible,
  isEdit,
  accent,
  initial,
  saving,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  isEdit: boolean;
  accent: string;
  initial: QuizQuestion | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: { questionText: string; options: string[]; correctIndex: number; timeLimit: number }) => void;
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [timer, setTimer] = useState('60');

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setQuestion(initial.questionText);
      const opts = initial.options.map(o => o.text);
      while (opts.length < 4) opts.push('');
      setOptions(opts.slice(0, 4));
      const ci = initial.options.findIndex(o => o.isCorrect);
      setCorrectIndex(ci >= 0 ? ci : 0);
      setTimer(String(initial.timeLimit || 60));
    } else {
      setQuestion('');
      setOptions(['', '', '', '']);
      setCorrectIndex(0);
      setTimer('60');
    }
  }, [visible, initial]);

  const setOption = (i: number, v: string) =>
    setOptions(prev => prev.map((o, idx) => (idx === i ? v : o)));

  const submit = () => {
    if (saving) return;
    if (!question.trim()) {
      Alert.alert('Missing question', 'Enter the question text.');
      return;
    }
    const filled = options.map(o => o.trim());
    if (filled.filter(Boolean).length < 2) {
      Alert.alert('Need options', 'Enter at least 2 options.');
      return;
    }
    if (!filled[correctIndex]) {
      Alert.alert('Mark correct', 'The option marked correct is empty.');
      return;
    }
    onSubmit({
      questionText: question.trim(),
      options: filled,
      correctIndex,
      timeLimit: parseInt(timer, 10) || 60,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.modalSheet}>
          <View style={s.modalHandle} />
          <View style={s.modalTitleRow}>
            <View style={[s.modalIconBox, { backgroundColor: accent + '22' }]}>
              <VectorIcon iconSet="Ionicons" iconName="help-circle-outline" size={18} color={accent} />
            </View>
            <Text style={s.modalTitle}>{isEdit ? 'Edit Question' : 'Add Question'}</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.inputLabel}>Question</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="Type the question..."
              placeholderTextColor={theme.colors.textMuted}
              value={question}
              onChangeText={setQuestion}
              multiline
              textAlignVertical="top"
            />

            <Text style={s.inputLabel}>Options · tap the circle to mark the correct one</Text>
            {options.map((opt, i) => {
              const correct = i === correctIndex;
              return (
                <View key={i} style={[s.optRow, correct && { borderColor: '#16A34A', backgroundColor: '#16A34A12' }]}>
                  <TouchableOpacity onPress={() => setCorrectIndex(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <View style={[s.radio, correct && { borderColor: '#16A34A', backgroundColor: '#16A34A' }]}>
                      {correct ? (
                        <VectorIcon iconSet="Ionicons" iconName="checkmark" size={12} color="#fff" />
                      ) : (
                        <Text style={s.radioLetter}>{LETTERS[i]}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TextInput
                    style={s.optInput}
                    placeholder={`Option ${LETTERS[i]}`}
                    placeholderTextColor={theme.colors.textMuted}
                    value={opt}
                    onChangeText={t => setOption(i, t)}
                  />
                </View>
              );
            })}

            <Text style={s.inputLabel}>Timer (seconds)</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 60"
              placeholderTextColor={theme.colors.textMuted}
              value={timer}
              onChangeText={t => setTimer(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
            />
          </ScrollView>

          <View style={s.modalActions}>
            <TouchableOpacity style={s.modalCancelBtn} onPress={onClose} activeOpacity={0.8} disabled={saving}>
              <Text style={s.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modalAddBtn, { backgroundColor: accent }, saving && { opacity: 0.6 }]}
              onPress={submit}
              activeOpacity={0.85}
              disabled={saving}
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

// ─── Read-only / edit question card ───────────────────────────────────────────
const QuestionCard = ({
  q,
  index,
  accent,
  editable,
  busy,
  onEdit,
  onDelete,
}: {
  q: QuizQuestion;
  index: number;
  accent: string;
  editable: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <View style={s.qCard}>
    <View style={s.qHeader}>
      <View style={[s.qBadge, { backgroundColor: accent }]}>
        <Text style={s.qBadgeText}>{index + 1}</Text>
      </View>
      <Text style={s.qText}>{q.questionText}</Text>
    </View>

    {q.options.map((o, i) => (
      <View key={o.id ?? i} style={[s.optView, o.isCorrect && s.optViewCorrect]}>
        <View style={[s.optLetter, o.isCorrect && { backgroundColor: '#16A34A' }]}>
          <Text style={[s.optLetterText, o.isCorrect && { color: '#fff' }]}>{LETTERS[i] ?? '•'}</Text>
        </View>
        <Text style={[s.optText, o.isCorrect && { color: '#15803D', fontWeight: '700' }]}>{o.text}</Text>
        {o.isCorrect && <VectorIcon iconSet="Ionicons" iconName="checkmark-circle" size={16} color="#16A34A" />}
      </View>
    ))}

    <View style={s.qFooter}>
      <View style={s.timerPill}>
        <VectorIcon iconSet="Ionicons" iconName="timer-outline" size={13} color={theme.colors.textSecondary} />
        <Text style={s.timerText}>{q.timeLimit}s</Text>
      </View>
      {editable && (
        <View style={s.qActions}>
          <TouchableOpacity style={[s.qActionBtn, { backgroundColor: accent + '18' }]} onPress={onEdit} activeOpacity={0.8} disabled={busy}>
            <VectorIcon iconSet="Ionicons" iconName="create-outline" size={15} color={accent} />
            <Text style={[s.qActionText, { color: accent }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.qActionBtn, s.qActionDanger]} onPress={onDelete} activeOpacity={0.8} disabled={busy}>
            {busy ? (
              <ActivityIndicator size="small" color={theme.colors.danger} />
            ) : (
              <>
                <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={15} color={theme.colors.danger} />
                <Text style={[s.qActionText, { color: theme.colors.danger }]}>Delete</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  </View>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const ManageQuizScreen = ({ navigation, route }: any) => {
  const {
    standardId,
    sectionId,
    chapterId,
    topicId,
    topicName,
    chapterName,
    subjectName,
  } = route.params ?? {};
  const accent: string = route.params?.subjectColor ?? PRIMARY;

  const [mode, setMode] = useState<'edit' | 'view'>('edit');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QuizQuestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getQuizzes({
        standard_id: standardId,
        section_id: sectionId,
        chapter_id: chapterId,
        topic_id: topicId,
      });
      setQuestions(list);
    } catch (e: any) {
      console.log('[getQuizzes] Error:', e?.response?.status, e?.message);
      setError(quizErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [standardId, sectionId, chapterId, topicId]);

  const { refreshing, onRefresh } = useRefresh(load);
  useFocusLoad(load);

  const submit = async (data: { questionText: string; options: string[]; correctIndex: number; timeLimit: number }) => {
    setSaving(true);
    try {
      const payload = {
        question_text: data.questionText,
        standard_id: standardId,
        section_id: sectionId,
        chapter_id: chapterId ?? null,
        topic_id: topicId ?? null,
        time_limit: data.timeLimit,
        options: data.options
          .map((text, i) => ({ option_text: text.trim(), is_correct: i === data.correctIndex }))
          .filter(o => o.option_text !== ''),
      };
      if (editing) {
        const updated = await updateQuestion(editing.id, payload);
        setQuestions(prev => prev.map(q => (q.id === updated.id ? updated : q)));
      } else {
        const created = await createQuestion(payload);
        setQuestions(prev => [...prev, created]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e: any) {
      Alert.alert('Error', quizErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (q: QuizQuestion) => {
    Alert.alert('Delete Question', 'Delete this MCQ? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(q.id);
          try {
            await deleteQuestion(q.id);
            setQuestions(prev => prev.filter(x => x.id !== q.id));
          } catch (e: any) {
            Alert.alert('Error', quizErrorMessage(e));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (q: QuizQuestion) => {
    setEditing(q);
    setModalOpen(true);
  };

  return (
    <View style={s.root}>
      <Header title="Manage Quiz" onBackPress={() => navigation.goBack()} />

      {/* Topic banner + mode toggle */}
      <View style={s.topBar}>
        <Text style={s.topicName} numberOfLines={1}>{topicName}</Text>
        <Text style={s.topicMeta} numberOfLines={1}>
          {subjectName}{chapterName ? ` · ${chapterName}` : ''}
        </Text>
        <View style={s.segment}>
          {(['edit', 'view'] as const).map(m => {
            const active = mode === m;
            return (
              <TouchableOpacity
                key={m}
                style={[s.segBtn, active && { backgroundColor: accent }]}
                onPress={() => setMode(m)}
                activeOpacity={0.85}
              >
                <VectorIcon
                  iconSet="Ionicons"
                  iconName={m === 'edit' ? 'create-outline' : 'eye-outline'}
                  size={15}
                  color={active ? '#fff' : theme.colors.textSecondary}
                />
                <Text style={[s.segText, active && { color: '#fff' }]}>{m === 'edit' ? 'Edit' : 'View'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

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
          <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="refresh" size={15} color={PRIMARY} />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {questions.length === 0 ? (
              <View style={s.empty}>
                <VectorIcon iconSet="Ionicons" iconName="help-circle-outline" size={48} color={theme.colors.textMuted} />
                <Text style={s.emptyTitle}>No questions yet</Text>
                <Text style={s.emptySubText}>
                  {mode === 'edit' ? 'Tap “Add Question” to create the first MCQ.' : 'No MCQs to preview yet.'}
                </Text>
              </View>
            ) : (
              questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  index={i}
                  accent={accent}
                  editable={mode === 'edit'}
                  busy={busyId === q.id}
                  onEdit={() => openEdit(q)}
                  onDelete={() => confirmDelete(q)}
                />
              ))
            )}
            <View style={{ height: 100 }} />
          </ScrollView>

          {mode === 'edit' && (
            <TouchableOpacity style={[s.fab, { backgroundColor: accent, shadowColor: accent }]} onPress={openAdd} activeOpacity={0.85}>
              <VectorIcon iconSet="Ionicons" iconName="add" size={20} color="#fff" />
              <Text style={s.fabText}>Add Question</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <QuestionModal
        visible={modalOpen}
        isEdit={!!editing}
        accent={accent}
        initial={editing}
        saving={saving}
        onClose={() => !saving && (setModalOpen(false), setEditing(null))}
        onSubmit={submit}
      />
    </View>
  );
};

export default ManageQuizScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },

  topBar: {
    backgroundColor: theme.colors.card, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  topicName: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  topicMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, fontWeight: '500' },
  segment: {
    flexDirection: 'row', backgroundColor: theme.colors.background, borderRadius: theme.radius.full,
    padding: 4, marginTop: 12, alignSelf: 'flex-start', gap: 4,
  },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 20, paddingVertical: 7, borderRadius: theme.radius.full },
  segText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },

  qCard: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border,
    padding: 14, marginBottom: 12, elevation: 1,
  },
  qHeader: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  qBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qBadgeText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  qText: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 21 },

  optView: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 6,
  },
  optViewCorrect: { borderColor: '#16A34A', backgroundColor: '#16A34A10' },
  optLetter: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  optLetterText: { fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary },
  optText: { flex: 1, fontSize: 13, color: theme.colors.textPrimary },

  qFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.background,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.full,
  },
  timerText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  qActions: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  qActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm },
  qActionDanger: { backgroundColor: '#FEE2E2' },
  qActionText: { fontSize: 12, fontWeight: '700' },

  fab: {
    position: 'absolute', bottom: 24, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 15, borderRadius: 999,
    shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8,
  },
  fabText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  errorIconRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, color: theme.colors.textSecondary, fontWeight: '800' },
  emptySubText: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 24, lineHeight: 19 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5,
    borderColor: PRIMARY, borderRadius: theme.radius.full, paddingHorizontal: 18, paddingVertical: 9, marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, maxHeight: '90%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 99, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 18 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  modalIconBox: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '900', color: theme.colors.textPrimary },
  inputLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: theme.colors.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: theme.colors.textPrimary, borderWidth: 1.5, borderColor: theme.colors.border, marginBottom: 16,
  },
  inputMulti: { minHeight: 80 },
  optRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: theme.colors.border,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10,
  },
  radio: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card,
  },
  radioLetter: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary },
  optInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 8 },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: theme.colors.background, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: theme.colors.textSecondary },
  modalAddBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14 },
  modalAddText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

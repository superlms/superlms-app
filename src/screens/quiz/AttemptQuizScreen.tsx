import React, { useCallback, useEffect, useRef, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import {
  getQuizzes,
  submitAnswer,
  quizErrorMessage,
  type QuizQuestion,
} from '../../api/quizApi';

const PRIMARY = theme.colors.primary;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

type Phase = 'loading' | 'error' | 'empty' | 'attempt' | 'report';

const AttemptQuizScreen = ({ navigation, route }: any) => {
  const { chapterId, topicId, topicName, chapterName, subjectName } = route.params ?? {};
  const accent: string = route.params?.subjectColor ?? PRIMARY;

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [selectedByQ, setSelectedByQ] = useState<Record<number, number>>({});

  // Synchronous mirrors for the timer/submit closures.
  const selectedRef = useRef<Record<number, number>>({});
  const takenRef = useRef<Record<number, number>>({});
  const remainingRef = useRef(0);
  const finishedRef = useRef(false);

  const load = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const list = await getQuizzes({ chapter_id: chapterId, topic_id: topicId });
      setQuestions(list);
      setPhase(list.length ? 'attempt' : 'empty');
    } catch (e: any) {
      console.log('[getQuizzes] Error:', e?.response?.status, e?.message);
      setError(quizErrorMessage(e));
      setPhase('error');
    }
  }, [chapterId, topicId]);

  useEffect(() => {
    load();
  }, [load]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // Persist every answered question (best-effort) so the report + admin sync.
    Object.entries(selectedRef.current).forEach(([qid, optId]) => {
      submitAnswer(Number(qid), optId, takenRef.current[Number(qid)] ?? 0).catch(() => {});
    });
    setPhase('report');
  }, []);

  const goNext = useCallback(() => {
    setIdx(prev => {
      if (prev < questions.length - 1) return prev + 1;
      finish();
      return prev;
    });
  }, [questions.length, finish]);

  // Per-question countdown. Resets whenever the question changes.
  useEffect(() => {
    if (phase !== 'attempt' || !questions.length) return;
    const q = questions[idx];
    const limit = q.timeLimit > 0 ? q.timeLimit : 60;
    remainingRef.current = limit;
    setRemaining(limit);

    const t = setInterval(() => {
      remainingRef.current -= 1;
      setRemaining(remainingRef.current);
      if (remainingRef.current <= 0) {
        clearInterval(t);
        // record time taken as the full limit on timeout
        takenRef.current[q.id] = limit;
        goNext();
      }
    }, 1000);

    return () => clearInterval(t);
  }, [idx, phase, questions, goNext]);

  const pick = (q: QuizQuestion, optionId: number) => {
    selectedRef.current[q.id] = optionId;
    setSelectedByQ(prev => ({ ...prev, [q.id]: optionId }));
  };

  const next = () => {
    const q = questions[idx];
    const limit = q.timeLimit > 0 ? q.timeLimit : 60;
    takenRef.current[q.id] = Math.max(0, limit - Math.max(0, remainingRef.current));
    goNext();
  };

  const retake = () => {
    selectedRef.current = {};
    takenRef.current = {};
    finishedRef.current = false;
    setSelectedByQ({});
    setIdx(0);
    setPhase('attempt');
  };

  // ── Loading / error / empty ──
  if (phase === 'loading') {
    return (
      <View style={s.root}>
        <Header title="Quiz" onBackPress={() => navigation.goBack()} />
        <View style={s.stateBox}><ScreenSkeleton variant="list" /></View>
      </View>
    );
  }
  if (phase === 'error') {
    return (
      <View style={s.root}>
        <Header title="Quiz" onBackPress={() => navigation.goBack()} />
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
      </View>
    );
  }
  if (phase === 'empty') {
    return (
      <View style={s.root}>
        <Header title="Quiz" onBackPress={() => navigation.goBack()} />
        <View style={s.stateBox}>
          <VectorIcon iconSet="Ionicons" iconName="help-circle-outline" size={48} color={theme.colors.textMuted} />
          <Text style={s.emptyTitle}>No quiz yet</Text>
          <Text style={s.emptySubText}>No MCQs have been added for “{topicName}” yet.</Text>
        </View>
      </View>
    );
  }

  // ── Report ──
  if (phase === 'report') {
    const total = questions.length;
    const correct = questions.reduce((sum, q) => {
      const sel = selectedByQ[q.id];
      const selOpt = q.options.find(o => o.id === sel);
      return sum + (selOpt?.isCorrect ? 1 : 0);
    }, 0);
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const pass = pct >= 40;

    return (
      <View style={s.root}>
        <Header title="Quiz Report" onBackPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Score card */}
          <View style={[s.scoreCard, { borderColor: accent + '40' }]}>
            <View style={[s.scoreRing, { borderColor: pass ? '#16A34A' : theme.colors.danger }]}>
              <Text style={[s.scorePct, { color: pass ? '#16A34A' : theme.colors.danger }]}>{pct}%</Text>
            </View>
            <Text style={s.scoreTitle}>{correct} / {total} correct</Text>
            <Text style={s.scoreSub} numberOfLines={1}>{topicName}</Text>
          </View>

          {/* Per-question review */}
          {questions.map((q, i) => {
            const sel = selectedByQ[q.id];
            const selOpt = q.options.find(o => o.id === sel);
            const correctOpt = q.options.find(o => o.isCorrect);
            const right = !!selOpt?.isCorrect;
            return (
              <View key={q.id} style={s.reviewCard}>
                <View style={s.reviewHeader}>
                  <View style={[s.reviewBadge, { backgroundColor: right ? '#16A34A' : theme.colors.danger }]}>
                    <VectorIcon iconSet="Ionicons" iconName={right ? 'checkmark' : 'close'} size={14} color="#fff" />
                  </View>
                  <Text style={s.reviewQ}>{i + 1}. {q.questionText}</Text>
                </View>

                {q.options.map((o, oi) => {
                  const isSel = o.id === sel;
                  const isCorrect = o.isCorrect;
                  return (
                    <View
                      key={o.id ?? oi}
                      style={[
                        s.reviewOpt,
                        isCorrect && s.optCorrect,
                        isSel && !isCorrect && s.optWrong,
                      ]}
                    >
                      <Text style={[s.reviewOptLetter, (isCorrect || (isSel && !isCorrect)) && { color: '#fff' }]}>{LETTERS[oi] ?? '•'}</Text>
                      <Text
                        style={[
                          s.reviewOptText,
                          isCorrect && { color: '#15803D', fontWeight: '700' },
                          isSel && !isCorrect && { color: theme.colors.danger, fontWeight: '700' },
                        ]}
                      >
                        {o.text}
                      </Text>
                      {isCorrect && <Text style={[s.tag, { color: '#15803D' }]}>Correct</Text>}
                      {isSel && !isCorrect && <Text style={[s.tag, { color: theme.colors.danger }]}>Your answer</Text>}
                    </View>
                  );
                })}

                {sel == null && (
                  <Text style={s.skippedText}>Not answered — correct answer: {correctOpt?.text ?? '—'}</Text>
                )}
              </View>
            );
          })}

          <View style={s.reportActions}>
            <TouchableOpacity style={[s.retakeBtn, { borderColor: accent }]} onPress={retake} activeOpacity={0.85}>
              <VectorIcon iconSet="Ionicons" iconName="refresh" size={16} color={accent} />
              <Text style={[s.retakeText, { color: accent }]}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.doneBtn, { backgroundColor: accent }]} onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <Text style={s.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    );
  }

  // ── Attempt ──
  const q = questions[idx];
  const sel = selectedByQ[q.id];
  const progress = (idx + 1) / questions.length;
  const low = remaining <= 5;

  return (
    <View style={s.root}>
      <Header title={subjectName || 'Quiz'} onBackPress={() => navigation.goBack()} />

      {/* Progress + timer */}
      <View style={s.attemptTop}>
        <View style={s.progressRow}>
          <Text style={s.counter}>Question {idx + 1} / {questions.length}</Text>
          <View style={[s.timerPill, low && { backgroundColor: theme.colors.danger }]}>
            <VectorIcon iconSet="Ionicons" iconName="timer-outline" size={14} color={low ? '#fff' : accent} />
            <Text style={[s.timerText, { color: low ? '#fff' : accent }]}>{remaining}s</Text>
          </View>
        </View>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.questionCard}>
          {!!chapterName && <Text style={s.qChapter} numberOfLines={1}>{chapterName}</Text>}
          <Text style={s.questionText}>{q.questionText}</Text>
        </View>

        {q.options.map((o, oi) => {
          const active = o.id === sel;
          return (
            <TouchableOpacity
              key={o.id ?? oi}
              style={[s.optBtn, active && { borderColor: accent, backgroundColor: accent + '12' }]}
              onPress={() => o.id != null && pick(q, o.id)}
              activeOpacity={0.85}
            >
              <View style={[s.optLetter, active && { backgroundColor: accent, borderColor: accent }]}>
                <Text style={[s.optLetterText, active && { color: '#fff' }]}>{LETTERS[oi] ?? '•'}</Text>
              </View>
              <Text style={[s.optText, active && { color: accent, fontWeight: '700' }]}>{o.text}</Text>
              {active && <VectorIcon iconSet="Ionicons" iconName="checkmark-circle" size={18} color={accent} />}
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 90 }} />
      </ScrollView>

      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.nextBtn, { backgroundColor: accent }, sel == null && { opacity: 0.5 }]}
          onPress={next}
          activeOpacity={0.85}
        >
          <Text style={s.nextText}>{idx < questions.length - 1 ? 'Next' : 'Finish'}</Text>
          <VectorIcon
            iconSet="Ionicons"
            iconName={idx < questions.length - 1 ? 'arrow-forward' : 'checkmark-done'}
            size={18}
            color="#fff"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AttemptQuizScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },

  attemptTop: {
    backgroundColor: theme.colors.card, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  counter: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  timerPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  timerText: { fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: theme.colors.background, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  questionCard: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border,
    padding: 16, marginBottom: 16,
  },
  qChapter: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  questionText: { fontSize: 17, fontWeight: '800', color: theme.colors.textPrimary, lineHeight: 24 },

  optBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.border,
    paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10,
  },
  optLetter: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background,
  },
  optLetterText: { fontSize: 13, fontWeight: '800', color: theme.colors.textSecondary },
  optText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },

  bottomBar: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 14 },
  nextText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Report
  scoreCard: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1,
    alignItems: 'center', padding: 24, marginBottom: 16,
  },
  scoreRing: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 6,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  scorePct: { fontSize: 26, fontWeight: '900' },
  scoreTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  scoreSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },

  reviewCard: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border,
    padding: 14, marginBottom: 12,
  },
  reviewHeader: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  reviewBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reviewQ: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 20 },

  reviewOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10,
    borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 6,
  },
  optCorrect: { borderColor: '#16A34A', backgroundColor: '#16A34A10' },
  optWrong: { borderColor: theme.colors.danger, backgroundColor: '#FEE2E2' },
  reviewOptLetter: {
    width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22,
    fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary, overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  reviewOptText: { flex: 1, fontSize: 13, color: theme.colors.textPrimary },
  tag: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  skippedText: { fontSize: 12, color: theme.colors.textMuted, fontStyle: 'italic', marginTop: 4 },

  reportActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  retakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1.5,
  },
  retakeText: { fontSize: 15, fontWeight: '800' },
  doneBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14 },
  doneText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  errorIconRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textSecondary },
  emptySubText: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5,
    borderColor: PRIMARY, borderRadius: theme.radius.full, paddingHorizontal: 18, paddingVertical: 9, marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

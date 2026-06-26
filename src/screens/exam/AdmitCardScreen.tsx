import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { Exam, STATUS_CONFIG, iconForType } from './examData';
import { getExams, examErrorMessage } from '../../api/examApi';
import {
  AdmitCardData,
  admitCardErrorMessage,
  authHeader,
  downloadAdmitCardPdf,
  getExamAdmitCard,
  isAdmitCardNotIssued,
} from '../../api/admitCardApi';
import ExamDropdown from './ExamDropdown';

const pdfName = (exam: Exam) =>
  `Admit_Card_${(exam.name || 'Exam').replace(/\s+/g, '_')}_${exam.academicYear || ''}`.replace(/_+$/, '');

const mk = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : String(n);

type CardState = 'loading' | 'issued' | 'not_issued' | 'error';

const AdmitCardScreen = ({ navigation }: any) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);

  const [card, setCard] = useState<AdmitCardData | null>(null);
  const [cardState, setCardState] = useState<CardState>('loading');
  const [cardError, setCardError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState(false);

  // ── Load the student's exams ──────────────────────────────────────────────
  const loadExams = useCallback(async () => {
    setExamsLoading(true);
    setExamsError(null);
    try {
      const list = await getExams();
      setExams(list);
      const first = list[0] ?? null;
      setExam(first);
      if (first) fetchAdmitCard(first);
      else setCardState('not_issued');
    } catch (e) {
      setExamsError(examErrorMessage(e));
    } finally {
      setExamsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load the admit card for a given exam ──────────────────────────────────
  const fetchAdmitCard = useCallback(async (e: Exam) => {
    setCardState('loading');
    setCard(null);
    setCardError(null);
    try {
      const data = await getExamAdmitCard(e.id);
      setCard(data);
      setCardState('issued');
    } catch (err) {
      if (isAdmitCardNotIssued(err)) {
        setCardState('not_issued');
      } else {
        setCardError(admitCardErrorMessage(err));
        setCardState('error');
      }
    }
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const chooseExam = (e: Exam) => {
    setExam(e);
    fetchAdmitCard(e);
  };

  const { refreshing, onRefresh } = useRefresh(async () => {
    if (exam) await fetchAdmitCard(exam);
    else await loadExams();
  });

  // ── Actions ───────────────────────────────────────────────────────────────
  const onPreview = async () => {
    if (!card?.pdf_url) return;
    const headers = await authHeader();
    navigation.navigate('BookReader', {
      url: card.pdf_url,
      title: 'Admit Card',
      headers,
    });
  };

  const onDownload = async () => {
    if (!card?.pdf_url || downloading) return;
    setDownloading(true);
    try {
      await downloadAdmitCardPdf(card.pdf_url, pdfName(exam ?? ({} as Exam)));
      Alert.alert(
        'Downloaded',
        Platform.OS === 'android'
          ? 'Admit card saved to your Downloads.'
          : 'Admit card saved to your device.',
      );
    } catch (e) {
      Alert.alert('Download failed', admitCardErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  // ── Exams still loading / failed ──────────────────────────────────────────
  if (examsLoading) {
    return (
      <View style={s.root}>
        <Header title="Admit Card" onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={s.centerText}>Loading exams…</Text>
        </View>
      </View>
    );
  }

  if (examsError) {
    return (
      <View style={s.root}>
        <Header title="Admit Card" onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={46} color={theme.colors.textMuted} />
          <Text style={s.centerText}>{examsError}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadExams} activeOpacity={0.85}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!exam) {
    return (
      <View style={s.root}>
        <Header title="Admit Card" onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <VectorIcon iconSet="Ionicons" iconName="document-text-outline" size={46} color={theme.colors.textMuted} />
          <Text style={s.centerText}>No exams found for your class yet.</Text>
        </View>
      </View>
    );
  }

  const status = STATUS_CONFIG[exam.status];

  return (
    <View style={s.root}>
      <Header title="Admit Card" onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ExamDropdown selected={exam} onSelect={chooseExam} exams={exams} />

        {/* ── Selected exam card ── */}
        <View style={s.card}>
          <View style={[s.accent, { backgroundColor: status?.accent ?? theme.colors.primary }]} />
          <View style={s.cardInner}>
            <View style={s.topRow}>
              <View style={s.iconBox}>
                <VectorIcon iconSet="Ionicons" iconName={iconForType(exam.type)} size={20} color={theme.colors.primary} />
              </View>
              <View style={s.meta}>
                <Text style={s.title} numberOfLines={1}>{exam.name}</Text>
                <View style={s.metaRow}>
                  <View style={s.tagPill}>
                    <Text style={s.tagText}>{exam.type}</Text>
                  </View>
                  {!!status && (
                    <View style={[s.tagPill, { backgroundColor: status.bg }]}>
                      <Text style={[s.tagText, { color: status.color }]}>{exam.status}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={s.detailRow}>
              <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={14} color={theme.colors.textMuted} />
              <Text style={s.detailText}>{exam.dateRange}</Text>
            </View>
            <View style={s.detailRow}>
              <VectorIcon iconSet="Ionicons" iconName="ribbon-outline" size={14} color={theme.colors.textMuted} />
              <Text style={s.detailText}>
                Total {mk(exam.totalMarks)} · Passing {mk(exam.passingMarks)} marks
              </Text>
            </View>
          </View>
        </View>

        {/* ── Admit card body ── */}
        {cardState === 'loading' && (
          <View style={s.stateBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={s.stateSub}>Checking admit card…</Text>
          </View>
        )}

        {cardState === 'error' && (
          <View style={s.stateBox}>
            <View style={s.stateIconRing}>
              <VectorIcon iconSet="Ionicons" iconName="alert-circle-outline" size={32} color={theme.colors.danger} />
            </View>
            <Text style={s.stateTitle}>Couldn’t load admit card</Text>
            <Text style={s.stateSub}>{cardError}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => fetchAdmitCard(exam)} activeOpacity={0.85}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {cardState === 'not_issued' && (
          <View style={s.stateBox}>
            <View style={s.stateIconRing}>
              <VectorIcon iconSet="Ionicons" iconName="card-outline" size={34} color={theme.colors.primary} />
            </View>
            <Text style={s.stateTitle}>Admit card not issued yet</Text>
            <Text style={s.stateSub}>
              Your admit card for {exam.name} ({exam.academicYear}) hasn’t been issued by the
              school yet. Please check back later.
            </Text>
          </View>
        )}

        {cardState === 'issued' && card && (
          <>
            {/* ── Paper preview (summary) ── */}
            <View style={s.paper}>
              <Text style={s.paperSchool}>{card.organization.name ?? 'School'}</Text>
              {!!card.organization.address && (
                <Text style={s.paperAddress}>{card.organization.address}</Text>
              )}
              <View style={s.paperTitlePill}>
                <Text style={s.paperTitleText}>
                  ADMIT CARD — {(card.exam.name ?? exam.name).toUpperCase()}
                  {card.exam.academic_year ? ` (${card.exam.academic_year})` : ''}
                </Text>
              </View>

              {/* Student row */}
              <View style={s.studentRow}>
                {!!card.student.image_url && (
                  <Image source={{ uri: card.student.image_url }} style={s.studentPhoto} />
                )}
                <View style={s.studentGrid}>
                  {[
                    ['Name', card.student.full_name],
                    ['Class', card.student.class],
                    ['Roll No', card.student.exam_roll_number || card.student.roll_number || card.student.roll_no],
                    ['Admission No', card.student.admission_no],
                  ]
                    .filter(([, v]) => !!v)
                    .map(([label, value]) => (
                      <View key={label as string} style={s.studentField}>
                        <Text style={s.studentLabel}>{label}</Text>
                        <Text style={s.studentValue}>{value}</Text>
                      </View>
                    ))}
                </View>
              </View>

              {/* Subjects table with marks */}
              {card.subjects.length > 0 ? (
                <View style={s.table}>
                  <View style={[s.tr, s.trHead]}>
                    <Text style={[s.th, { flex: 1.7 }]}>Subject</Text>
                    <Text style={[s.th, s.thRight, { flex: 0.7 }]}>Total</Text>
                    <Text style={[s.th, s.thRight, { flex: 0.7 }]}>Pass</Text>
                    <Text style={[s.th, { flex: 1.2 }]}>Date</Text>
                  </View>
                  {card.subjects.map((row, i) => (
                    <View key={`${row.subject_id ?? row.subject_name}-${i}`} style={[s.tr, i % 2 === 1 && s.trAlt]}>
                      <Text style={[s.td, { flex: 1.7, fontWeight: '700' }]} numberOfLines={1}>
                        {row.subject_name}
                      </Text>
                      <Text style={[s.td, s.tdRight, { flex: 0.7 }]}>{mk(row.total_marks)}</Text>
                      <Text style={[s.td, s.tdRight, { flex: 0.7 }]}>{mk(row.passing_marks)}</Text>
                      <Text style={[s.td, { flex: 1.2 }]}>{row.exam_date_formatted ?? '—'}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={s.noSubjects}>Subject schedule will appear here once added.</Text>
              )}

              {/* Center / seat */}
              {(card.exam_center.name || card.exam_center.seating_label) && (
                <View style={s.centerRow}>
                  <VectorIcon iconSet="Ionicons" iconName="location-outline" size={13} color={theme.colors.textMuted} />
                  <Text style={s.centerText2}>
                    {[card.exam_center.name, card.exam_center.seating_label].filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
              )}

              <Text style={s.paperNote}>
                Note: This is a summary. Tap “Preview” to view the full admit card, and carry the
                downloaded copy on all exam days.
              </Text>
            </View>

            {/* ── Actions ── */}
            <View style={s.actionRow}>
              <TouchableOpacity style={s.actionGhost} onPress={onPreview} activeOpacity={0.85}>
                <VectorIcon iconSet="Ionicons" iconName="book-outline" size={17} color={theme.colors.primary} />
                <Text style={s.actionGhostText}>Preview</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionPrimary, downloading && { opacity: 0.7 }]}
                onPress={onDownload}
                disabled={downloading}
                activeOpacity={0.85}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <VectorIcon iconSet="Ionicons" iconName="download-outline" size={17} color="#fff" />
                )}
                <Text style={s.actionPrimaryText}>{downloading ? 'Downloading…' : 'Download'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default AdmitCardScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, gap: 14 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centerText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Exam card
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  accent: { width: 4, alignSelf: 'stretch' },
  cardInner: { flex: 1, padding: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagPill: {
    borderRadius: theme.radius.full,
    paddingHorizontal: 9,
    paddingVertical: 2,
    backgroundColor: theme.colors.primaryLight,
  },
  tagText: { fontSize: 10, fontWeight: '700', color: theme.colors.primary },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  detailText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },

  // State boxes (loading / not issued / error)
  stateBox: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    paddingVertical: 34,
    paddingHorizontal: 24,
    gap: 8,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  stateIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stateTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  stateSub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19 },
  retryBtn: {
    marginTop: 12,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // PDF toolbar
  pdfBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 10,
  },
  pdfBadge: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  pdfName: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  pdfMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },

  // Paper preview
  paper: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    elevation: 2,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  paperSchool: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.primary,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  paperAddress: { fontSize: 10, color: theme.colors.textMuted, textAlign: 'center', marginTop: 2 },
  paperTitlePill: {
    alignSelf: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: 10,
  },
  paperTitleText: { fontSize: 11, fontWeight: '800', color: theme.colors.primary, letterSpacing: 0.6 },
  studentRow: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'center' },
  studentPhoto: {
    width: 64,
    height: 76,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  studentGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  studentField: { width: '50%', paddingVertical: 3 },
  studentLabel: { fontSize: 9, color: theme.colors.textMuted, fontWeight: '600' },
  studentValue: { fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary },

  // Table
  table: { marginTop: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, overflow: 'hidden' },
  tr: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, gap: 4 },
  trHead: { backgroundColor: theme.colors.primaryLight },
  trAlt: { backgroundColor: theme.colors.background },
  th: { fontSize: 9, fontWeight: '800', color: theme.colors.primary, textTransform: 'uppercase' },
  thRight: { textAlign: 'right' },
  td: { fontSize: 10, color: theme.colors.textPrimary },
  tdRight: { textAlign: 'right' },
  noSubjects: { fontSize: 11, color: theme.colors.textMuted, marginTop: 14, fontStyle: 'italic' },

  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  centerText2: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', flex: 1 },

  paperNote: { fontSize: 9, color: theme.colors.textMuted, marginTop: 12, lineHeight: 13 },

  // Actions
  actionRow: { flexDirection: 'row', gap: 12 },
  actionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingVertical: 13,
  },
  actionPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  actionGhost: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    paddingVertical: 13,
  },
  actionGhostText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

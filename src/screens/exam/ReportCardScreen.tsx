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
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import {
  GradeBand,
  ReportCardDetail,
  authHeader,
  downloadReportCardPdf,
  getReportCard,
  getReportCards,
  reportCardErrorMessage,
} from '../../api/reportCardApi';

// Colour for a grade letter (A1/A2 → green, B → teal, C → amber, D/E → red).
const gradeColor = (grade?: string | null): { color: string; bg: string } => {
  const g = (grade ?? '').toUpperCase();
  if (g.startsWith('A')) return { color: '#16A34A', bg: '#DCFCE7' };
  if (g.startsWith('B')) return { color: '#0EA5E9', bg: '#E0F2FE' };
  if (g.startsWith('C')) return { color: '#D97706', bg: '#FEF3C7' };
  return { color: '#EF4444', bg: '#FEE2E2' };
};

const num = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : String(Math.round(n * 100) / 100);

const avatarFor = (name?: string | null) =>
  `https://ui-avatars.com/api/?background=4F46E5&color=fff&size=160&name=${encodeURIComponent(
    name || 'Student',
  )}`;

const fileNameFor = (d: ReportCardDetail | null) =>
  `Report_Card_${(d?.academic_year || '').replace(/[^0-9A-Za-z-]/g, '_')}`.replace(/_+$/, '');

type ScreenState = 'loading' | 'ready' | 'empty' | 'error';

const ReportCardScreen = ({ navigation }: any) => {
  const [state, setState] = useState<ScreenState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<ReportCardDetail | null>(null);
  const [photoBroken, setPhotoBroken] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Load the latest (current year) report card.
  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    setPhotoBroken(false);
    try {
      const list = await getReportCards();
      if (!list.length) {
        setCard(null);
        setState('empty');
        return;
      }
      // The list is latest-first; the current year is the first issued card.
      const detail = await getReportCard(list[0].id);
      setCard(detail);
      setState('ready');
    } catch (e) {
      setError(reportCardErrorMessage(e));
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { refreshing, onRefresh } = useRefresh(load);

  const onPreview = async () => {
    if (!card?.pdf_url) return;
    const headers = await authHeader();
    navigation.navigate('BookReader', {
      url: card.pdf_url,
      title: 'Annual Report Card',
      headers,
    });
  };

  const onDownload = async () => {
    if (!card?.pdf_url || downloading) return;
    setDownloading(true);
    try {
      await downloadReportCardPdf(card.pdf_url, fileNameFor(card));
      Alert.alert(
        'Downloaded',
        Platform.OS === 'android'
          ? 'Report card saved to your Downloads.'
          : 'Report card saved to your device.',
      );
    } catch (e) {
      Alert.alert('Download failed', reportCardErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  // ── Loading / empty / error ────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <View style={s.root}>
        <Header title="Report Card" onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={s.centerText}>Loading report card…</Text>
        </View>
      </View>
    );
  }

  if (state === 'empty') {
    return (
      <View style={s.root}>
        <Header title="Report Card" onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <View style={s.emptyRing}>
            <VectorIcon iconSet="Ionicons" iconName="document-text-outline" size={34} color={theme.colors.primary} />
          </View>
          <Text style={s.emptyTitle}>No report card yet</Text>
          <Text style={s.centerText}>
            Your annual report card hasn’t been issued by the school yet. Please check back later.
          </Text>
        </View>
      </View>
    );
  }

  if (state === 'error' || !card) {
    return (
      <View style={s.root}>
        <Header title="Report Card" onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={44} color={theme.colors.textMuted} />
          <Text style={s.centerText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.85}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { summary, student } = card;
  const gc = gradeColor(summary.grade);
  const photo = !photoBroken ? student.image_url || avatarFor(student.full_name) : avatarFor(student.full_name);

  return (
    <View style={s.root}>
      <Header title="Report Card" onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Current-year chip (only the active academic year) */}
        <View style={s.yearChipRow}>
          <View style={s.yearChip}>
            <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={13} color={theme.colors.primary} />
            <Text style={s.yearChipText}>AY {card.academic_year ?? '—'}</Text>
          </View>
        </View>

        {/* ── Hero card ── */}
        <View style={s.hero}>
          <View style={s.heroAccent} />
          <View style={s.heroInner}>
            <View style={s.heroTop}>
              {/* Image instead of an icon */}
              <Image source={{ uri: photo }} onError={() => setPhotoBroken(true)} style={s.heroImage} />
              <View style={s.heroMeta}>
                <Text style={s.heroTitle}>Annual Report Card</Text>
                <Text style={s.heroName} numberOfLines={1}>{student.full_name ?? '—'}</Text>
                <View style={s.heroSubRow}>
                  {!!card.class && (
                    <View style={s.heroPill}><Text style={s.heroPillText}>{card.class}</Text></View>
                  )}
                  {!!student.roll_no && (
                    <View style={s.heroPill}><Text style={s.heroPillText}>Roll {student.roll_no}</Text></View>
                  )}
                </View>
              </View>
            </View>

            {/* Dynamic stats */}
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statValue}>{num(summary.percentage)}%</Text>
                <Text style={s.statLabel}>Percentage</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <View style={[s.gradeBadge, { backgroundColor: gc.bg }]}>
                  <Text style={[s.gradeBadgeText, { color: gc.color }]}>{summary.grade ?? '—'}</Text>
                </View>
                <Text style={s.statLabel}>Grade</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>
                  {summary.rank ? summary.rank : '—'}
                  {summary.rank && summary.rank_total ? (
                    <Text style={s.statValueSub}> / {summary.rank_total}</Text>
                  ) : null}
                </Text>
                <Text style={s.statLabel}>Rank</Text>
              </View>
            </View>

            {/* Result + remark */}
            <View style={s.resultRow}>
              {!!summary.result && (
                <View
                  style={[
                    s.resultPill,
                    { backgroundColor: summary.result === 'Pass' ? '#DCFCE7' : '#FEE2E2' },
                  ]}
                >
                  <Text style={[s.resultPillText, { color: summary.result === 'Pass' ? '#16A34A' : '#EF4444' }]}>
                    {summary.result}
                  </Text>
                </View>
              )}
              {!!summary.grade_remark && <Text style={s.remarkText}>{summary.grade_remark}</Text>}
            </View>
          </View>
        </View>

        {/* ── Subjects ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Subjects</Text>
          {card.subjects.length > 0 ? (
            <View style={s.table}>
              <View style={[s.tr, s.trHead]}>
                <Text style={[s.th, { flex: 2 }]}>Subject</Text>
                <Text style={[s.th, s.thRight, { flex: 1 }]}>Marks</Text>
                <Text style={[s.th, s.thRight, { flex: 0.9 }]}>%</Text>
                <Text style={[s.th, s.thRight, { flex: 0.9 }]}>Grade</Text>
              </View>
              {card.subjects.map((row, i) => {
                const rgc = gradeColor(row.grade);
                return (
                  <View key={`${row.subject_id ?? row.subject}-${i}`} style={[s.tr, i % 2 === 1 && s.trAlt]}>
                    <Text style={[s.td, { flex: 2, fontWeight: '700' }]} numberOfLines={1}>
                      {row.subject ?? '—'}
                    </Text>
                    <Text style={[s.td, s.tdRight, { flex: 1 }]}>
                      {num(row.obtained)}/{num(row.total)}
                    </Text>
                    <Text style={[s.td, s.tdRight, { flex: 0.9 }]}>{num(row.percentage)}</Text>
                    <View style={{ flex: 0.9, alignItems: 'flex-end' }}>
                      <View style={[s.gradeMini, { backgroundColor: rgc.bg }]}>
                        <Text style={[s.gradeMiniText, { color: rgc.color }]}>{row.grade ?? '—'}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
              <View style={[s.tr, s.trTotal]}>
                <Text style={[s.td, { flex: 2, fontWeight: '900' }]}>Total</Text>
                <Text style={[s.td, s.tdRight, { flex: 1, fontWeight: '900' }]}>
                  {num(summary.total_obtained)}/{num(summary.total_max)}
                </Text>
                <Text style={[s.td, s.tdRight, { flex: 0.9, fontWeight: '900' }]}>{num(summary.percentage)}</Text>
                <View style={{ flex: 0.9 }} />
              </View>
            </View>
          ) : (
            <Text style={s.noData}>Subject-wise marks will appear here once results are uploaded.</Text>
          )}
        </View>

        {/* ── Grading key ── */}
        {card.grading_scale?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Grading System</Text>
            <View style={s.gradeKeyWrap}>
              {card.grading_scale.map((b: GradeBand) => {
                const kgc = gradeColor(b.grade);
                return (
                  <View key={b.grade} style={s.gradeKeyItem}>
                    <View style={[s.gradeMini, { backgroundColor: kgc.bg }]}>
                      <Text style={[s.gradeMiniText, { color: kgc.color }]}>{b.grade}</Text>
                    </View>
                    <Text style={s.gradeKeyRange}>{b.min}–{b.max}%</Text>
                    <Text style={s.gradeKeyRemark} numberOfLines={1}>{b.remark}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── PDF bubble (tap to preview the official template) ── */}
        <TouchableOpacity style={s.pdfBar} activeOpacity={0.85} onPress={onPreview}>
          <View style={s.pdfBadge}>
            <Text style={s.pdfBadgeText}>PDF</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.pdfName} numberOfLines={1}>{fileNameFor(card)}.pdf</Text>
            <Text style={s.pdfMeta}>
              Official template{card.issued_at ? ` · Issued ${card.issued_at}` : ''}
            </Text>
          </View>
          <View style={s.previewHint}>
            <VectorIcon iconSet="Ionicons" iconName="eye-outline" size={16} color={theme.colors.primary} />
            <Text style={s.previewHintText}>Preview</Text>
          </View>
        </TouchableOpacity>

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
      </ScrollView>
    </View>
  );
};

export default ReportCardScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, gap: 14 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centerText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyRing: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.textPrimary },
  retryBtn: {
    marginTop: 6, backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.full, paddingHorizontal: 28, paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Year chip
  yearChipRow: { flexDirection: 'row' },
  yearChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 7,
  },
  yearChipText: { fontSize: 13, fontWeight: '800', color: theme.colors.primary },

  // Hero
  hero: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  heroAccent: { height: 5, backgroundColor: theme.colors.primary },
  heroInner: { padding: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroImage: {
    width: 60, height: 60, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.primaryLight,
  },
  heroMeta: { flex: 1 },
  heroTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.primary, letterSpacing: 0.4, textTransform: 'uppercase' },
  heroName: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 2 },
  heroSubRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  heroPill: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 3,
  },
  heroPillText: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 34, backgroundColor: theme.colors.border },
  statValue: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary },
  statValueSub: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted },
  statLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  gradeBadge: { paddingHorizontal: 12, paddingVertical: 3, borderRadius: theme.radius.full },
  gradeBadgeText: { fontSize: 16, fontWeight: '900' },

  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  resultPill: { borderRadius: theme.radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  resultPillText: { fontSize: 12, fontWeight: '800' },
  remarkText: { flex: 1, fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },

  // Section
  section: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 14,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 10 },
  noData: { fontSize: 12, color: theme.colors.textMuted, fontStyle: 'italic' },

  // Table
  table: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, gap: 4 },
  trHead: { backgroundColor: theme.colors.primaryLight },
  trAlt: { backgroundColor: theme.colors.background },
  trTotal: { backgroundColor: theme.colors.primaryLight },
  th: { fontSize: 10, fontWeight: '800', color: theme.colors.primary, textTransform: 'uppercase' },
  thRight: { textAlign: 'right' },
  td: { fontSize: 12, color: theme.colors.textPrimary },
  tdRight: { textAlign: 'right' },

  gradeMini: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.full, alignSelf: 'flex-end' },
  gradeMiniText: { fontSize: 11, fontWeight: '800' },

  // Grade key
  gradeKeyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gradeKeyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    width: '47%',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm, paddingHorizontal: 8, paddingVertical: 6,
  },
  gradeKeyRange: { fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary },
  gradeKeyRemark: { flex: 1, fontSize: 10, color: theme.colors.textMuted },

  // PDF bar
  pdfBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, padding: 10,
  },
  pdfBadge: {
    width: 38, height: 38, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  pdfBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  pdfName: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  pdfMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  previewHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewHintText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },

  // Actions
  actionRow: { flexDirection: 'row', gap: 12 },
  actionPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.full, paddingVertical: 13,
  },
  actionPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  actionGhost: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.full,
    borderWidth: 1.5, borderColor: theme.colors.primary, paddingVertical: 13,
  },
  actionGhostText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
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
import {
  getStudentExamCopies,
  marksErrorMessage,
  type StudentExamCopy,
} from '../../api/marksApi';

const gradeColor = (g?: string | null): { color: string; bg: string } => {
  const x = (g || '').toUpperCase();
  if (x.startsWith('A')) return { color: '#16A34A', bg: '#DCFCE7' };
  if (x.startsWith('B')) return { color: '#0EA5E9', bg: '#E0F2FE' };
  if (x.startsWith('C') || x === 'D') return { color: '#D97706', bg: '#FEF3C7' };
  if (x === 'F') return { color: '#DC2626', bg: '#FEE2E2' };
  return { color: theme.colors.primary, bg: theme.colors.primaryLight };
};

const CopyCard = ({
  item,
  onOpen,
}: {
  item: StudentExamCopy;
  onOpen: (c: StudentExamCopy) => void;
}) => {
  const g = gradeColor(item.grade);
  const obtained = Number(item.marks_obtained ?? 0);
  const total = Number(item.max_marks ?? 0);
  const pct =
    item.percentage != null
      ? Math.round(Number(item.percentage))
      : total > 0
      ? Math.round((obtained / total) * 100)
      : 0;

  return (
    <View style={s.card}>
      <View style={[s.accent, { backgroundColor: g.color }]} />
      <View style={s.cardInner}>
        <View style={s.topRow}>
          <View style={[s.iconBox, { backgroundColor: g.bg }]}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="document-text-outline"
              size={20}
              color={g.color}
            />
          </View>
          <View style={s.meta}>
            <Text style={s.title} numberOfLines={1}>
              {item.subject?.name ?? 'Subject'}
            </Text>
            <View style={s.metaRow}>
              <View style={s.codePill}>
                <Text style={s.codeText} numberOfLines={1}>
                  {item.exam?.name ?? 'Exam'}
                </Text>
              </View>
              {!!item.grade && (
                <View style={[s.gradePill, { backgroundColor: g.bg }]}>
                  <Text style={[s.gradeText, { color: g.color }]}>
                    Grade {item.grade}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {total > 0 && (
            <View style={s.marksBox}>
              <Text style={s.marksValue}>
                {obtained}
                <Text style={s.marksTotal}>/{total}</Text>
              </Text>
              <Text style={s.marksPct}>{pct}%</Text>
            </View>
          )}
        </View>

        {total > 0 && (
          <View style={s.progressTrack}>
            <View
              style={[s.progressFill, { width: `${pct}%`, backgroundColor: g.color }]}
            />
          </View>
        )}

        <TouchableOpacity
          style={[s.viewBtn, !item.pdf_url && s.viewBtnDisabled]}
          onPress={() => onOpen(item)}
          activeOpacity={0.85}
          disabled={!item.pdf_url}
        >
          <VectorIcon
            iconSet="Ionicons"
            iconName="eye-outline"
            size={15}
            color={item.pdf_url ? theme.colors.primary : theme.colors.textMuted}
          />
          <Text style={[s.viewBtnText, !item.pdf_url && { color: theme.colors.textMuted }]}>
            {item.pdf_url ? 'View Copy' : 'PDF not available'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ExamCopyScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copies, setCopies] = useState<StudentExamCopy[]>([]);
  const [examId, setExamId] = useState<number | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getStudentExamCopies();
      setCopies(list);
    } catch (e: any) {
      console.log('[getStudentExamCopies] Error:', e?.response?.status, e?.message);
      setError(marksErrorMessage(e));
      setCopies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  // Distinct exams for the filter chips
  const exams = useMemo(() => {
    const map = new Map<number, string>();
    copies.forEach(c => {
      if (c.exam?.id != null) map.set(c.exam.id, c.exam.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [copies]);

  const filtered = useMemo(
    () => (examId === 'all' ? copies : copies.filter(c => c.exam?.id === examId)),
    [copies, examId],
  );

  const openCopy = async (item: StudentExamCopy) => {
    if (!item.pdf_url) return;
    try {
      await Linking.openURL(item.pdf_url);
    } catch {
      Alert.alert('Error', 'Unable to open this copy on your device.');
    }
  };

  return (
    <View style={s.root}>
      <Header title="Exam Copy" onBackPress={() => navigation.goBack()} />

      {/* Exam filter chips */}
      {!loading && !error && exams.length > 1 && (
        <View style={s.filterWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {[{ id: 'all' as const, name: 'All' }, ...exams].map(ex => {
              const active = examId === ex.id;
              return (
                <TouchableOpacity
                  key={String(ex.id)}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setExamId(ex.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>
                    {ex.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={s.center}>
          <ScreenSkeleton variant="list" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <View style={[s.emptyIconRing, { backgroundColor: '#FEE2E2' }]}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.danger} />
          </View>
          <Text style={s.emptyTitle}>Couldn’t load copies</Text>
          <Text style={s.emptySubtitle}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="refresh" size={15} color={theme.colors.primary} />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filtered.length > 0 && (
            <View style={s.infoBanner}>
              <VectorIcon iconSet="Ionicons" iconName="information-circle-outline" size={16} color={theme.colors.secondary} />
              <Text style={s.infoBannerText}>
                {filtered.length} evaluated cop{filtered.length !== 1 ? 'ies' : 'y'}
              </Text>
            </View>
          )}

          {filtered.length === 0 ? (
            <View style={s.emptyBox}>
              <View style={s.emptyIconRing}>
                <VectorIcon iconSet="Ionicons" iconName="documents-outline" size={36} color={theme.colors.primary} />
              </View>
              <Text style={s.emptyTitle}>No copies yet</Text>
              <Text style={s.emptySubtitle}>
                Evaluated copies will appear here after the exam is checked
              </Text>
            </View>
          ) : (
            filtered.map(item => <CopyCard key={item.id} item={item} onOpen={openCopy} />)
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default ExamCopyScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  listContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, gap: 14 },

  // Filter chips
  filterWrap: {
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    maxWidth: 180,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  chipTextActive: { color: '#fff' },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: 10 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: theme.colors.secondary },

  // Card
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
  iconBox: { width: 42, height: 42, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1 },
  title: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  codePill: {
    borderRadius: theme.radius.full,
    paddingHorizontal: 9,
    paddingVertical: 2,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxWidth: 150,
  },
  codeText: { fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary },
  gradePill: { borderRadius: theme.radius.full, paddingHorizontal: 9, paddingVertical: 2 },
  gradeText: { fontSize: 10, fontWeight: '700' },
  marksBox: { alignItems: 'flex-end' },
  marksValue: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  marksTotal: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  marksPct: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted },

  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.background,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },

  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingVertical: 9,
  },
  viewBtnDisabled: { borderColor: theme.colors.border },
  viewBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  // Empty
  emptyBox: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

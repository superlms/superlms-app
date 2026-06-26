import React, { useCallback, useEffect, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { Exam, STATUS_CONFIG, iconForType } from './examData';
import { getExamDetail, examErrorMessage } from '../../api/examApi';

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconWrap}>
      <VectorIcon
        iconSet="Ionicons"
        iconName={icon}
        size={16}
        color={theme.colors.primary}
      />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const ExamDetailScreen = () => {
  const route = useRoute<any>();
  const summary: Exam | undefined = route.params?.exam;
  const examId: string | number | undefined = route.params?.examId ?? summary?.id;

  // Start from the summary passed by the list (instant render), then enrich it
  // with the full detail (syllabus, description) fetched from the API.
  const [exam, setExam] = useState<Exam | undefined>(summary);
  const [loading, setLoading] = useState(!summary);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (examId == null) {
      setError('Exam not found.');
      setLoading(false);
      return;
    }
    if (!summary) setLoading(true);
    setError(null);
    try {
      const detail = await getExamDetail(examId);
      setExam(detail);
    } catch (e: any) {
      console.log('[getExamDetail] Error:', e?.response?.status, e?.message);
      if (!summary) setError(examErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [examId, summary]);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  if (loading || !exam) {
    return (
      <View style={styles.safeArea}>
        <Header title="Exam Details" />
        {error ? (
          <View style={styles.stateBox}>
            <View style={styles.errorIconRing}>
              <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.danger} />
            </View>
            <Text style={styles.errorTitle}>Couldn’t load exam</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
              <VectorIcon iconSet="Ionicons" iconName="refresh" size={15} color={theme.colors.primary} />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.stateBox}>
            <ScreenSkeleton variant="detail" />
          </View>
        )}
      </View>
    );
  }

  const sc = STATUS_CONFIG[exam.status];

  return (
    <View style={styles.safeArea}>
      <Header title="Exam Details" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={[styles.accentBar, { backgroundColor: sc.accent }]} />
          <View style={styles.heroInner}>
            <View style={styles.heroTop}>
              <View style={styles.heroIconWrap}>
                <VectorIcon
                  iconSet="Ionicons"
                  iconName={iconForType(exam.type)}
                  size={26}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroName}>{exam.name}</Text>
                <Text style={styles.heroSubtitle}>{exam.subtitle}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                <View
                  style={[styles.badgeDot, { backgroundColor: sc.color }]}
                />
                <Text style={[styles.badgeText, { color: sc.color }]}>
                  {exam.status}
                </Text>
              </View>
            </View>

            <View style={styles.heroPills}>
              <View style={styles.pill}>
                <VectorIcon
                  iconSet="Ionicons"
                  iconName="calendar-outline"
                  size={12}
                  color={theme.colors.primary}
                />
                <Text style={styles.pillText}>{exam.academicYear}</Text>
              </View>
              <View style={styles.pill}>
                <VectorIcon
                  iconSet="Ionicons"
                  iconName="layers-outline"
                  size={12}
                  color={theme.colors.primary}
                />
                <Text style={styles.pillText}>{exam.type}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Exam Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exam Information</Text>
          <View style={styles.sectionCard}>
            <InfoRow
              icon="play-circle-outline"
              label="Start Date"
              value={exam.startDate}
            />
            <View style={styles.divider} />
            <InfoRow
              icon="stop-circle-outline"
              label="End Date"
              value={exam.endDate}
            />
            <View style={styles.divider} />
            <InfoRow
              icon="time-outline"
              label="Date Range"
              value={exam.dateRange}
            />
            {!!exam.venue && (
              <>
                <View style={styles.divider} />
                <InfoRow icon="location-outline" label="Venue" value={exam.venue} />
              </>
            )}
            {exam.totalMarks > 0 && (
              <>
                <View style={styles.divider} />
                <InfoRow
                  icon="checkmark-circle-outline"
                  label="Total Marks"
                  value={`${exam.totalMarks} Marks`}
                />
              </>
            )}
            {exam.passingMarks > 0 && (
              <>
                <View style={styles.divider} />
                <InfoRow
                  icon="ribbon-outline"
                  label="Passing Marks"
                  value={`${exam.passingMarks} Marks`}
                />
              </>
            )}
          </View>
        </View>

        {/* Syllabus */}
        {exam.syllabus.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Syllabus</Text>
            <View style={styles.sectionCard}>
              {exam.syllabus.map((s, i) => (
                <View key={i}>
                  {i > 0 && <View style={styles.divider} />}
                  <View style={styles.syllabusItem}>
                    <View style={styles.syllabusHeader}>
                      <View style={styles.subjectDot} />
                      <Text style={styles.syllabusSubject}>{s.subject}</Text>
                    </View>
                    <View style={styles.topicsWrap}>
                      {s.topics.map((t, j) => (
                        <View key={j} style={styles.topicChip}>
                          <Text style={styles.topicChipText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          <View style={styles.sectionCard}>
            {exam.instructions.map((inst, i) => (
              <View key={i} style={styles.instructionRow}>
                <View style={styles.instructionNum}>
                  <Text style={styles.instructionNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{inst}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default ExamDetailScreen;

const __mk_styles = () => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: 16, paddingBottom: 30 },

  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: 10 },
  errorIconRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  errorTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  errorSubtitle: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: theme.colors.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 18, paddingVertical: 9, marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  heroCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  accentBar: { height: 5, width: '100%' },
  heroInner: { padding: theme.spacing.md, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroIconWrap: {
    width: 50,
    height: 50,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  heroSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  heroPills: { flexDirection: 'row', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },

  section: { gap: 8 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  sectionCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: theme.colors.border },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '500' },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginTop: 1,
  },

  syllabusItem: { padding: theme.spacing.md, gap: 8 },
  syllabusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  syllabusSubject: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  topicsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 16,
  },
  topicChip: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  topicChipText: { fontSize: 12, color: theme.colors.textSecondary },

  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  instructionNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });

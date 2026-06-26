import React, { useCallback, useEffect, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  FlatList,
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
  FILTERS,
  STATUS_CONFIG,
  iconForType,
  Exam,
  ExamStatus,
  SyllabusItem,
} from './examData';
import {
  getExams,
  getExamSyllabus,
  examErrorMessage,
} from '../../api/examApi';

const TeacherExamsScreen = () => {
  const [activeFilter, setActiveFilter] = useState<ExamStatus | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Syllabus is fetched lazily per exam when its card is expanded.
  const [syllabusMap, setSyllabusMap] = useState<Record<string, SyllabusItem[]>>({});
  const [syllabusLoading, setSyllabusLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getExams();
      setExams(list);
    } catch (e: any) {
      console.log('[getExams] Error:', e?.response?.status, e?.message);
      setError(examErrorMessage(e));
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  const toggleSyllabus = useCallback(
    async (id: string) => {
      const next = expandedId === id ? null : id;
      setExpandedId(next);
      if (next && syllabusMap[id] === undefined && !syllabusLoading[id]) {
        setSyllabusLoading(p => ({ ...p, [id]: true }));
        try {
          const s = await getExamSyllabus(id);
          setSyllabusMap(p => ({ ...p, [id]: s }));
        } catch (e: any) {
          console.log('[getExamSyllabus] Error:', e?.response?.status, e?.message);
          setSyllabusMap(p => ({ ...p, [id]: [] }));
        } finally {
          setSyllabusLoading(p => ({ ...p, [id]: false }));
        }
      }
    },
    [expandedId, syllabusMap, syllabusLoading],
  );

  const filtered = exams.filter(e => {
    const matchFilter = activeFilter === 'All' || e.status === activeFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      e.academicYear.includes(q);
    return matchFilter && matchSearch;
  });

  const renderExam = ({ item }: { item: Exam }) => {
    const isExpanded = expandedId === item.id;
    const sc = STATUS_CONFIG[item.status];
    const syllabus = syllabusMap[item.id] ?? [];
    const sylLoading = !!syllabusLoading[item.id];

    return (
      <View style={styles.card}>
        {/* Accent bar */}
        <View style={[styles.accentBar, { backgroundColor: sc.accent }]} />

        <View style={styles.cardInner}>
          {/* Top row: name + status badge */}
          <View style={styles.cardTop}>
            <View style={styles.iconWrap}>
              <VectorIcon
                iconSet="Ionicons"
                iconName={iconForType(item.type)}
                size={20}
                color={theme.colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.examName}>{item.name}</Text>
              <Text style={styles.examSubtitle}>{item.subtitle}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: sc.bg }]}>
              <View style={[styles.badgeDot, { backgroundColor: sc.color }]} />
              <Text style={[styles.badgeText, { color: sc.color }]}>
                {item.status}
              </Text>
            </View>
          </View>

          {/* Info pills row */}
          <View style={styles.pillsRow}>
            <View style={styles.pill}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="calendar-outline"
                size={12}
                color={theme.colors.primary}
              />
              <Text style={styles.pillText}>{item.academicYear}</Text>
            </View>
            <View style={styles.pill}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="layers-outline"
                size={12}
                color={theme.colors.primary}
              />
              <Text style={styles.pillText}>{item.type}</Text>
            </View>
          </View>

          {/* Date range */}
          <View style={styles.dateRow}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="time-outline"
              size={13}
              color={theme.colors.textMuted}
            />
            <Text style={styles.dateText}>{item.dateRange}</Text>
          </View>
        </View>

        {/* Syllabus toggle */}
        <TouchableOpacity
          style={styles.syllabusToggle}
          onPress={() => toggleSyllabus(item.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.syllabusToggleText}>
            {isExpanded ? 'Hide Syllabus' : 'View Syllabus'}
          </Text>
          <VectorIcon
            iconSet="Ionicons"
            iconName={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.colors.primary}
          />
        </TouchableOpacity>

        {/* Syllabus expanded */}
        {isExpanded && (
          <View style={styles.syllabusBox}>
            {sylLoading ? (
              <View style={styles.syllabusLoading}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : syllabus.length === 0 ? (
              <Text style={styles.syllabusEmpty}>No syllabus available for this exam.</Text>
            ) : (
              syllabus.map((s, i) => (
                <View key={i} style={styles.syllabusItem}>
                  <View style={styles.syllabusLeft}>
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
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>
      <Header title="Exams" />

      {/* Search bar */}
      <View style={styles.searchWrapper}>
        <VectorIcon iconSet="Ionicons" iconName="search-outline" size={18} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exams..."
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <VectorIcon iconSet="Ionicons" iconName="close-circle" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterBtn,
                activeFilter === f && styles.filterBtnActive,
              ]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === f && styles.filterTextActive,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ScreenSkeleton variant="list" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorIconRing}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.danger} />
          </View>
          <Text style={styles.errorTitle}>Couldn’t load exams</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="refresh" size={15} color={theme.colors.primary} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderExam}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={<Text style={styles.empty}>No exams found.</Text>}
        />
      )}
    </View>
  );
};

export default TeacherExamsScreen;

const __mk_styles = () => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },

  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
    padding: 0,
  },

  filterWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  filterRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: 8,
    alignItems: 'center',
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  filterBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterTextActive: { color: '#fff' },

  list: { padding: theme.spacing.lg, gap: 14 },

  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    shadowColor: '#000000',
    elevation: 3,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  cardInner: {
    padding: theme.spacing.md,
    gap: 10,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  examSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },

  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  syllabusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  syllabusToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },

  syllabusBox: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: 12,
  },
  syllabusItem: {
    gap: 6,
  },
  syllabusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  subjectDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  syllabusSubject: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  topicsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 14,
  },
  topicChip: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  topicChipText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },

  empty: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    marginTop: 40,
  },

  syllabusLoading: { paddingVertical: 8, alignItems: 'center' },
  syllabusEmpty: { fontSize: 12, color: theme.colors.textMuted, paddingVertical: 4 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: 10 },
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
});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });

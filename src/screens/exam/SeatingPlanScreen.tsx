import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import {
  EXAMS,
  Exam,
  SEATING_DATA,
  SubjectSeat,
  iconForType,
} from './examData';
import ExamDropdown from './ExamDropdown';

// Rotating accent colors so each subject card gets its own identity
const ACCENTS = [
  { color: '#4F46E5', bg: '#E0E7FF' },
  { color: '#0EA5E9', bg: '#E0F2FE' },
  { color: '#16A34A', bg: '#DCFCE7' },
  { color: '#D97706', bg: '#FEF3C7' },
];

const SeatCard = ({ item, index }: { item: SubjectSeat; index: number }) => {
  const accent = ACCENTS[index % ACCENTS.length];

  return (
    <View style={s.card}>
      <View style={[s.accent, { backgroundColor: accent.color }]} />
      <View style={s.cardInner}>
        {/* Top row — subject */}
        <View style={s.topRow}>
          <View style={[s.iconBox, { backgroundColor: accent.bg }]}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="book-outline"
              size={20}
              color={accent.color}
            />
          </View>
          <View style={s.meta}>
            <Text style={s.title} numberOfLines={1}>
              {item.subject}
            </Text>
            <View style={[s.tagPill, { backgroundColor: accent.bg }]}>
              <Text style={[s.tagText, { color: accent.color }]}>
                {item.subjectCode}
              </Text>
            </View>
          </View>
        </View>

        {/* Date & time */}
        <View style={s.timeRow}>
          <View style={s.timeChip}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="calendar-outline"
              size={12}
              color={theme.colors.textSecondary}
            />
            <Text style={s.timeChipText}>{item.date}</Text>
          </View>
          <View style={s.timeChip}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="time-outline"
              size={12}
              color={theme.colors.textSecondary}
            />
            <Text style={s.timeChipText}>{item.time}</Text>
          </View>
        </View>

        {/* Room & seat */}
        <View style={s.statRow}>
          <View style={s.statBox}>
            <Text style={s.statLabel}>ROOM NO</Text>
            <Text style={[s.statValue, { color: accent.color }]}>
              {item.roomNo}
            </Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>SEAT NO</Text>
            <Text style={[s.statValue, { color: accent.color }]}>
              {item.seatNo}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const SeatingPlanScreen = ({ navigation }: any) => {
  const [exam, setExam] = useState<Exam>(EXAMS[0]);
  const seats = SEATING_DATA[exam.id] ?? [];

  // TODO: wire to the seating-plan API loader once integrated.
  const { refreshing, onRefresh } = useRefresh(() => {});

  return (
    <View style={s.root}>
      <Header title="Seating Plan" onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <ExamDropdown selected={exam} onSelect={setExam} />

        {/* Summary banner */}
        <View style={s.summaryCard}>
          <View style={s.summaryIconRing}>
            <VectorIcon
              iconSet="Ionicons"
              iconName={iconForType(exam.type)}
              size={20}
              color={theme.colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.summaryTitle} numberOfLines={1}>
              {exam.name} · {exam.academicYear}
            </Text>
            <Text style={s.summarySub} numberOfLines={1}>
              {seats.length} subject{seats.length !== 1 ? 's' : ''} ·{' '}
              {exam.dateRange}
            </Text>
            <View style={s.summaryVenueRow}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="location-outline"
                size={12}
                color={theme.colors.textMuted}
              />
              <Text style={s.summaryVenue} numberOfLines={1}>
                {exam.venue}
              </Text>
            </View>
          </View>
        </View>

        {seats.length === 0 ? (
          <View style={s.emptyBox}>
            <View style={s.emptyIconRing}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="grid-outline"
                size={36}
                color={theme.colors.primary}
              />
            </View>
            <Text style={s.emptyTitle}>No seating plan</Text>
            <Text style={s.emptySubtitle}>Not available for this exam yet</Text>
          </View>
        ) : (
          seats.map((item, i) => (
            <SeatCard key={item.subjectCode} item={item} index={i} />
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default SeatingPlanScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 14,
  },

  // Summary banner
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.lg,
    padding: 14,
  },
  summaryIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  summarySub: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    marginTop: 2,
  },
  summaryVenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  summaryVenue: { fontSize: 11, color: theme.colors.textMuted },

  // Card (announcement style)
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1 },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 5,
  },
  tagPill: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.full,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  tagText: { fontSize: 10, fontWeight: '700' },

  timeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },

  statRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 3,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
  },
  statValue: { fontSize: 20, fontWeight: '800' },

  // Empty
  emptyBox: { alignItems: 'center', paddingTop: 50 },
  emptyIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  emptySubtitle: { fontSize: 13, color: theme.colors.textMuted },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

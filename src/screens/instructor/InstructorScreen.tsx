import React, { useState, useCallback } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ScreenSkeleton from '../../components/Skeleton';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getInstructors, Instructor } from '../../api/instructorApi';

// A stable accent colour per instructor (announcement-card style).
const ACCENTS = [
  { color: '#4F46E5', bg: '#E0E7FF' },
  { color: '#0EA5E9', bg: '#E0F2FE' },
  { color: '#16A34A', bg: '#DCFCE7' },
  { color: '#D97706', bg: '#FEF3C7' },
  { color: '#DB2777', bg: '#FCE7F3' },
  { color: '#7C3AED', bg: '#EDE9FE' },
];
const accentFor = (id: number) => ACCENTS[id % ACCENTS.length];

const initials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const InstructorCard = ({
  item,
  onProfile,
  onChat,
}: {
  item: Instructor;
  onProfile: () => void;
  onChat: () => void;
}) => {
  const accent = accentFor(item.id);
  const subjectNames =
    item.subjects?.map(s => s.name).filter(Boolean).join(', ') || 'No subjects assigned';

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onProfile} style={s.card}>
      <View style={[s.accent, { backgroundColor: accent.color }]} />

      <View style={s.inner}>
        {/* Top row: avatar + name + subjects */}
        <View style={s.topRow}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={s.avatar} />
          ) : (
            <View style={[s.avatarFallback, { backgroundColor: accent.bg }]}>
              <Text style={[s.avatarInitials, { color: accent.color }]}>
                {initials(item.name || 'NA')}
              </Text>
            </View>
          )}

          <View style={s.meta}>
            <Text style={s.name} numberOfLines={1}>{item.name}</Text>
            <View style={[s.subjectPill, { backgroundColor: accent.bg }]}>
              <VectorIcon iconSet="Ionicons" iconName="book-outline" size={11} color={accent.color} />
              <Text style={[s.subjectText, { color: accent.color }]} numberOfLines={1}>
                {subjectNames}
              </Text>
            </View>
          </View>
        </View>

        {/* Mobile number (instead of ID) */}
        <View style={s.infoRow}>
          <View style={[s.infoIcon, { backgroundColor: accent.bg }]}>
            <VectorIcon iconSet="Feather" iconName="phone" size={12} color={accent.color} />
          </View>
          <Text style={s.infoText} numberOfLines={1}>
            {item.phone || 'Mobile not available'}
          </Text>
        </View>

        {/* Actions: View Profile + Chat Now */}
        <View style={s.btnRow}>
          <TouchableOpacity style={s.ghostBtn} onPress={onProfile} activeOpacity={0.85}>
            <VectorIcon iconSet="Feather" iconName="user" size={14} color={theme.colors.primary} />
            <Text style={s.ghostBtnText}>View Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.primaryBtn} onPress={onChat} activeOpacity={0.9}>
            <VectorIcon iconSet="Ionicons" iconName="chatbubble-ellipses-outline" size={14} color="#fff" />
            <Text style={s.primaryBtnText}>Chat Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const InstructorScreen = () => {
  const navigation = useNavigation<any>();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstructors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInstructors(20);
      setInstructors(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load instructors');
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(fetchInstructors);
  useFocusLoad(fetchInstructors);

  const openProfile = (item: Instructor) =>
    navigation.navigate('InstructorProfile', { instructor: item });

  // Chat Now → the chats screen.
  const openChat = (_item: Instructor) => navigation.navigate('ChatsList');

  if (loading) {
    return (
      <View style={s.screen}>
        <Header title="Instructors" />
        <View style={s.centeredBox}>
          <ScreenSkeleton variant="list" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.screen}>
        <Header title="Instructors" />
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={36} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchInstructors}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Header title="Instructors" />
      <FlatList
        data={instructors}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[s.list, instructors.length === 0 && s.listEmpty]}
        renderItem={({ item }) => (
          <InstructorCard
            item={item}
            onProfile={() => openProfile(item)}
            onChat={() => openChat(item)}
          />
        )}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <View style={s.emptyIconRing}>
              <VectorIcon iconSet="Ionicons" iconName="people-outline" size={36} color={theme.colors.primary} />
            </View>
            <Text style={s.emptyTitle}>No instructors found</Text>
            <Text style={s.emptySubtitle}>No instructors have been added yet.</Text>
          </View>
        }
      />
    </View>
  );
};

export default InstructorScreen;

const __mk_s = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  list: { padding: 16, paddingBottom: 30, gap: 12 },
  listEmpty: { flexGrow: 1 },

  centeredBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: 4, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: theme.radius.full, backgroundColor: theme.colors.primary,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: theme.colors.white },

  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 80 },
  emptyIconRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },

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
  inner: { flex: 1, padding: 14 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 16, fontWeight: '800' },
  meta: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 5 },
  subjectPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', maxWidth: '100%',
    borderRadius: theme.radius.full, paddingHorizontal: 9, paddingVertical: 3,
  },
  subjectText: { fontSize: 10.5, fontWeight: '700', flexShrink: 1 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  infoIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  ghostBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: theme.radius.full, borderWidth: 1.5, borderColor: theme.colors.primary,
    paddingVertical: 9, backgroundColor: theme.colors.card,
  },
  ghostBtnText: { fontSize: 12.5, fontWeight: '700', color: theme.colors.primary },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: theme.radius.full, paddingVertical: 9, backgroundColor: theme.colors.primary,
  },
  primaryBtnText: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

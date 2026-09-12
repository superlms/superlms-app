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
import { Skeleton } from '../../components/Skeleton';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getInstructors, Instructor } from '../../api/instructorApi';
import { DocHeader, DocNoData, DocError } from '../more/docUi';

const TITLE = 'Instructors';

const initials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// One instructor as a plain row: avatar, name and subjects, with a small chat
// button on the right. Tapping the row opens the profile.
const InstructorRow = ({
  item,
  onProfile,
  onChat,
  isLast,
}: {
  item: Instructor;
  onProfile: () => void;
  onChat: () => void;
  isLast: boolean;
}) => {
  const subjectNames =
    item.subjects?.map(sub => sub.name).filter(Boolean).join(', ') || 'No subjects assigned';

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider]}
      activeOpacity={0.6}
      onPress={onProfile}
    >
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarFallback]}>
          <Text style={s.avatarInitials}>{initials(item.name || 'NA')}</Text>
        </View>
      )}

      <View style={s.rowText}>
        <Text style={s.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={s.subjects} numberOfLines={1}>
          {subjectNames}
        </Text>
      </View>

      <TouchableOpacity style={s.chatBtn} onPress={onChat} activeOpacity={0.7} hitSlop={6}>
        <VectorIcon
          iconSet="Ionicons"
          iconName="chatbubble-ellipses-outline"
          size={18}
          color={theme.colors.primary}
        />
      </TouchableOpacity>
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
        <DocHeader title={TITLE} />
        <View style={s.list}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[s.skeletonRow, i < 4 && s.rowDivider]}>
              <Skeleton width={44} height={44} radius={22} />
              <View style={s.skeletonText}>
                <Skeleton width="50%" height={14} />
                <Skeleton width="70%" height={11} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error) {
    return <DocError title={TITLE} message={error} onRetry={fetchInstructors} />;
  }

  return (
    <View style={s.screen}>
      <DocHeader title={TITLE} />
      <FlatList
        data={instructors}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[s.list, instructors.length === 0 && s.listEmpty]}
        renderItem={({ item, index }) => (
          <InstructorRow
            item={item}
            isLast={index === instructors.length - 1}
            onProfile={() => openProfile(item)}
            onChat={() => openChat(item)}
          />
        )}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <DocNoData
            icon="people-outline"
            title="No instructors found"
            subtitle="No instructors have been added yet."
          />
        }
      />
    </View>
  );
};

export default InstructorScreen;

const __mk_s = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 30 },
  listEmpty: { flexGrow: 1 },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.background },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  subjects: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  chatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Loading skeleton
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  skeletonText: { flex: 1, gap: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

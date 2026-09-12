import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Skeleton } from '../../components/Skeleton';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import apiClient from '../../api/apiClient';
import { FILTERS, mapApiItem } from './announcementData';
import type { Announcement, FilterKey } from './announcementData';
import AnnouncementRow from './AnnouncementRow';
import { DocHeader, DocNoData } from '../more/docUi';

// ── Role → allowed tags ───────────────────────────────────────────────────────
const ROLE_TAGS: Record<string, Array<Announcement['tag']>> = {
  student: ['All', 'Student'],
  teacher: ['All', 'Teacher'],
  admin: ['All', 'Teacher', 'Student', 'Admin'],
};

const AnnouncementScreen = ({ navigation }: any) => {
  const [role, setRole] = useState<string>('student');
  useEffect(() => {
    AsyncStorage.getItem('user_role').then(r => {
      if (r) setRole(r);
    });
  }, []);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('15 Days');

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await apiClient.post('/announcement', {
        per_page: 50,
      });

      console.log('[API Response]', JSON.stringify(data, null, 2));

      const items = data?.data ?? data?.announcements ?? [];
      const mapped = items.map(mapApiItem);

      console.log('[Mapped Data] First item:', mapped[0]);

      setAnnouncements(mapped);
    } catch (err: any) {
      console.error('[API Error]', err?.response?.data);
      const msg = err?.response?.data?.message ?? err?.message ?? 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(fetchAnnouncements);

  useFocusLoad(fetchAnnouncements);

  // ── Filter by date window + role ────────────────────────────────────────────
  const allowedTags = ROLE_TAGS[role.toLowerCase()] ?? ROLE_TAGS.student;

  const filtered = useMemo(() => {
    const f = FILTERS.find(f => f.label === activeFilter)!;
    return announcements.filter(d => {
      const withinDays = f.days === 0 ? d.daysAgo === 0 : d.daysAgo <= f.days;
      const roleMatch = allowedTags.includes(d.tag);
      return withinDays && roleMatch;
    });
  }, [activeFilter, announcements, allowedTags]);

  const handleRowPress = (item: Announcement) => {
    navigation.navigate('ViewAnnouncement', { item });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <DocHeader title="Announcement" onBackPress={() => navigation.goBack()} />

      {/* Date window — a segmented control pinned under the header */}
      <View style={s.filterBar}>
        <View style={s.segment}>
          {FILTERS.map(f => {
            const active = activeFilter === f.label;
            return (
              <TouchableOpacity
                key={f.label}
                activeOpacity={0.7}
                onPress={() => setActiveFilter(f.label)}
                style={[s.segmentItem, active && s.segmentItemActive]}
              >
                <Text style={[s.segmentText, active && s.segmentTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={s.fullDivider} />

      {/* Body */}
      {loading ? (
        <View style={s.list}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[s.skeletonRow, i < 4 && s.rowDivider]}>
              <View style={s.skeletonLine}>
                <Skeleton width="55%" height={14} />
                <Skeleton width={44} height={10} />
              </View>
              <Skeleton width="80%" height={12} />
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchAnnouncements} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filtered.length === 0 ? (
            <DocNoData
              icon="megaphone-outline"
              title="No announcements"
              subtitle="Nothing posted in this period."
            />
          ) : (
            filtered.map((item, i) => (
              <AnnouncementRow
                key={item.id}
                item={item}
                isLast={i === filtered.length - 1}
                onPress={handleRowPress}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default AnnouncementScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Filter bar
  filterBar: { paddingHorizontal: 20, paddingVertical: 12 },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentItemActive: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
  },
  segmentText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  segmentTextActive: { color: theme.colors.primary, fontWeight: '600' },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  skeletonRow: { paddingVertical: 14, gap: 8 },
  skeletonLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

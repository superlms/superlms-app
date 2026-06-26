import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
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
import { FILTERS, mapApiItem, TAG_META } from './announcementData';
import type {
  Announcement,
  AnnouncementApiResponse,
  FilterKey,
} from './announcementData';
import AnnouncementCard from './AnnouncementCard';
import apiClient from '../../api/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Role → allowed tags ───────────────────────────────────────────────────────
const ROLE_TAGS: Record<string, Array<Announcement['tag']>> = {
  student: ['All', 'Student'],
  teacher: ['All', 'Teacher'],
  admin: ['All', 'Teacher', 'Student', 'Admin'],
};

const AnnouncementScreen = ({ navigation, route }: any) => {
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

  const handleCardPress = (item: Announcement) => {
    navigation.navigate('ViewAnnouncement', { item });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <Header title="Announcement" onBackPress={() => navigation.goBack()} />

      {/* Filter chips */}
      <View style={s.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersRow}
        >
          {FILTERS.map(f => {
            const active = activeFilter === f.label;
            return (
              <TouchableOpacity
                key={f.label}
                activeOpacity={0.8}
                onPress={() => setActiveFilter(f.label)}
                style={[s.chip, active && s.chipActive]}
              >
                {active && (
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="checkmark-circle"
                    size={13}
                    color="#fff"
                  />
                )}
                <Text style={[s.chipText, active && s.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={s.filtersDivider} />
      </View>

      {/* Body */}
      {loading ? (
        <View style={s.centeredBox}>
          <ScreenSkeleton variant="list" />
        </View>
      ) : error ? (
        <View style={s.centeredBox}>
          <VectorIcon
            iconSet="Ionicons"
            iconName="cloud-offline-outline"
            size={36}
            color={theme.colors.textMuted}
          />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchAnnouncements}>
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
          {filtered.length === 0 ? (
            <View style={s.emptyBox}>
              <View style={s.emptyIconRing}>
                <VectorIcon
                  iconSet="Ionicons"
                  iconName="megaphone-outline"
                  size={36}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={s.emptyTitle}>No announcements</Text>
              <Text style={s.emptySubtitle}>Nothing posted in this period</Text>
            </View>
          ) : (
            filtered.map(item => (
              <AnnouncementCard
                key={item.id}
                item={item}
                onPress={handleCardPress}
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
  root: { flex: 1, backgroundColor: theme.colors.background },

  filtersWrapper: { paddingTop: 12 },
  filtersRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filtersDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: theme.radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  chipTextActive: { color: theme.colors.white },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 14,
    gap: 14,
  },

  centeredBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: theme.colors.white },

  emptyBox: { alignItems: 'center', paddingTop: 60 },
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

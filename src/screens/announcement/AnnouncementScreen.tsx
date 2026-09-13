import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import apiClient from '../../api/apiClient';
import { FILTERS, mapApiItem } from './announcementData';
import type { Announcement, FilterKey } from './announcementData';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  BODY,
  DayHeading,
  FilterPills,
  InboxRow,
  InboxSkeleton,
  groupByDay,
  inboxStyles as ui,
  timeLabel,
} from '../notification/inboxUi';

// ── Role → allowed tags ───────────────────────────────────────────────────────
const ROLE_TAGS: Record<string, Array<Announcement['tag']>> = {
  student: ['All', 'Student'],
  teacher: ['All', 'Teacher'],
  admin: ['All', 'Teacher', 'Student', 'Admin'],
};

// When it was posted, as epoch ms (0 when the server sent no date).
const postedAt = (a: Announcement) => (a.date ? moment(a.date).valueOf() : 0);

const inWindow = (a: Announcement, days: number) =>
  days === 0 ? a.daysAgo === 0 : a.daysAgo <= days;

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
  const loadedOnce = useRef(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  // The skeleton shows only until the first load; pulling to refresh or coming
  // back from an announcement updates the list in place.
  const fetchAnnouncements = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);
    setError(null);

    try {
      const { data } = await apiClient.post('/announcement', {
        per_page: 50,
      });

      const items = data?.data ?? data?.announcements ?? [];
      setAnnouncements(items.map(mapApiItem));
      loadedOnce.current = true;
    } catch (err: any) {
      console.error('[Announcement] ❌', err?.response?.data);
      const msg = err?.response?.data?.message ?? err?.message ?? 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(fetchAnnouncements);

  useFocusLoad(fetchAnnouncements);

  // ── Role, then date window ──────────────────────────────────────────────────
  const allowedTags = ROLE_TAGS[role.toLowerCase()] ?? ROLE_TAGS.student;

  const forRole = useMemo(
    () => announcements.filter(a => allowedTags.includes(a.tag)),
    [announcements, allowedTags],
  );

  const pillOptions = FILTERS.map(f => ({
    key: f.label,
    label: f.label,
    count: forRole.filter(a => inWindow(a, f.days)).length,
  }));

  const sections = useMemo(() => {
    const window = FILTERS.find(x => x.label === activeFilter)!;
    return groupByDay(forRole.filter(a => inWindow(a, window.days)), postedAt);
  }, [activeFilter, forRole]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <DocHeader title="Announcement" onBackPress={() => navigation.goBack()} />

      {loading ? (
        <InboxSkeleton pills={FILTERS.length} />
      ) : error ? (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchAnnouncements} hitSlop={10}>
            <Text style={ui.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Date window, each with how many it holds */}
          <View style={ui.metaBar}>
            <FilterPills options={pillOptions} active={activeFilter} onChange={setActiveFilter} />
          </View>
          <View style={ui.fullDivider} />

          <SectionList
            sections={sections}
            keyExtractor={a => a.id}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={ui.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <DocNoData
                icon="megaphone-outline"
                title="No announcements"
                subtitle="Nothing posted in this period."
              />
            }
            renderSectionHeader={({ section }) => <DayHeading title={section.title} />}
            renderItem={({ item, index, section }) => {
              const at = postedAt(item);
              return (
                <InboxRow
                  icon="megaphone"
                  title={item.title}
                  body={item.content}
                  kind={item.tag === 'All' ? 'Everyone' : item.tag}
                  time={at ? timeLabel(at) : undefined}
                  highlight={item.isNew}
                  attachment={item.hasImage || item.hasPdf}
                  isLast={index === section.data.length - 1}
                  onPress={() => navigation.navigate('ViewAnnouncement', { item })}
                />
              );
            }}
          />
        </>
      )}
    </View>
  );
};

export default AnnouncementScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: BODY, textAlign: 'center', lineHeight: 20 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

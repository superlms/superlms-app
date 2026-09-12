import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import { Skeleton } from '../../components/Skeleton';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import apiClient from '../../api/apiClient';
import { FILTERS, mapApiItem } from './announcementData';
import type { Announcement, FilterKey } from './announcementData';
import { DocHeader, DocNoData } from '../more/docUi';
import { DayLabel, chatColors as CH, dayLabelFor } from '../chats/chatUi';

const TITLE = 'Announcement';

// ── Role → allowed tags ───────────────────────────────────────────────────────
const ROLE_TAGS: Record<string, Array<Announcement['tag']>> = {
  student: ['All', 'Student'],
  teacher: ['All', 'Teacher'],
  admin: ['All', 'Teacher', 'Student', 'Admin'],
};

// What the feed actually renders: a day separator, or an announcement.
type FeedItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'post'; key: string; item: Announcement; showSender: boolean };

const initials = (name?: string | null) =>
  (name ?? 'S')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// ── One announcement, as a message from the school ───────────────────────────
// Everything here is incoming, so every bubble sits on the left: the sender,
// what it is about, the announcement itself, whatever came attached, and when
// it landed. A run from the same person shares one photo.
const Post = ({
  item,
  showSender,
  onPress,
}: {
  item: Announcement;
  showSender: boolean;
  onPress: () => void;
}) => {
  const sender = item.creatorName || 'School';
  const audience = item.tag && item.tag !== 'All' ? item.tag : null;
  const hasFile = item.hasImage || item.hasPdf;

  return (
    <View style={[s.postRow, showSender && s.postRowFirst]}>
      {/* The photo only leads a run, so a burst from one person reads as one */}
      <View style={s.avatarSlot}>
        {showSender &&
          (item.creatorAvatar ? (
            <Image source={{ uri: item.creatorAvatar }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitials}>{initials(sender)}</Text>
            </View>
          ))}
      </View>

      <TouchableOpacity
        style={[s.bubble, showSender && s.bubbleFirst]}
        activeOpacity={0.75}
        onPress={onPress}
      >
        {showSender && (
          <View style={s.senderLine}>
            <Text style={s.sender} numberOfLines={1}>
              {sender}
              {audience ? <Text style={s.audience}>{`  ${audience}`}</Text> : null}
            </Text>
            {item.isNew && <Text style={s.new}>NEW</Text>}
          </View>
        )}

        <Text style={s.title}>{item.title}</Text>

        {!!item.content && (
          <Text style={s.body} numberOfLines={6}>
            {item.content}
          </Text>
        )}

        <View style={s.footer}>
          {hasFile ? (
            <View style={s.attach}>
              <VectorIcon iconSet="Feather" iconName="paperclip" size={12} color={CH.sub} />
              <Text style={s.attachText}>
                {[item.hasImage ? 'Image' : null, item.hasPdf ? 'PDF' : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          ) : (
            <View style={s.flex} />
          )}
          <Text style={s.time}>{moment(item.date).format('h:mm A')}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
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
  const listRef = useRef<FlatList>(null);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data } = await apiClient.post('/announcement', { per_page: 50 });
      const items = data?.data ?? data?.announcements ?? [];
      setAnnouncements(items.map(mapApiItem));
    } catch (err: any) {
      console.error('[Announcement] ❌', err?.response?.data);
      setError(err?.response?.data?.message ?? err?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(fetchAnnouncements);

  useFocusLoad(fetchAnnouncements);

  const allowedTags = ROLE_TAGS[role.toLowerCase()] ?? ROLE_TAGS.student;

  // Oldest first, the way a conversation reads, with a separator whenever the
  // day changes and the sender's photo only where a run begins.
  const feed = useMemo<FeedItem[]>(() => {
    const f = FILTERS.find(x => x.label === activeFilter)!;
    const visible = announcements
      .filter(d => {
        const withinDays = f.days === 0 ? d.daysAgo === 0 : d.daysAgo <= f.days;
        return withinDays && allowedTags.includes(d.tag);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const out: FeedItem[] = [];
    let lastDay = '';
    let lastSender = '';

    visible.forEach(item => {
      const day = moment(item.date).format('YYYY-MM-DD');
      const newDay = day !== lastDay;
      if (newDay) {
        out.push({ kind: 'day', key: `day-${day}`, label: dayLabelFor(item.date) });
        lastDay = day;
        lastSender = '';
      }
      const sender = item.creatorName || 'School';
      out.push({
        kind: 'post',
        key: item.id,
        item,
        showSender: sender !== lastSender,
      });
      lastSender = sender;
    });

    return out;
  }, [activeFilter, announcements, allowedTags]);

  const openPost = (item: Announcement) => navigation.navigate('ViewAnnouncement', { item });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      {/* How far back to look — a segmented control pinned under the header */}
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
                <Text style={[s.segmentText, active && s.segmentTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Body */}
      {loading && !refreshing ? (
        <View style={s.list}>
          {[0, 1, 2].map(i => (
            <View key={i} style={s.skeletonRow}>
              <Skeleton width={32} height={32} radius={16} />
              <View style={s.skeletonBubble}>
                <Skeleton width="45%" height={11} />
                <Skeleton width="75%" height={14} />
                <Skeleton width="100%" height={12} />
                <Skeleton width="60%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={CH.muted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchAnnouncements} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={feed}
          keyExtractor={i => i.key}
          contentContainerStyle={[s.list, feed.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            feed.length > 0 && listRef.current?.scrollToEnd({ animated: false })
          }
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <DocNoData
              icon="megaphone-outline"
              title="No announcements"
              subtitle="Nothing posted in this period."
            />
          }
          renderItem={({ item }) =>
            item.kind === 'day' ? (
              <DayLabel label={item.label} />
            ) : (
              <Post
                item={item.item}
                showSender={item.showSender}
                onPress={() => openPost(item.item)}
              />
            )
          }
        />
      )}
    </View>
  );
};

export default AnnouncementScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: CH.page },
  flex: { flex: 1 },

  // Filter bar
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: CH.surface,
    borderBottomWidth: 1,
    borderBottomColor: CH.surfaceLine,
  },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: CH.surfaceLine,
    backgroundColor: CH.page,
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
  segmentItemActive: { backgroundColor: CH.surface, borderColor: CH.surfaceLine },
  segmentText: { fontSize: 13, fontWeight: '500', color: CH.sub },
  segmentTextActive: { color: CH.accent, fontWeight: '600' },

  // Feed
  list: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24 },
  listEmpty: { flexGrow: 1 },

  postRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 3 },
  postRowFirst: { marginTop: 12 },
  avatarSlot: { width: 32 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: CH.page },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 12, fontWeight: '600', color: CH.sub },

  bubble: {
    flex: 1,
    maxWidth: '92%',
    backgroundColor: CH.surface,
    borderWidth: 1,
    borderColor: CH.surfaceLine,
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: 8,
  },
  bubbleFirst: { borderTopLeftRadius: 16 },

  senderLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  sender: { flex: 1, fontSize: 12.5, fontWeight: '600', color: CH.accent },
  audience: { fontWeight: '400', color: CH.muted },
  new: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6, color: theme.colors.success },

  title: { fontSize: 15, fontWeight: '600', color: CH.ink, lineHeight: 21 },
  body: { fontSize: 14, lineHeight: 20, color: CH.sub, marginTop: 4 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7 },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  attachText: { fontSize: 11.5, color: CH.sub },
  time: { marginLeft: 'auto', fontSize: 10.5, color: CH.muted },

  // Loading
  skeletonRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  skeletonBubble: {
    flex: 1,
    gap: 8,
    backgroundColor: CH.surface,
    borderWidth: 1,
    borderColor: CH.surfaceLine,
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    padding: 13,
  },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: CH.sub, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: CH.accent },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

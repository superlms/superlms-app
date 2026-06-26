import React, { useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import {
  CATEGORY_CONFIG,
  NotifCategory,
  useNotifications,
  type NotificationItem,
} from '../../notifications';
import { navigateToScreen } from '../../navigation/navigationRef';

// "3 mins ago" / "2 hrs ago" / "Yesterday" from an epoch-ms timestamp.
const relativeTime = (ts: number): string => {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min${min > 1 ? 's' : ''} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr > 1 ? 's' : ''} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  return new Date(ts).toLocaleDateString();
};

const FILTERS: (NotifCategory | 'All')[] = ['All'];

const NotificationScreen = () => {
  const { items, unreadCount, markRead, markAllRead, remove } = useNotifications();
  const [activeFilter, setActiveFilter] = useState<NotifCategory | 'All'>('All');

  // Filter chips are built from whatever categories actually exist in the inbox.
  const categories = useMemo(() => {
    const set = new Set<NotifCategory>();
    items.forEach(i => set.add(i.category));
    return ['All', ...Array.from(set)] as (NotifCategory | 'All')[];
  }, [items]);

  const filtered = useMemo(
    () => (activeFilter === 'All' ? items : items.filter(i => i.category === activeFilter)),
    [items, activeFilter],
  );

  // Pull-to-refresh has nothing to fetch yet (local store); kept for parity and
  // so push-synced inboxes (Phase 2) can hook a real loader here.
  const { refreshing, onRefresh } = useRefresh(async () => {});

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const cfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.General;
    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => {
          markRead(item.id);
          const data = item.data as
            | { screen?: string; params?: Record<string, any> }
            | undefined;
          if (data?.screen) navigateToScreen(data.screen, data.params);
        }}
        activeOpacity={0.8}
      >
        {!item.read && <View style={styles.unreadDot} />}

        <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
          <VectorIcon iconSet="Ionicons" iconName={cfg.icon} size={20} color={cfg.color} />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardTop}>
            <View style={[styles.categoryChip, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.categoryText, { color: cfg.color }]}>{item.category}</Text>
            </View>
            <Text style={styles.timeText}>{relativeTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {!!item.body && (
            <Text style={styles.cardBody} numberOfLines={2}>
              {item.body}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => remove(item.id)}
          style={styles.dismissBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.safeArea}>
      <Header title="Notifications" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.topBarTitle}>
            {unreadCount > 0 ? `${unreadCount} Unread` : 'All caught up!'}
          </Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips (only when there is more than one category) */}
      {categories.length > 2 && (
        <View style={styles.filterWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {categories.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, activeFilter === f && styles.filterBtnActive]}
                onPress={() => setActiveFilter(f)}
                activeOpacity={0.8}
              >
                {f !== 'All' && (
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName={CATEGORY_CONFIG[f as NotifCategory].icon}
                    size={13}
                    color={activeFilter === f ? '#fff' : theme.colors.textSecondary}
                  />
                )}
                <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconRing}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="notifications-off-outline"
                size={36}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>You're all caught up</Text>
          </View>
        }
      />
    </View>
  );
};

export default NotificationScreen;

const __mk_styles = () => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.card },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  unreadBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  markAllText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

  filterWrapper: {
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: 8,
    alignItems: 'center',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  filterBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  filterTextActive: { color: '#fff' },

  list: { padding: theme.spacing.lg, gap: 10, paddingBottom: 30 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  cardUnread: {
    borderColor: theme.colors.primary + '40',
    backgroundColor: theme.colors.primaryLight + '60',
  },
  unreadDot: {
    position: 'absolute',
    top: 14,
    left: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: { flex: 1, gap: 4 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.full },
  categoryText: { fontSize: 10, fontWeight: '700' },
  timeText: { fontSize: 11, color: theme.colors.textMuted },
  cardTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  cardBody: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },
  dismissBtn: { paddingTop: 2 },

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
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: theme.colors.textMuted },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });

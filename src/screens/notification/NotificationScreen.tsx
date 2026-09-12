import React, { useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
import { DocHeader, DocNoData } from '../more/docUi';

const TITLE = 'Notifications';

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

// ── One notification as a plain row, separated by a divider ──────────────────
// The category's own icon leads the row; an unread one carries that icon and
// its title in the accent colour, which is what a loose dot used to say.
//   📄  Exam Schedule Released                        ✕
//       The mid-term timetable has been published.
//       Exam · 2 hrs ago
const NotificationRow = ({
  item,
  isLast,
  onPress,
  onDismiss,
}: {
  item: NotificationItem;
  isLast: boolean;
  onPress: () => void;
  onDismiss: () => void;
}) => {
  const cfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.General;
  const unread = !item.read;

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider]}
      activeOpacity={0.6}
      onPress={onPress}
    >
      <View style={s.iconSlot}>
        <VectorIcon
          iconSet="Ionicons"
          iconName={cfg.icon}
          size={18}
          color={unread ? theme.colors.primary : theme.colors.textSecondary}
        />
      </View>

      <View style={s.body}>
        <View style={s.line}>
          <Text style={[s.title, unread && s.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <TouchableOpacity onPress={onDismiss} hitSlop={10} activeOpacity={0.6}>
            <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {!!item.body && (
          <Text style={s.preview} numberOfLines={2}>
            {item.body}
          </Text>
        )}

        <Text style={s.meta} numberOfLines={1}>
          {item.category} · {relativeTime(item.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const NotificationScreen = () => {
  const { items, unreadCount, markRead, markAllRead, remove } = useNotifications();
  const [activeFilter, setActiveFilter] = useState<NotifCategory | 'All'>('All');

  // The tabs are built from whatever categories actually turned up in the inbox.
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

  const open = (item: NotificationItem) => {
    markRead(item.id);
    const data = item.data as { screen?: string; params?: Record<string, any> } | undefined;
    if (data?.screen) navigateToScreen(data.screen, data.params);
  };

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} />

      {/* How many are waiting, and a way to clear them all at once */}
      <View style={s.metaBar}>
        <Text style={s.metaBarText}>
          {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.6} hitSlop={8}>
            <Text style={s.linkText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category tabs, only once there is more than one kind to choose from */}
      {categories.length > 2 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabs}
        >
          {categories.map(f => {
            const active = activeFilter === f;
            return (
              <TouchableOpacity
                key={f}
                activeOpacity={0.6}
                onPress={() => setActiveFilter(f)}
                style={[s.tab, active && s.tabActive]}
              >
                <Text style={[s.tabText, active && s.tabTextActive]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      <View style={s.fullDivider} />

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={[s.list, filtered.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <DocNoData
            icon="notifications-off-outline"
            title="No notifications"
            subtitle="Anything the school sends you will appear here."
          />
        }
        renderItem={({ item, index }) => (
          <NotificationRow
            item={item}
            isLast={index === filtered.length - 1}
            onPress={() => open(item)}
            onDismiss={() => remove(item.id)}
          />
        )}
      />
    </View>
  );
};

export default NotificationScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Count and "mark all read"
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  metaBarText: { fontSize: 12, color: theme.colors.textMuted },
  linkText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

  // Category tabs
  tabs: { paddingHorizontal: 20, gap: 18 },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },

  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 30 },
  listEmpty: { flexGrow: 1 },

  row: { flexDirection: 'row', gap: 12, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconSlot: { width: 22, alignItems: 'center', paddingTop: 1 },
  body: { flex: 1, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  titleUnread: { fontWeight: '600', color: theme.colors.primary },
  preview: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },
  meta: { fontSize: 12, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
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
import { DocNoData } from '../more/docUi';

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
// its title in the accent colour, which is what a loose dot used to say. While
// picking rows to delete, the same slot holds the tick — so nothing shifts.
//   🎓  Exam Schedule Released                        ✕
//       The mid-term timetable has been published.
//       Exam · 2 hrs ago
const NotificationRow = ({
  item,
  isLast,
  selectionMode,
  selected,
  onPress,
  onLongPress,
  onDismiss,
}: {
  item: NotificationItem;
  isLast: boolean;
  selectionMode: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDismiss: () => void;
}) => {
  const cfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.General;
  const unread = !item.read;

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider, selected && s.rowSelected]}
      activeOpacity={0.6}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={s.iconSlot}>
        <VectorIcon
          iconSet="Ionicons"
          iconName={
            selectionMode
              ? selected
                ? 'checkmark-circle'
                : 'ellipse-outline'
              : cfg.icon
          }
          size={selectionMode ? 20 : 18}
          color={
            selectionMode
              ? selected
                ? theme.colors.primary
                : theme.colors.border
              : unread
              ? theme.colors.primary
              : theme.colors.textSecondary
          }
        />
      </View>

      <View style={s.body}>
        <View style={s.line}>
          <Text style={[s.title, unread && s.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          {!selectionMode && (
            <TouchableOpacity onPress={onDismiss} hitSlop={10} activeOpacity={0.6}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
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

const NotificationScreen = ({ navigation }: any) => {
  const { items, unreadCount, markRead, markAllRead, remove, removeMany } = useNotifications();
  const [activeFilter, setActiveFilter] = useState<NotifCategory | 'All'>('All');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const selectionMode = selectedIds.length > 0;
  // Selecting everything means everything currently on screen, not the whole
  // inbox — a filter is on screen for a reason.
  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length;

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const clearSelection = () => setSelectedIds([]);

  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? [] : filtered.map(i => i.id));

  const deleteSelected = () => {
    removeMany(selectedIds);
    setSelectedIds([]);
    setConfirmDelete(false);
  };

  const open = (item: NotificationItem) => {
    markRead(item.id);
    const data = item.data as { screen?: string; params?: Record<string, any> } | undefined;
    if (data?.screen) navigateToScreen(data.screen, data.params);
  };

  return (
    <View style={s.root}>
      <Header
        title={selectionMode ? `${selectedIds.length} selected` : TITLE}
        divider
        height={50}
        onBackPress={() => (selectionMode ? clearSelection() : navigation.goBack())}
        rightSlot={
          selectionMode ? (
            <TouchableOpacity
              style={s.headBtn}
              activeOpacity={0.6}
              hitSlop={8}
              onPress={() => setConfirmDelete(true)}
            >
              <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={19} color={theme.colors.danger} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* What is waiting, and what can be done with the lot */}
      <View style={s.metaBar}>
        <Text style={s.metaBarText}>
          {selectionMode
            ? `${selectedIds.length} of ${filtered.length} selected`
            : unreadCount > 0
            ? `${unreadCount} unread`
            : 'All caught up'}
        </Text>

        {selectionMode ? (
          <TouchableOpacity onPress={toggleSelectAll} activeOpacity={0.6} hitSlop={8}>
            <Text style={s.linkText}>{allSelected ? 'Clear all' : 'Select all'}</Text>
          </TouchableOpacity>
        ) : (
          unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} activeOpacity={0.6} hitSlop={8}>
              <Text style={s.linkText}>Mark all read</Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {/* Category tabs, only once there is more than one kind to choose from */}
      {categories.length > 2 && !selectionMode && (
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
            selectionMode={selectionMode}
            selected={selectedIds.includes(item.id)}
            onPress={() => (selectionMode ? toggleSelect(item.id) : open(item))}
            onLongPress={() => toggleSelect(item.id)}
            onDismiss={() => remove(item.id)}
          />
        )}
      />

      {/* Delete confirmation */}
      <Modal
        transparent
        visible={confirmDelete}
        animationType="fade"
        onRequestClose={() => setConfirmDelete(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              Delete{' '}
              {selectedIds.length === 1
                ? 'this notification'
                : `${selectedIds.length} notifications`}
              ?
            </Text>
            <Text style={s.modalDesc}>
              They will be removed from this device. This cannot be undone.
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnGhost]}
                activeOpacity={0.7}
                onPress={() => setConfirmDelete(false)}
              >
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnDanger]}
                activeOpacity={0.85}
                onPress={deleteSelected}
              >
                <Text style={s.modalBtnDangerText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default NotificationScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  // Count, and whatever applies to the whole list
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
  // Full-bleed highlight: the row's own padding stops at the page margin.
  rowSelected: {
    backgroundColor: theme.colors.background,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  iconSlot: { width: 22, alignItems: 'center', paddingTop: 1 },
  body: { flex: 1, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  titleUnread: { fontWeight: '600', color: theme.colors.primary },
  preview: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },
  meta: { fontSize: 12, color: theme.colors.textMuted },

  // Confirm modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  modalDesc: { marginTop: 8, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhost: { borderWidth: 1, borderColor: theme.colors.border },
  modalBtnGhostText: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  modalBtnDanger: { backgroundColor: theme.colors.danger },
  modalBtnDangerText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import moment from 'moment';
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

// A step darker than the theme's text colours, so the inbox reads crisply.
const INK = '#0F172A';   // titles
const BODY = '#475569';  // previews, tabs, day headings
const QUIET = '#64748B'; // times, counts, categories

// "3 mins ago" / "2 hrs ago" from an epoch-ms timestamp.
const relativeTime = (ts: number): string => {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min${min > 1 ? 's' : ''} ago`;
  const hr = Math.floor(min / 60);
  return `${hr} hr${hr > 1 ? 's' : ''} ago`;
};

// Today's notifications say how long ago; older ones, the time of day — the day
// itself is in the heading above them.
const timeLabel = (ts: number) =>
  moment(ts).isSame(moment(), 'day') ? relativeTime(ts) : moment(ts).format('h:mm A');

const dayHeading = (ts: number) => {
  const d = moment(ts);
  if (d.isSame(moment(), 'day')) return 'Today';
  if (d.isSame(moment().subtract(1, 'day'), 'day')) return 'Yesterday';
  return d.isSame(moment(), 'year') ? d.format('ddd, D MMM') : d.format('D MMM YYYY');
};

interface DaySection {
  title: string;
  data: NotificationItem[];
}

// Newest first, gathered under a heading per day.
const byDay = (items: NotificationItem[]): DaySection[] => {
  const sections: DaySection[] = [];
  [...items]
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(item => {
      const title = dayHeading(item.createdAt);
      const last = sections[sections.length - 1];
      if (last && last.title === title) last.data.push(item);
      else sections.push({ title, data: [item] });
    });
  return sections;
};

// ── One notification ─────────────────────────────────────────────────────────
// A round icon centred on the row (tinted while unread), then the title, the
// description running all the way to the right edge, and the kind with its
// time on the last line. While picking rows, the icon's slot holds a small
// tick instead, so the text never shifts.
//   (🎓)  Exam Schedule Released
//         The mid-term timetable has been published for all the classes.
//         Exam · 2 hrs ago
const NotificationRow = ({
  item,
  isLast,
  selectionMode,
  selected,
  onPress,
  onLongPress,
}: {
  item: NotificationItem;
  isLast: boolean;
  selectionMode: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) => {
  const cfg = CATEGORY_CONFIG[item.category] ?? CATEGORY_CONFIG.General;
  const unread = !item.read;
  // The filled glyph reads better than the outline inside the small circle.
  const icon = cfg.icon.replace(/-outline$/, '');

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider, selected && s.rowSelected]}
      activeOpacity={0.6}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
    >
      <View style={s.leadSlot}>
        {selectionMode ? (
          <View style={[s.check, selected ? s.checkOn : s.checkOff]}>
            {selected && (
              <VectorIcon iconSet="Ionicons" iconName="checkmark" size={13} color={theme.colors.white} />
            )}
          </View>
        ) : (
          <View style={[s.lead, unread ? s.leadUnread : s.leadRead]}>
            <VectorIcon
              iconSet="Ionicons"
              iconName={icon}
              size={17}
              color={unread ? theme.colors.primary : BODY}
            />
          </View>
        )}
      </View>

      <View style={s.body}>
        <Text style={[s.title, unread && s.titleUnread]} numberOfLines={1}>
          {item.title}
        </Text>

        {!!item.body && (
          <Text style={s.preview} numberOfLines={2}>
            {item.body}
          </Text>
        )}

        <Text style={s.meta} numberOfLines={1}>
          {item.category} ·{' '}
          <Text style={unread ? s.timeUnread : undefined}>{timeLabel(item.createdAt)}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const NotificationScreen = ({ navigation }: any) => {
  const { items, unreadCount, markRead, markAllRead, removeMany } = useNotifications();
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
  const sections = useMemo(() => byDay(filtered), [filtered]);

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

  // While rows are picked, going back — the header arrow, Android's back
  // button or a swipe — only lets go of the selection.
  usePreventRemove(selectionMode, () => clearSelection());

  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? [] : filtered.map(i => i.id));

  const chooseFilter = (f: NotifCategory | 'All') => {
    setActiveFilter(f);
    clearSelection();
  };

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

      {/* While picking, a tap on any empty part of the screen lets go of the
          selection; rows and links keep their own taps. */}
      <Pressable
        style={s.fill}
        accessible={false}
        disabled={!selectionMode}
        onPress={clearSelection}
      >
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
        {categories.length > 2 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // A horizontal ScrollView grows to fill a column by default.
            style={s.tabsBar}
            contentContainerStyle={s.tabs}
          >
            {categories.map(f => {
              const active = activeFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  activeOpacity={0.6}
                  onPress={() => chooseFilter(f)}
                  style={[s.tab, active && s.tabActive]}
                >
                  <Text style={[s.tabText, active && s.tabTextActive]}>{f}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        <View style={s.fullDivider} />

        <SectionList
          sections={sections}
          keyExtractor={i => i.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <DocNoData
              icon="notifications-off-outline"
              title="No notifications"
              subtitle="Anything the school sends you will appear here."
            />
          }
          renderSectionHeader={({ section }) => <Text style={s.dayHead}>{section.title}</Text>}
          renderItem={({ item, index, section }) => (
            <NotificationRow
              item={item}
              isLast={index === section.data.length - 1}
              selectionMode={selectionMode}
              selected={selectedIds.includes(item.id)}
              onPress={() => (selectionMode ? toggleSelect(item.id) : open(item))}
              onLongPress={() => toggleSelect(item.id)}
            />
          )}
        />
      </Pressable>

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
  fill: { flex: 1 },

  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  // Count, and whatever applies to the whole list
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  metaBarText: { fontSize: 13, color: QUIET },
  linkText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

  // Category tabs
  tabsBar: { flexGrow: 0 },
  tabs: { paddingHorizontal: 20, gap: 20 },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: BODY },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },

  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // List — grows to the full height so the empty part below it takes taps.
  list: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 30 },
  dayHead: { paddingTop: 18, paddingBottom: 2, fontSize: 13, fontWeight: '600', color: BODY },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  // Full-bleed highlight: the row's own padding stops at the page margin.
  rowSelected: {
    backgroundColor: theme.colors.background,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },

  // Leading slot: the kind's icon in a circle, or a small tick while picking
  leadSlot: { width: 36, alignItems: 'center', justifyContent: 'center' },
  lead: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  leadRead: { backgroundColor: theme.colors.background },
  leadUnread: { backgroundColor: theme.colors.primaryLight },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  checkOff: { borderWidth: 1.5, borderColor: theme.colors.border },
  checkOn: { backgroundColor: theme.colors.primary },

  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '500', color: INK },
  titleUnread: { fontWeight: '700' },
  preview: { fontSize: 13, lineHeight: 18, color: BODY },
  // Kind and time share the last line, in small type.
  meta: { fontSize: 11, color: QUIET, marginTop: 1 },
  timeUnread: { color: theme.colors.primary, fontWeight: '500' },

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
  modalTitle: { fontSize: 17, fontWeight: '600', color: INK },
  modalDesc: { marginTop: 8, fontSize: 14, color: BODY, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhost: { borderWidth: 1, borderColor: theme.colors.border },
  modalBtnGhostText: { fontSize: 15, fontWeight: '500', color: INK },
  modalBtnDanger: { backgroundColor: theme.colors.danger },
  modalBtnDangerText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

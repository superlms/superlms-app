import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { useNotifications, type NotificationItem } from '../../notifications';
import { navigateToScreen } from '../../navigation/navigationRef';
import { DocNoData } from '../more/docUi';
import {
  BODY,
  INK,
  DayHeading,
  FilterPills,
  InboxRow,
  InboxSkeleton,
  groupByDay,
  inboxStyles as ui,
  timeLabel,
} from './inboxUi';

const TITLE = 'Notifications';

type ReadFilter = 'all' | 'unread' | 'read';
const READ_FILTERS: { key: ReadFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
];

// Every notification shows the bell, whatever its kind; the kind is named under
// the title. The filled glyph reads better than the outline in the small circle.
const NOTIFICATION_ICON = 'notifications';

const NotificationScreen = ({ navigation }: any) => {
  const { items, ready, unreadCount, markRead, markAllRead, removeMany } = useNotifications();
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Totals for the All / Unread / Read selector.
  const readCounts = useMemo(() => {
    const unread = items.filter(i => !i.read).length;
    return { all: items.length, unread, read: items.length - unread };
  }, [items]);
  const filtered = useMemo(
    () =>
      readFilter === 'all'
        ? items
        : items.filter(i => (readFilter === 'unread' ? !i.read : i.read)),
    [items, readFilter],
  );
  const sections = useMemo(() => groupByDay(filtered, i => i.createdAt), [filtered]);

  // Pulling to refresh brings the skeleton back for a moment. The inbox lives on
  // this device, so there is nothing to fetch yet (push-synced inboxes can hook
  // a real loader here); the pause is what shows it reloaded. The skeleton
  // stands in for the spinner, which is never turned on.
  const [reloading, setReloading] = useState(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(reloadTimer.current), []);
  const reload = useCallback(() => {
    setSelectedIds([]);
    setReloading(true);
    clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => setReloading(false), 600);
  }, []);

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

  const chooseReadFilter = (f: ReadFilter) => {
    setReadFilter(f);
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

      {!ready || reloading ? (
        // The saved inbox is still being read off the device, or was pulled to refresh
        <InboxSkeleton pillWidths={[54, 72, 62]} trailing />
      ) : (
        /* While picking, a tap on any empty part of the screen lets go of the
           selection; rows and links keep their own taps. */
        <Pressable
          style={s.fill}
          accessible={false}
          disabled={!selectionMode}
          onPress={clearSelection}
        >
          {/* All / Unread / Read with their totals, and what applies to the lot */}
          <View style={ui.metaBar}>
            {selectionMode ? (
              <Text style={ui.metaBarText}>
                {selectedIds.length} of {filtered.length} selected
              </Text>
            ) : (
              <FilterPills
                options={READ_FILTERS.map(f => ({ ...f, count: readCounts[f.key] }))}
                active={readFilter}
                onChange={chooseReadFilter}
              />
            )}

            {selectionMode ? (
              <TouchableOpacity onPress={toggleSelectAll} activeOpacity={0.6} hitSlop={8}>
                <Text style={ui.linkText}>{allSelected ? 'Clear all' : 'Select all'}</Text>
              </TouchableOpacity>
            ) : unreadCount > 0 ? (
              <TouchableOpacity onPress={markAllRead} activeOpacity={0.6} hitSlop={8}>
                <Text style={ui.linkText}>Mark all read</Text>
              </TouchableOpacity>
            ) : (
              <Text style={ui.metaBarText}>All caught up</Text>
            )}
          </View>

          <View style={ui.fullDivider} />

          <SectionList
            sections={sections}
            keyExtractor={i => i.id}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={ui.list}
            showsVerticalScrollIndicator={false}
            // Off while picking rows, so a press that drifts down selects
            // without pulling the list.
            refreshControl={
              <AppRefreshControl refreshing={false} onRefresh={reload} enabled={!selectionMode} />
            }
            ListEmptyComponent={
              readFilter === 'unread' && readCounts.all > 0 ? (
                <DocNoData
                  icon="checkmark-done-outline"
                  title="All caught up"
                  subtitle="You have read every notification here."
                />
              ) : readFilter === 'read' && readCounts.all > 0 ? (
                <DocNoData
                  icon="mail-unread-outline"
                  title="Nothing read yet"
                  subtitle="Notifications you open will appear here."
                />
              ) : (
                <DocNoData
                  icon="notifications-off-outline"
                  title="No notifications"
                  subtitle="Anything the school sends you will appear here."
                />
              )
            }
            renderSectionHeader={({ section }) => <DayHeading title={section.title} />}
            renderItem={({ item, index, section }) => (
              <InboxRow
                icon={NOTIFICATION_ICON}
                title={item.title}
                body={item.body}
                kind={item.category}
                time={timeLabel(item.createdAt)}
                highlight={!item.read}
                isLast={index === section.data.length - 1}
                selectionMode={selectionMode}
                selected={selectedIds.includes(item.id)}
                onPress={() => (selectionMode ? toggleSelect(item.id) : open(item))}
                onLongPress={() => toggleSelect(item.id)}
              />
            )}
          />
        </Pressable>
      )}

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

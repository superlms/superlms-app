import React, { useCallback, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { Skeleton, SkeletonText } from '../../components/Skeleton';
import { AppAlert } from '../../components/AppDialog';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocNoData } from '../more/docUi';
import {
  type ChatContact,
  type ChatRole,
  blockChatUsers,
  chatErrorMessage,
  chatRoleOf,
  deleteChatConversations,
  getChatContacts,
  pinChatConversations,
  unblockChatUsers,
} from '../../api/chatApi';
import { clearChatNotifications } from '../../notifications/chatNotifications';
import { onChatPush } from './chatEvents';
import { listTimeLabel, previewLine, SAMPLE_CONTACTS } from './chatFormat';

// While the list is on screen it checks for new messages this often; a push
// brings one in straight away.
const POLL_MS = 15000;

const toast = (message: string) =>
  Platform.OS === 'android' ? ToastAndroid.show(message, ToastAndroid.SHORT) : AppAlert.alert(message);

const initials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// A line of text, or its skeleton.
const Words = ({
  skeleton,
  style,
  children,
}: {
  skeleton?: boolean;
  style: StyleProp<TextStyle>;
  children: React.ReactNode;
}) =>
  skeleton ? (
    <SkeletonText style={style} numberOfLines={1}>{children}</SkeletonText>
  ) : (
    <Text style={style} numberOfLines={1}>{children}</Text>
  );

// ── One conversation as a plain row, separated by a divider ──────────────────
//   [photo]  Ravi Sharma  Physics                10:42 AM
//            Please submit your assignment…             2
// A teacher's rows say the student's class where a student's say the subject,
// and an admin's the person's role; a chat pinned in Messages carries a pin.
const ChatRow = ({
  item,
  selected,
  isLast,
  onPress,
  onLongPress,
  skeleton,
}: {
  item: ChatContact;
  selected: boolean;
  isLast: boolean;
  onPress: () => void;
  onLongPress: () => void;
  skeleton?: boolean;
}) => {
  const unread = item.unread > 0;
  // By the name: a teacher's subjects, or a student's class · section.
  const detail = [item.standard?.name, item.section?.name].filter(Boolean).join(' · ') || item.subtitle;

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider, selected && s.rowSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.6}
      disabled={skeleton}
    >
      <View>
        {skeleton ? (
          <Skeleton width={46} height={46} radius={23} />
        ) : item.avatar ? (
          <Image source={{ uri: item.avatar }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarInitials}>{initials(item.name)}</Text>
          </View>
        )}
        {selected && (
          <View style={s.tick}>
            <VectorIcon iconSet="Ionicons" iconName="checkmark" size={11} color={theme.colors.white} />
          </View>
        )}
      </View>

      <View style={s.rowText}>
        <View style={s.rowLine}>
          <View style={s.fill}>
            <Words skeleton={skeleton} style={s.name}>
              {item.name}
              {detail ? <Text style={s.subject}>{`  ${detail}`}</Text> : null}
            </Words>
          </View>
          {!!item.last_message && (
            <Words skeleton={skeleton} style={[s.time, unread && !item.blocked && s.timeUnread]}>
              {listTimeLabel(item.last_message.created_at)}
            </Words>
          )}
        </View>

        <View style={s.rowLine}>
          <View style={s.fill}>
            {/* A blocked person's row says so in place of their messages */}
            <Words
              skeleton={skeleton}
              style={[
                s.last,
                unread && !item.blocked && s.lastUnread,
                !item.last_message && s.lastNone,
                item.blocked && s.lastBlocked,
              ]}
            >
              {item.blocked ? 'Blocked' : previewLine(item)}
            </Words>
          </View>
          {!!item.pinned && !skeleton && (
            <VectorIcon iconSet="AntDesign" iconName="pushpin" size={13} color={theme.colors.textMuted} />
          )}
          {unread && !item.blocked &&
            (skeleton ? (
              <Skeleton width={18} height={18} radius={9} />
            ) : (
              <View style={s.unread}>
                <Text style={s.unreadText}>{item.unread}</Text>
              </View>
            ))}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ChatsListScreen = ({ navigation, route }: any) => {
  const userRole: ChatRole = chatRoleOf(route?.params?.userRole);
  const isStudent = userRole === 'student';
  // The admin app's Messages: the web panel's chat, where chats are pinned rather than blocked.
  const isAdmin = userRole === 'admin';

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  // The skeleton shows on the first load and on a pull to refresh; while the
  // list is on screen it checks for new messages quietly.
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [last, rememberLast] = useLastLoaded<ChatContact[]>(`chats:${userRole}`);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      try {
        const list = await getChatContacts(userRole);
        setContacts(list);
        setError(null);
        setLoaded(true);
        loadedRef.current = true;
        rememberLast(list);
      } catch (e: any) {
        console.log('[ChatsListScreen] load failed:', e?.response?.status, e?.message);
        // A failed check keeps the list on screen; only a list never loaded says so.
        if (!loadedRef.current) setError(chatErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [rememberLast, userRole],
  );

  const reload = useCallback(() => load(true), [load]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(() => load(), POLL_MS);
      const off = onChatPush(() => load());
      return () => {
        clearInterval(timer);
        off();
      };
    }, [load]),
  );

  // The phone's back button first lets go of the picked chats, then closes the
  // search — and only then leaves Chats.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (selectedIds.length > 0) {
          setSelectedIds([]);
          return true;
        }
        if (searchOpen) {
          setSearchOpen(false);
          setSearchText('');
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [selectedIds.length, searchOpen]),
  );

  const selectionMode = selectedIds.length > 0;
  const selectedContacts = contacts.filter(c => selectedIds.includes(c.user_id));
  // With every picked chat blocked already, the button unblocks instead.
  const allBlocked = selectedContacts.length > 0 && selectedContacts.every(c => c.blocked);
  // In Messages, likewise: with every picked chat pinned already, the pin unpins.
  const allPinned = selectedContacts.length > 0 && selectedContacts.every(c => c.pinned);

  const pinSelected = async () => {
    const ids = selectedIds;
    const pin = !allPinned;
    setSelectedIds([]);
    setContacts(prev => prev.map(c => (ids.includes(c.user_id) ? { ...c, pinned: pin } : c)));
    try {
      await pinChatConversations(ids);
      toast(pin ? (ids.length > 1 ? 'Chats pinned' : 'Chat pinned') : ids.length > 1 ? 'Chats unpinned' : 'Chat unpinned');
    } catch (e: any) {
      AppAlert.alert(pin ? 'Could not pin' : 'Could not unpin', chatErrorMessage(e));
    }
    load();
  };

  const unblockSelected = async () => {
    const ids = selectedIds;
    setSelectedIds([]);
    setContacts(prev => prev.map(c => (ids.includes(c.user_id) ? { ...c, blocked: false } : c)));
    try {
      await unblockChatUsers(ids);
      toast(ids.length > 1 ? 'Unblocked' : `${selectedContacts[0]?.name ?? 'Chat'} unblocked`);
    } catch (e: any) {
      AppAlert.alert('Could not unblock', chatErrorMessage(e));
    }
    load();
  };

  const blockSelected = async () => {
    const ids = selectedIds;
    setConfirmBlock(false);
    setSelectedIds([]);
    setContacts(prev => prev.map(c => (ids.includes(c.user_id) ? { ...c, blocked: true } : c)));
    ids.forEach(id => clearChatNotifications(id));
    try {
      await blockChatUsers(ids);
      toast(ids.length > 1 ? 'Blocked' : `${selectedContacts[0]?.name ?? 'Chat'} blocked`);
    } catch (e: any) {
      AppAlert.alert('Could not block', chatErrorMessage(e));
    }
    load();
  };

  // Only people there has been a conversation with — + starts a new one. While
  // it loads, the list is drawn as a skeleton from the chats it shows.
  const shown = (loading ? (loaded ? contacts : Array.isArray(last) ? last : SAMPLE_CONTACTS) : contacts).filter(
    c => !!c.last_message,
  );

  const q = searchText.trim().toLowerCase();
  const filteredChats = q
    ? shown.filter(c => c.name.toLowerCase().includes(q) || (c.subtitle ?? '').toLowerCase().includes(q))
    : shown;

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const deleteSelected = async () => {
    const ids = selectedIds;
    setConfirmDelete(false);
    setSelectedIds([]);
    try {
      await deleteChatConversations(ids, userRole);
    } catch (e: any) {
      AppAlert.alert('Could not delete', chatErrorMessage(e));
    }
    load();
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchText('');
  };

  return (
    <View style={s.root}>
      <Header
        title={selectionMode ? `${selectedIds.length} selected` : isAdmin ? 'Messages' : 'Chats'}
        divider
        height={50}
        onBackPress={() => (selectionMode ? setSelectedIds([]) : navigation.goBack())}
        rightSlot={
          <View style={s.headActions}>
            {/* Messages: pin the picked chats to the top — or unpin them, when every one is pinned */}
            {selectionMode && isAdmin && (
              <TouchableOpacity style={s.headBtn} activeOpacity={0.6} hitSlop={8} onPress={pinSelected}>
                <VectorIcon
                  iconSet="AntDesign"
                  iconName={allPinned ? 'pushpin' : 'pushpino'}
                  size={19}
                  color={theme.colors.textPrimary}
                />
              </TouchableOpacity>
            )}
            {/* Block the picked chats — or unblock them, when every one is blocked */}
            {selectionMode && !isAdmin && (
              <TouchableOpacity
                style={s.headBtn}
                activeOpacity={0.6}
                hitSlop={8}
                onPress={() => (allBlocked ? unblockSelected() : setConfirmBlock(true))}
              >
                <VectorIcon
                  iconSet="Ionicons"
                  iconName={allBlocked ? 'lock-open-outline' : 'ban-outline'}
                  size={20}
                  color={theme.colors.textPrimary}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.headBtn}
              activeOpacity={0.6}
              hitSlop={8}
              onPress={() =>
                selectionMode
                  ? setConfirmDelete(true)
                  : searchOpen
                  ? closeSearch()
                  : setSearchOpen(true)
              }
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName={selectionMode ? 'trash-outline' : searchOpen ? 'close' : 'search'}
                size={19}
                color={selectionMode ? theme.colors.danger : theme.colors.primary}
              />
            </TouchableOpacity>
            {/* + starts a chat: a student picks a teacher, a teacher a class and then a student,
                an admin one of the school's admins, sub-admins or accounts team */}
            {!selectionMode && (
              <TouchableOpacity
                style={s.headBtn}
                activeOpacity={0.6}
                hitSlop={8}
                onPress={() => navigation.navigate('NewChat', { userRole })}
              >
                <VectorIcon iconSet="Ionicons" iconName="add" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Search, only while it is asked for */}
      {searchOpen && !selectionMode && (
        <View style={s.searchWrap}>
          <View style={s.searchRow}>
            <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search chats"
              placeholderTextColor={theme.colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
              returnKeyType="search"
            />
            {!!searchText && (
              <TouchableOpacity onPress={() => setSearchText('')} hitSlop={8}>
                <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {error && !loaded && !loading ? (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={reload} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={i => String(i.user_id)}
          contentContainerStyle={[s.list, filteredChats.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          // The skeleton stands in for the spinner.
          refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
          ListEmptyComponent={
            <DocNoData
              icon="chatbubbles-outline"
              title={q ? 'No chats found' : 'No chats yet'}
              subtitle={
                q
                  ? 'Nothing matches that search.'
                  : isAdmin
                  ? 'Tap + to message your school’s admin or accounts team.'
                  : isStudent
                  ? 'Tap + to message a teacher of your class.'
                  : 'Tap + to choose a class and message a student.'
              }
              skeleton={loading}
            />
          }
          renderItem={({ item, index }) => (
            <ChatRow
              item={item}
              skeleton={loading}
              selected={selectedIds.includes(item.user_id)}
              isLast={index === filteredChats.length - 1}
              onPress={() => {
                if (selectionMode) toggleSelect(item.user_id);
                else
                  navigation.navigate('UserChats', {
                    contact: {
                      user_id: item.user_id,
                      name: item.name,
                      avatar: item.avatar,
                      subtitle: item.subtitle,
                    },
                    userRole,
                  });
              }}
              // Only a chat with messages has anything to delete.
              onLongPress={() => item.conversation_id && toggleSelect(item.user_id)}
            />
          )}
        />
      )}

      {/* Block confirmation */}
      <Modal
        transparent
        visible={confirmBlock}
        animationType="fade"
        onRequestClose={() => setConfirmBlock(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              Block {selectedIds.length === 1 ? selectedContacts[0]?.name ?? 'this chat' : `${selectedIds.length} chats`}?
            </Text>
            <Text style={s.modalDesc}>
              They won't be able to message you, and you won't get notifications from them. You can unblock
              them at any time.
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnGhost]}
                activeOpacity={0.7}
                onPress={() => setConfirmBlock(false)}
              >
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnDanger]}
                activeOpacity={0.85}
                onPress={blockSelected}
              >
                <Text style={s.modalBtnDangerText}>Block</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              Delete {selectedIds.length === 1 ? 'chat' : `${selectedIds.length} chats`}?
            </Text>
            <Text style={s.modalDesc}>
              The messages will be removed for you. The other person keeps their copy.
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

export default ChatsListScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Search
  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, padding: 0 },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 30 },
  listEmpty: { flexGrow: 1 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  // Full-bleed highlight: the row's own padding stops at the page margin.
  rowSelected: {
    backgroundColor: theme.colors.background,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },

  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.background },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  tick: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.card,
  },

  rowText: { flex: 1, gap: 3 },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fill: { flex: 1 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  subject: { fontSize: 11, fontWeight: '400', color: theme.colors.textMuted },
  time: { fontSize: 12, color: theme.colors.textMuted },
  timeUnread: { color: theme.colors.primary, fontWeight: '500' },
  last: { fontSize: 13, color: theme.colors.textSecondary },
  lastUnread: { color: theme.colors.textPrimary, fontWeight: '500' },
  lastNone: { color: theme.colors.textMuted },
  lastBlocked: { color: theme.colors.danger, fontStyle: 'italic' },
  unread: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { fontSize: 11, fontWeight: '600', color: theme.colors.white },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

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

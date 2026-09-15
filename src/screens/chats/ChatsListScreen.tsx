import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocNoData } from '../more/docUi';

type DrawerRole = 'student' | 'teacher';

export interface ChatItem {
  id: string;
  name: string;
  subject?: string; // only for teacher contacts (student sees teacher's subject)
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
}

// Student sees → list of Teachers (each has a subject)
const STUDENT_CHATS: ChatItem[] = [
  {
    id: '1',
    name: 'Ravi Sharma',
    subject: 'Physics',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    lastMessage: 'Please submit your assignment by tomorrow.',
    time: '10:42 AM',
    unread: 2,
    online: true,
  },
  {
    id: '2',
    name: 'Priya Mehta',
    subject: 'Mathematics',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    lastMessage: 'Great work on the last test!',
    time: '9:15 AM',
    unread: 0,
    online: true,
  },
  {
    id: '3',
    name: 'Anil Verma',
    subject: 'Chemistry',
    avatar: 'https://randomuser.me/api/portraits/men/75.jpg',
    lastMessage: 'Chapter 5 notes have been uploaded.',
    time: 'Yesterday',
    unread: 1,
    online: false,
  },
  {
    id: '4',
    name: 'Sunita Rao',
    subject: 'Biology',
    avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
    lastMessage: 'Lab session rescheduled to Friday.',
    time: 'Yesterday',
    unread: 0,
    online: false,
  },
  {
    id: '5',
    name: 'Deepak Singh',
    subject: 'English',
    avatar: 'https://randomuser.me/api/portraits/men/52.jpg',
    lastMessage: 'Read chapter 3 before next class.',
    time: 'Mon',
    unread: 0,
    online: true,
  },
  {
    id: '6',
    name: 'Kavita Joshi',
    subject: 'History',
    avatar: 'https://randomuser.me/api/portraits/women/90.jpg',
    lastMessage: 'Quiz on Monday. Be prepared!',
    time: 'Sun',
    unread: 3,
    online: false,
  },
];

// Teacher sees → list of Students (no subject)
const TEACHER_CHATS: ChatItem[] = [
  {
    id: '1',
    name: 'Arjun Patel',
    avatar: 'https://randomuser.me/api/portraits/men/11.jpg',
    lastMessage: 'Sir, I have a doubt in chapter 4.',
    time: '11:02 AM',
    unread: 3,
    online: true,
  },
  {
    id: '2',
    name: 'Sneha Gupta',
    avatar: 'https://randomuser.me/api/portraits/women/21.jpg',
    lastMessage: 'Thank you for the notes!',
    time: '10:30 AM',
    unread: 0,
    online: true,
  },
  {
    id: '3',
    name: 'Rohan Mehta',
    avatar: 'https://randomuser.me/api/portraits/men/33.jpg',
    lastMessage: 'Can I submit the assignment tomorrow?',
    time: 'Yesterday',
    unread: 1,
    online: false,
  },
  {
    id: '4',
    name: 'Pooja Singh',
    avatar: 'https://randomuser.me/api/portraits/women/55.jpg',
    lastMessage: 'I missed the class today.',
    time: 'Yesterday',
    unread: 0,
    online: false,
  },
  {
    id: '5',
    name: 'Karan Shah',
    avatar: 'https://randomuser.me/api/portraits/men/60.jpg',
    lastMessage: 'Understood, thank you!',
    time: 'Mon',
    unread: 0,
    online: true,
  },
  {
    id: '6',
    name: 'Nisha Verma',
    avatar: 'https://randomuser.me/api/portraits/women/72.jpg',
    lastMessage: 'Please share the study material.',
    time: 'Sun',
    unread: 2,
    online: false,
  },
];

const initials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// ── One conversation as a plain row, separated by a divider ──────────────────
//   [photo]  Ravi Sharma · Physics            10:42 AM
//            Please submit your assignment…          2
const ChatRow = ({
  item,
  isStudent,
  selected,
  isLast,
  onPress,
  onLongPress,
}: {
  item: ChatItem;
  isStudent: boolean;
  selected: boolean;
  isLast: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) => (
  <TouchableOpacity
    style={[s.row, !isLast && s.rowDivider, selected && s.rowSelected]}
    onPress={onPress}
    onLongPress={onLongPress}
    activeOpacity={0.6}
  >
    <View>
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarFallback]}>
          <Text style={s.avatarInitials}>{initials(item.name)}</Text>
        </View>
      )}
      {selected ? (
        <View style={s.tick}>
          <VectorIcon iconSet="Ionicons" iconName="checkmark" size={11} color={theme.colors.white} />
        </View>
      ) : (
        item.online && <View style={s.onlineDot} />
      )}
    </View>

    <View style={s.rowText}>
      <View style={s.rowLine}>
        <Text style={s.name} numberOfLines={1}>
          {item.name}
          {isStudent && item.subject ? (
            <Text style={s.subject}>{`  ${item.subject}`}</Text>
          ) : null}
        </Text>
        <Text style={[s.time, item.unread > 0 && s.timeUnread]}>{item.time}</Text>
      </View>

      <View style={s.rowLine}>
        <Text style={[s.last, item.unread > 0 && s.lastUnread]} numberOfLines={1}>
          {item.lastMessage}
        </Text>
        {item.unread > 0 && (
          <View style={s.unread}>
            <Text style={s.unreadText}>{item.unread}</Text>
          </View>
        )}
      </View>
    </View>
  </TouchableOpacity>
);

const ChatsListScreen = ({ navigation, route }: any) => {
  const userRole: DrawerRole = route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  const [chats, setChats] = useState<ChatItem[]>(
    userRole === 'student' ? STUDENT_CHATS : TEACHER_CHATS,
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // TODO: wire to the chats API loader once integrated.
  const { refreshing, onRefresh } = useRefresh(() => {});

  const selectionMode = selectedIds.length > 0;

  const q = searchText.trim().toLowerCase();
  const filteredChats = q
    ? chats.filter(
        c => c.name.toLowerCase().includes(q) || (c.subject ?? '').toLowerCase().includes(q),
      )
    : chats;

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const deleteSelected = () => {
    setChats(prev => prev.filter(c => !selectedIds.includes(c.id)));
    setSelectedIds([]);
    setConfirmDelete(false);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchText('');
  };

  return (
    <View style={s.root}>
      <Header
        title={selectionMode ? `${selectedIds.length} selected` : 'Chats'}
        divider
        height={50}
        onBackPress={() => (selectionMode ? setSelectedIds([]) : navigation.goBack())}
        rightSlot={
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

      <FlatList
        data={filteredChats}
        keyExtractor={i => i.id}
        contentContainerStyle={[s.list, filteredChats.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <DocNoData
            icon="chatbubbles-outline"
            title="No chats found"
            subtitle={q ? 'Nothing matches that search.' : 'Your conversations will appear here.'}
          />
        }
        renderItem={({ item, index }) => (
          <ChatRow
            item={item}
            isStudent={userRole === 'student'}
            selected={selectedIds.includes(item.id)}
            isLast={index === filteredChats.length - 1}
            onPress={() => {
              if (selectionMode) toggleSelect(item.id);
              else navigation.navigate('UserChats', { chat: item, userRole });
            }}
            onLongPress={() => toggleSelect(item.id)}
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
              Delete {selectedIds.length === 1 ? 'chat' : `${selectedIds.length} chats`}?
            </Text>
            <Text style={s.modalDesc}>
              The conversation and its messages will be removed. This cannot be undone.
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
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.card,
  },
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
  name: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  subject: { fontSize: 13, fontWeight: '400', color: theme.colors.textMuted },
  time: { fontSize: 12, color: theme.colors.textMuted },
  timeUnread: { color: theme.colors.primary, fontWeight: '500' },
  last: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },
  lastUnread: { color: theme.colors.textPrimary, fontWeight: '500' },
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

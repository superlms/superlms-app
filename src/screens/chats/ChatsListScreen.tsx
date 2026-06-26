import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';

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

const ChatRow = ({
  item,
  isStudent,
  selected,
  onPress,
  onLongPress,
}: {
  item: ChatItem;
  isStudent: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) => (
  <TouchableOpacity
    style={[s.row, selected && s.rowSelected]}
    onPress={onPress}
    onLongPress={onLongPress}
    delayLongPress={2000}
    activeOpacity={0.7}
  >
    <View style={s.avatarWrap}>
      <Image source={{ uri: item.avatar }} style={s.avatar} />
      {selected ? (
        <View style={s.selectedDot}>
          <VectorIcon
            iconSet="Ionicons"
            iconName="checkmark"
            size={11}
            color="#fff"
          />
        </View>
      ) : (
        item.online && <View style={s.onlineDot} />
      )}
    </View>

    <View style={s.body}>
      <View style={s.topRow}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>
            {item.name}
          </Text>
          {/* subject badge only when student views teacher */}
          {isStudent && item.subject && (
            <View style={s.subjectBadge}>
              <Text style={s.subjectText}>{item.subject}</Text>
            </View>
          )}
        </View>
        <Text
          style={[s.time, item.unread > 0 && { color: theme.colors.primary }]}
        >
          {item.time}
        </Text>
      </View>

      <View style={s.bottomRow}>
        <Text
          style={[s.lastMsg, item.unread > 0 && s.lastMsgBold]}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
        {item.unread > 0 && (
          <View style={s.unreadBadge}>
            <Text style={s.unreadText}>{item.unread}</Text>
          </View>
        )}
      </View>
    </View>
  </TouchableOpacity>
);

const ChatsListScreen = ({ navigation, route }: any) => {
  const userRole: DrawerRole =
    route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

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

  const filteredChats = searchText.trim()
    ? chats.filter(
        c =>
          c.name.toLowerCase().includes(searchText.trim().toLowerCase()) ||
          (c.subject ?? '')
            .toLowerCase()
            .includes(searchText.trim().toLowerCase()),
      )
    : chats;

  const toggleSelect = (id: string) =>
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

  const deleteSelected = () => {
    setChats(prev => prev.filter(c => !selectedIds.includes(c.id)));
    setSelectedIds([]);
    setConfirmDelete(false);
  };

  return (
    <View style={s.root}>
      {/* ── Top bar ── */}
      <View style={s.topBar}>
        {selectionMode ? (
          <>
            <TouchableOpacity
              onPress={() => setSelectedIds([])}
              style={s.topIconBtn}
              activeOpacity={0.7}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName="close"
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
            <Text style={s.topTitle}>{selectedIds.length} selected</Text>
            <TouchableOpacity
              onPress={() => setConfirmDelete(true)}
              style={s.topIconBtn}
              activeOpacity={0.7}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName="trash-outline"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </>
        ) : searchOpen ? (
          <>
            <TouchableOpacity
              onPress={() => {
                setSearchOpen(false);
                setSearchText('');
              }}
              style={s.topIconBtn}
              activeOpacity={0.7}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName="arrow-back"
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
            <TextInput
              style={s.searchInput}
              placeholder="Search chats..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchText('')}
                style={s.topIconBtn}
                activeOpacity={0.7}
              >
                <VectorIcon
                  iconSet="Ionicons"
                  iconName="close-circle"
                  size={18}
                  color="rgba(255,255,255,0.8)"
                />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={s.topIconBtn}
              activeOpacity={0.7}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName="arrow-back"
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
            <Text style={s.topTitle}>Chats</Text>
            <TouchableOpacity
              onPress={() => setSearchOpen(true)}
              style={s.topIconBtn}
              activeOpacity={0.7}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName="search"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </>
        )}
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={i => i.id}
        contentContainerStyle={s.list}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ItemSeparatorComponent={() => <View style={s.separator} />}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="chatbubbles-outline"
              size={44}
              color={theme.colors.textMuted}
            />
            <Text style={s.emptyText}>No chats found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChatRow
            item={item}
            isStudent={userRole === 'student'}
            selected={selectedIds.includes(item.id)}
            onPress={() => {
              if (selectionMode) {
                toggleSelect(item.id);
              } else {
                navigation.navigate('UserChats', { chat: item, userRole });
              }
            }}
            onLongPress={() => toggleSelect(item.id)}
          />
        )}
      />

      {/* ── Delete confirmation (logout style) ── */}
      <Modal
        transparent
        visible={confirmDelete}
        animationType="fade"
        onRequestClose={() => setConfirmDelete(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalIconWrap}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="trash-outline"
                size={28}
                color={theme.colors.danger}
              />
            </View>

            <Text style={s.modalTitle}>Delete Chat{selectedIds.length > 1 ? 's' : ''}?</Text>
            <Text style={s.modalDesc}>
              {selectedIds.length} chat{selectedIds.length > 1 ? 's' : ''} will
              be deleted. This cannot be undone.
            </Text>

            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnGhost]}
                activeOpacity={0.85}
                onPress={() => setConfirmDelete(false)}
              >
                <Text style={[s.modalBtnText, s.modalBtnGhostText]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnDanger]}
                activeOpacity={0.9}
                onPress={deleteSelected}
              >
                <Text style={[s.modalBtnText, s.modalBtnDangerText]}>
                  Delete
                </Text>
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

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'ios' ? 52 : 14,
    paddingBottom: 12,
    gap: 4,
    elevation: 4,
  },
  topIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    paddingVertical: 6,
    marginLeft: 4,
  },

  list: { paddingVertical: 6, paddingBottom: 30, flexGrow: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: theme.colors.card,
  },
  rowSelected: {
    backgroundColor: theme.colors.primaryLight,
  },

  avatarWrap: { position: 'relative', marginRight: 13 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.card,
  },
  selectedDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  subjectBadge: {
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subjectText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  time: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '500' },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMsg: {
    fontSize: 14,
    color: theme.colors.textMuted,
    flex: 1,
    marginRight: 8,
  },
  lastMsgBold: { color: theme.colors.textSecondary, fontWeight: '600' },

  unreadBadge: {
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 79,
  },

  // Empty
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },

  // Delete confirmation modal (logout style)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.full,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  modalDesc: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { fontSize: 15, fontWeight: '700' },
  modalBtnGhost: { backgroundColor: theme.colors.border },
  modalBtnGhostText: { color: theme.colors.textPrimary },
  modalBtnDanger: { backgroundColor: theme.colors.danger },
  modalBtnDangerText: { color: theme.colors.white },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

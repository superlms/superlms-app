import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { DayLabel, chatColors as CH } from './chatUi';

type DrawerRole = 'student' | 'teacher';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
  status: 'sent' | 'delivered' | 'read';
}

// A message with what it needs to know about its neighbours, so a run from the
// same person reads as one block instead of six separate cards.
interface GroupedMessage extends Message {
  firstOfGroup: boolean;
  lastOfGroup: boolean;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    sender: 'other',
    text: 'Hello! How are you doing today?',
    time: '9:00 AM',
    status: 'read',
  },
  {
    id: '2',
    sender: 'me',
    text: 'Hi! I am doing well. I had a doubt in chapter 4.',
    time: '9:02 AM',
    status: 'read',
  },
  {
    id: '3',
    sender: 'other',
    text: 'Sure, go ahead. What is your doubt?',
    time: '9:03 AM',
    status: 'read',
  },
  {
    id: '4',
    sender: 'me',
    text: "I didn't understand Newton's 3rd law in the context of rockets.",
    time: '9:05 AM',
    status: 'read',
  },
  {
    id: '5',
    sender: 'other',
    text: "When a rocket expels gas downward, the reaction force pushes the rocket upward. That's Newton's 3rd law in action.",
    time: '9:07 AM',
    status: 'read',
  },
  {
    id: '6',
    sender: 'me',
    text: 'Oh! That makes sense now. Thank you so much!',
    time: '9:08 AM',
    status: 'read',
  },
  {
    id: '7',
    sender: 'other',
    text: 'You are welcome! Please submit your assignment by tomorrow.',
    time: '10:42 AM',
    status: 'delivered',
  },
];

const initials = (name?: string) =>
  (name ?? 'S')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// One tick when sent, two once it has landed; read turns them the accent colour.
const Ticks = ({ status }: { status: Message['status'] }) => (
  <VectorIcon
    iconSet="Ionicons"
    iconName={status === 'sent' ? 'checkmark' : 'checkmark-done'}
    size={13}
    color={status === 'read' ? CH.accent : CH.muted}
  />
);

// ── One message ──────────────────────────────────────────────────────────────
// Mine sit on a soft indigo wash, theirs on white behind a hairline. The side a
// bubble sits on is what says who wrote it — no tails, no shadows, no colour
// beyond the wash. Only the last bubble of a run carries the time.
const Bubble = ({
  msg,
  selected,
  selectionMode,
  onLongPress,
  onPress,
}: {
  msg: GroupedMessage;
  selected: boolean;
  selectionMode: boolean;
  onLongPress: () => void;
  onPress: () => void;
}) => {
  const isMe = msg.sender === 'me';
  return (
    <TouchableOpacity
      style={[
        s.bubbleWrap,
        isMe ? s.bubbleWrapMe : s.bubbleWrapOther,
        msg.firstOfGroup && s.bubbleWrapFirst,
        selected && s.bubbleWrapSelected,
      ]}
      onLongPress={onLongPress}
      onPress={selectionMode ? onPress : undefined}
      activeOpacity={selectionMode ? 0.7 : 1}
    >
      <View
        style={[
          s.bubble,
          isMe ? s.bubbleMe : s.bubbleOther,
          msg.lastOfGroup && (isMe ? s.bubbleTailMe : s.bubbleTailOther),
        ]}
      >
        <Text style={s.bubbleText}>{msg.text}</Text>
        {msg.lastOfGroup && (
          <View style={s.meta}>
            <Text style={s.metaTime}>{msg.time}</Text>
            {isMe && <Ticks status={msg.status} />}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const ChatsScreen = ({ navigation, route }: any) => {
  // chat item passed from ChatsListScreen
  const chat = route?.params?.chat ?? {
    name: 'Ravi Sharma',
    subject: 'Physics',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    online: true,
  };

  // userRole = who is logged in right now
  const userRole: DrawerRole = route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const listRef = useRef<FlatList>(null);

  const selectionMode = selectedIds.length > 0;

  // Android draws behind the keyboard, so the composer is lifted by hand.
  const liftStyle = useKeyboardLiftStyle();

  // Mark where each run of messages from one person starts and ends.
  const grouped = useMemo<GroupedMessage[]>(
    () =>
      messages.map((m, i) => ({
        ...m,
        firstOfGroup: i === 0 || messages[i - 1].sender !== m.sender,
        lastOfGroup: i === messages.length - 1 || messages[i + 1].sender !== m.sender,
      })),
    [messages],
  );

  // Keep the newest message in view as the keyboard opens.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    });
    return () => sub.remove();
  }, []);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'me',
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
      },
    ]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const deleteSelected = () => {
    setMessages(prev => prev.filter(m => !selectedIds.includes(m.id)));
    setSelectedIds([]);
    setConfirmDelete(false);
  };

  /*
    Subtitle rules:
    - logged in as STUDENT  → talking to a Teacher → show "Teacher · <subject>"
    - logged in as TEACHER  → talking to a Student → show "Student"
  */
  const subtitle = chat.online
    ? 'Online'
    : userRole === 'student'
    ? ['Teacher', chat.subject].filter(Boolean).join(' · ')
    : 'Student';

  const hasText = input.trim().length > 0;

  return (
    <Animated.View style={[s.root, liftStyle]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.statusBar} />

      {/* ── Who you are talking to ── */}
      <View style={s.topBar}>
        <TouchableOpacity
          style={s.backBtn}
          activeOpacity={0.7}
          onPress={() => (selectionMode ? setSelectedIds([]) : navigation.goBack())}
        >
          <VectorIcon
            iconSet="Ionicons"
            iconName={selectionMode ? 'close' : 'chevron-back'}
            size={22}
            color={CH.ink}
          />
        </TouchableOpacity>

        {selectionMode ? (
          <>
            <Text style={s.topName}>{selectedIds.length} selected</Text>
            <TouchableOpacity
              style={s.headBtn}
              activeOpacity={0.6}
              hitSlop={8}
              onPress={() => setConfirmDelete(true)}
            >
              <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={19} color={theme.colors.danger} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            {chat.avatar ? (
              <Image source={{ uri: chat.avatar }} style={s.topAvatar} />
            ) : (
              <View style={[s.topAvatar, s.topAvatarFallback]}>
                <Text style={s.topAvatarInitials}>{initials(chat.name)}</Text>
              </View>
            )}
            <View style={s.topInfo}>
              <Text style={s.topName} numberOfLines={1}>
                {chat.name}
              </Text>
              <Text style={s.topSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* ── Messages ── */}
      <FlatList
        ref={listRef}
        data={grouped}
        keyExtractor={m => m.id}
        contentContainerStyle={s.msgList}
        showsVerticalScrollIndicator={false}
        style={s.flex}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={<DayLabel label="Today" />}
        renderItem={({ item }) => (
          <Bubble
            msg={item}
            selected={selectedIds.includes(item.id)}
            selectionMode={selectionMode}
            onLongPress={() => toggleSelect(item.id)}
            onPress={() => toggleSelect(item.id)}
          />
        )}
      />

      {/* ── Write ── */}
      <View style={s.inputBar}>
        <View style={s.inputPill}>
          <TextInput
            style={s.input}
            placeholder="Message"
            placeholderTextColor={CH.muted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity activeOpacity={0.6} hitSlop={8}>
            <VectorIcon iconSet="Feather" iconName="paperclip" size={18} color={CH.muted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.sendBtn, hasText && s.sendBtnActive]}
          onPress={send}
          activeOpacity={0.85}
          disabled={!hasText}
        >
          <VectorIcon
            iconSet="Ionicons"
            iconName="arrow-up"
            size={19}
            color={hasText ? theme.colors.white : CH.muted}
          />
        </TouchableOpacity>
      </View>

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
              Delete {selectedIds.length === 1 ? 'message' : `${selectedIds.length} messages`}?
            </Text>
            <Text style={s.modalDesc}>
              They will be removed from this conversation. This cannot be undone.
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
    </Animated.View>
  );
};

export default ChatsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: CH.page },
  flex: { flex: 1 },

  // Top bar — the app's 50px bar, with a face on it
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: CH.surface,
    borderBottomWidth: 1,
    borderBottomColor: CH.surfaceLine,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CH.surfaceLine,
  },
  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  topAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: CH.page },
  topAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  topAvatarInitials: { fontSize: 13, fontWeight: '600', color: CH.sub },
  topInfo: { flex: 1 },
  topName: { flex: 1, fontSize: 15, fontWeight: '600', color: CH.ink },
  topSubtitle: { fontSize: 12, color: CH.muted, marginTop: 1 },

  // Messages
  msgList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },

  bubbleWrap: { maxWidth: '82%', marginTop: 2 },
  bubbleWrapFirst: { marginTop: 10 },
  bubbleWrapMe: { alignSelf: 'flex-end' },
  bubbleWrapOther: { alignSelf: 'flex-start' },
  bubbleWrapSelected: { opacity: 0.5 },
  bubble: {
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  bubbleMe: { backgroundColor: CH.mine, borderColor: CH.mineLine },
  bubbleOther: { backgroundColor: CH.surface, borderColor: CH.surfaceLine },
  // Only the closing bubble of a run squares off its corner.
  bubbleTailMe: { borderBottomRightRadius: 5 },
  bubbleTailOther: { borderBottomLeftRadius: 5 },
  bubbleText: { fontSize: 14.5, lineHeight: 21, color: CH.ink },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  metaTime: { fontSize: 10.5, color: CH.muted },

  // Write
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: CH.surfaceLine,
    backgroundColor: CH.surface,
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: CH.surfaceLine,
    borderRadius: theme.radius.md,
    backgroundColor: CH.page,
  },
  input: { flex: 1, fontSize: 15, color: CH.ink, padding: 0, maxHeight: 100 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CH.page,
    borderWidth: 1,
    borderColor: CH.surfaceLine,
  },
  sendBtnActive: { backgroundColor: CH.accent, borderColor: CH.accent },

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
    backgroundColor: CH.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: CH.ink },
  modalDesc: { marginTop: 8, fontSize: 14, color: CH.sub, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhost: { borderWidth: 1, borderColor: CH.surfaceLine },
  modalBtnGhostText: { fontSize: 15, fontWeight: '500', color: CH.ink },
  modalBtnDanger: { backgroundColor: theme.colors.danger },
  modalBtnDangerText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';

type DrawerRole = 'student' | 'teacher';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
  status: 'sent' | 'delivered' | 'read';
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

// One tick when sent, two once it has landed; read turns them white.
const Ticks = ({ status }: { status: Message['status'] }) => (
  <VectorIcon
    iconSet="Ionicons"
    iconName={status === 'sent' ? 'checkmark' : 'checkmark-done'}
    size={13}
    color={status === 'read' ? theme.colors.white : 'rgba(255,255,255,0.6)'}
  />
);

// ── One message ──────────────────────────────────────────────────────────────
// Mine are filled in the accent colour, theirs sit on the page's quiet grey.
// No tails, no shadows — the side it sits on is what says who wrote it.
const Bubble = ({
  msg,
  selected,
  selectionMode,
  onLongPress,
  onPress,
}: {
  msg: Message;
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
        selected && s.bubbleWrapSelected,
      ]}
      onLongPress={onLongPress}
      onPress={selectionMode ? onPress : undefined}
      activeOpacity={selectionMode ? 0.7 : 1}
    >
      <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
        <Text style={[s.bubbleText, isMe ? s.bubbleTextMe : s.bubbleTextOther]}>{msg.text}</Text>
        <View style={s.meta}>
          <Text style={[s.metaTime, isMe ? s.metaTimeMe : s.metaTimeOther]}>{msg.time}</Text>
          {isMe && <Ticks status={msg.status} />}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// A plain centred line, not a pill.
const DayLabel = ({ label }: { label: string }) => (
  <Text style={s.dayLabel}>{label.toUpperCase()}</Text>
);

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

  // Keep the latest messages visible when the keyboard opens
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
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
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
    >
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
            color={theme.colors.textPrimary}
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
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={s.msgList}
        showsVerticalScrollIndicator={false}
        style={s.flex}
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
            placeholderTextColor={theme.colors.textMuted}
            value={input}
            onChangeText={setInput}
            onFocus={() =>
              setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
            }
            multiline
            maxLength={500}
          />
          <TouchableOpacity activeOpacity={0.6} hitSlop={8}>
            <VectorIcon iconSet="Feather" iconName="paperclip" size={18} color={theme.colors.textMuted} />
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
            color={hasText ? theme.colors.white : theme.colors.textMuted}
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
    </KeyboardAvoidingView>
  );
};

export default ChatsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },

  // Top bar — the same 50px bar the rest of the app uses, with a face on it
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  topAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.background },
  topAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  topAvatarInitials: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  topInfo: { flex: 1 },
  topName: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  topSubtitle: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },

  // Messages
  msgList: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  dayLabel: {
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: theme.colors.textMuted,
    marginBottom: 14,
  },

  bubbleWrap: { marginBottom: 8, maxWidth: '82%' },
  bubbleWrapMe: { alignSelf: 'flex-end' },
  bubbleWrapOther: { alignSelf: 'flex-start' },
  bubbleWrapSelected: { opacity: 0.55 },
  bubble: { paddingHorizontal: 13, paddingTop: 9, paddingBottom: 7, borderRadius: 14 },
  bubbleMe: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: theme.colors.background, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14.5, lineHeight: 21 },
  bubbleTextMe: { color: theme.colors.white },
  bubbleTextOther: { color: theme.colors.textPrimary },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 },
  metaTime: { fontSize: 10 },
  metaTimeMe: { color: 'rgba(255,255,255,0.7)' },
  metaTimeOther: { color: theme.colors.textMuted },

  // Write
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  input: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, padding: 0, maxHeight: 100 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sendBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },

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

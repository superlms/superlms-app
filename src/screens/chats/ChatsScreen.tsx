import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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

const Ticks = ({ status }: { status: Message['status'] }) => (
  <VectorIcon
    iconSet="Ionicons"
    iconName={status === 'sent' ? 'checkmark' : 'checkmark-done'}
    size={14}
    color={status === 'read' ? '#A5B4FC' : 'rgba(255,255,255,0.6)'}
  />
);

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
      delayLongPress={2000}
      activeOpacity={selectionMode ? 0.7 : 1}
    >
      <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
        <Text style={[s.bubbleText, isMe ? s.bubbleTextMe : s.bubbleTextOther]}>
          {msg.text}
        </Text>
        <View style={s.meta}>
          <Text style={[s.metaTime, isMe ? s.metaTimeMe : s.metaTimeOther]}>
            {msg.time}
          </Text>
          {isMe && <Ticks status={msg.status} />}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const DateChip = ({ label }: { label: string }) => (
  <View style={s.chipWrap}>
    <View style={s.dateChip}>
      <Text style={s.dateChipText}>{label}</Text>
    </View>
  </View>
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
  const userRole: DrawerRole =
    route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const listRef = useRef<FlatList>(null);

  const selectionMode = selectedIds.length > 0;

  // Keep the latest messages visible when the keyboard opens
  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
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
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: 'sent',
      },
    ]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const toggleSelect = (id: string) =>
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );

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
    ? 'online'
    : userRole === 'student'
    ? `Teacher · ${chat.subject ?? ''}`
    : 'Student';

  const hasText = input.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
    >
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
            <Text style={s.selectionTitle}>
              {selectedIds.length} selected
            </Text>
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

            <Image source={{ uri: chat.avatar }} style={s.topAvatar} />

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
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
        ListHeaderComponent={<DateChip label="Today" />}
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

      {/* ── Input bar ── */}
      <View style={s.inputBar}>
        <View style={s.inputPill}>
          <TextInput
            style={s.input}
            placeholder="Message"
            placeholderTextColor={theme.colors.textMuted}
            value={input}
            onChangeText={setInput}
            onFocus={() =>
              setTimeout(
                () => listRef.current?.scrollToEnd({ animated: true }),
                100,
              )
            }
            multiline
            maxLength={500}
          />
          <TouchableOpacity activeOpacity={0.7}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="attach"
              size={22}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.sendBtn, hasText && s.sendBtnActive]}
          onPress={send}
          activeOpacity={0.85}
        >
          <VectorIcon
            iconSet="Ionicons"
            iconName="send"
            size={18}
            color={hasText ? '#fff' : theme.colors.textMuted}
          />
        </TouchableOpacity>
      </View>

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

            <Text style={s.modalTitle}>
              Delete Message{selectedIds.length > 1 ? 's' : ''}?
            </Text>
            <Text style={s.modalDesc}>
              {selectedIds.length} message{selectedIds.length > 1 ? 's' : ''}{' '}
              will be deleted. This cannot be undone.
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
    </KeyboardAvoidingView>
  );
};

export default ChatsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EEF2FF' },
  flex: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'ios' ? 52 : 14,
    paddingBottom: 12,
    gap: 8,
    elevation: 4,
  },
  topIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  topInfo: { flex: 1, marginLeft: 2 },
  topName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  topSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '500',
    marginTop: 1,
  },
  selectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 4,
  },

  msgList: { paddingHorizontal: 12, paddingBottom: 8, paddingTop: 4 },

  // Date chip
  chipWrap: { alignItems: 'center', marginVertical: 10 },
  dateChip: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateChipText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },

  // Bubbles
  bubbleWrap: { marginBottom: 4, borderRadius: theme.radius.sm },
  bubbleWrapMe: { alignItems: 'flex-end' },
  bubbleWrapOther: { alignItems: 'flex-start' },
  bubbleWrapSelected: {
    backgroundColor: `${theme.colors.primary}26`,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingTop: 7,
    paddingBottom: 5,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  bubbleMe: {
    backgroundColor: theme.colors.primary,
    borderTopRightRadius: 2,
  },
  bubbleOther: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 2,
  },
  bubbleText: { fontSize: 14.5, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextOther: { color: theme.colors.textPrimary },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-end',
    marginTop: 2,
    marginLeft: 8,
  },
  metaTime: { fontSize: 10.5 },
  metaTimeMe: { color: 'rgba(255,255,255,0.65)' },
  metaTimeOther: { color: theme.colors.textMuted },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: theme.colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
    elevation: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    maxHeight: 110,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    elevation: 3,
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { Skeleton, SkeletonText } from '../../components/Skeleton';
import { AppAlert } from '../../components/AppDialog';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { pickDocument, pickImage } from '../../utils/filePickers';
import type { PickedFile } from '../../api/adminProfileApi';
import {
  type ChatMessage,
  type ChatPerson,
  type ChatThread,
  chatErrorMessage,
  deleteChatMessages,
  getChatThread,
  pinChatMessages,
  sendChatMessage,
} from '../../api/chatApi';
import { clearChatNotifications } from '../../notifications/chatNotifications';
import { DayLabel, chatColors as CH, dayLabelFor } from './chatUi';
import { onChatPush, setOpenChat } from './chatEvents';
import { bubbleTime, fileSize, SAMPLE_MESSAGES } from './chatFormat';

// The clipboard is a native module; it is required lazily so a build without it
// still runs, and Copy then says to update the app.
let Clipboard: any = null;
try {
  Clipboard = require('@react-native-clipboard/clipboard').default;
} catch {
  Clipboard = null;
}

type DrawerRole = 'student' | 'teacher';

// While a conversation is open it checks for new messages this often; a push
// brings one in straight away.
const POLL_MS = 3000;

// Read ticks, as the message's other person has seen it.
const READ_GREEN = '#16A34A';

// A message on screen: one the school has, or one of mine still on its way.
interface LocalMessage extends ChatMessage {
  pending?: boolean;
  failed?: boolean;
  // What a message still on its way carries, to send it again.
  file?: PickedFile | null;
}

// A message with what it needs to know about its neighbours, so a run from the
// same person reads as one block and each day opens with its label.
interface Row extends LocalMessage {
  firstOfGroup: boolean;
  lastOfGroup: boolean;
  day: string | null;
}

const isSent = (m: LocalMessage) => !m.pending && !m.failed;

// The messages the school has, oldest first, then mine still on their way.
const merge = (current: LocalMessage[], incoming: ChatMessage[]): LocalMessage[] => {
  const byId = new Map<number, LocalMessage>();
  current.filter(isSent).forEach(m => byId.set(m.id, m));
  incoming.forEach(m => byId.set(m.id, m));
  return [...[...byId.values()].sort((a, b) => a.id - b.id), ...current.filter(m => !isSent(m))];
};

const RANK = { sent: 0, delivered: 1, read: 2 } as const;

// How far the other person has got with mine — ticks only ever move forward.
const withReceipts = (list: LocalMessage[], receipts?: ChatThread['receipts']): LocalMessage[] =>
  !receipts
    ? list
    : list.map(m => {
        if (!m.mine || !isSent(m)) return m;
        const reached = m.id <= receipts.read_up_to ? 'read' : m.id <= receipts.delivered_up_to ? 'delivered' : 'sent';
        return RANK[reached] > RANK[m.status] ? { ...m, status: reached } : m;
      });

const sameList = (a: LocalMessage[], b: LocalMessage[]) => a.length === b.length && a.every((m, i) => m === b[i]);

const samePins = (a: ChatMessage[], b: ChatMessage[]) =>
  a.length === b.length && a.every((m, i) => m.id === b[i].id);

// What a message says in one line: its words, or what it carries.
const previewOf = (m: ChatMessage) => m.body || (m.attachment?.type === 'image' ? 'Photo' : 'File');

const toast = (message: string) =>
  Platform.OS === 'android' ? ToastAndroid.show(message, ToastAndroid.SHORT) : AppAlert.alert(message);

const initials = (name?: string) =>
  (name ?? 'S')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// A clock while mine is on its way, a warning if it did not go; then one grey
// tick when sent, two once it has reached them, and two green once read.
const Ticks = ({ msg }: { msg: LocalMessage }) =>
  msg.failed ? (
    <VectorIcon iconSet="Ionicons" iconName="alert-circle" size={13} color={theme.colors.danger} />
  ) : msg.pending ? (
    <VectorIcon iconSet="Ionicons" iconName="time-outline" size={12} color={CH.muted} />
  ) : (
    <VectorIcon
      iconSet="Ionicons"
      iconName={msg.status === 'sent' ? 'checkmark' : 'checkmark-done'}
      size={14}
      color={msg.status === 'read' ? READ_GREEN : CH.muted}
    />
  );

// ── One message ──────────────────────────────────────────────────────────────
// Mine sit on a soft indigo wash, theirs on white behind a hairline. A photo
// shows in the bubble and a document as its name and size; either opens in the
// phone's viewer. A forwarded copy says so on top, a pinned one carries a pin
// by its time. As a skeleton, each bubble is a grey block its own size.
const Bubble = ({
  msg,
  pinned,
  skeleton,
  selected,
  selectionMode,
  onPress,
  onLongPress,
  onRetry,
}: {
  msg: Row;
  pinned: boolean;
  skeleton?: boolean;
  selected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onRetry: () => void;
}) => {
  const isMe = msg.mine;
  const file = msg.attachment;

  const open = () => {
    if (!file?.url) return;
    Linking.openURL(file.url).catch(() => AppAlert.alert('Error', 'Unable to open this file on this device.'));
  };
  const tapFile = selectionMode ? onPress : open;

  return (
    <>
      {!!msg.day &&
        (skeleton ? (
          <View style={s.dayWrap}>
            <SkeletonText style={s.dayText}>{msg.day.toUpperCase()}</SkeletonText>
          </View>
        ) : (
          <DayLabel label={msg.day} />
        ))}

      <TouchableOpacity
        style={[
          s.bubbleWrap,
          isMe ? s.bubbleWrapMe : s.bubbleWrapOther,
          msg.firstOfGroup && s.bubbleWrapFirst,
          selected && s.bubbleWrapSelected,
        ]}
        onLongPress={onLongPress}
        onPress={selectionMode ? onPress : msg.failed ? onRetry : undefined}
        activeOpacity={selectionMode || msg.failed ? 0.7 : 1}
        disabled={skeleton}
      >
        <View
          style={[
            s.bubble,
            isMe ? s.bubbleMe : s.bubbleOther,
            msg.lastOfGroup && (isMe ? s.bubbleTailMe : s.bubbleTailOther),
            skeleton && s.unseen,
          ]}
        >
          {msg.forwarded && (
            <View style={s.forwarded}>
              <VectorIcon iconSet="Ionicons" iconName="arrow-redo" size={11} color={CH.muted} />
              <Text style={s.forwardedText}>Forwarded</Text>
            </View>
          )}
          {file?.type === 'image' && (
            <TouchableOpacity activeOpacity={0.85} onPress={tapFile} onLongPress={onLongPress} disabled={skeleton}>
              {file.url && !skeleton ? <Image source={{ uri: file.url }} style={s.photo} /> : <View style={s.photo} />}
            </TouchableOpacity>
          )}
          {file?.type === 'file' && (
            <TouchableOpacity
              style={s.file}
              activeOpacity={0.7}
              onPress={tapFile}
              onLongPress={onLongPress}
              disabled={skeleton}
            >
              <VectorIcon iconSet="Ionicons" iconName="document-text-outline" size={22} color={CH.accent} />
              <View style={s.fileText}>
                <Text style={s.fileName} numberOfLines={1}>
                  {file.name || 'File'}
                </Text>
                {!!file.size && <Text style={s.fileSize}>{fileSize(file.size)}</Text>}
              </View>
            </TouchableOpacity>
          )}
          {!!msg.body && <Text style={[s.bubbleText, !!file && s.bubbleTextAfter]}>{msg.body}</Text>}
          {(msg.lastOfGroup || pinned) && (
            <View style={s.meta}>
              {pinned && <VectorIcon iconSet="Ionicons" iconName="pin" size={10} color={CH.muted} />}
              <Text style={s.metaTime}>{bubbleTime(msg.created_at)}</Text>
              {isMe && <Ticks msg={msg} />}
            </View>
          )}
        </View>
        {skeleton && <Skeleton radius={16} style={s.fillBox} />}
      </TouchableOpacity>

      {msg.failed && <Text style={s.failedText}>Not sent · Tap to try again</Text>}
    </>
  );
};

// A header button in selection mode.
const HeadBtn = ({ icon, color, onPress }: { icon: string; color?: string; onPress: () => void }) => (
  <TouchableOpacity style={s.headBtn} activeOpacity={0.6} hitSlop={8} onPress={onPress}>
    <VectorIcon iconSet="Ionicons" iconName={icon} size={20} color={color ?? CH.ink} />
  </TouchableOpacity>
);

const ChatsScreen = ({ navigation, route }: any) => {
  // Who this conversation is with — from the chats, an instructor or a push.
  const contact: ChatPerson | undefined = route?.params?.contact;
  const userId = contact?.user_id;
  // userRole = who is logged in right now
  const userRole: DrawerRole = route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const messagesRef = useRef<LocalMessage[]>([]);
  messagesRef.current = messages;

  // The skeleton shows while the conversation first loads and on a pull to
  // refresh; new messages come in quietly after that.
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [last, rememberLast] = useLastLoaded<ChatMessage[]>(userId ? `chat:${userId}` : null);
  // Pinned messages, the latest pin first, and which one the pin bar shows.
  const [pins, setPins] = useState<ChatMessage[]>([]);
  const [pinIndex, setPinIndex] = useState(0);

  const [input, setInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const listRef = useRef<FlatList>(null);
  // Follow the newest message unless the reader has scrolled up to older ones.
  const atBottom = useRef(true);
  const checking = useRef(false);

  const selectionMode = selectedIds.length > 0;

  // Android draws behind the keyboard, so the composer is lifted by hand.
  const liftStyle = useKeyboardLiftStyle();

  const takePins = useCallback((thread: ChatThread) => {
    if (!thread.pinned) return;
    const next = thread.pinned;
    setPins(prev => (samePins(prev, next) ? prev : next));
  }, []);

  const loadLatest = useCallback(
    async (showSkeleton = false) => {
      if (!userId) return;
      if (showSkeleton) setLoading(true);
      try {
        const thread = await getChatThread(userId);
        atBottom.current = true;
        setMessages(prev => withReceipts(merge(prev.filter(m => !isSent(m)), thread.messages), thread.receipts));
        takePins(thread);
        setHasMore(thread.has_more);
        setError(null);
        setLoaded(true);
        loadedRef.current = true;
      } catch (e: any) {
        console.log('[ChatsScreen] load failed:', e?.response?.status, e?.message);
        if (!loadedRef.current) setError(chatErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [userId, takePins],
  );

  // New messages since the newest on screen, how far mine have got, and the pins.
  const checkNew = useCallback(async () => {
    if (!userId || !loadedRef.current || checking.current || AppState.currentState !== 'active') return;
    checking.current = true;
    try {
      const newest = messagesRef.current.reduce((max, m) => (isSent(m) ? Math.max(max, m.id) : max), 0);
      const thread = await getChatThread(userId, newest > 0 ? { afterId: newest } : {});
      setMessages(prev => {
        const next = withReceipts(merge(prev, thread.messages), thread.receipts);
        return sameList(prev, next) ? prev : next;
      });
      takePins(thread);
    } catch {
      // The next check tries again.
    } finally {
      checking.current = false;
    }
  }, [userId, takePins]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  // While the conversation is on screen: its notification is cleared, new
  // messages are checked for, a push from this person is fetched at once, and
  // their pushes raise no notification.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setOpenChat(userId);
      clearChatNotifications(userId);
      const timer = setInterval(checkNew, POLL_MS);
      const off = onChatPush(from => {
        if (from === userId) checkNew();
      });
      return () => {
        setOpenChat(null);
        clearInterval(timer);
        off();
      };
    }, [userId, checkNew]),
  );

  // Kept for the conversation's next first load: the latest messages, no file links.
  useEffect(() => {
    if (!loaded) return;
    rememberLast(
      messages
        .filter(isSent)
        .slice(-30)
        .map(m => ({ ...m, attachment: m.attachment ? { ...m.attachment, url: null } : null })),
    );
  }, [loaded, messages, rememberLast]);

  // Keep the newest message in view as the keyboard opens.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    });
    return () => sub.remove();
  }, []);

  const loadOlder = async () => {
    const oldest = messagesRef.current.find(isSent);
    if (!userId || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    atBottom.current = false;
    try {
      const thread = await getChatThread(userId, { beforeId: oldest.id });
      setMessages(prev => merge(prev, thread.messages));
      setHasMore(thread.has_more);
    } catch (e: any) {
      AppAlert.alert('Could not load earlier messages', chatErrorMessage(e));
    } finally {
      setLoadingOlder(false);
    }
  };

  // Send what is typed, with a file when one is picked — or send again one that failed.
  const send = async (file?: PickedFile | null, retryOf?: LocalMessage) => {
    if (!userId) return;
    const body = retryOf ? retryOf.body ?? '' : input.trim();
    const attachment = retryOf ? retryOf.file ?? null : file ?? null;
    if (!body && !attachment) return;

    const temp: LocalMessage = {
      id: -Date.now(),
      body: body || null,
      mine: true,
      created_at: new Date().toISOString(),
      status: 'sent',
      attachment: attachment
        ? {
            type: attachment.type?.startsWith('image/') ? 'image' : 'file',
            name: attachment.name ?? null,
            size: null,
            url: attachment.uri,
          }
        : null,
      pending: true,
      file: attachment,
    };

    if (!retryOf) setInput('');
    atBottom.current = true;
    setMessages(prev => [...prev.filter(m => m.id !== retryOf?.id), temp]);

    try {
      const saved = await sendChatMessage(userId, { body: temp.body ?? undefined, file: attachment });
      setMessages(prev => merge(prev.filter(m => m.id !== temp.id), [saved]));
    } catch (e: any) {
      setMessages(prev => prev.map(m => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
      AppAlert.alert('Message not sent', chatErrorMessage(e));
    }
  };

  const attach = () =>
    AppAlert.alert('Send a file', 'Choose what to send.', [
      {
        text: 'Photo',
        onPress: async () => {
          const f = await pickImage();
          if (f) send(f);
        },
      },
      {
        text: 'Document',
        onPress: async () => {
          const f = await pickDocument();
          if (f) send(f);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  // ── Selected messages: pin, copy, forward, delete ─────────────────────────
  const toggleSelect = (id: number) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const pinnedIds = useMemo(() => new Set(pins.map(m => m.id)), [pins]);
  const selectedMessages = messages.filter(m => selectedIds.includes(m.id));
  const allPinned = selectedMessages.length > 0 && selectedMessages.every(m => pinnedIds.has(m.id));
  const canCopy = selectedMessages.some(m => !!m.body);

  const pinSelected = async () => {
    const ids = selectedIds;
    const chosen = selectedMessages;
    setSelectedIds([]);
    try {
      const res = await pinChatMessages(ids);
      setPins(prev =>
        res.pinned
          ? [...chosen.filter(m => !prev.some(p => p.id === m.id)), ...prev]
          : prev.filter(m => !ids.includes(m.id)),
      );
      setPinIndex(0);
      const what = ids.length > 1 ? 'Messages' : 'Message';
      toast(res.pinned ? `${what} pinned` : `${what} unpinned`);
    } catch (e: any) {
      AppAlert.alert('Could not pin', chatErrorMessage(e));
    }
  };

  const copySelected = () => {
    const text = selectedMessages
      .map(m => m.body)
      .filter(Boolean)
      .join('\n');
    const count = selectedMessages.length;
    setSelectedIds([]);
    if (!text) return;
    try {
      Clipboard.setString(text);
      toast(count > 1 ? 'Messages copied' : 'Message copied');
    } catch {
      AppAlert.alert('Update the app', 'Copying messages needs the latest version of the app.');
    }
  };

  const forwardSelected = () => {
    const ids = selectedIds.filter(id => id > 0);
    setSelectedIds([]);
    if (ids.length) navigation.navigate('ForwardChat', { ids, userRole });
  };

  const deleteSelected = async () => {
    const ids = selectedIds;
    setConfirmDelete(false);
    setSelectedIds([]);
    setMessages(prev => prev.filter(m => !ids.includes(m.id)));
    setPins(prev => prev.filter(m => !ids.includes(m.id)));
    try {
      await deleteChatMessages(ids);
    } catch (e: any) {
      AppAlert.alert('Could not delete', chatErrorMessage(e));
      loadLatest();
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    atBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
  };

  // While it loads, the conversation is drawn as a skeleton from the messages it
  // shows — or, before its first load, from what it held last time on this phone.
  const source: LocalMessage[] = loading
    ? loaded
      ? messages
      : Array.isArray(last)
      ? last
      : SAMPLE_MESSAGES
    : messages;

  // Mark where each run of messages from one person starts and ends, and where each day begins.
  const rows = useMemo<Row[]>(
    () =>
      source.map((m, i) => {
        const prev = source[i - 1];
        const next = source[i + 1];
        const day = dayLabelFor(m.created_at);
        const newDay = !prev || dayLabelFor(prev.created_at) !== day;
        return {
          ...m,
          day: newDay ? day : null,
          firstOfGroup: newDay || prev.mine !== m.mine,
          lastOfGroup: !next || next.mine !== m.mine || dayLabelFor(next.created_at) !== day,
        };
      }),
    [source],
  );

  // The pin bar shows one pinned message; a tap takes the list to it and the
  // bar on to the next pin.
  const pin = pins.length ? pins[pinIndex % pins.length] : null;
  const showPin = () => {
    if (!pin) return;
    const index = rows.findIndex(r => r.id === pin.id);
    if (index >= 0) {
      atBottom.current = false;
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    }
    setPinIndex(i => i + 1);
  };

  if (!contact) {
    return (
      <View style={s.root}>
        <View style={s.topBar}>
          <TouchableOpacity style={s.backBtn} activeOpacity={0.7} onPress={() => navigation.goBack()}>
            <VectorIcon iconSet="Ionicons" iconName="chevron-back" size={22} color={CH.ink} />
          </TouchableOpacity>
        </View>
        <View style={s.centered}>
          <Text style={s.emptyTitle}>Chat not found</Text>
        </View>
      </View>
    );
  }

  /*
    Subtitle rules:
    - logged in as STUDENT  → talking to a Teacher → "Teacher · <subjects>"
    - logged in as TEACHER  → talking to a Student → "Student · <class>"
  */
  const subtitle = [userRole === 'student' ? 'Teacher' : 'Student', contact.subtitle].filter(Boolean).join(' · ');

  const hasText = input.trim().length > 0;

  return (
    <Animated.View style={[s.root, liftStyle]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.statusBar} />

      {/* ── Who you are talking to — or, while picking, what to do with the picked ── */}
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
            <Text style={s.topName}>{selectedIds.length}</Text>
            <View style={s.headActions}>
              <HeadBtn icon={allPinned ? 'pin' : 'pin-outline'} onPress={pinSelected} />
              {canCopy && <HeadBtn icon="copy-outline" onPress={copySelected} />}
              <HeadBtn icon="arrow-redo-outline" onPress={forwardSelected} />
              <HeadBtn icon="trash-outline" color={theme.colors.danger} onPress={() => setConfirmDelete(true)} />
            </View>
          </>
        ) : (
          <>
            {contact.avatar ? (
              <Image source={{ uri: contact.avatar }} style={s.topAvatar} />
            ) : (
              <View style={[s.topAvatar, s.topAvatarFallback]}>
                <Text style={s.topAvatarInitials}>{initials(contact.name)}</Text>
              </View>
            )}
            <View style={s.topInfo}>
              <Text style={s.topInfoName} numberOfLines={1}>
                {contact.name}
              </Text>
              <Text style={s.topSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* ── The pinned message ── */}
      {!loading && !!pin && (
        <TouchableOpacity style={s.pinBar} activeOpacity={0.7} onPress={showPin}>
          <VectorIcon iconSet="Ionicons" iconName="pin" size={15} color={CH.accent} />
          <View style={s.pinText}>
            <Text style={s.pinLabel}>
              {pins.length > 1 ? `Pinned message ${(pinIndex % pins.length) + 1} of ${pins.length}` : 'Pinned message'}
            </Text>
            <Text style={s.pinBody} numberOfLines={1}>
              {previewOf(pin)}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Messages ── */}
      {error && !loaded && !loading ? (
        <View style={s.centered}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={CH.muted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadLatest(true)} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={m => String(m.id)}
          contentContainerStyle={[s.msgList, rows.length === 0 && s.msgListEmpty]}
          showsVerticalScrollIndicator={false}
          style={s.flex}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!loading}
          onScroll={onScroll}
          scrollEventThrottle={100}
          // Earlier messages load above without moving what is being read.
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          onContentSizeChange={() => {
            if (atBottom.current) listRef.current?.scrollToEnd({ animated: false });
          }}
          onScrollToIndexFailed={info =>
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true })
          }
          // The skeleton stands in for the spinner.
          refreshControl={<AppRefreshControl refreshing={false} onRefresh={() => loadLatest(true)} />}
          ListHeaderComponent={
            !loading && hasMore ? (
              <TouchableOpacity style={s.earlier} activeOpacity={0.7} disabled={loadingOlder} onPress={loadOlder}>
                {loadingOlder ? (
                  <ActivityIndicator size="small" color={CH.accent} />
                ) : (
                  <Text style={s.earlierText}>Earlier messages</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={s.centered}>
                <Text style={s.emptyTitle}>No messages yet</Text>
                <Text style={s.emptySub}>Say hello to {contact.name}.</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Bubble
              msg={item}
              pinned={pinnedIds.has(item.id)}
              skeleton={loading}
              selected={selectedIds.includes(item.id)}
              selectionMode={selectionMode}
              onLongPress={() => isSent(item) && toggleSelect(item.id)}
              onPress={() => isSent(item) && toggleSelect(item.id)}
              onRetry={() => send(null, item)}
            />
          )}
        />
      )}

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
            maxLength={2000}
          />
          <TouchableOpacity activeOpacity={0.6} hitSlop={8} onPress={attach}>
            <VectorIcon iconSet="Feather" iconName="paperclip" size={18} color={CH.muted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.sendBtn, hasText && s.sendBtnActive]}
          onPress={() => send()}
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
              They will be removed for you. {contact.name} keeps their copy.
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
  headBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: CH.page },
  topAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  topAvatarInitials: { fontSize: 13, fontWeight: '600', color: CH.sub },
  // The name and the line under it sit together, centred on the photo.
  topInfo: { flex: 1, justifyContent: 'center' },
  topInfoName: { fontSize: 15, lineHeight: 19, fontWeight: '600', color: CH.ink },
  topName: { flex: 1, fontSize: 16, fontWeight: '600', color: CH.ink },
  topSubtitle: { fontSize: 12, lineHeight: 15, color: CH.muted },

  // Pin bar
  pinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    backgroundColor: CH.surface,
    borderBottomWidth: 1,
    borderBottomColor: CH.surfaceLine,
  },
  pinText: { flex: 1 },
  pinLabel: { fontSize: 11.5, fontWeight: '600', color: CH.accent },
  pinBody: { fontSize: 13, color: CH.sub, marginTop: 1 },

  // Messages
  msgList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  msgListEmpty: { flexGrow: 1 },
  earlier: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14, marginBottom: 4 },
  earlierText: { fontSize: 13, fontWeight: '600', color: CH.accent },

  // A day's label as a skeleton — the same type as DayLabel
  dayWrap: { alignSelf: 'center' },
  dayText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 6, marginBottom: 14 },

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
  bubbleTextAfter: { marginTop: 8 },
  forwarded: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  forwardedText: { fontSize: 11.5, fontStyle: 'italic', color: CH.muted },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  metaTime: { fontSize: 10.5, color: CH.muted },
  failedText: { alignSelf: 'flex-end', fontSize: 11, color: theme.colors.danger, marginTop: 3 },

  // Attachments
  photo: { width: 220, height: 165, borderRadius: 12, backgroundColor: CH.page },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180, paddingVertical: 2 },
  fileText: { flexShrink: 1 },
  fileName: { fontSize: 14, fontWeight: '500', color: CH.ink },
  fileSize: { fontSize: 11.5, color: CH.muted, marginTop: 1 },

  // A bubble as a skeleton: laid out unseen, under a grey block
  unseen: { opacity: 0 },
  fillBox: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },

  // Empty, error
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: CH.ink },
  emptySub: { fontSize: 13, color: CH.muted, textAlign: 'center' },
  errorText: { fontSize: 14, color: CH.sub, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: CH.accent },

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

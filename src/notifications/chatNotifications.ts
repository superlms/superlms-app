// ─────────────────────────────────────────────────────────────────────────────
//  Chat notifications, the way WhatsApp shows them.
//
//  Each conversation has one notification. Every message that arrives while it
//  is unread goes into that same box, one line after another, and each still
//  plays the sound and pops up. With messages from more than one person, the
//  boxes are gathered under a summary ("5 messages from 2 chats"). Opening the
//  conversation clears its box. Chat messages stay out of the in-app inbox.
//
//  The lines are kept in storage, since a push can arrive while the app is shut.
//
//  With several accounts signed in on the phone, each account's conversations
//  have their own boxes, and a message for an account other than the active
//  one names that account under the sender.
// ─────────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import notifee, { AndroidGroupAlertBehavior, AndroidImportance, AndroidStyle } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveUserId } from '../utils/accountStore';
import {
  CHANNEL_ID,
  NOTIFICATION_COLOR,
  NOTIFICATION_ICON,
  SOUND_ANDROID,
  SOUND_IOS,
  ensureChannel,
  notificationsEnabled,
} from './service';

const STORE_KEY = 'chat_notifications';
const GROUP_ID = 'superlms-chats';
const SUMMARY_ID = 'chat_summary';
// The phone shows only the last few lines of a conversation.
const MAX_LINES = 20;

interface Line {
  text: string;
  at: number;
}

interface Thread {
  name: string;
  lines: Line[];
  // What opens the conversation: { contact, userRole }.
  params: Record<string, any>;
}

type Threads = Record<string, Thread>;

const readThreads = async (): Promise<Threads> => {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeThreads = (threads: Threads) => AsyncStorage.setItem(STORE_KEY, JSON.stringify(threads)).catch(() => {});

export const chatNotificationId = (userId: number | string) => `chat_${userId}`;

// One box per conversation — per account, when the push says which account it is for.
const threadKey = (accountId: number | null | undefined, fromUserId: number) =>
  accountId ? `${accountId}_${fromUserId}` : String(fromUserId);

/** A chat message arrived: add it to its conversation's box, with the sound. */
export async function showChatMessage(input: {
  fromUserId: number;
  // The account on this phone it was sent to, and its name when that isn't the active one.
  accountId?: number | null;
  accountName?: string | null;
  name: string;
  text: string;
  params: Record<string, any>;
}): Promise<void> {
  if (!(await notificationsEnabled())) return;

  const threads = await readThreads();
  const key = threadKey(input.accountId, input.fromUserId);
  const previous = threads[key]?.lines ?? [];
  threads[key] = {
    name: input.name,
    params: input.params,
    lines: [...previous, { text: input.text, at: Date.now() }].slice(-MAX_LINES),
  };
  await writeThreads(threads);

  try {
    await ensureChannel();
    await notifee.displayNotification({
      id: chatNotificationId(key),
      title: input.name,
      // Whose message it is, when it isn't the active account's.
      subtitle: input.accountName ?? undefined,
      body: input.text,
      data: { screen: 'UserChats', params: JSON.stringify(input.params), chatFrom: key },
      android: {
        channelId: CHANNEL_ID,
        smallIcon: NOTIFICATION_ICON,
        color: NOTIFICATION_COLOR,
        sound: SOUND_ANDROID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        groupId: GROUP_ID,
        // Every new message alerts, not only the first of the box.
        onlyAlertOnce: false,
        groupAlertBehavior: AndroidGroupAlertBehavior.CHILDREN,
        timestamp: Date.now(),
        showTimestamp: true,
        style: {
          type: AndroidStyle.MESSAGING,
          person: { name: 'You' },
          messages: threads[key].lines.map(line => ({
            text: line.text,
            timestamp: line.at,
            person: { name: input.name, id: key },
          })),
        },
      },
      ios: {
        sound: SOUND_IOS,
        threadId: chatNotificationId(key),
      },
    });
    await showSummary(threads);
  } catch {
    // Native module missing / not configured — nothing to show.
  }
}

/** The active account's conversation is open: its box goes, and the summary follows. */
export async function clearChatNotifications(fromUserId: number): Promise<void> {
  const threads = await readThreads();
  // The active account's box, and one kept before boxes were per account.
  const keys = [...new Set([threadKey(await getActiveUserId(), fromUserId), String(fromUserId)])];
  const cleared = keys.filter(key => threads[key]);
  if (cleared.length) {
    cleared.forEach(key => delete threads[key]);
    await writeThreads(threads);
  }
  try {
    await Promise.all(keys.map(key => notifee.cancelNotification(chatNotificationId(key))));
    await showSummary(threads);
  } catch {
    // Nothing shown to clear.
  }
}

// With more than one conversation waiting, a summary heads their boxes (Android).
async function showSummary(threads: Threads): Promise<void> {
  const waiting = Object.values(threads);
  if (Platform.OS !== 'android' || waiting.length < 2) {
    await notifee.cancelNotification(SUMMARY_ID);
    return;
  }

  const messages = waiting.reduce((n, t) => n + t.lines.length, 0);
  await notifee.displayNotification({
    id: SUMMARY_ID,
    title: 'Chats',
    body: `${messages} messages from ${waiting.length} chats`,
    data: {
      screen: 'ChatsList',
      params: JSON.stringify({ userRole: waiting[0]?.params?.userRole }),
    },
    android: {
      channelId: CHANNEL_ID,
      smallIcon: NOTIFICATION_ICON,
      color: NOTIFICATION_COLOR,
      groupId: GROUP_ID,
      groupSummary: true,
      groupAlertBehavior: AndroidGroupAlertBehavior.CHILDREN,
      pressAction: { id: 'default' },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Push (FCM) — Phase 2.
//
//  Everything funnels through the same `notify()` used by in-app notifications,
//  so a pushed message behaves identically (inbox + unread badge + custom sound).
//
//  Backend contract: send **data-only** FCM messages (no `notification` block) so
//  this app — not the OS — renders them, giving us the custom sound + inbox entry
//  in every state. Expected data payload (all values are strings over FCM):
//     { type, title?, body?, screen?, params?, ...extra }
//  `params` may be a JSON-encoded string; it is parsed if present.
//
//  Every account signed in on the phone (Switch account) is registered for the
//  phone's token, so each gets its pushes here, not only the active one.
// ─────────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notify } from './index';
import { emitChatPush, isChatOpenWith } from '../screens/chats/chatEvents';
import { markChatDelivered } from '../api/chatApi';
import { showChatMessage } from './chatNotifications';
import { NotifData, NotificationType } from './catalog';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  DevicePlatform,
} from '../api/notificationApi';
import { getActiveUserId, listAccounts } from '../utils/accountStore';

const LAST_TOKEN_KEY = 'fcm_last_token';
const platform: DevicePlatform = Platform.OS === 'ios' ? 'ios' : 'android';

/** Map an incoming FCM message onto our `notify()` shape and raise it. */
export async function handleRemoteMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const raw = (remoteMessage.data ?? {}) as Record<string, string>;
  const { type, title, body, params, ...rest } = raw;

  let parsedParams: Record<string, any> | undefined;
  if (params) {
    try {
      parsedParams = JSON.parse(params);
    } catch {
      parsedParams = undefined;
    }
  }

  // A chat message: this phone has it (the sender's second tick), an open chat
  // screen fetches it at once, and it joins its conversation's own notification
  // — none for the conversation already on screen, and never the inbox. One for
  // another account signed in here says whose it is, and is marked delivered
  // with that account's own sign-in.
  if (type === 'chat_message') {
    const from = Number(parsedParams?.contact?.user_id);
    const accountId = Number(parsedParams?.accountId) || null;
    const activeId = await getActiveUserId();
    const forActive = !accountId || !activeId || accountId === activeId;
    const account = forActive ? null : (await listAccounts()).find(a => a.user_id === accountId);
    // An account no longer signed in on this phone gets nothing here.
    if (!forActive && !account) return;

    markChatDelivered(account?.token).catch(() => {});
    if (from) {
      if (forActive) emitChatPush(from);
      if (!forActive || !isChatOpenWith(from)) {
        await showChatMessage({
          fromUserId: from,
          accountId,
          accountName: account?.name ?? null,
          name: title ?? parsedParams?.contact?.name ?? 'New message',
          text: body ?? '',
          params: parsedParams ?? {},
        });
      }
    }
    return;
  }

  const data: NotifData = { ...rest };
  if (parsedParams) data.params = parsedParams;

  await notify({
    type: (type as NotificationType) || 'general',
    // Fall back to the notification block if the backend ever sends one.
    title: title ?? remoteMessage.notification?.title,
    body: body ?? remoteMessage.notification?.body,
    data,
  });
}

// The token goes to every account signed in on this phone: the active one
// through the app's client, each other with its own sign-in. One that fails
// (signed out elsewhere) doesn't stop the rest.
async function registerForEveryAccount(token: string): Promise<void> {
  const [accounts, activeAuth] = await Promise.all([listAccounts(), AsyncStorage.getItem('auth_token')]);
  const ids = accounts.map(a => a.user_id);

  await registerDeviceToken(token, platform, { accounts: ids });
  await Promise.all(
    accounts
      .filter(a => a.token && a.token !== activeAuth)
      .map(a =>
        registerDeviceToken(token, platform, { accounts: ids, authToken: a.token }).catch(e =>
          console.log('[push] registering another account failed:', a.user_id, e?.response?.status ?? e?.message),
        ),
      ),
  );
}

/** Fetch the current FCM token and register it with the backend (deduped). */
export async function syncDeviceToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }
    const token = await messaging().getToken();
    if (!token) return null;

    const last = await AsyncStorage.getItem(LAST_TOKEN_KEY);
    // Always (re)register on login; only skip the network call when the token
    // is unchanged AND we've registered it before in this install.
    await registerForEveryAccount(token);
    if (token !== last) await AsyncStorage.setItem(LAST_TOKEN_KEY, token);
    return token;
  } catch (e) {
    console.log('[push] syncDeviceToken failed:', e);
    return null;
  }
}

/** Remove the token from the backend + local cache (call on logout). */
export async function clearDeviceToken(): Promise<void> {
  try {
    const token =
      (await AsyncStorage.getItem(LAST_TOKEN_KEY)) ||
      (await messaging().getToken());
    if (token) await unregisterDeviceToken(token);
  } catch (e) {
    console.log('[push] clearDeviceToken failed:', e);
  } finally {
    await AsyncStorage.removeItem(LAST_TOKEN_KEY);
  }
}

/** Stop one account's pushes to this phone — an account being removed — leaving the others'. */
export async function unregisterDeviceTokenFor(authToken: string): Promise<void> {
  try {
    const token =
      (await AsyncStorage.getItem(LAST_TOKEN_KEY)) ||
      (await messaging().getToken());
    if (token) await unregisterDeviceToken(token, authToken);
  } catch (e: any) {
    console.log('[push] unregistering an account failed:', e?.response?.status ?? e?.message);
  }
}

let listenersBound = false;

/**
 * Bind foreground + token-refresh + tap listeners. Idempotent.
 * Background/quit messages are handled by `setBackgroundMessageHandler` in index.js.
 */
export function initPushListeners(): void {
  if (listenersBound) return;
  listenersBound = true;

  // Foreground messages: render through notify() so banner + sound + inbox fire.
  messaging().onMessage(handleRemoteMessage);

  // Token rotates → re-register with the backend, for every account here.
  messaging().onTokenRefresh(async token => {
    try {
      await registerForEveryAccount(token);
      await AsyncStorage.setItem(LAST_TOKEN_KEY, token);
    } catch (e) {
      console.log('[push] onTokenRefresh register failed:', e);
    }
  });
}

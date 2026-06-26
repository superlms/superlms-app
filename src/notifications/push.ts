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
// ─────────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notify } from './index';
import { NotifData, NotificationType } from './catalog';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  DevicePlatform,
} from '../api/notificationApi';

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
    await registerDeviceToken(token, platform);
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

  // Token rotates → re-register with the backend.
  messaging().onTokenRefresh(async token => {
    try {
      await registerDeviceToken(token, platform);
      await AsyncStorage.setItem(LAST_TOKEN_KEY, token);
    } catch (e) {
      console.log('[push] onTokenRefresh register failed:', e);
    }
  });
}

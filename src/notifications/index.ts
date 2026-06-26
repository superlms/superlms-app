// ─────────────────────────────────────────────────────────────────────────────
//  Public notifications API
//
//  Anywhere in the app you want to raise a notification, call:
//
//     import { notify } from '../notifications';
//     notify({ type: 'homework_assigned', data: { subject: 'Maths' } });
//
//  It (1) adds the item to the persistent inbox, (2) bumps the unread badge and
//  (3) shows a heads-up banner with the custom sound. Push messages (Phase 2)
//  funnel through this same function so behaviour stays identical.
// ─────────────────────────────────────────────────────────────────────────────
import { entryFor, NotifData, NotificationType } from './catalog';
import { notificationStore, NotificationItem } from './store';
import { displaySystemNotification } from './service';

export interface NotifyInput {
  type: NotificationType;
  /** Overrides the catalog's default title. */
  title?: string;
  /** Overrides the catalog's default body. */
  body?: string;
  data?: NotifData;
  /** Skip the heads-up + sound, only drop it into the inbox. Default false. */
  silent?: boolean;
}

const genId = () =>
  `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Raise a notification: persist to inbox, badge it and (unless silent) sound + banner. */
export async function notify(input: NotifyInput): Promise<NotificationItem> {
  const entry = entryFor(input.type);
  const title = input.title ?? entry.buildTitle?.(input.data) ?? 'Notification';
  const body = input.body ?? entry.buildBody?.(input.data) ?? '';

  const item: NotificationItem = {
    id: genId(),
    type: input.type,
    category: entry.category,
    title,
    body,
    createdAt: Date.now(),
    read: false,
    data: input.data,
  };

  await notificationStore.add(item);
  if (!input.silent) await displaySystemNotification(item);
  return item;
}

export { initNotifications, openNotificationTarget } from './service';
export {
  syncDeviceToken,
  clearDeviceToken,
  initPushListeners,
  handleRemoteMessage,
} from './push';
export {
  useNotifications,
  useUnreadCount,
  notificationStore,
  type NotificationItem,
} from './store';
export { CATEGORY_CONFIG, type NotifCategory, type NotificationType } from './catalog';

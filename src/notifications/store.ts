// ─────────────────────────────────────────────────────────────────────────────
//  Notification inbox store
//
//  A tiny, dependency-free singleton that holds this device's notifications,
//  persists them to AsyncStorage and lets React components subscribe. Used by
//  the inbox screen and the unread badge on the top bar.
//
//  It is intentionally not a React context so that `notify()` can add items
//  from anywhere (push handlers, API callbacks) without a provider in scope.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotifCategory, NotifData, NotificationType } from './catalog';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  category: NotifCategory;
  title: string;
  body: string;
  createdAt: number; // epoch ms
  read: boolean;
  data?: NotifData;
}

const STORAGE_KEY = 'notifications_inbox_v1';
const MAX_ITEMS = 200; // keep the inbox bounded

type Listener = () => void;

class NotificationStore {
  private items: NotificationItem[] = [];
  private listeners = new Set<Listener>();
  private hydrated = false;

  /** Load persisted notifications once at app start. */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.items = parsed;
      }
    } catch {}
    this.emit();
  }

  getAll(): NotificationItem[] {
    return this.items;
  }

  getById(id: string): NotificationItem | undefined {
    return this.items.find(i => i.id === id);
  }

  unreadCount(): number {
    return this.items.reduce((n, i) => (i.read ? n : n + 1), 0);
  }

  async add(item: NotificationItem): Promise<void> {
    this.items = [item, ...this.items].slice(0, MAX_ITEMS);
    this.persist();
    this.emit();
  }

  async markRead(id: string): Promise<void> {
    let changed = false;
    this.items = this.items.map(i => {
      if (i.id === id && !i.read) { changed = true; return { ...i, read: true }; }
      return i;
    });
    if (changed) { this.persist(); this.emit(); }
  }

  async markAllRead(): Promise<void> {
    if (!this.items.some(i => !i.read)) return;
    this.items = this.items.map(i => (i.read ? i : { ...i, read: true }));
    this.persist();
    this.emit();
  }

  async remove(id: string): Promise<void> {
    const next = this.items.filter(i => i.id !== id);
    if (next.length === this.items.length) return;
    this.items = next;
    this.persist();
    this.emit();
  }

  async clearAll(): Promise<void> {
    if (!this.items.length) return;
    this.items = [];
    this.persist();
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach(fn => fn());
  }

  private persist() {
    // Fire-and-forget; the in-memory list is the source of truth for the UI.
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items)).catch(() => {});
  }
}

export const notificationStore = new NotificationStore();

// ─── React hooks ─────────────────────────────────────────────────────────────

/** Live list of notifications + actions for the inbox screen. */
export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>(notificationStore.getAll());

  useEffect(() => {
    const sync = () => setItems([...notificationStore.getAll()]);
    sync();
    return notificationStore.subscribe(sync);
  }, []);

  return {
    items,
    unreadCount: items.reduce((n, i) => (i.read ? n : n + 1), 0),
    markRead: (id: string) => notificationStore.markRead(id),
    markAllRead: () => notificationStore.markAllRead(),
    remove: (id: string) => notificationStore.remove(id),
    clearAll: () => notificationStore.clearAll(),
  };
}

/** Just the unread count — used by the top-bar bell badge. */
export function useUnreadCount(): number {
  const [count, setCount] = useState<number>(notificationStore.unreadCount());
  useEffect(() => {
    const sync = () => setCount(notificationStore.unreadCount());
    sync();
    return notificationStore.subscribe(sync);
  }, []);
  return count;
}

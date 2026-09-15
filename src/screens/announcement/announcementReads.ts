import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../api/apiClient';

// Which announcements this user has opened. The server keeps the read receipts,
// so they survive reinstalling the app or signing in on another phone. The
// device keeps a copy — one per signed-in user, since accounts can be switched —
// so the dots are right before the list arrives and while offline.

const MAX_IDS = 500;

let cache: { key: string; ids: Set<string> } | null = null;
const listeners = new Set<() => void>();

const storageKey = async (): Promise<string> => {
  try {
    const raw = await AsyncStorage.getItem('user_data');
    const id = raw ? JSON.parse(raw)?.id : null;
    return `announcement_reads_${id ?? 'anon'}`;
  } catch {
    return 'announcement_reads_anon';
  }
};

export async function loadAnnouncementReads(): Promise<Set<string>> {
  const key = await storageKey();
  if (cache?.key === key) return cache.ids;
  let ids = new Set<string>();
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) ids = new Set(JSON.parse(raw));
  } catch {}
  cache = { key, ids };
  return ids;
}

const saveReads = async (ids: Set<string>) => {
  const key = await storageKey();
  // A Set keeps insertion order, so the newest reads are the ones kept.
  AsyncStorage.setItem(key, JSON.stringify(Array.from(ids).slice(-MAX_IDS))).catch(() => {});
  listeners.forEach(fn => fn());
};

// Tell the server. A call that fails is sent again by the next list sync.
const sendReads = (ids: string[]) => {
  if (ids.length === 0) return;
  apiClient.post('/announcement/read', { ids: ids.map(Number) }).catch(() => {});
};

export async function markAnnouncementRead(id: string): Promise<void> {
  const ids = await loadAnnouncementReads();
  sendReads([id]);
  if (ids.has(id)) return;
  ids.add(id);
  saveReads(ids);
}

/**
 * Line the device up with the server once the list arrives: what the server
 * has as read is read here too, and what was only read on this device (before
 * the server kept receipts, or while offline) is sent up.
 */
export async function syncAnnouncementReads(
  items: { id: string; isRead?: boolean }[],
): Promise<void> {
  const ids = await loadAnnouncementReads();
  sendReads(items.filter(a => !a.isRead && ids.has(a.id)).map(a => a.id));

  const fromServer = items.filter(a => a.isRead && !ids.has(a.id));
  if (fromServer.length === 0) return;
  fromServer.forEach(a => ids.add(a.id));
  saveReads(ids);
}

/** The opened announcement ids, or null until they have been read off the device. */
export function useAnnouncementReads(): Set<string> | null {
  const [ids, setIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    const sync = () => {
      loadAnnouncementReads().then(next => {
        if (alive) setIds(new Set(next));
      });
    };
    sync();
    listeners.add(sync);
    return () => {
      alive = false;
      listeners.delete(sync);
    };
  }, []);

  return ids;
}

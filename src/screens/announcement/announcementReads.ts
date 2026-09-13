import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Which announcements this user has opened. The server keeps no read receipts
// for announcements, so the list lives on the device — one per signed-in user,
// since accounts can be switched.

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

export async function markAnnouncementRead(id: string): Promise<void> {
  const ids = await loadAnnouncementReads();
  if (ids.has(id)) return;
  ids.add(id);
  const key = await storageKey();
  // A Set keeps insertion order, so the newest reads are the ones kept.
  AsyncStorage.setItem(key, JSON.stringify(Array.from(ids).slice(-MAX_IDS))).catch(() => {});
  listeners.forEach(fn => fn());
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

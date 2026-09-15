import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveAccountId } from '../utils/accountStore';

/**
 * What a screen last loaded on this phone, for the signed-in account, so its
 * first load can draw a skeleton in the shape of the page it is likely to show.
 *
 *   const [last, remember] = useLastLoaded<Query[]>('queries:student');
 *
 * `last` is undefined while it is being read (or while `name` is not known
 * yet) and null when nothing was kept; `remember` keeps the next load.
 */
export function useLastLoaded<T>(name: string | null) {
  const [last, setLast] = useState<T | null | undefined>(undefined);

  const key = useMemo(
    () =>
      name
        ? getActiveAccountId()
            .then(id => `last_loaded:${name}:${id ?? 'me'}`)
            .catch(() => `last_loaded:${name}:me`)
        : null,
    [name],
  );

  useEffect(() => {
    if (!key) return;
    let live = true;
    setLast(undefined);
    key
      .then(k => AsyncStorage.getItem(k))
      .then(raw => {
        if (live) setLast(raw ? (JSON.parse(raw) as T) : null);
      })
      .catch(() => {
        if (live) setLast(null);
      });
    return () => {
      live = false;
    };
  }, [key]);

  const remember = useCallback(
    (value: T) => {
      key?.then(k => AsyncStorage.setItem(k, JSON.stringify(value))).catch(() => {});
    },
    [key],
  );

  return [last, remember] as const;
}

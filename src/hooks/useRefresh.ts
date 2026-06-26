import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Wraps a screen's data-loading function for pull-to-refresh.
 *
 *   const load = useCallback(async () => { ... }, []);
 *   const { refreshing, onRefresh } = useRefresh(load);
 *   <ScrollView refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />} />
 *
 * `refreshing` drives the spinner; `onRefresh` runs the loader and clears the
 * spinner when it settles (success or failure).
 */
export function useRefresh(loader: () => void | Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loader();
    } finally {
      setRefreshing(false);
    }
  }, [loader]);

  return { refreshing, onRefresh };
}

/**
 * Run a screen's loader every time the screen gains focus (mount + each time
 * the user navigates back to it from the drawer / a tab / a tile), so content
 * is always fresh on navigation — not just on first mount.
 *
 *   const load = useCallback(async () => { ... }, []);
 *   useFocusLoad(load);
 *
 * Safe with non-memoized loaders: a ref keeps the latest `load` while the
 * focus subscription stays stable, so it fires exactly once per focus.
 */
export function useFocusLoad(load: () => void | Promise<unknown>) {
  const ref = useRef(load);
  ref.current = load;

  useFocusEffect(
    useCallback(() => {
      ref.current();
    }, []),
  );
}

export default useRefresh;

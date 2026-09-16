import { useSyncExternalStore } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';

/**
 * Play Store updates, forced from inside the app.
 *
 * When the app opens, Google Play is asked whether a newer build of the app is
 * on the Play Store. If one is, Play's own full-screen update opens before the
 * app goes past the splash, and Play restarts the app on the new build once it
 * is installed. Closing that screen doesn't get round it: the app stays behind
 * an "Update required" card (PlayUpdateGate) until it is updated. The same
 * check runs whenever the app comes back to the front, so a build published
 * while the app sat in the background is picked up too.
 *
 * Play only answers for a release build installed from the Play Store; debug
 * builds, sideloaded APKs, builds without the native module (a JS bundle that
 * arrived over OTA on an older build) and any Play error just carry on into the
 * app. Play can take a while to learn about a newly published build on a
 * phone — opening the app's Play Store page refreshes it.
 */

type CheckResult = {
  available: boolean;
  inProgress: boolean;
  immediateAllowed: boolean;
  versionCode: number;
};

type FlowResult = 'updated' | 'cancelled' | 'failed' | 'unavailable';

type PlayUpdateNative = {
  check(): Promise<CheckResult>;
  startImmediate(): Promise<FlowResult>;
  openStore(): Promise<boolean>;
};

const native: PlayUpdateNative | undefined =
  Platform.OS === 'android' && !__DEV__ ? NativeModules.PlayUpdate : undefined;

/** How long the splash waits on Play before carrying on regardless. */
const CHECK_TIMEOUT_MS = 5000;

// 'checking' until the first answer; 'required' while an update must be
// installed; 'none' otherwise.
export type PlayUpdateStatus = 'checking' | 'none' | 'required';

let status: PlayUpdateStatus = native ? 'checking' : 'none';
// Play's update screen is open (or being opened) — its own pauses and resumes
// of the app must not start another check.
let flowOpen = false;
let checking: Promise<void> | null = null;
let started = false;
const listeners = new Set<() => void>();

const setStatus = (next: PlayUpdateStatus) => {
  if (next === status) return;
  status = next;
  listeners.forEach(listener => listener());
};

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Play update check timed out')),
      ms,
    );
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

/** Opens Play's update screen; if Play won't, its Play Store page. */
export async function startPlayUpdate(): Promise<void> {
  if (!native || flowOpen) return;
  flowOpen = true;
  try {
    const result = await native.startImmediate();
    if (result === 'unavailable') {
      // Play still says there's a newer build but won't update it here.
      const info = await native.check().catch(() => null);
      if (info?.available) {
        await native.openStore().catch(() => {});
      } else if (!info?.inProgress) {
        setStatus('none');
      }
    }
    // 'updated': Play restarts the app on the new build. 'cancelled' and
    // 'failed' leave the app behind the "Update required" card.
  } catch (e) {
    console.warn('Play update could not start:', e);
  } finally {
    flowOpen = false;
  }
}

const runCheck = (): Promise<void> => {
  if (!native) return Promise.resolve();
  if (checking) return checking;

  checking = (async () => {
    try {
      const info = await withTimeout(native.check(), CHECK_TIMEOUT_MS);
      const needed =
        info.inProgress || (info.available && info.immediateAllowed);
      if (!needed) {
        // A newer build Play won't force in the app still sends the user to
        // the Play Store; otherwise the app carries on.
        if (info.available) {
          setStatus('required');
        } else {
          setStatus('none');
        }
        return;
      }

      const wasRequired = status === 'required';
      setStatus('required');
      // Opened by itself the first time the update is found, and to carry on
      // an update Play had already begun. After the user closes Play's screen
      // the card's button opens it again, so it doesn't reopen on its own.
      if (!wasRequired || info.inProgress) {
        startPlayUpdate();
      }
    } catch {
      // Not from the Play Store, no Play services, offline, or too slow:
      // never keep the user out of the app because of it.
      if (status === 'checking') setStatus('none');
    } finally {
      checking = null;
    }
  })();

  return checking;
};

/**
 * Starts the update check once for the app's life, and again each time the
 * app returns to the front. Resolves when the first check has an answer, so
 * the splash can hold until then.
 */
export function startPlayUpdateChecks(): Promise<void> {
  if (!native) return Promise.resolve();
  if (!started) {
    started = true;
    AppState.addEventListener('change', state => {
      if (state === 'active' && !flowOpen) runCheck();
    });
  }
  return runCheck();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getStatus = () => status;

export function usePlayUpdateStatus(): PlayUpdateStatus {
  return useSyncExternalStore(subscribe, getStatus);
}

import { useSyncExternalStore } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';

/**
 * Play Store updates from inside the app, without holding up the splash.
 *
 * While the splash plays, Google Play is asked in the background whether a
 * newer build of the app is on the Play Store. Once the next screen is up
 * (dashboard or login), and only if there is one, Play's small prompt offers
 * it; after "Update" it downloads in the background while the app is used, and
 * installs quietly the next time the app leaves the screen (PlayUpdateModule).
 * The app then opens on the new build, still signed in — an update keeps the
 * app's data.
 *
 * Play doesn't let an app install its own update without that one tap; only
 * the Play Store's own auto-update does, on its own schedule. So the update
 * still can't be skipped: "No thanks" leaves the app behind an "Update
 * required" card (PlayUpdateGate) whose "Update now" runs Play's full-screen
 * update, after which Play restarts the app. The check runs again whenever the
 * app comes back to the front, and a full-screen update Play had begun is
 * carried on.
 *
 * Play only answers for a release build installed from the Play Store; debug
 * builds, sideloaded APKs, builds without the native module (a JS bundle that
 * arrived over OTA on an older build) and any Play error just carry on into the
 * app. Play can take a while to learn about a newly published build on a
 * phone — opening the app's Play Store page refreshes it.
 */

type InstallStatus =
  | 'none'
  | 'pending'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'installed'
  | 'failed'
  | 'canceled';

type CheckResult = {
  available: boolean;
  inProgress: boolean;
  immediateAllowed: boolean;
  flexibleAllowed: boolean;
  installStatus: InstallStatus;
  versionCode: number;
};

type FlowResult =
  | 'accepted'
  | 'updated'
  | 'cancelled'
  | 'failed'
  | 'unavailable';

type PlayUpdateNative = {
  check(): Promise<CheckResult>;
  startFlexible(): Promise<FlowResult>;
  startImmediate(): Promise<FlowResult>;
  openStore(): Promise<boolean>;
};

const native: PlayUpdateNative | undefined =
  Platform.OS === 'android' && !__DEV__ ? NativeModules.PlayUpdate : undefined;

/** Longest a check may take before it is given up on. */
const CHECK_TIMEOUT_MS = 15000;

// Already coming down (or going in) in the background.
const UNDER_WAY: InstallStatus[] = [
  'pending',
  'downloading',
  'downloaded',
  'installing',
];

// 'required' while the app must stay behind the "Update required" card.
export type PlayUpdateStatus = 'none' | 'required';

let status: PlayUpdateStatus = 'none';
// Play's prompt or update screen is open (or being opened) — its own pauses
// and resumes of the app must not start another check.
let flowOpen = false;
let checking: Promise<void> | null = null;
let started = false;
// The first screen after the splash is showing; Play's screens wait for it.
let appReady = false;
let whenReady: (() => void) | null = null;
// "No thanks" was chosen in Play's prompt this session.
let declined = false;
const listeners = new Set<() => void>();

const setStatus = (next: PlayUpdateStatus) => {
  if (next === status) return;
  status = next;
  listeners.forEach(listener => listener());
};

const onceReady = (action: () => void) => {
  if (appReady) {
    action();
  } else {
    whenReady = action;
  }
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

const openFlow = async (
  start: (module: PlayUpdateNative) => Promise<FlowResult>,
): Promise<FlowResult | null> => {
  if (!native || flowOpen) return null;
  flowOpen = true;
  try {
    return await start(native);
  } catch (e) {
    console.warn('Play update could not start:', e);
    return 'failed';
  } finally {
    flowOpen = false;
  }
};

/** Play's full-screen update; if Play won't run one, the Play Store page. */
export async function startPlayUpdate(): Promise<void> {
  const result = await openFlow(module => module.startImmediate());
  if (result === 'unavailable' && native) {
    const info = await native.check().catch(() => null);
    if (info?.available) {
      await native.openStore().catch(() => {});
    } else if (!info?.inProgress) {
      setStatus('none');
    }
  }
  // 'updated': Play restarts the app on the new build. 'cancelled' and
  // 'failed' leave the app behind the "Update required" card.
}

/** Play's prompt to download the update in the background. */
async function offerBackgroundUpdate(): Promise<void> {
  const result = await openFlow(module => module.startFlexible());
  if (result === 'cancelled' || result === 'failed') {
    declined = true;
    setStatus('required');
  } else if (result === 'unavailable') {
    // Play won't download it in the background; update in full screen.
    setStatus('required');
    startPlayUpdate();
  }
  // 'accepted': downloading; installed once the app leaves the screen.
}

const runCheck = (): Promise<void> => {
  if (!native) return Promise.resolve();
  if (checking) return checking;

  checking = (async () => {
    try {
      const info = await withTimeout(native.check(), CHECK_TIMEOUT_MS);

      if (info.inProgress) {
        // A full-screen update Play had begun: carry it on.
        setStatus('required');
        onceReady(startPlayUpdate);
        return;
      }
      if (UNDER_WAY.includes(info.installStatus) || !info.available) {
        setStatus('none');
        return;
      }

      if (!declined && info.flexibleAllowed) {
        onceReady(offerBackgroundUpdate);
        return;
      }

      // Declined, or Play only offers the full-screen update. Opened by itself
      // the first time; after that the card's button opens it, so it doesn't
      // reopen every time the app comes back.
      const wasRequired = status === 'required';
      setStatus('required');
      if (!wasRequired && info.immediateAllowed) {
        onceReady(startPlayUpdate);
      }
    } catch {
      // Not from the Play Store, no Play services, offline, or too slow:
      // never keep the user out of the app because of it.
    } finally {
      checking = null;
    }
  })();

  return checking;
};

/**
 * Looks for an update now, in the background, and again each time the app
 * returns to the front. Call once when the app starts.
 */
export function startPlayUpdateChecks(): void {
  if (!native || started) return;
  started = true;
  AppState.addEventListener('change', state => {
    if (state === 'active' && !flowOpen) runCheck();
  });
  runCheck();
}

/**
 * The splash has handed over to the first screen: Play's prompt or update
 * screen may show from now on.
 */
export function playUpdateAppReady(): void {
  if (appReady) return;
  appReady = true;
  const action = whenReady;
  whenReady = null;
  action?.();
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

import { Platform } from 'react-native';
import hotUpdate from 'react-native-ota-hot-update';
import ReactNativeBlobUtil from 'react-native-blob-util';
import constant from './constant';

/**
 * Self-hosted OTA (over-the-air) JS updates.
 *
 * On launch the app fetches a small manifest from CloudFront. If it advertises
 * a bundle version newer than what this device is running, the new JS bundle is
 * downloaded silently in the background and swapped in on the NEXT cold start —
 * so the user never sees a build/Play Store prompt. Native code is untouched, so
 * anything that needs new native code still requires a real Play Store release
 * (bump `versionCode` + `OTA_BASELINE_VERSION` together for those).
 *
 * Safety nets (handled inside the native module):
 *  - the bundle is only used if the app's native version matches, so an OTA
 *    bundle built against newer native never lands on an older install;
 *  - if the app crashes within ~2s of loading a new bundle it auto-rolls back
 *    to the previous good bundle.
 *
 * OTA only takes effect in RELEASE builds — in debug the Metro bundle is used.
 */

// Manifest shape uploaded to S3 (see scripts/ota-release.mjs).
interface OtaManifest {
  version: number;
  downloadAndroidUrl?: string;
  downloadIosUrl?: string;
  mandatory?: boolean;
  notes?: string;
}

const MANIFEST_URL = `${constant.OTA_BASE_URL}/android/update.json`;

let alreadyChecked = false;

export async function checkForOTAUpdate(): Promise<void> {
  // Only Android is wired for now; iOS needs the AppDelegate change + its own
  // build before it can be enabled.
  if (Platform.OS !== 'android') {
    return;
  }
  // OTA is a no-op in debug (Metro serves the bundle) — skip the network call.
  if (__DEV__) {
    return;
  }
  // Guard against duplicate checks within a single app session.
  if (alreadyChecked) {
    return;
  }
  alreadyChecked = true;

  try {
    // Cache-bust so CloudFront edge caching never hides a just-published manifest.
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) {
      return;
    }
    const manifest = (await res.json()) as OtaManifest;
    const remoteVersion = Number(manifest?.version) || 0;
    const downloadUrl = manifest?.downloadAndroidUrl;
    if (!remoteVersion || !downloadUrl) {
      return;
    }

    // Seed the baseline the first time this native build runs so we never
    // re-download the JS that's already embedded in the APK/AAB.
    let currentVersion = await hotUpdate.getCurrentVersion();
    if (currentVersion === 0 && constant.OTA_BASELINE_VERSION > 0) {
      await hotUpdate.setCurrentVersion(constant.OTA_BASELINE_VERSION);
      currentVersion = constant.OTA_BASELINE_VERSION;
    }

    if (remoteVersion <= currentVersion) {
      return; // already up to date
    }

    // Download + install. By default we DON'T restart mid-session — the new
    // bundle is picked up on the next cold start (seamless for the user). A
    // manifest can set `mandatory: true` to force an immediate restart.
    hotUpdate.downloadBundleUri(ReactNativeBlobUtil, downloadUrl, remoteVersion, {
      restartAfterInstall: !!manifest.mandatory,
      restartDelay: 500,
      maxBundleVersions: 3,
      updateSuccess: () => {
        // Applied — takes effect on next launch (or immediately if mandatory).
      },
      updateFail: (message: string) => {
        // Non-fatal: the app keeps running the current bundle.
        console.warn('OTA update failed:', message);
      },
    });
  } catch (e) {
    // Network / parse errors are non-fatal — never block app startup on OTA.
    console.warn('OTA check skipped:', e);
  }
}

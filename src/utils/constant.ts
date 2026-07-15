import { Dimensions, Platform } from 'react-native';

const constant = {
  API_BASE_URL: 'https://superlms.in/api/v1',
  /**
   * OTA (over-the-air) JS updates. Bundles + manifest are hosted on S3 and
   * served via the existing CloudFront distribution (cdn.superlms.in).
   * Manifest: `${OTA_BASE_URL}/android/update.json`
   */
  OTA_BASE_URL: 'https://cdn.superlms.in/ota',
  /**
   * The OTA bundle version physically embedded in THIS native build. On a fresh
   * install the device has no applied OTA yet, so we seed the stored version to
   * this baseline — that way the app never re-downloads the JS it already ships
   * with, and only pulls manifests newer than this. Bump this in lockstep with
   * `versionCode`/`versionName` whenever you cut a new native (Play Store) build
   * so it equals the OTA `version` whose JS is baked into that build.
   */
  OTA_BASELINE_VERSION: 1,
  /** screen */
  screen: Dimensions.get('window'),
  screenHeight:
    (Platform.OS === 'ios' && Dimensions.get('window').height) ||
    Dimensions.get('window').height - 24,
  screenWidth: Dimensions.get('window').width,
};

export default constant;
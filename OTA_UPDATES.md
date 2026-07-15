# OTA (Over-the-Air) JS Updates

Ship JavaScript / asset changes straight to users **without a Play Store build**.
On every launch the app checks a manifest on `cdn.superlms.in`; if a newer bundle
exists it downloads silently and applies it on the **next cold start**.

## Ship a change (the everyday flow)

```bash
# 1. Make your JS/TS/screen/logic changes and test them.
# 2. When you want them live for users:
yarn ota:release
```

That single command builds the production bundle, Hermes-compiles it, uploads it
to S3, and refreshes CloudFront. Users get it the next time they open the app.
No Play Console, no user "update" tap.

Force an immediate restart on devices (for a critical fix):

```bash
yarn ota:release --mandatory
```

## What OTA can and cannot ship

| Change | OTA? |
|---|---|
| JS/TS code, screens, navigation, logic, styling | ✅ Yes |
| Images / fonts / other JS-referenced assets | ✅ Yes |
| New **native** module / library with native code | ❌ Needs a Play Store build |
| Android permission, app icon, app name, native config | ❌ Needs a Play Store build |

## When you DO make a native (Play Store) build

Bump all three together, then build & upload the AAB as usual:

- `android/app/build.gradle` → `versionCode` and `versionName`
- `src/utils/constant.ts` → `OTA_BASELINE_VERSION` = the current OTA version
  whose JS is baked into that build

This keeps fresh installs from re-downloading JS they already ship with, and
keeps OTA bundles from landing on an incompatible native version.

## How it works (short)

- Manifest: `https://cdn.superlms.in/ota/android/update.json`
- Bundles: `s3://superlms-media-540361297670/ota/android/` → served via CloudFront
- Library: [`react-native-ota-hot-update`](https://github.com/vantuan88291/react-native-ota-hot-update)
  (self-hosted) + `react-native-blob-util`
- Safety: a bundle is only applied if the native app version matches, and if the
  app crashes within ~2s of loading a new bundle it auto-rolls back to the
  previous good one.
- **Only works in release builds** (debug uses the Metro bundle).

## Requirements to run `yarn ota:release`

- AWS CLI configured with write access to the `superlms-media-540361297670`
  bucket and the CloudFront distribution (already set up on the build machine).

## iOS

Not wired yet. Enabling it needs the `AppDelegate.swift` `bundleURL()` change
(see the library README) plus its own build.

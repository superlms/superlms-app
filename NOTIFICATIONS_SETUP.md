# Notifications

In-app notifications with a custom sound, a persistent inbox and an unread badge.
Built on [Notifee](https://notifee.app). Push (FCM) is Phase 2 — see the checklist
at the bottom.

## What's wired (Phase 1 — done)

| Piece | File |
| --- | --- |
| Notification catalog (every "kind" + templates) | `src/notifications/catalog.ts` |
| Persistent inbox store + hooks | `src/notifications/store.ts` |
| Notifee channel / permission / display (custom sound) | `src/notifications/service.ts` |
| Public `notify()` trigger | `src/notifications/index.ts` |
| Inbox screen (real data) | `src/screens/notification/NotificationScreen.tsx` |
| Unread badge on the bell | `src/components/TopBar.tsx` |
| One-time init | `App.tsx` (`initNotifications`) |
| Background tap handler | `index.js` (`notifee.onBackgroundEvent`) |
| Custom sound | `android/app/src/main/res/raw/notification_tone.wav` |
| Android 13+ permission | `AndroidManifest.xml` (`POST_NOTIFICATIONS`) |

## How to raise a notification

From anywhere (a screen, an API callback, a push handler):

```ts
import { notify } from '../notifications';

// Uses the catalog's default title/body for the type:
notify({ type: 'homework_assigned', data: { subject: 'Mathematics' } });

// Or fully custom:
notify({
  type: 'general',
  title: 'Welcome 🎉',
  body: 'Your account is ready.',
  data: { screen: 'Dashboard' },
});
```

`notify()` will:
1. add the item to the inbox (persisted, survives restarts),
2. bump the unread badge on the bell,
3. show a heads-up banner with `notification_tone.wav` (unless `silent: true`).

## Adding a new notification "kind"

1. Add a `type` + entry in `src/notifications/catalog.ts` (category + default
   title/body templates).
2. Call `notify({ type: '<your_type>', data: {...} })` from wherever the event
   happens. **Tell me which event → which type, and I'll wire the call.**

## Changing the sound

Replace `android/app/src/main/res/raw/notification_tone.wav` (filename must stay
lowercase letters/digits/underscore). For iOS, add the same file to the Xcode
bundle. The references are `SOUND_ANDROID` / `SOUND_IOS` in
`src/notifications/service.ts`.

> After any native change (sound, this library) do a **clean rebuild** —
> Metro reload is not enough.

---

## Phase 2 — Push notifications (FCM)

### App side — DONE ✅

Firebase project `superlms-lms-57e8c`, Android app `com.edyoneapp`.

| Piece | File |
| --- | --- |
| `google-services.json` | `android/app/google-services.json` |
| Firebase libs | `@react-native-firebase/app` + `/messaging` (v24) |
| Gradle | `google-services:4.4.2` classpath + plugin in `android/(app/)build.gradle` |
| Token register/refresh, foreground msgs → `notify()` | `src/notifications/push.ts` |
| Backend token API | `src/api/notificationApi.ts` (`POST /device-token`, `/device-token/remove`) |
| Background/quit msgs → `notify()` | `index.js` (`setBackgroundMessageHandler`) |
| Token lifecycle | login → `syncDeviceToken()`, logout → `clearDeviceToken()` (`authApi.ts`); app start re-syncs if logged in (`service.ts`) |

**Contract:** the backend must send **data-only** FCM messages (no `notification`
block) so the app renders them with the custom sound + inbox entry in every state.
Payload (string values): `{ type, title?, body?, screen?, params?, ...extra }`
where `type` matches a key in `catalog.ts` and `params` is JSON-encoded.

> Needs a **clean native rebuild** (new native modules added).

### Still TODO

1. **Backend** (`superlms` API): a `device_tokens` table + `POST /device-token`
   (& `/device-token/remove`) endpoints, and a sender that pushes data-only
   messages via **FCM HTTP v1** using the Firebase **service account key** (still
   to be provided; goes in `storage/`, never committed). Extend the existing
   `SendNotificationController`.
2. **Event → notification rules**: which event fires which `type`, to whom. Each
   becomes a `notify()` call (in-app) and/or a backend FCM send (push).
3. **iOS** (only if/when building for iOS): add `GoogleService-Info.plist` + an
   APNs key in Firebase.

/**
 * @format
 */

import { AppRegistry } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';
import {
  notificationStore,
  handleRemoteMessage,
  openNotificationTarget,
} from './src/notifications';

// Handle push messages while the app is in the background or quit. The backend
// sends data-only messages, so we render them here (inbox + custom sound) via
// the same notify() path used in the foreground.
messaging().setBackgroundMessageHandler(handleRemoteMessage);

// Handle taps/dismisses while the app is in the background or quit.
// (Required by Notifee — without it background events log a warning.)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const id = detail.notification?.id;
  if (id && type === EventType.PRESS) {
    await notificationStore.hydrate();
    await notificationStore.markRead(id);
    // Deep-link to the screen the notification points at. If the app was killed,
    // the navigator isn't ready yet — navigateToScreen queues until onReady.
    openNotificationTarget(id);
  }
});

AppRegistry.registerComponent(appName, () => App);

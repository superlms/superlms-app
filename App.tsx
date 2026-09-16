import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, StatusBar, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  navigationRef,
  flushPendingNavigation,
} from './src/navigation/navigationRef';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import AppLock from './src/components/AppLock';
import { ThemeProvider, theme } from './src/utils/theme';
import { initNotifications } from './src/notifications';
import { checkForOTAUpdate } from './src/utils/otaUpdate';
import { startPlayUpdateChecks } from './src/utils/playUpdate';
import PlayUpdateGate from './src/components/PlayUpdateGate';
import { AppAlertHost } from './src/components/AppDialog';
import { SystemBarShade } from './src/navigation/drawerShade';

// Routes where the biometric prompt must NOT fire — splash, onboarding and
// every auth screen. Anything else is considered "inside the app" (dashboard
// and beyond), where the lock should activate.
const PUBLIC_ROUTES = new Set([
  'Splash',
  'Onboarding',
  'SelectUser',
  'TeacherLogin',
  'StudentLogin',
  'ForgotPassword',
]);

const AppInner = () => {
  const [inMainApp, setInMainApp] = useState(false);
  // Avoid spamming setState every navigation event when the answer hasn't
  // changed (and it changes only a handful of times per session).
  const lastValue = useRef(false);
  const insets = useSafeAreaInsets();

  const recheckRoute = useCallback(() => {
    const name = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
    const next = !!name && !PUBLIC_ROUTES.has(name);
    if (next !== lastValue.current) {
      lastValue.current = next;
      setInMainApp(next);
    }
  }, []);

  // The status-bar strip is painted with the same colour as the top bars so
  // the two read as one surface; the bottom inset keeps the page background.
  // The bar is translucent so the page reaches up under it and this strip is
  // what shows there: Android 15+ ignores a status bar colour, and a bar that is
  // not translucent shows the window's own grey (#FAFAFA) above the header.
  return (
    <View
      style={[
        styles.safeArea,
        { paddingTop: insets.top, backgroundColor: theme.colors.statusBar },
      ]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.statusBar}
        translucent
      />
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
        edges={['bottom']}
      >
        <AppLock active={inMainApp}>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              recheckRoute();
              // Open any notification tapped before the navigator was ready.
              flushPendingNavigation();
            }}
            onStateChange={recheckRoute}
          >
            <AppNavigator />
          </NavigationContainer>
        </AppLock>
      </SafeAreaView>

      {/* Dims the status and navigation bars along with an open sidebar */}
      <SystemBarShade />
    </View>
  );
};

const App = () => {
  // Set up the notification channel, permission and tap handling once.
  useEffect(() => {
    initNotifications();
    // Check for an over-the-air JS update in the background (release builds
    // only). New bundles are applied on the next cold start — no Play Store.
    checkForOTAUpdate();
    // Look for a newer Play Store build in the background while the splash
    // plays; it is offered once the next screen is up.
    startPlayUpdateChecks();
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppInner />
          {/* Draws every AppAlert.alert() popup */}
          <AppAlertHost />
          {/* Holds the app until a newer Play Store build is installed */}
          <PlayUpdateGate />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});

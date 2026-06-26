import 'react-native-gesture-handler';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  navigationRef,
  flushPendingNavigation,
} from './src/navigation/navigationRef';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import AppNavigator from './src/navigation/AppNavigator';
import AppLock from './src/components/AppLock';
import { ThemeProvider, theme } from './src/utils/theme';
import { initNotifications } from './src/notifications';

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

  const recheckRoute = useCallback(() => {
    const name = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
    const next = !!name && !PUBLIC_ROUTES.has(name);
    if (next !== lastValue.current) {
      lastValue.current = next;
      setInMainApp(next);
    }
  }, []);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.background}
        translucent={false}
      />
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
  );
};

const App = () => {
  // Set up the notification channel, permission and tap handling once.
  useEffect(() => {
    initNotifications();
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppInner />
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

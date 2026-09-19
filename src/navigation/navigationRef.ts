// ─────────────────────────────────────────────────────────────────────────────
//  Shared navigation ref + helper for deep-linking from notifications.
//
//  A notification carries `data.screen` (+ optional `data.params`). Tapping it
//  should open that screen from anywhere — including a cold start, where the
//  navigator isn't mounted yet. We queue the target until `onReady` flushes it.
// ─────────────────────────────────────────────────────────────────────────────
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

// Screens that live inside the Drawer (under the `DrawerRoot` stack screen)
// rather than directly on the root stack — they need nested navigation.
const DRAWER_SCREENS = new Set<string>([
  'Homework',
  'Attendance',
  'MarkAttendance',
  'Timetable',
  'Subjects',
  'Transport',
  'Fees',
]);

// Screens that come before the signed-in app: a tap waits until they give way
// to it (the splash replaces itself with the dashboard on a cold start).
const WAIT_ON = new Set<string>(['Splash', 'Onboarding']);

let pending: { screen: string; params?: Record<string, any> } | null = null;

/** Navigate to a notification's target screen, or queue it if not ready yet. */
export function navigateToScreen(
  screen?: string,
  params?: Record<string, any>,
): void {
  if (!screen) return;

  const current = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
  if (!current || WAIT_ON.has(current)) {
    pending = { screen, params };
    return;
  }

  // RN navigation's ref typing rejects dynamic (string, params) calls; the
  // codebase navigates with untyped routes, so cast to keep parity.
  const navigate = navigationRef.navigate as (options: {
    name: string;
    params?: Record<string, any>;
    merge?: boolean;
    pop?: boolean;
  }) => void;

  try {
    if (DRAWER_SCREENS.has(screen)) {
      // Back to the open drawer, keeping its params — the drawer reads the
      // signed-in role from them, so a teacher's stays a teacher's.
      const drawer = navigationRef.getRootState()?.routes.find(r => r.name === 'DrawerRoot');
      const userRole = (drawer?.params as { userRole?: string } | undefined)?.userRole;
      navigate({
        name: 'DrawerRoot',
        params: { ...(userRole ? { userRole } : {}), screen, params },
        merge: true,
        pop: true,
      });
    } else {
      navigate({ name: screen, params });
    }
  } catch (e) {
    console.log('[nav] navigateToScreen failed:', e);
  }
}

/** Flush a queued navigation once the app is on a signed-in screen (call from onReady and onStateChange). */
export function flushPendingNavigation(): void {
  if (pending) {
    const { screen, params } = pending;
    pending = null;
    navigateToScreen(screen, params);
  }
}

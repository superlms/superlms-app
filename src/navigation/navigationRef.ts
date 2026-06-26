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
]);

let pending: { screen: string; params?: Record<string, any> } | null = null;

/** Navigate to a notification's target screen, or queue it if not ready yet. */
export function navigateToScreen(
  screen?: string,
  params?: Record<string, any>,
): void {
  if (!screen) return;

  if (!navigationRef.isReady()) {
    pending = { screen, params };
    return;
  }

  // RN navigation's ref typing rejects dynamic (string, params) calls; the
  // codebase navigates with untyped routes, so cast to keep parity.
  const navigate = navigationRef.navigate as (
    name: string,
    params?: Record<string, any>,
  ) => void;

  try {
    if (DRAWER_SCREENS.has(screen)) {
      navigate('DrawerRoot', { screen, params });
    } else {
      navigate(screen, params);
    }
  } catch (e) {
    console.log('[nav] navigateToScreen failed:', e);
  }
}

/** Flush a queued navigation once the container is ready (call from onReady). */
export function flushPendingNavigation(): void {
  if (pending) {
    const { screen, params } = pending;
    pending = null;
    navigateToScreen(screen, params);
  }
}

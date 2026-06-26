import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, TouchableOpacity, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { Biometrics, isPromptInProgress } from '../utils/biometrics';
import { theme, onThemeChange } from '../utils/theme';

/**
 * Wraps the app and dims the dashboard while the system biometric prompt is
 * showing. No lock UI of its own — the dashboard underneath shows at ~92%
 * (a thin white veil) and the OS biometric sheet does all the work, like
 * banking / WhatsApp.
 *
 * The lock only activates after the user has crossed the splash / auth
 * screens (controlled by the `active` prop), so the biometric prompt fires
 * the moment the dashboard appears — not during splash.
 *
 * Locks on first arrival to the main app and whenever the app returns from
 * the background. If the user dismisses the sheet, tapping the dim overlay
 * re-fires it.
 */
const AppLock = ({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) => {
  const [locked, setLocked] = useState(false);
  // True while the system biometric sheet is open. The sheet (or the
  // device-credential fallback screen) can briefly background the app on
  // some devices, which must not re-trigger the lock.
  const promptActive = useRef(false);
  // Remember the first time the user reaches the main app, so we don't keep
  // re-locking every time they navigate around.
  const firstArrivalDone = useRef(false);

  const promptUnlock = useCallback(async () => {
    if (promptActive.current) return;
    promptActive.current = true;
    try {
      const { available } = await Biometrics.check();
      if (!available) {
        // Nothing left to authenticate with (biometrics removed and no
        // device PIN). Fail open instead of locking the user out forever.
        setLocked(false);
        return;
      }
      const success = await Biometrics.authenticate('Unlock Edyone LMS');
      if (success) setLocked(false);
    } finally {
      promptActive.current = false;
    }
  }, []);

  // Fire the lock the moment we first land on the main app (after splash /
  // auth). The same moment the dashboard mounts, the biometric sheet shows
  // and the dashboard underneath is dimmed.
  useEffect(() => {
    if (!active || firstArrivalDone.current) return;
    firstArrivalDone.current = true;
    let cancelled = false;
    Biometrics.isEnabled().then(enabled => {
      if (cancelled || !enabled) return;
      setLocked(true);
      promptUnlock();
    });
    return () => {
      cancelled = true;
    };
  }, [active, promptUnlock]);

  // Re-lock when the app goes to background (only if we're already in the
  // main app — never lock the splash / login screens).
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (
        state === 'background' &&
        active &&
        !promptActive.current &&
        !isPromptInProgress()
      ) {
        Biometrics.isEnabled().then(enabled => {
          if (enabled) setLocked(true);
        });
      }
    });
    return () => sub.remove();
  }, [active]);

  // Re-fire the prompt when we come back to the foreground while still
  // locked (covers the case where the user dismissed the sheet by going
  // home).
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && locked && !promptActive.current) {
        promptUnlock();
      }
    });
    return () => sub.remove();
  }, [locked, promptUnlock]);

  return (
    <View style={s.flex}>
      {children}
      {locked && (
        // Real frosted-glass blur over the dashboard at 15% strength; the
        // system biometric sheet draws on top. Tapping it re-fires the
        // prompt in case the user dismissed the system sheet.
        <TouchableOpacity
          activeOpacity={1}
          onPress={promptUnlock}
          style={s.overlay}
        >
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="light"
            blurAmount={15}
            reducedTransparencyFallbackColor={theme.colors.white}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default AppLock;

const __mk_s = () => StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

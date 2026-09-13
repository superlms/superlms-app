import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { Biometrics, isPromptInProgress } from '../utils/biometrics';
import { theme, onThemeChange } from '../utils/theme';

/**
 * Wraps the app and keeps it locked behind the system biometric prompt.
 *
 * The lock only activates after the user has crossed the splash / auth
 * screens (controlled by the `active` prop): the dashboard appears and, at the
 * same moment, the system prompt opens over it with the dashboard lightly
 * blurred behind.
 *
 * Dismissing the prompt (Back, or Cancel) leaves the app locked and shows a
 * small card — "SuperLMS is locked", why, and "Unlock now", which opens the
 * prompt again. Back does nothing else while locked, so the screens behind
 * can't be reached.
 *
 * Locks on first arrival to the main app and whenever the app returns from
 * the background.
 */
const AppLock = ({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) => {
  const [locked, setLocked] = useState(false);
  // True while the system prompt is (about to be) open; the card waits for it
  // to close. The ref guards against opening two prompts.
  const [prompting, setPrompting] = useState(false);
  // The sheet (or the device-credential fallback screen) can briefly
  // background the app on some devices, which must not re-trigger the lock.
  const promptActive = useRef(false);
  // Remember the first time the user reaches the main app, so we don't keep
  // re-locking every time they navigate around.
  const firstArrivalDone = useRef(false);

  const promptUnlock = useCallback(async () => {
    if (promptActive.current) return;
    promptActive.current = true;
    setPrompting(true);
    try {
      const { available } = await Biometrics.check();
      if (!available) {
        // Nothing left to authenticate with (biometrics removed and no
        // device PIN). Fail open instead of locking the user out forever.
        setLocked(false);
        return;
      }
      const success = await Biometrics.authenticate('Unlock SuperLMS');
      if (success) setLocked(false);
    } finally {
      promptActive.current = false;
      setPrompting(false);
    }
  }, []);

  // Fire the lock the moment we first land on the main app (after splash /
  // auth): the dashboard mounts, the prompt opens and the dashboard blurs.
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
  // main app — never lock the splash / login screens). The prompt reopens on
  // return, so the card isn't shown in between.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (
        state === 'background' &&
        active &&
        !promptActive.current &&
        !isPromptInProgress()
      ) {
        Biometrics.isEnabled().then(enabled => {
          if (!enabled) return;
          setLocked(true);
          setPrompting(true);
        });
      }
    });
    return () => sub.remove();
  }, [active]);

  // Re-open the prompt when we come back to the foreground while still locked.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && locked && !promptActive.current) {
        promptUnlock();
      }
    });
    return () => sub.remove();
  }, [locked, promptUnlock]);

  // While locked, Back stays on the lock — it must not move the app behind it.
  useEffect(() => {
    if (!locked) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [locked]);

  return (
    <View style={s.flex}>
      {children}
      {locked && (
        // A light frosted blur over the dashboard; the system prompt draws on
        // top of it. It takes every touch, so nothing behind can be used.
        <View style={s.overlay} onStartShouldSetResponder={() => true}>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="light"
            blurAmount={6}
            reducedTransparencyFallbackColor={theme.colors.white}
          />

          {!prompting && (
            <View style={s.center}>
              <View style={s.card}>
                <View style={s.cardBody}>
                  <Text style={s.title}>SuperLMS is locked</Text>
                  <Text style={s.desc}>Authentication is required to access this app.</Text>
                </View>
                <View style={s.divider} />
                <TouchableOpacity style={s.unlock} activeOpacity={0.6} onPress={promptUnlock}>
                  <Text style={s.unlockText}>Unlock now</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  // Locked card: title and reason, a full-width rule, then the action across the card
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardBody: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  title: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary, textAlign: 'center' },
  desc: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  divider: { height: 1, backgroundColor: theme.colors.border },
  unlock: { height: 52, alignItems: 'center', justifyContent: 'center' },
  unlockText: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

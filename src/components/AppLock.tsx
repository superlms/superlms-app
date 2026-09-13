import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Biometrics, isPromptInProgress } from '../utils/biometrics';
import { theme, onThemeChange } from '../utils/theme';

/**
 * Wraps the app and keeps it locked behind the system biometric prompt.
 *
 * The lock only activates after the user has crossed the splash / auth
 * screens (controlled by the `active` prop): the dashboard appears and, at the
 * same moment, the system prompt opens over it with the dashboard faintly
 * veiled behind.
 *
 * Dismissing the prompt (Back, or Cancel) leaves the app locked and shows a
 * small card — "SuperLMS is locked", why, and "Unlock now", which opens the
 * prompt again. Back does nothing else while locked, so the screens behind
 * can't be reached. Once unlocked the veil is gone at once.
 *
 * The veil is a plain translucent view, not a native blur: on Android the blur
 * view snapshots the screen (grey if it was taken mid-transition) and could stay
 * drawn after it was removed, leaving the dashboard dull after unlocking.
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
  // to close.
  const [prompting, setPrompting] = useState(false);

  // Read by the AppState listener, which outlives renders: the latest lock
  // state, and whether a prompt is open (so two are never opened). The sheet
  // or the device-credential fallback screen can briefly background the app on
  // some devices, which must not re-trigger the lock.
  const lockedRef = useRef(false);
  const promptActive = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  // Remember the first time the user reaches the main app, so we don't keep
  // re-locking every time they navigate around.
  const firstArrivalDone = useRef(false);

  const lock = useCallback((withPrompt: boolean) => {
    lockedRef.current = true;
    setLocked(true);
    if (withPrompt) setPrompting(true);
  }, []);

  const unlock = useCallback(() => {
    lockedRef.current = false;
    setLocked(false);
    setPrompting(false);
  }, []);

  const promptUnlock = useCallback(async () => {
    if (promptActive.current) return;
    promptActive.current = true;
    setPrompting(true);
    try {
      const { available } = await Biometrics.check();
      if (!available) {
        // Nothing left to authenticate with (biometrics removed and no
        // device PIN). Fail open instead of locking the user out forever.
        unlock();
        return;
      }
      const success = await Biometrics.authenticate('Unlock SuperLMS');
      if (success) unlock();
    } finally {
      promptActive.current = false;
      setPrompting(false);
    }
  }, [unlock]);

  // Fire the lock the moment we first land on the main app (after splash /
  // auth): the dashboard mounts and the prompt opens over it.
  useEffect(() => {
    if (!active || firstArrivalDone.current) return;
    firstArrivalDone.current = true;
    let cancelled = false;
    Biometrics.isEnabled().then(enabled => {
      if (cancelled || !enabled) return;
      lock(true);
      promptUnlock();
    });
    return () => {
      cancelled = true;
    };
  }, [active, lock, promptUnlock]);

  // Background: re-lock (only once in the main app — never on splash / login).
  // The prompt reopens on return, so the card isn't shown in between.
  // Foreground while still locked: open the prompt again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') {
        if (!activeRef.current || promptActive.current || isPromptInProgress()) return;
        Biometrics.isEnabled().then(enabled => {
          if (enabled) lock(true);
        });
      } else if (state === 'active' && lockedRef.current && !promptActive.current) {
        promptUnlock();
      }
    });
    return () => sub.remove();
  }, [lock, promptUnlock]);

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
        // A faint frosted veil over the dashboard; the system prompt draws on
        // top of it. It takes every touch, so nothing behind can be used.
        <View style={s.overlay} onStartShouldSetResponder={() => true}>
          <View style={[StyleSheet.absoluteFill, s.veil]} />

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
  // The page colour at 70%: the dashboard shows through, softened.
  veil: { backgroundColor: 'rgba(248, 250, 252, 0.7)' },
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

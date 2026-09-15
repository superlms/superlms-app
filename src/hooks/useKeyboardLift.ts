import { useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';
import {
  Easing,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';

/**
 * Keeps whatever is pinned to the bottom of a screen — a chat composer, a
 * submit bar — above the keyboard.
 *
 *   const lift = useKeyboardLiftStyle();
 *   <Animated.View style={[s.root, lift]}>…</Animated.View>
 *
 * Android has drawn edge to edge since React Native 0.81, so the window is no
 * longer resized when the keyboard opens: `adjustResize` in the manifest does
 * nothing, KeyboardAvoidingView has nothing to react to, and React Native's own
 * `keyboardDidShow` event can stay silent because it is derived from that same
 * resize. Reanimated reads the keyboard straight off the window insets instead,
 * which is reported whether or not anything resizes — and it is already a
 * dependency here, since the drawer navigator runs on it.
 *
 * The JS keyboard events are still watched and the larger of the two heights
 * wins, so the screen lifts even on a device where only one of them reports.
 *
 * Both heights already leave out the phone's navigation bar, which the app sits
 * above (App.tsx wraps everything in a SafeAreaView with the bottom edge), so
 * the content is lifted by the whole of either — taking the bar off again left
 * a chat's composer under the keyboard by the bar's height.
 */
export function useKeyboardLiftStyle(): AnimatedStyle {
  const keyboard = useAnimatedKeyboard();
  const jsHeight = useSharedValue(0);

  useEffect(() => {
    // iOS announces the keyboard before it animates, Android only after.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subs = [
      Keyboard.addListener(showEvent, e => {
        jsHeight.value = e?.endCoordinates?.height ?? 0;
      }),
      Keyboard.addListener(hideEvent, () => {
        jsHeight.value = 0;
      }),
    ];
    return () => subs.forEach(sub => sub.remove());
  }, [jsHeight]);

  return useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboard.height.value, jsHeight.value),
  }));
}

/**
 * The keyboard's height as it opens and closes, for something that rides above
 * it — a bottom sheet in a Modal, say.
 *
 * Reanimated follows the keyboard frame by frame where the window reports it.
 * An Android Modal is a window of its own, where that tracking can stay at zero
 * and only React Native's events arrive, once the keyboard is already open or
 * shut; their height is eased in and out rather than set, so nothing jumps
 * into place.
 */
export function useKeyboardHeight() {
  const keyboard = useAnimatedKeyboard();
  const jsHeight = useSharedValue(0);

  useEffect(() => {
    // iOS announces the keyboard before it animates, Android only after.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const ease = (to: number, duration?: number) =>
      withTiming(to, { duration: duration || 250, easing: Easing.out(Easing.cubic) });

    const subs = [
      Keyboard.addListener(showEvent, e => {
        jsHeight.value = ease(e?.endCoordinates?.height ?? 0, e?.duration);
      }),
      Keyboard.addListener(hideEvent, e => {
        jsHeight.value = ease(0, e?.duration);
      }),
    ];
    return () => subs.forEach(sub => sub.remove());
  }, [jsHeight]);

  return useDerivedValue(() => Math.max(keyboard.height.value, jsHeight.value));
}

export default useKeyboardLiftStyle;

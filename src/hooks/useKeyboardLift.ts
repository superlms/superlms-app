import { useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
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
 * The app already sits above the bottom safe area (App.tsx wraps everything in
 * a SafeAreaView with the bottom edge), so only the part of the keyboard that
 * actually overlaps the content is made up for.
 */
export function useKeyboardLiftStyle(): AnimatedStyle {
  const insets = useSafeAreaInsets();
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

  return useAnimatedStyle(() => {
    const height = Math.max(keyboard.height.value, jsHeight.value);
    return { paddingBottom: Math.max(0, height - insets.bottom) };
  });
}

export default useKeyboardLiftStyle;

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How far a screen has to lift its content so the keyboard does not sit on top
 * of it.
 *
 * Android draws edge to edge from React Native 0.81 on, which means the window
 * is no longer resized when the keyboard opens — `adjustResize` in the manifest
 * has no effect any more and anything pinned to the bottom (a chat composer,
 * a submit bar) ends up underneath the keyboard. Measuring the keyboard and
 * padding the screen ourselves behaves the same on both platforms, and does not
 * depend on KeyboardAvoidingView guessing right.
 *
 *   const lift = useKeyboardLift();
 *   <View style={[s.root, { paddingBottom: lift }]}>…</View>
 *
 * The app already sits above the bottom safe area (App.tsx wraps everything in
 * a SafeAreaView with the bottom edge), so only the part of the keyboard that
 * overlaps the content is returned.
 */
export function useKeyboardLift(): number {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS announces the keyboard before it animates, Android only after.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subs = [
      Keyboard.addListener(showEvent, e => setHeight(e?.endCoordinates?.height ?? 0)),
      Keyboard.addListener(hideEvent, () => setHeight(0)),
    ];
    return () => subs.forEach(sub => sub.remove());
  }, []);

  return height > 0 ? Math.max(0, height - insets.bottom) : 0;
}

export default useKeyboardLift;

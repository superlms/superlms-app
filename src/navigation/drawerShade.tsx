import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { makeMutable, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDrawerProgress } from '@react-navigation/drawer';
import { theme, onThemeChange } from '../utils/theme';

/**
 * The app lays out edge to edge, and its root paints the status bar strip and
 * the phone's navigation bar strip itself, outside the navigators. An open
 * sidebar's dimmed backdrop and its sheet therefore stop short of both bars.
 *
 * A drawer reports how far open it is through DrawerShadeBridge, and
 * SystemBarShade — drawn once at the root, over both strips — follows it: the
 * sidebar's colour across its own width, the same dim as the backdrop beside it.
 */

// How far open the sidebar is (0–1), and the share of the screen's width it takes.
const progress = makeMutable(0);
const widthShare = makeMutable(0.74);

/** Rendered inside a drawer's content: passes on how far open the drawer is. */
export const DrawerShadeBridge = ({ widthFraction }: { widthFraction: number }) => {
  const drawerProgress = useDrawerProgress();

  useAnimatedReaction(
    () => drawerProgress.value,
    value => {
      progress.value = value;
      widthShare.value = widthFraction;
    },
    [widthFraction],
  );

  // A drawer that goes away while open (e.g. on log out) must not leave the bars dimmed.
  useEffect(
    () => () => {
      progress.value = 0;
    },
    [],
  );

  return null;
};

// One strip: the dim across it, and the sidebar's colour sliding in over its left part.
const BarShade = ({ edge, height }: { edge: 'top' | 'bottom'; height: number }) => {
  const { width } = useWindowDimensions();

  // Matches the drawer's own backdrop (rgba(0,0,0,0.5) faded in with progress)
  // and its sheet's slide from the left.
  const dim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheet = useAnimatedStyle(() => ({
    width: width * widthShare.value,
    transform: [{ translateX: (progress.value - 1) * width * widthShare.value }],
  }));

  if (height <= 0) return null;

  return (
    <View pointerEvents="none" style={[s.bar, edge === 'top' ? s.top : s.bottom, { height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, s.dim, dim]} />
      <Animated.View style={[s.sheet, sheet]} />
    </View>
  );
};

/** Drawn once at the app's root, over the status bar and navigation bar strips. */
export const SystemBarShade = () => {
  const insets = useSafeAreaInsets();
  return (
    <>
      <BarShade edge="top" height={insets.top} />
      <BarShade edge="bottom" height={insets.bottom} />
    </>
  );
};

const __mk_s = () => StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  top: { top: 0 },
  bottom: { bottom: 0 },
  dim: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheet: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDrawerProgress } from '@react-navigation/drawer';
import { theme, onThemeChange } from '../utils/theme';

/**
 * The app lays out edge to edge, and its root paints the status bar strip and
 * the phone's navigation bar strip itself, outside the navigators. An open
 * sidebar's dimmed backdrop and its sheet therefore stop short of both bars.
 *
 * A drawer hands its own progress value over through DrawerShadeBridge, and
 * SystemBarShade — drawn once at the root, over both strips — follows it: the
 * sidebar's colour across its own width, the same dim as the backdrop beside it.
 *
 * The strips read the drawer's progress itself, not a copy made in a reaction:
 * Reanimated cannot run a reaction's writes before the styles that read them,
 * so a copy reached the strips a frame after the drawer had moved and the
 * status bar trailed the sidebar, cut off from it, as it slid.
 */

type DrawerProgress = ReturnType<typeof useDrawerProgress>;
type Shade = { progress: DrawerProgress; widthFraction: number; owner: object } | null;

// The open drawer's progress and the share of the screen's width it takes.
let current: Shade = null;
const listeners = new Set<() => void>();

const setShade = (next: Shade) => {
  current = next;
  listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getShade = () => current;

/** Rendered inside a drawer's content: hands over how far open the drawer is. */
export const DrawerShadeBridge = ({ widthFraction }: { widthFraction: number }) => {
  const progress = useDrawerProgress();

  useEffect(() => {
    const owner = {};
    setShade({ progress, widthFraction, owner });
    // A drawer that goes away while open (e.g. on log out) must not leave the bars dimmed.
    return () => {
      if (current?.owner === owner) setShade(null);
    };
  }, [progress, widthFraction]);

  return null;
};

// One strip: the dim across it, and the sidebar's colour sliding in over its left part.
const BarShade = ({
  edge,
  height,
  progress,
  widthFraction,
}: {
  edge: 'top' | 'bottom';
  height: number;
  progress: DrawerProgress;
  widthFraction: number;
}) => {
  const { width } = useWindowDimensions();
  const sheetWidth = width * widthFraction;

  // Matches the drawer's own backdrop (rgba(0,0,0,0.5) faded in with progress)
  // and its sheet's slide from the left.
  const dim = useAnimatedStyle(() => ({ opacity: progress.value }), [progress]);
  const sheet = useAnimatedStyle(
    () => ({
      width: sheetWidth,
      transform: [{ translateX: (progress.value - 1) * sheetWidth }],
    }),
    [progress, sheetWidth],
  );

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
  const shade = useSyncExternalStore(subscribe, getShade);

  if (!shade) return null;

  return (
    <>
      <BarShade edge="top" height={insets.top} progress={shade.progress} widthFraction={shade.widthFraction} />
      <BarShade
        edge="bottom"
        height={insets.bottom}
        progress={shade.progress}
        widthFraction={shade.widthFraction}
      />
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

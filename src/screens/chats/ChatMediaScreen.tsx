import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import VectorIcon from '../../components/VectorIcon';
import { DocHeader } from '../more/docUi';
import { theme, onThemeChange } from '../../utils/theme';
import { fileUri, readTextFile } from './chatFiles';

/**
 * A chat's photo or text file, opened in the app from this phone's copy.
 *
 * Route params:
 *   path – the file on this phone
 *   name – its name, for the header
 *   kind – 'image' | 'text'
 *
 * A photo pinches to zoom, moves while zoomed, and a double tap zooms in or
 * back out.
 */

const MAX_ZOOM = 5;

export const ZoomImage = ({ uri, onError }: { uri: string; onError: () => void }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);

  const gesture = useMemo(() => {
    const resetZoom = () => {
      'worklet';
      scale.value = withTiming(1);
      savedScale.value = 1;
      x.value = withTiming(0);
      y.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
    };

    // Keeps a zoomed photo from being moved off its own edges.
    const settle = () => {
      'worklet';
      const maxX = (width.value * (savedScale.value - 1)) / 2;
      const maxY = (height.value * (savedScale.value - 1)) / 2;
      const nextX = Math.min(Math.max(x.value, -maxX), maxX);
      const nextY = Math.min(Math.max(y.value, -maxY), maxY);
      x.value = withTiming(nextX);
      y.value = withTiming(nextY);
      savedX.value = nextX;
      savedY.value = nextY;
    };

    const pinch = Gesture.Pinch()
      .onUpdate(e => {
        scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_ZOOM);
      })
      .onEnd(() => {
        if (scale.value <= 1.01) {
          resetZoom();
        } else {
          savedScale.value = scale.value;
          settle();
        }
      });

    const pan = Gesture.Pan()
      .averageTouches(true)
      .onUpdate(e => {
        if (savedScale.value > 1 || scale.value > 1) {
          x.value = savedX.value + e.translationX;
          y.value = savedY.value + e.translationY;
        }
      })
      .onEnd(() => {
        if (savedScale.value > 1) settle();
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        if (savedScale.value > 1) {
          resetZoom();
        } else {
          scale.value = withTiming(2.5);
          savedScale.value = 2.5;
        }
      });

    return Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));
  }, [scale, savedScale, x, y, savedX, savedY, width, height]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={s.fill}
        onLayout={e => {
          width.value = e.nativeEvent.layout.width;
          height.value = e.nativeEvent.layout.height;
        }}
      >
        <Animated.Image source={{ uri }} style={[s.fill, style]} resizeMode="contain" onError={onError} />
      </View>
    </GestureDetector>
  );
};

const ChatMediaScreen = ({ navigation, route }: any) => {
  const path: string | undefined = route?.params?.path;
  const name: string = route?.params?.name || 'File';
  const kind: 'image' | 'text' = route?.params?.kind === 'text' ? 'text' : 'image';

  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== 'text' || !path) return;
    readTextFile(path)
      .then(setText)
      .catch(() => setError('Couldn’t open this file.'));
  }, [kind, path]);

  const failed = !path || error;

  return (
    <View style={s.root}>
      <DocHeader title={name} onBackPress={() => navigation.goBack()} />

      {failed ? (
        <View style={s.center}>
          <VectorIcon iconSet="Ionicons" iconName="document-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.stateText}>{error ?? 'This file is not on this phone.'}</Text>
        </View>
      ) : kind === 'text' ? (
        text === null ? (
          <View style={s.center}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.textWrap}>
            <Text selectable style={s.text}>
              {text}
            </Text>
          </ScrollView>
        )
      ) : (
        <View style={s.stage}>
          <ZoomImage uri={fileUri(path)} onError={() => setError('Couldn’t open this photo.')} />
        </View>
      )}
    </View>
  );
};

export default ChatMediaScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  // Photos on black, under the app's own header
  stage: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  fill: { flex: 1, width: '100%' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  stateText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  textWrap: { padding: 20 },
  text: { fontSize: 14, lineHeight: 21, color: theme.colors.textPrimary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

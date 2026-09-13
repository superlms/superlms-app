import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The framed square, as fractions (0–1) of the upright photo's width and height. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAX_ZOOM = 4;
const EDGE = 24;               // space either side of the frame
const SHADE = 'rgba(0,0,0,0.6)';
const FAR = 2000;              // shades reach well past any screen edge

// Full-screen square cropper for profile photos. The photo always covers the
// frame: it can be dragged and pinched, but never pulled clear of it. Nothing
// is cut on the phone — the square goes back as fractions of the photo and the
// server makes the cut, so this needs no native module.
const PhotoCropper = ({
  uri,
  width,
  height,
  onCancel,
  onDone,
}: {
  uri: string | null;
  /** Upright pixel size, as the image picker reports it. */
  width?: number;
  height?: number;
  onCancel: () => void;
  onDone: (crop: CropRect) => void;
}) => {
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const frameSize = Math.min(win.width, win.height) - EDGE * 2;
  // The photo is first sized to just cover the frame (zoom 1).
  const cover = size ? frameSize / Math.min(size.w, size.h) : 1;
  const shownW = size ? size.w * cover : frameSize;
  const shownH = size ? size.h * cover : frameSize;

  const zoom = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const baseW = useSharedValue(shownW);
  const baseH = useSharedValue(shownH);
  const frame = useSharedValue(frameSize);

  useEffect(() => {
    zoom.value = 1;
    tx.value = 0;
    ty.value = 0;
    setFailed(false);
    if (!uri) {
      setSize(null);
    } else if (width && height) {
      setSize({ w: width, h: height });
    } else {
      setSize(null);
      Image.getSize(uri, (w, h) => setSize({ w, h }), () => setFailed(true));
    }
  }, [uri, width, height, zoom, tx, ty]);

  useEffect(() => {
    baseW.value = shownW;
    baseH.value = shownH;
    frame.value = frameSize;
  }, [shownW, shownH, frameSize, baseW, baseH, frame]);

  // Furthest the photo's centre may sit from the frame's centre at a zoom.
  const clamp = (v: number, z: number, base: number) => {
    'worklet';
    const lim = Math.max(0, (base * z - frame.value) / 2);
    return Math.min(lim, Math.max(-lim, v));
  };

  const pinch = Gesture.Pinch().onChange(e => {
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom.value * e.scaleChange));
    zoom.value = z;
    tx.value = clamp(tx.value, z, baseW.value);
    ty.value = clamp(ty.value, z, baseH.value);
  });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onChange(e => {
      tx.value = clamp(tx.value + e.changeX, zoom.value, baseW.value);
      ty.value = clamp(ty.value + e.changeY, zoom.value, baseH.value);
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: zoom.value }],
  }));

  const finish = () => {
    if (!size) return;
    const w = shownW * zoom.value;
    const h = shownH * zoom.value;
    const fit = (v: number) => Math.min(1, Math.max(0, v));
    onDone({
      x: fit(((w - frameSize) / 2 - tx.value) / w),
      y: fit(((h - frameSize) / 2 - ty.value) / h),
      w: fit(frameSize / w),
      h: fit(frameSize / h),
    });
  };

  return (
    <Modal
      visible={!!uri}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <GestureHandlerRootView style={c.root}>
        <View style={[c.top, { paddingTop: insets.top + 14 }]}>
          <Text style={c.hint}>Drag and pinch to fit your face in the circle</Text>
        </View>

        <GestureDetector gesture={gesture}>
          <View style={c.stage}>
            {size && uri ? (
              <View style={{ width: frameSize, height: frameSize }}>
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      width: shownW,
                      height: shownH,
                      left: (frameSize - shownW) / 2,
                      top: (frameSize - shownH) / 2,
                    },
                    photoStyle,
                  ]}
                >
                  <Image source={{ uri }} style={{ width: shownW, height: shownH }} />
                </Animated.View>

                {/* Shade everything outside the square, then ring the circle
                    the avatar will actually show. */}
                <View pointerEvents="none" style={[c.shade, c.shadeTop]} />
                <View pointerEvents="none" style={[c.shade, c.shadeBottom]} />
                <View pointerEvents="none" style={[c.shade, c.shadeLeft]} />
                <View pointerEvents="none" style={[c.shade, c.shadeRight]} />
                <View pointerEvents="none" style={[c.ring, { borderRadius: frameSize / 2 }]} />
              </View>
            ) : failed ? (
              <Text style={c.hint}>This photo could not be opened.</Text>
            ) : (
              <ActivityIndicator color="#fff" />
            )}
          </View>
        </GestureDetector>

        <View style={[c.bar, { paddingBottom: insets.bottom + 14 }]}>
          <TouchableOpacity onPress={onCancel} hitSlop={10} activeOpacity={0.6}>
            <Text style={c.cancel}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={finish} disabled={!size} hitSlop={10} activeOpacity={0.6}>
            <Text style={[c.done, !size && c.doneOff]}>Use photo</Text>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default PhotoCropper;

// Always dark, whatever the app theme — a photo is judged best on black.
const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { paddingHorizontal: 20, paddingBottom: 14, alignItems: 'center', backgroundColor: '#000', zIndex: 1 },
  hint: { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  shade: { position: 'absolute', backgroundColor: SHADE },
  shadeTop: { left: -FAR, right: -FAR, bottom: '100%', height: FAR },
  shadeBottom: { left: -FAR, right: -FAR, top: '100%', height: FAR },
  shadeLeft: { top: 0, bottom: 0, right: '100%', width: FAR },
  shadeRight: { top: 0, bottom: 0, left: '100%', width: FAR },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },

  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#000',
    zIndex: 1,
  },
  cancel: { fontSize: 16, color: '#fff' },
  done: { fontSize: 16, fontWeight: '600', color: '#fff' },
  doneOff: { opacity: 0.4 },
});

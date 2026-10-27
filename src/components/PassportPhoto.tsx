import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VectorIcon from './VectorIcon';
import type { CropRect } from './PhotoCropper';
import type { PhotoEdit } from './PhotoEditor';
import { UploadStatus } from './TransferToast';

/**
 * A passport-size photo (35 × 45 mm) for a student or a teacher. The frame
 * stays put in the middle of the screen; the photo moves under it — dragged
 * with a finger, zoomed in and out with two fingers or − and + — and it always
 * fills the frame. Whatever shows inside the frame is the photo that is saved:
 * nothing else to crop.
 *
 * Nothing is cut on the phone: `crop` goes to the server as fractions of the
 * upright photo and the server cuts it (App\Support\PhotoCrop), so this needs
 * no native module and ships over the air. `circle` — the top square of the
 * frame, where the face is — lets a form show the round photo the lists will
 * show before it is saved.
 */

/** Width ÷ height of a passport photo: 35 mm × 45 mm. */
export const PASSPORT_RATIO = 35 / 45;

const MAX_ZOOM = 5;
const STEP = 1.25; // one press of − or +
const EDGE = 28; // room round the frame, the photo dimmed there
const SHADE = 'rgba(0,0,0,0.62)';
const FAR = 2000; // the shades reach well past any screen edge

const fit = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The part kept, and the round photo the lists show of it: the top square of
 * the part (its full width, as tall as it is wide), as fractions of the photo.
 */
export const passportEdit = (crop: CropRect, nat: { w: number; h: number }): PhotoEdit => ({
  crop,
  circle: { x: crop.x, y: crop.y, w: crop.w, h: Math.min(crop.h, (crop.w * nat.w) / nat.h) },
});

/** The selector itself, to sit in a full screen of its own (inside a Modal). */
export const PassportPhotoView = ({
  uri,
  width,
  height,
  title = 'Passport size photo',
  doneLabel = 'Use photo',
  busy = false,
  onCancel,
  onDone,
}: {
  uri: string;
  /** Upright pixel size, when the picker knows it. */
  width?: number;
  height?: number;
  title?: string;
  doneLabel?: string;
  /** Saving: the buttons wait, and the photo shows it is going up. */
  busy?: boolean;
  onCancel: () => void;
  onDone: (edit: PhotoEdit) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (width && height) {
      setNat({ w: width, h: height });
    } else {
      setNat(null);
      Image.getSize(
        uri,
        (w, h) => alive && w > 0 && h > 0 && setNat({ w, h }),
        () => alive && setFailed(true),
      );
    }
    return () => {
      alive = false;
    };
  }, [uri, width, height]);

  // The frame: as big as the stage allows, 35 : 45.
  const frameW = stage ? Math.max(80, Math.min(stage.w - EDGE * 2, (stage.h - EDGE * 2) * PASSPORT_RATIO)) : 0;
  const frameH = frameW / PASSPORT_RATIO;
  // The photo first just covers the frame (zoom 1).
  const cover = nat && frameW ? Math.max(frameW / nat.w, frameH / nat.h) : 1;
  const shownW = nat ? nat.w * cover : frameW;
  const shownH = nat ? nat.h * cover : frameH;

  const zoom = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const baseW = useSharedValue(shownW);
  const baseH = useSharedValue(shownH);
  const fw = useSharedValue(frameW);
  const fh = useSharedValue(frameH);

  // Another photo: back to the whole of it, centred.
  useEffect(() => {
    zoom.value = 1;
    tx.value = 0;
    ty.value = 0;
  }, [uri, zoom, tx, ty]);

  useEffect(() => {
    baseW.value = shownW;
    baseH.value = shownH;
    fw.value = frameW;
    fh.value = frameH;
    // The screen turned or the photo came: kept covering the frame.
    const limX = Math.max(0, (shownW * zoom.value - frameW) / 2);
    const limY = Math.max(0, (shownH * zoom.value - frameH) / 2);
    tx.value = Math.min(limX, Math.max(-limX, tx.value));
    ty.value = Math.min(limY, Math.max(-limY, ty.value));
  }, [shownW, shownH, frameW, frameH, baseW, baseH, fw, fh, zoom, tx, ty]);

  // Furthest the photo's centre may sit from the frame's centre at a zoom.
  const clampX = (v: number, z: number) => {
    'worklet';
    const lim = Math.max(0, (baseW.value * z - fw.value) / 2);
    return Math.min(lim, Math.max(-lim, v));
  };
  const clampY = (v: number, z: number) => {
    'worklet';
    const lim = Math.max(0, (baseH.value * z - fh.value) / 2);
    return Math.min(lim, Math.max(-lim, v));
  };

  const pinch = Gesture.Pinch().onChange(e => {
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom.value * e.scaleChange));
    zoom.value = z;
    tx.value = clampX(tx.value, z);
    ty.value = clampY(ty.value, z);
  });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onChange(e => {
      tx.value = clampX(tx.value + e.changeX, zoom.value);
      ty.value = clampY(ty.value + e.changeY, zoom.value);
    });

  // A double tap zooms in a step, and from all the way in back out.
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const z = zoom.value >= MAX_ZOOM - 0.01 ? 1 : Math.min(MAX_ZOOM, zoom.value * STEP * STEP);
      zoom.value = withTiming(z, { duration: 180 });
      tx.value = withTiming(clampX(tx.value, z), { duration: 180 });
      ty.value = withTiming(clampY(ty.value, z), { duration: 180 });
    });

  const gesture = Gesture.Simultaneous(pan, pinch, doubleTap);

  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: zoom.value }],
  }));

  // − and +: a step out or in about the middle of the frame.
  const zoomBy = (k: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom.value * k));
    const ratio = z / zoom.value;
    const limX = Math.max(0, (shownW * z - frameW) / 2);
    const limY = Math.max(0, (shownH * z - frameH) / 2);
    zoom.value = withTiming(z, { duration: 160 });
    tx.value = withTiming(Math.min(limX, Math.max(-limX, tx.value * ratio)), { duration: 160 });
    ty.value = withTiming(Math.min(limY, Math.max(-limY, ty.value * ratio)), { duration: 160 });
  };

  const reset = () => {
    zoom.value = withTiming(1, { duration: 160 });
    tx.value = withTiming(0, { duration: 160 });
    ty.value = withTiming(0, { duration: 160 });
  };

  const finish = () => {
    if (!nat || !frameW || busy) return;
    const w = shownW * zoom.value;
    const h = shownH * zoom.value;
    const crop: CropRect = {
      x: fit(((w - frameW) / 2 - tx.value) / w),
      y: fit(((h - frameH) / 2 - ty.value) / h),
      w: fit(frameW / w),
      h: fit(frameH / h),
    };
    onDone(passportEdit(crop, nat));
  };

  const onStage = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (!stage || Math.abs(stage.w - w) > 1 || Math.abs(stage.h - h) > 1) setStage({ w, h });
  };

  const ready = !!nat && frameW > 0;

  return (
    <GestureHandlerRootView style={c.root}>
      <View style={[c.top, { paddingTop: insets.top + 12 }]}>
        <Text style={c.title}>{title}</Text>
        <Text style={c.hint}>Move the photo and zoom in or out — what is inside the frame is saved.</Text>
      </View>

      <GestureDetector gesture={gesture}>
        <View style={c.stage} onLayout={onStage}>
          {ready ? (
            <View style={{ width: frameW, height: frameH }}>
              <Animated.View
                style={[
                  c.photoBox,
                  { width: shownW, height: shownH, left: (frameW - shownW) / 2, top: (frameH - shownH) / 2 },
                  photoStyle,
                ]}
              >
                <Image source={{ uri }} style={{ width: shownW, height: shownH }} />
              </Animated.View>

              {/* Dimmed outside the frame; the frame, and a guide for the face. */}
              <View pointerEvents="none" style={[c.shade, c.shadeTop]} />
              <View pointerEvents="none" style={[c.shade, c.shadeBottom]} />
              <View pointerEvents="none" style={[c.shade, c.shadeLeft]} />
              <View pointerEvents="none" style={[c.shade, c.shadeRight]} />
              <View pointerEvents="none" style={c.frame} />
              <View
                pointerEvents="none"
                style={[
                  c.face,
                  {
                    width: frameW * 0.58,
                    height: frameH * 0.6,
                    left: frameW * 0.21,
                    top: frameH * 0.1,
                    borderRadius: frameW,
                  },
                ]}
              />
              {busy && <UploadStatus color="#fff" style={c.busy} />}
            </View>
          ) : failed ? (
            <Text style={c.hint}>This photo could not be opened.</Text>
          ) : (
            <ActivityIndicator color="#fff" />
          )}
        </View>
      </GestureDetector>

      <Text style={c.size}>35 × 45 mm · keep the face inside the oval</Text>

      <View style={c.zoomRow}>
        <TouchableOpacity style={c.zoomBtn} onPress={() => zoomBy(1 / STEP)} disabled={!ready || busy} hitSlop={6} accessibilityLabel="Zoom out">
          <VectorIcon iconSet="Ionicons" iconName="remove" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={c.resetBtn} onPress={reset} disabled={!ready || busy} hitSlop={6} accessibilityLabel="Whole photo">
          <VectorIcon iconSet="Ionicons" iconName="scan-outline" size={16} color="#fff" />
          <Text style={c.resetText}>Fit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={c.zoomBtn} onPress={() => zoomBy(STEP)} disabled={!ready || busy} hitSlop={6} accessibilityLabel="Zoom in">
          <VectorIcon iconSet="Ionicons" iconName="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[c.bar, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity onPress={onCancel} disabled={busy} hitSlop={10} activeOpacity={0.6}>
          <Text style={[c.cancel, busy && c.off]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={finish} disabled={!ready || busy} hitSlop={10} activeOpacity={0.6}>
          <Text style={[c.done, (!ready || busy) && c.off]}>{busy ? 'Saving…' : doneLabel}</Text>
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  );
};

/** The selector over the screen: shown while `uri` is set. */
const PassportPhoto = ({
  uri,
  width,
  height,
  title,
  doneLabel = 'Use photo',
  busy = false,
  onCancel,
  onDone,
}: {
  uri: string | null;
  width?: number;
  height?: number;
  title?: string;
  doneLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onDone: (edit: PhotoEdit) => void;
}) => (
  <Modal visible={!!uri} animationType="fade" statusBarTranslucent onRequestClose={() => !busy && onCancel()}>
    {!!uri && (
      <PassportPhotoView
        uri={uri}
        width={width}
        height={height}
        title={title}
        doneLabel={doneLabel}
        busy={busy}
        onCancel={onCancel}
        onDone={onDone}
      />
    )}
  </Modal>
);

export default PassportPhoto;

// Always dark, whatever the app theme — a photo is judged best on black.
const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { paddingHorizontal: 24, paddingBottom: 10, alignItems: 'center', gap: 4, backgroundColor: '#000', zIndex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  hint: { fontSize: 13, color: 'rgba(255,255,255,0.72)', textAlign: 'center', lineHeight: 18 },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoBox: { position: 'absolute' },

  shade: { position: 'absolute', backgroundColor: SHADE },
  shadeTop: { left: -FAR, right: -FAR, bottom: '100%', height: FAR },
  shadeBottom: { left: -FAR, right: -FAR, top: '100%', height: FAR },
  shadeLeft: { top: 0, bottom: 0, right: '100%', width: FAR },
  shadeRight: { top: 0, bottom: 0, left: '100%', width: FAR },
  frame: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2, borderColor: '#fff' },
  face: { position: 'absolute', borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.55)' },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },

  size: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', paddingTop: 10, backgroundColor: '#000', zIndex: 1 },

  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingTop: 12,
    backgroundColor: '#000',
    zIndex: 1,
  },
  zoomBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  resetText: { fontSize: 13, fontWeight: '600', color: '#fff' },

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
  off: { opacity: 0.4 },
});

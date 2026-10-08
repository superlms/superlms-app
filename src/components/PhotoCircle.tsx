import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VectorIcon from './VectorIcon';
import CroppedPhoto from './CroppedPhoto';
import type { CropRect } from './PhotoCropper';

/**
 * Profile on a photo — the web panel's Profile, on the phone: the round circle
 * the lists show of the photo, set by moving the photo under it with a finger
 * and zooming in or out (two fingers, or − and +). It opens where the circle
 * was set before, else at the top of the photo (what the lists show with none
 * set). Nothing is cut: onDone gets the circle's square as fractions of the
 * upright photo, and the photo itself stays as it is.
 */

const MAX_ZOOM = 5; // the circle down to a fifth of the photo's shorter side
const STEP = 1.25; // one press of − or +
const EDGE = 20; // room round the circle, the photo dimmed there
const SHADE = 'rgba(0,0,0,0.6)';

/** The circle's square on the photo, in the photo's own pixels. */
type Circle = { x: number; y: number; s: number };
type Size = { w: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Kept inside the photo, and never bigger than its shorter side. */
const place = (x: number, y: number, s: number, nat: Size): Circle => {
  const max = Math.min(nat.w, nat.h);
  const side = clamp(s, max / MAX_ZOOM, max);
  return { x: clamp(x, 0, nat.w - side), y: clamp(y, 0, nat.h - side), s: side };
};

/** The circle grown or shrunk about its middle (as far as it may go). */
const sized = (c: Circle, s: number, nat: Size) => {
  const max = Math.min(nat.w, nat.h);
  const side = clamp(s, max / MAX_ZOOM, max);
  return place(c.x + c.s / 2 - side / 2, c.y + c.s / 2 - side / 2, side, nat);
};

export const PhotoCircleView = ({
  uri,
  circle,
  doneLabel = 'Save',
  busy = false,
  onCancel,
  onDone,
}: {
  uri: string;
  /** The circle set before, if any. */
  circle?: CropRect | null;
  doneLabel?: string;
  /** Saving: the buttons wait. */
  busy?: boolean;
  onCancel: () => void;
  onDone: (circle: CropRect) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [nat, setNat] = useState<Size | null>(null);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState<Size | null>(null);
  const [c, setC] = useState<Circle | null>(null);

  useEffect(() => {
    let alive = true;
    setNat(null);
    setFailed(false);
    Image.getSize(
      uri,
      (w, h) => alive && w > 0 && h > 0 && setNat({ w, h }),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [uri]);

  // Where it opens: the circle set before, else the top of the photo.
  const [sx, sy, sw, sh] = [circle?.x, circle?.y, circle?.w, circle?.h];
  useEffect(() => {
    if (!nat) return;
    const max = Math.min(nat.w, nat.h);
    setC(
      sw != null && sh != null && sx != null && sy != null && sw > 0 && sh > 0
        ? place(sx * nat.w, sy * nat.h, Math.min(sw * nat.w, sh * nat.h), nat)
        : place((nat.w - max) / 2, 0, max, nat),
    );
  }, [nat, sx, sy, sw, sh]);

  // The circle on screen: as wide as the room allows.
  const dia = stage ? Math.max(1, Math.min(stage.w, stage.h) - EDGE * 2) : 0;

  // What the touch handler reads: it is made once.
  const live = useRef({ c, nat, dia });
  live.current = { c, nat, dia };

  const responder = useMemo(() => {
    // The gesture so far: one finger moves the photo, two zoom it.
    let from: { mode: 'move' | 'zoom'; c: Circle; dx: number; dy: number; apart: number } | null = null;
    const apartOf = (t: any[]) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        from = null;
      },
      onPanResponderMove: (e, g) => {
        const { c: now, nat: n, dia: d } = live.current;
        if (!now || !n || d <= 0) return;
        const touches: any[] = (e as any)?.nativeEvent?.touches ?? [];
        if (touches.length >= 2) {
          const apart = apartOf(touches);
          if (!from || from.mode !== 'zoom') from = { mode: 'zoom', c: now, dx: 0, dy: 0, apart: Math.max(1, apart) };
          // Fingers apart: zoomed in — the circle takes in less of the photo.
          setC(sized(from.c, (from.c.s * from.apart) / Math.max(1, apart), n));
        } else {
          // From the touch itself; after two fingers, from where the one left is now.
          if (!from) from = { mode: 'move', c: now, dx: 0, dy: 0, apart: 0 };
          else if (from.mode !== 'move') from = { mode: 'move', c: now, dx: g.dx, dy: g.dy, apart: 0 };
          const k = d / from.c.s; // screen px per photo px
          setC(place(from.c.x - (g.dx - from.dx) / k, from.c.y - (g.dy - from.dy) / k, from.c.s, n));
        }
      },
      onPanResponderRelease: () => {
        from = null;
      },
    });
  }, []);

  const zoom = c && nat ? Math.min(nat.w, nat.h) / c.s : 1;
  const zoomBy = (f: number) => c && nat && setC(sized(c, c.s / f, nat));

  const current: CropRect | null =
    c && nat ? { x: c.x / nat.w, y: c.y / nat.h, w: c.s / nat.w, h: c.s / nat.h } : null;

  const k = c ? dia / c.s : 1;
  const box = dia + EDGE * 2;
  // The dimming round the circle: a ring this thick reaches past the corners.
  const ring = box;

  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      <Text style={s.hint}>Drag the photo to set the face in the circle; pinch, or − and +, to zoom in or out.</Text>

      <View
        style={s.stage}
        onLayout={(e: LayoutChangeEvent) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        {...responder.panHandlers}
      >
        {nat && c && stage ? (
          <View style={{ width: box, height: box, overflow: 'hidden' }}>
            <Image
              source={{ uri }}
              style={{ position: 'absolute', left: EDGE - c.x * k, top: EDGE - c.y * k, width: nat.w * k, height: nat.h * k }}
            />
            <View
              pointerEvents="none"
              style={[
                s.shade,
                {
                  left: EDGE - ring,
                  top: EDGE - ring,
                  width: dia + ring * 2,
                  height: dia + ring * 2,
                  borderRadius: dia / 2 + ring,
                  borderWidth: ring,
                },
              ]}
            />
            <View pointerEvents="none" style={[s.ring, { left: EDGE, top: EDGE, width: dia, height: dia, borderRadius: dia / 2 }]} />
          </View>
        ) : failed ? (
          <Text style={s.hint}>This photo could not be opened.</Text>
        ) : (
          <ActivityIndicator color="#fff" />
        )}
      </View>

      {/* Zoom, and how it will show in the list */}
      <View style={s.row}>
        <TouchableOpacity
          style={s.zoomBtn}
          onPress={() => zoomBy(1 / STEP)}
          disabled={!c || busy || zoom <= 1.001}
          hitSlop={8}
          activeOpacity={0.6}
          accessibilityLabel="Zoom out"
        >
          <View style={(!c || busy || zoom <= 1.001) && s.off}>
            <VectorIcon iconSet="Ionicons" iconName="remove" size={22} color="#fff" />
          </View>
        </TouchableOpacity>
        {current ? (
          <CroppedPhoto uri={uri} crop={current} size={56} style={s.preview} />
        ) : (
          <View style={[s.preview, { width: 56, height: 56 }]} />
        )}
        <TouchableOpacity
          style={s.zoomBtn}
          onPress={() => zoomBy(STEP)}
          disabled={!c || busy || zoom >= MAX_ZOOM - 0.001}
          hitSlop={8}
          activeOpacity={0.6}
          accessibilityLabel="Zoom in"
        >
          <View style={(!c || busy || zoom >= MAX_ZOOM - 0.001) && s.off}>
            <VectorIcon iconSet="Ionicons" iconName="add" size={22} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>
      <Text style={s.previewText}>In the list</Text>

      <View style={[s.bar, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity onPress={onCancel} disabled={busy} hitSlop={10} activeOpacity={0.6}>
          <Text style={[s.cancel, busy && s.off]}>Cancel</Text>
        </TouchableOpacity>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <TouchableOpacity onPress={() => current && onDone(current)} disabled={!current} hitSlop={10} activeOpacity={0.6}>
            <Text style={[s.done, !current && s.off]}>{doneLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default PhotoCircleView;

// Always dark, as the photo editor.
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  hint: { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', paddingHorizontal: 20 },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', margin: 12 },
  shade: { position: 'absolute', borderColor: SHADE },
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, paddingTop: 4 },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  preview: { borderRadius: 28, backgroundColor: '#222' },
  previewText: { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', paddingTop: 6, paddingBottom: 4 },

  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  cancel: { fontSize: 16, color: '#fff' },
  done: { fontSize: 16, fontWeight: '600', color: '#fff' },
  off: { opacity: 0.4 },
});

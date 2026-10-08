import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  PanResponderInstance,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CroppedPhoto from './CroppedPhoto';
import type { CropRect } from './PhotoCropper';

/**
 * A photo cropped from any side before it is saved — the web panel's photo
 * editor, on the phone. The whole photo is kept to begin with; a handle on an
 * edge or a corner crops from that side, and a finger inside the part kept
 * moves it. The dotted circle in it — its top square's, where the face is — is
 * what the round photos in the lists show, and the preview under it shows that
 * circle as a list will. Nothing is cut on the phone: `crop` (the part kept)
 * goes to the server as fractions of the upright photo, and `circle` (its top
 * square) lets a form show the cut photo before it is saved.
 */

export interface PhotoEdit {
  crop: CropRect;
  circle: CropRect;
}

type Handle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Exclude<Handle, 'move'>[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const HIT = 32; // a handle's touch area
const PAD = HIT / 2; // room round the photo for the handles on its edges
const MIN = 40; // smallest side of the part kept, on screen
const SHADE = 'rgba(0,0,0,0.6)';

type Box = { x: number; y: number; w: number; h: number };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fit = (v: number) => clamp(v, 0, 1);

/** The editor itself, to sit in a full screen of its own. */
export const PhotoEditorView = ({
  uri,
  doneLabel = 'Use photo',
  busy = false,
  showCircle = true,
  onCancel,
  onDone,
}: {
  uri: string;
  doneLabel?: string;
  /** Saving: the buttons wait. */
  busy?: boolean;
  /**
   * false: crop only — no dotted circle and no "In the list" preview (the
   * list's large photo, whose circle is set apart with Profile, PhotoCircle).
   */
  showCircle?: boolean;
  onCancel: () => void;
  onDone: (edit: PhotoEdit) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 });

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

  // The photo whole in the room there is, the handles round it.
  const disp = useMemo(() => {
    if (!nat || !stage) return null;
    const k = Math.min((stage.w - PAD * 2) / nat.w, (stage.h - PAD * 2) / nat.h);
    return { w: Math.max(1, Math.round(nat.w * k)), h: Math.max(1, Math.round(nat.h * k)) };
  }, [nat, stage]);

  // A new photo, or the room changed: all of it kept again.
  useEffect(() => {
    if (disp) setBox({ x: 0, y: 0, w: disp.w, h: disp.h });
  }, [disp]);

  // What the touch handlers read: they are made once.
  const live = useRef({ box, disp });
  live.current = { box, disp };

  const responders = useMemo(() => {
    const make = (h: Handle): PanResponderInstance => {
      let from: Box = { x: 0, y: 0, w: 0, h: 0 };
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          from = live.current.box;
        },
        onPanResponderMove: (_e, g) => {
          const d = live.current.disp;
          if (!d) return;
          let { x, y, w, h: ht } = from;
          if (h === 'move') {
            x = clamp(x + g.dx, 0, d.w - w);
            y = clamp(y + g.dy, 0, d.h - ht);
          } else {
            if (h.includes('w')) {
              const nx = clamp(x + g.dx, 0, x + w - MIN);
              w += x - nx;
              x = nx;
            }
            if (h.includes('e')) w = clamp(w + g.dx, MIN, d.w - x);
            if (h.includes('n')) {
              const ny = clamp(y + g.dy, 0, y + ht - MIN);
              ht += y - ny;
              y = ny;
            }
            if (h.includes('s')) ht = clamp(ht + g.dy, MIN, d.h - y);
          }
          setBox({ x, y, w, h: ht });
        },
      });
    };
    const all = {} as Record<Handle, PanResponderInstance>;
    (['move', ...HANDLES] as Handle[]).forEach(h => {
      all[h] = make(h);
    });
    return all;
  }, []);

  // The circle the lists show: the top square of the part kept (across, the middle).
  const side = Math.min(box.w, box.h);
  const circleBox = { x: box.x + (box.w - side) / 2, y: box.y, s: side };

  const edit = (): PhotoEdit | null => {
    if (!disp || box.w <= 0 || box.h <= 0) return null;
    return {
      crop: { x: fit(box.x / disp.w), y: fit(box.y / disp.h), w: fit(box.w / disp.w), h: fit(box.h / disp.h) },
      circle: {
        x: fit(circleBox.x / disp.w),
        y: fit(circleBox.y / disp.h),
        w: fit(side / disp.w),
        h: fit(side / disp.h),
      },
    };
  };
  const current = edit();

  const handleAt = (h: Exclude<Handle, 'move'>) => {
    const cx = h.includes('w') ? box.x : h.includes('e') ? box.x + box.w : box.x + box.w / 2;
    const cy = h.includes('n') ? box.y : h.includes('s') ? box.y + box.h : box.y + box.h / 2;
    return { left: PAD + cx - HIT / 2, top: PAD + cy - HIT / 2 };
  };

  return (
    <View style={[c.root, { paddingTop: insets.top + 12 }]}>
      <Text style={c.hint}>Drag an edge or a corner to crop from that side; drag inside to move it.</Text>

      <View style={c.stage} onLayout={(e: LayoutChangeEvent) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {disp ? (
          <View style={{ width: disp.w + PAD * 2, height: disp.h + PAD * 2 }}>
            <Image source={{ uri }} style={{ position: 'absolute', left: PAD, top: PAD, width: disp.w, height: disp.h }} />

            {/* Everything outside the part kept, dimmed */}
            <View pointerEvents="none" style={[c.shade, { left: PAD, top: PAD, width: disp.w, height: box.y }]} />
            <View pointerEvents="none" style={[c.shade, { left: PAD, top: PAD + box.y + box.h, width: disp.w, height: disp.h - box.y - box.h }]} />
            <View pointerEvents="none" style={[c.shade, { left: PAD, top: PAD + box.y, width: box.x, height: box.h }]} />
            <View pointerEvents="none" style={[c.shade, { left: PAD + box.x + box.w, top: PAD + box.y, width: disp.w - box.x - box.w, height: box.h }]} />

            {/* The part kept: moved by a finger inside it */}
            <View
              style={[c.box, { left: PAD + box.x, top: PAD + box.y, width: box.w, height: box.h }]}
              {...responders.move.panHandlers}
            >
              {showCircle && (
                <View
                  pointerEvents="none"
                  style={[
                    c.circle,
                    { left: circleBox.x - box.x, top: circleBox.y - box.y, width: side, height: side, borderRadius: side / 2 },
                  ]}
                />
              )}
            </View>

            {HANDLES.map(h => (
              <View key={h} style={[c.hit, handleAt(h)]} {...responders[h].panHandlers}>
                <View style={c.dot} />
              </View>
            ))}
          </View>
        ) : failed ? (
          <Text style={c.hint}>This photo could not be opened.</Text>
        ) : (
          <ActivityIndicator color="#fff" />
        )}
      </View>

      {/* How it will show in the list */}
      <View style={c.previewRow}>
        {showCircle &&
          (current ? (
            <CroppedPhoto uri={uri} crop={current.circle} size={56} style={c.preview} />
          ) : (
            <View style={[c.preview, { width: 56, height: 56 }]} />
          ))}
        {showCircle && <Text style={c.previewText}>In the list</Text>}
        <TouchableOpacity
          onPress={() => disp && setBox({ x: 0, y: 0, w: disp.w, h: disp.h })}
          disabled={!disp || busy}
          hitSlop={10}
          activeOpacity={0.6}
        >
          <Text style={[c.whole, (!disp || busy) && c.off]}>Whole photo</Text>
        </TouchableOpacity>
      </View>

      <View style={[c.bar, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity onPress={onCancel} disabled={busy} hitSlop={10} activeOpacity={0.6}>
          <Text style={[c.cancel, busy && c.off]}>Cancel</Text>
        </TouchableOpacity>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <TouchableOpacity onPress={() => current && onDone(current)} disabled={!current} hitSlop={10} activeOpacity={0.6}>
            <Text style={[c.done, !current && c.off]}>{doneLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/** The editor in a full-screen popup, open while `uri` is set. */
const PhotoEditor = ({
  uri,
  doneLabel,
  busy,
  onCancel,
  onDone,
}: {
  uri: string | null;
  doneLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onDone: (edit: PhotoEdit) => void;
}) => (
  <Modal visible={!!uri} animationType="fade" statusBarTranslucent onRequestClose={() => !busy && onCancel()}>
    {!!uri && <PhotoEditorView uri={uri} doneLabel={doneLabel} busy={busy} onCancel={onCancel} onDone={onDone} />}
  </Modal>
);

export default PhotoEditor;

// Always dark, whatever the app theme — a photo is judged best on black (as PhotoCropper).
const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  hint: { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', paddingHorizontal: 20 },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', margin: 12 },
  shade: { position: 'absolute', backgroundColor: SHADE },
  box: { position: 'absolute', borderWidth: 2, borderColor: '#fff' },
  circle: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', borderStyle: 'dashed' },
  hit: { position: 'absolute', width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.4)' },

  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 8 },
  preview: { borderRadius: 28, backgroundColor: '#222' },
  previewText: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  whole: { fontSize: 13, fontWeight: '600', color: '#fff', marginLeft: 12 },

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

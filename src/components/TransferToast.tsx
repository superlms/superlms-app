import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VectorIcon from './VectorIcon';
import { theme, onThemeChange } from '../utils/theme';
import { Transfer, TransferKind, claimUploads, useActiveUpload, useTransfers } from '../utils/transfers';

/**
 * Files going up and coming down, shown as they go.
 *
 * TransferIcon is the moving arrow: falling into a tray while a file comes
 * down, rising off it while one goes up — for a button or a row that is busy
 * with a file.
 *
 * TransferToast is the card at the foot of the screen, drawn once at the root:
 *
 *   ╭──────────────────────────────────────────╮
 *   │ (↓)  Downloading                    45%  │
 *   │      Fee receipt 12.pdf                  │
 *   │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──────────── │
 *   ╰──────────────────────────────────────────╯
 *
 * Done, it turns green with a tick ("Saved to Downloads", "Uploaded") for a
 * moment and slides away. An upload a saving button is drawing itself is left
 * to the button. The card never takes a touch.
 */

// ── The arrow ────────────────────────────────────────────────────────────────
export const TransferIcon = ({
  kind,
  size = 18,
  color = theme.colors.primary,
}: {
  kind: TransferKind;
  size?: number;
  color?: string;
}) => {
  const move = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    move.setValue(0);
    const run = Animated.loop(
      Animated.timing(move, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    );
    run.start();
    return () => run.stop();
  }, [move]);

  const travel = size * 0.75;
  const down = kind === 'download';
  return (
    <View style={[st.iconBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={{
          opacity: move.interpolate({ inputRange: [0, 0.2, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            {
              translateY: move.interpolate({
                inputRange: [0, 1],
                outputRange: down ? [-travel, travel * 0.35] : [travel * 0.35, -travel],
              }),
            },
          ],
        }}
      >
        <VectorIcon iconSet="Ionicons" iconName={down ? 'arrow-down' : 'arrow-up'} size={Math.round(size * 0.8)} color={color} />
      </Animated.View>
      {/* The tray it falls into, or rises off */}
      <View style={[st.tray, { left: size * 0.12, right: size * 0.12, backgroundColor: color }]} />
    </View>
  );
};

// ── In place of a busy button or over a photo, while it saves ───────────────
//   ↑ 42%        the file going up, as it goes
//   ◌ Saving     before it starts, and once it is up
// It draws the upload itself, so the toast leaves that one alone.
export const UploadStatus = ({
  color = theme.colors.primary,
  label = 'Saving',
  compact,
  style,
  textStyle,
}: {
  color?: string;
  /** Said with the spinner, before the file goes and after. */
  label?: string;
  /** The arrow and the figure only (over a photo). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) => {
  useEffect(() => claimUploads(), []);
  const up = useActiveUpload();
  const pct = up?.progress;
  const words = up ? (pct != null ? `${Math.round(pct * 100)}%` : compact ? '' : 'Uploading') : compact ? '' : label;
  return (
    <View style={[st.status, compact && st.statusCompact, style]} accessibilityLabel={up ? `Uploading ${words}` : label}>
      {up ? <TransferIcon kind="upload" size={compact ? 22 : 16} color={color} /> : <ActivityIndicator size="small" color={color} />}
      {!!words && <Text style={[st.statusText, compact && st.statusTextCompact, { color }, textStyle]}>{words}</Text>}
    </View>
  );
};

// ── The bar, for a size not known yet: a piece sliding along ────────────────
const Sliding = ({ color }: { color: string }) => {
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    const run = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    run.start();
    return () => run.stop();
  }, [x]);
  const piece = Math.max(40, w * 0.3);
  return (
    <View style={st.track} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Animated.View
          style={[
            st.bar,
            {
              width: piece,
              backgroundColor: color,
              transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-piece, w] }) }],
            },
          ]}
        />
      )}
    </View>
  );
};

const Filled = ({ progress, color }: { progress: number; color: string }) => {
  const p = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(p, { toValue: progress, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [progress, p]);
  return (
    <View style={st.track}>
      <Animated.View
        style={[st.bar, { backgroundColor: color, width: p.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
      />
    </View>
  );
};

const titleOf = (t: Transfer) => {
  if (t.state === 'done') {
    if (t.kind === 'upload') return 'Uploaded';
    return Platform.OS === 'android' ? 'Saved to Downloads' : 'Downloaded';
  }
  return t.kind === 'upload' ? 'Uploading' : 'Downloading';
};

// ── The card ─────────────────────────────────────────────────────────────────
export const TransferToast = () => {
  const list = useTransfers();
  const insets = useSafeAreaInsets();
  // What the toast shows: the newest one not left to a button, not failed
  // (the screen says why).
  const visible = list.filter(t => !t.claimed && t.state !== 'failed');
  const current = visible[visible.length - 1] ?? null;
  const more = visible.filter(t => t.state === 'running').length - (current?.state === 'running' ? 1 : 0);

  // The last one shown stays drawn while the card slides away.
  const [held, setHeld] = useState<Transfer | null>(current);
  const show = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (current) {
      setHeld(current);
      Animated.spring(show, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }).start();
    } else {
      Animated.timing(show, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setHeld(null);
      });
    }
  }, [current, show]);

  const doneNow = current?.state === 'done';
  useEffect(() => {
    if (!doneNow) return;
    pop.setValue(0.5);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 170, useNativeDriver: true }).start();
  }, [doneNow, pop]);

  const t = current ?? held;
  if (!t) return null;

  const done = t.state === 'done';
  const accent = done ? theme.colors.success : theme.colors.primary;

  return (
    <View pointerEvents="none" style={[st.layer, { bottom: insets.bottom + 18 }]}>
      <Animated.View
        style={[
          st.card,
          {
            opacity: show,
            transform: [{ translateY: show.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          },
        ]}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`${titleOf(t)} ${t.label}${t.progress != null && !done ? `, ${Math.round(t.progress * 100)} percent` : ''}`}
      >
        <View style={st.row}>
          <View style={[st.badge, { backgroundColor: accent }]}>
            {done ? (
              <Animated.View style={{ transform: [{ scale: pop }] }}>
                <VectorIcon iconSet="Ionicons" iconName="checkmark" size={18} color={theme.colors.white} />
              </Animated.View>
            ) : (
              <TransferIcon kind={t.kind} size={18} color={theme.colors.white} />
            )}
          </View>
          <View style={st.body}>
            <Text style={st.title} numberOfLines={1}>
              {titleOf(t)}
              {more > 0 ? <Text style={st.more}>{`  +${more} more`}</Text> : null}
            </Text>
            <Text style={st.label} numberOfLines={1}>
              {t.label}
            </Text>
          </View>
          {!done && t.progress != null && <Text style={st.pct}>{`${Math.round(t.progress * 100)}%`}</Text>}
        </View>
        {done ? (
          <Filled progress={1} color={accent} />
        ) : t.progress != null ? (
          <Filled progress={t.progress} color={accent} />
        ) : (
          <Sliding color={accent} />
        )}
      </Animated.View>
    </View>
  );
};

export default TransferToast;

const __mk_st = () => StyleSheet.create({
  // Arrow
  iconBox: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tray: { position: 'absolute', bottom: 0, height: 2, borderRadius: 1 },

  // Upload status
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusCompact: { flexDirection: 'column', justifyContent: 'center', gap: 2 },
  statusText: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  statusTextCompact: { fontSize: 12, fontWeight: '700' },

  // Card
  layer: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 1 },
  title: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  more: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },
  label: { fontSize: 12, color: theme.colors.textSecondary },
  pct: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary, fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: theme.colors.border, overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let st = __mk_st();
onThemeChange(() => { st = __mk_st(); });

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import VectorIcon from './VectorIcon';
import { TransferIcon } from './TransferToast';
import { theme, onThemeChange } from '../utils/theme';
import { claimUploads, useActiveUpload } from '../utils/transfers';

/**
 * A button that saves, and shows how the save is going:
 *
 *   idle       [ ✓  Save ]
 *   saving     [ ◌  Saving…  ]            a light sweeps across, again and again
 *   uploading  [ ↑  Uploading · 42% ]     filling up as the file goes
 *   done       [ ✓  Saved ]               green, the tick springs in
 *
 * Give it `state` for all three (and the green tick), or just `busy` for the
 * sweep. While it saves it draws any file going up in itself, so the upload
 * toast leaves that one to it.
 */

export type SaveState = 'idle' | 'saving' | 'done';
export type SavingVariant = 'solid' | 'outline' | 'danger';

export interface SavingButtonProps {
  label: string;
  onPress: () => void;
  /** idle, saving or done. Takes the place of `busy`. */
  state?: SaveState;
  /** Shorthand for state 'saving'. */
  busy?: boolean;
  /** "Saving" — the dots come after it. Defaults to the label's own -ing ("Post" → "Posting"). */
  busyLabel?: string;
  /** "Saved", on green. */
  doneLabel?: string;
  /** An Ionicons name, before the label. */
  icon?: string;
  /** What it is busy with: saving (a spinner) or a file coming down (the falling arrow). */
  busyKind?: 'save' | 'download';
  disabled?: boolean;
  variant?: SavingVariant;
  /** 40pt high, for a row of buttons or a card. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

// What a button says while it works, from what it says at rest: "Save
// changes" → "Saving changes", "Post assignment" → "Posting assignment".
const ING: Record<string, string> = {
  add: 'Adding',
  apply: 'Applying',
  approve: 'Approving',
  assign: 'Assigning',
  change: 'Changing',
  collect: 'Collecting',
  confirm: 'Confirming',
  create: 'Creating',
  delete: 'Deleting',
  download: 'Downloading',
  generate: 'Generating',
  issue: 'Issuing',
  mark: 'Marking',
  pay: 'Paying',
  post: 'Posting',
  publish: 'Publishing',
  record: 'Recording',
  reject: 'Rejecting',
  remove: 'Removing',
  reply: 'Replying',
  request: 'Requesting',
  reset: 'Resetting',
  save: 'Saving',
  send: 'Sending',
  set: 'Setting',
  share: 'Sharing',
  submit: 'Submitting',
  update: 'Updating',
  upload: 'Uploading',
  verify: 'Verifying',
};

export const busyLabelOf = (label: string) => {
  const [first = '', ...rest] = label.replace(/…|\.\.\./g, '').trim().split(/\s+/);
  const ing = ING[first.toLowerCase()];
  if (!ing) return 'Saving';
  // "Approve & make receipt" says just "Approving".
  return rest.length > 0 && rest.length <= 2 && !rest.some(w => w === '&' || w === 'and') ? `${ing} ${rest.join(' ')}` : ing;
};

export const SavingButton = ({
  label,
  onPress,
  state,
  busy,
  busyLabel,
  doneLabel,
  icon,
  busyKind = 'save',
  disabled,
  variant = 'solid',
  compact,
  style,
  textStyle,
  accessibilityLabel,
}: SavingButtonProps) => {
  const now: SaveState = state ?? (busy ? 'saving' : 'idle');
  const saving = now === 'saving';
  const done = now === 'done';
  const outline = variant === 'outline';

  const sweep = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  // "Saving" with one, two, three dots after it in turn.
  const [dots, setDots] = useState(1);

  // The file going up while this saves is drawn here, not in the toast.
  const saves = saving && busyKind === 'save';
  useEffect(() => (saves ? claimUploads() : undefined), [saves]);
  const upload = useActiveUpload(saves);
  const pct = upload?.progress;

  useEffect(() => {
    if (!saving) return;
    sweep.setValue(0);
    setDots(1);
    const run = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    run.start();
    const tick = setInterval(() => setDots(n => (n % 3) + 1), 400);
    return () => {
      run.stop();
      clearInterval(tick);
    };
  }, [saving, sweep]);

  useEffect(() => {
    if (!done) return;
    pop.setValue(0.4);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [done, pop]);

  useEffect(() => {
    Animated.timing(fill, {
      toValue: upload && pct != null ? pct : 0,
      duration: upload ? 220 : 0,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [upload, pct, fill]);

  const band = Math.max(60, width * 0.35);
  const fg = outline && !done ? theme.colors.primary : theme.colors.white;
  const words = [s.text, compact && s.textCompact, { color: fg }, textStyle];
  const shownLabel = saving
    ? upload
      ? pct != null
        ? `Uploading · ${Math.round(pct * 100)}%`
        : 'Uploading'
      : busyLabel ?? busyLabelOf(label)
    : done
    ? doneLabel ?? label
    : label;

  return (
    <TouchableOpacity
      style={[
        s.btn,
        compact && s.btnCompact,
        variant === 'danger' && s.danger,
        outline && s.outline,
        style,
        // How it is going wins over the screen's own colours.
        saving && s.busy,
        done && s.done,
        disabled && now === 'idle' && s.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || now !== 'idle'}
      activeOpacity={0.9}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="button"
      accessibilityState={{ busy: saving, disabled: disabled || now !== 'idle' }}
      accessibilityLabel={accessibilityLabel ?? shownLabel}
    >
      {/* How much of the file has gone up */}
      {saving && !!upload && width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.fill,
            outline && s.fillOutline,
            { width: fill.interpolate({ inputRange: [0, 1], outputRange: [0, width] }) },
          ]}
        />
      )}

      {saving && width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.sweep,
            outline && s.sweepOutline,
            {
              width: band,
              transform: [
                { translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-band, width] }) },
                { skewX: '-20deg' },
              ],
            },
          ]}
        />
      )}

      {now === 'idle' && (
        <>
          {!!icon && <VectorIcon iconSet="Ionicons" iconName={icon} size={compact ? 16 : 18} color={fg} />}
          <Text style={words} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}

      {saving && (
        <>
          {upload || busyKind === 'download' ? (
            <TransferIcon kind={upload ? 'upload' : 'download'} size={compact ? 16 : 18} color={fg} />
          ) : (
            <ActivityIndicator size="small" color={fg} />
          )}
          <View style={s.busyRow}>
            <Text style={words} numberOfLines={1}>
              {shownLabel}
            </Text>
            {/* Room for three dots always held, so the words don't move as they come and go */}
            {!(upload && pct != null) && (
              <View style={s.dotsBox}>
                <Text style={words}>{'.'.repeat(dots)}</Text>
              </View>
            )}
          </View>
        </>
      )}

      {done && (
        <Animated.View style={[s.doneRow, { transform: [{ scale: pop }] }]}>
          <VectorIcon iconSet="Ionicons" iconName="checkmark-circle" size={compact ? 18 : 20} color={theme.colors.white} />
          <Text style={[words, { color: theme.colors.white }]} numberOfLines={1}>
            {shownLabel}
          </Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
};

export default SavingButton;

// ── The green tick, for a page that stays open once saved ───────────────────
//   const [saved, flashSaved] = useSavedFlash();
//   <SavingButton state={saveStateOf(saving, saved)} … />
//   …saved: flashSaved(); afterTick(() => AppAlert.alert('Saved'));
export const useSavedFlash = (hold = 1600) => {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const flash = useCallback(() => {
    setOn(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), hold);
  }, [hold]);
  return [on, flash] as const;
};

export const saveStateOf = (busy: boolean, saved: boolean): SaveState =>
  busy ? 'saving' : saved ? 'done' : 'idle';

/** What follows a save, once the tick has had a moment on the button. */
export const afterTick = (fn: () => void, ms = 650) => setTimeout(fn, ms);

const __mk_s = () => StyleSheet.create({
  btn: {
    flexDirection: 'row',
    gap: 8,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnCompact: { height: 40, borderRadius: 10, paddingHorizontal: 12, gap: 6 },
  danger: { backgroundColor: theme.colors.danger },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  busy: { opacity: 0.94 },
  done: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  disabled: { opacity: 0.5 },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  fillOutline: { backgroundColor: theme.colors.primary + '1F' },
  sweep: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  sweepOutline: { backgroundColor: theme.colors.primary + '1A' },
  text: { fontSize: 15, fontWeight: '700', color: theme.colors.white, flexShrink: 1 },
  textCompact: { fontSize: 13 },
  busyRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  dotsBox: { width: 16 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

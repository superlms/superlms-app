import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AlertButton,
  AlertOptions,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme, onThemeChange } from '../utils/theme';

/**
 * The app's popup, drawn as the "Update required" card is: a plain card in the
 * middle of the screen, the title and a line or two of message centred, a
 * full-width rule, then the buttons as words — a destructive one red, Cancel
 * quieter, any other the accent colour. One button fills the foot, two share
 * it with a thin line between, three or more stack (a line between each) with
 * Cancel last. The card comes in with a small rise from 96%.
 *
 *   <AppDialog
 *     visible={open}
 *     title="Delete event?"
 *     message="It will be removed for everyone."
 *     actions={[
 *       { text: 'Cancel', style: 'cancel', onPress: close },
 *       { text: 'Delete', style: 'destructive', onPress: remove, loading: deleting },
 *     ]}
 *     onRequestClose={close}
 *   />
 *
 * For a one-off message or question, AppAlert.alert() takes Alert.alert()'s
 * arguments and shows the same card; AppAlertHost, mounted once in App.tsx,
 * draws it.
 */

export interface DialogAction {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
  // A spinner in the button; every button waits until it settles.
  loading?: boolean;
}

// A label longer than this doesn't fit half the card, so the buttons stack.
const ROW_LABEL_MAX = 14;

export const AppDialog = ({
  visible,
  title,
  message,
  actions,
  onRequestClose,
  onBackdropPress,
}: {
  visible: boolean;
  title?: string;
  message?: string;
  actions: DialogAction[];
  // Android's back button.
  onRequestClose?: () => void;
  // A tap outside the card; ignored when not given.
  onBackdropPress?: () => void;
}) => {
  const busy = actions.some(a => a.loading);
  const stacked =
    actions.length > 2 || (actions.length === 2 && actions.some(a => a.text.length > ROW_LABEL_MAX));
  const ordered = stacked
    ? [...actions.filter(a => a.style !== 'cancel'), ...actions.filter(a => a.style === 'cancel')]
    : actions;

  // A small rise as the card comes in, as the overlay fades.
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    rise.setValue(0);
    Animated.timing(rise, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, rise]);

  const colorOf = (a: DialogAction) =>
    a.style === 'destructive'
      ? theme.colors.danger
      : a.style === 'cancel'
        ? theme.colors.textSecondary
        : theme.colors.primary;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => !busy && onRequestClose?.()}
    >
      <View style={s.overlay}>
        {!!onBackdropPress && (
          <Pressable style={StyleSheet.absoluteFill} disabled={busy} onPress={onBackdropPress} />
        )}
        <Animated.View
          style={[
            s.card,
            {
              opacity: rise,
              transform: [{ scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
            },
          ]}
        >
          {(!!title || !!message) && (
            <View style={s.body}>
              {!!title && <Text style={s.title}>{title}</Text>}
              {!!message && <Text style={[s.message, !title && s.messageAlone]}>{message}</Text>}
            </View>
          )}

          <View style={s.rule} />
          <View style={[s.actions, stacked && s.actionsStacked]}>
            {ordered.map((a, i) => {
              const cancel = a.style === 'cancel';
              return (
                <React.Fragment key={`${i}:${a.text}`}>
                  {i > 0 && <View style={stacked ? s.rule : s.ruleUpright} />}
                  <TouchableOpacity
                    style={[s.btn, !stacked && s.btnInRow, a.loading && s.btnBusy]}
                    activeOpacity={0.6}
                    disabled={busy}
                    onPress={a.onPress}
                    accessibilityRole="button"
                  >
                    {a.loading ? (
                      <ActivityIndicator size="small" color={colorOf(a)} />
                    ) : (
                      <Text style={[s.btnText, cancel && s.btnTextCancel, { color: colorOf(a) }]} numberOfLines={1}>
                        {a.text}
                      </Text>
                    )}
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ── AppAlert: Alert.alert(), in the app's popup ─────────────────────────────
interface AlertRequest {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
}

// Popups asked for while one is open wait their turn.
const queue: AlertRequest[] = [];
let show: ((request: AlertRequest | null) => void) | null = null;

export const AppAlert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    // Nothing mounted to draw it yet — the system alert stands in.
    if (!show) return Alert.alert(title, message, buttons, options);
    queue.push({ title, message, buttons, options });
    if (queue.length === 1) show(queue[0]);
  },
};

// Close the popup on screen and bring up the next one waiting, if any.
const advance = () => {
  queue.shift();
  show?.(queue[0] ?? null);
};

export const AppAlertHost = () => {
  const [current, setCurrent] = useState<AlertRequest | null>(null);
  // The last popup stays drawn while it fades out.
  const last = useRef<AlertRequest | null>(null);
  if (current) last.current = current;

  useEffect(() => {
    show = setCurrent;
    setCurrent(queue[0] ?? null);
    return () => {
      show = null;
    };
  }, []);

  const req = current ?? last.current;
  if (!req) return null;

  const buttons: AlertButton[] = req.buttons?.length ? req.buttons : [{ text: 'OK' }];

  const press = (b: AlertButton) => {
    if (!current) return;
    advance();
    b.onPress?.();
  };

  const dismiss = () => {
    if (!current) return;
    advance();
    req.options?.onDismiss?.();
  };

  // Back closes a cancelable popup; otherwise it means Cancel, or the only button.
  const onBack = () => {
    if (req.options?.cancelable) return dismiss();
    const cancel = buttons.find(b => b.style === 'cancel') ?? (buttons.length === 1 ? buttons[0] : undefined);
    if (cancel) press(cancel);
  };

  return (
    <AppDialog
      visible={!!current}
      title={req.title}
      message={req.message}
      actions={buttons.map(b => ({ text: b.text ?? 'OK', style: b.style, onPress: () => press(b) }))}
      onRequestClose={onBack}
      onBackdropPress={req.options?.cancelable ? dismiss : undefined}
    />
  );
};

// The "Update required" card's measures (components/PlayUpdateGate).
const __mk_s = () => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  title: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary, textAlign: 'center' },
  message: { marginTop: 8, fontSize: 14, lineHeight: 20, color: theme.colors.textSecondary, textAlign: 'center' },
  messageAlone: { marginTop: 0 },

  // The rule across the card, and the one between two buttons side by side
  rule: { height: 1, backgroundColor: theme.colors.border },
  ruleUpright: { width: 1, backgroundColor: theme.colors.border },

  // Buttons: words, side by side or stacked
  actions: { flexDirection: 'row' },
  actionsStacked: { flexDirection: 'column' },
  btn: { height: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnInRow: { flex: 1 },
  btnBusy: { opacity: 0.7 },
  btnText: { fontSize: 15, fontWeight: '600' },
  btnTextCancel: { fontWeight: '500' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

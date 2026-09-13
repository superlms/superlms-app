import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AlertButton,
  AlertOptions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme, onThemeChange } from '../utils/theme';

/**
 * The app's popup: the card the delete confirmations use — a title, a line or
 * two of message, and the buttons along the bottom. Cancel is outlined, a
 * destructive action red, any other the accent colour. One button fills the
 * row, two share it, three or more stack with Cancel last.
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
        <View style={s.card}>
          {!!title && <Text style={s.title}>{title}</Text>}
          {!!message && <Text style={[s.message, !title && s.messageAlone]}>{message}</Text>}

          <View style={[s.actions, stacked && s.actionsStacked]}>
            {ordered.map((a, i) => {
              const cancel = a.style === 'cancel';
              return (
                <TouchableOpacity
                  key={`${i}:${a.text}`}
                  style={[
                    s.btn,
                    !stacked && s.btnInRow,
                    cancel ? s.btnGhost : a.style === 'destructive' ? s.btnDanger : s.btnPrimary,
                    a.loading && s.btnBusy,
                  ]}
                  activeOpacity={cancel ? 0.7 : 0.85}
                  disabled={busy}
                  onPress={a.onPress}
                >
                  {a.loading ? (
                    <ActivityIndicator
                      size="small"
                      color={cancel ? theme.colors.textPrimary : theme.colors.white}
                    />
                  ) : (
                    <Text style={cancel ? s.btnGhostText : s.btnText} numberOfLines={1}>
                      {a.text}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
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

const __mk_s = () => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
  },
  title: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  message: { marginTop: 8, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  messageAlone: { marginTop: 0 },

  // Buttons: side by side, or stacked
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  actionsStacked: { flexDirection: 'column' },
  btn: {
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnInRow: { flex: 1 },
  btnGhost: { borderWidth: 1, borderColor: theme.colors.border },
  btnPrimary: { backgroundColor: theme.colors.primary },
  btnDanger: { backgroundColor: theme.colors.danger },
  btnBusy: { opacity: 0.7 },
  btnGhostText: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  btnText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

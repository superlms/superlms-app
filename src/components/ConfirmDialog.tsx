import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme, onThemeChange } from '../utils/theme';
import VectorIcon from './VectorIcon';

// Logout-style confirmation dialog (matches the drawer's logout modal).
export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  iconSet?: string;
  iconName?: string;
  iconColor?: string;
  iconBg?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = theme.colors.primary,
  iconSet = 'Ionicons',
  iconName = 'help-circle-outline',
  iconColor = theme.colors.primary,
  iconBg = theme.colors.primaryLight,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => (
  <Modal
    transparent
    visible={visible}
    animationType="fade"
    onRequestClose={onCancel}
  >
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <VectorIcon
            iconSet={iconSet}
            iconName={iconName}
            size={28}
            color={iconColor}
          />
        </View>

        <Text style={styles.title}>{title}</Text>
        {!!message && <Text style={styles.desc}>{message}</Text>}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            activeOpacity={0.85}
            disabled={loading}
            onPress={onCancel}
          >
            <Text style={[styles.btnText, styles.btnGhostText]}>{cancelText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: confirmColor }]}
            activeOpacity={0.9}
            disabled={loading}
            onPress={onConfirm}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text style={[styles.btnText, styles.btnConfirmText]}>
                {confirmText}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// Single-action success dialog.
export interface SuccessDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  buttonText?: string;
  onClose: () => void;
}

export const SuccessDialog = ({
  visible,
  title,
  message,
  buttonText = 'Done',
  onClose,
}: SuccessDialogProps) => (
  <Modal
    transparent
    visible={visible}
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: '#DCFCE7' }]}>
          <VectorIcon
            iconSet="Ionicons"
            iconName="checkmark-circle"
            size={32}
            color={theme.colors.success}
          />
        </View>

        <Text style={styles.title}>{title}</Text>
        {!!message && <Text style={styles.desc}>{message}</Text>}

        <TouchableOpacity
          style={[styles.btn, styles.btnFull, { backgroundColor: theme.colors.success }]}
          activeOpacity={0.9}
          onPress={onClose}
        >
          <Text style={[styles.btnText, styles.btnConfirmText]}>{buttonText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const __mk_styles = () => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  desc: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: { marginTop: theme.spacing.xl },
  btnText: { fontSize: 15, fontWeight: '700' },
  btnGhost: { backgroundColor: theme.colors.border },
  btnGhostText: { color: theme.colors.textPrimary },
  btnConfirmText: { color: theme.colors.white },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });

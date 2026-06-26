import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { updatePassword } from '../../api/authApi';

const ACCENT = '#6366F1';

// Mirrors the backend update-password validation rules so the checklist
// and the API accept exactly the same passwords.
const passwordRules: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'One lowercase letter (a-z)', test: p => /[a-z]/.test(p) },
  { label: 'One uppercase letter (A-Z)', test: p => /[A-Z]/.test(p) },
  { label: 'One number (0-9)', test: p => /[0-9]/.test(p) },
  { label: 'One special character (@ $ ! % * # ? &)', test: p => /[@$!%*#?&]/.test(p) },
];

// ── Field with leading lock icon + trailing eye toggle ─────────────────────────
const PasswordField = ({
  label,
  placeholder,
  value,
  onChangeText,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
}) => {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);

  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      <View
        style={[
          s.inputRow,
          (focused || !!value) && { borderColor: ACCENT, backgroundColor: theme.colors.card },
        ]}
      >
        <VectorIcon
          iconSet="Ionicons"
          iconName="lock-closed-outline"
          size={18}
          color={focused || !!value ? ACCENT : theme.colors.textMuted}
        />
        <TextInput
          style={s.input}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={!show}
          autoCapitalize="none"
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <TouchableOpacity onPress={() => setShow(v => !v)} hitSlop={10}>
          <VectorIcon
            iconSet="Ionicons"
            iconName={show ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ChangePasswordScreen = () => {
  const navigation = useNavigation<any>();
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = async () => {
    if (!current) {
      setError('Enter your current password.');
      return;
    }
    const unmet = passwordRules.find(r => !r.test(newPass));
    if (unmet) {
      setError(`Password needs: ${unmet.label.toLowerCase()}.`);
      return;
    }
    if (newPass !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await updatePassword(current, newPass, confirm);
      setSuccessMsg(res.message || 'Your password has been changed.');
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err?.message ??
          'Failed to change password. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!current && !!newPass && !!confirm && !loading;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Change Password" />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card ── */}
        <View style={s.card}>
          <View style={[s.accentStrip, { backgroundColor: ACCENT }]} />
          <View style={s.cardInner}>
            <View style={s.heroRow}>
              <View style={[s.heroIcon, { backgroundColor: ACCENT + '18' }]}>
                <VectorIcon iconSet="Ionicons" iconName="shield-checkmark" size={26} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.heroTitle}>Update Password</Text>
                <Text style={[s.heroSub, { color: ACCENT }]}>
                  Keep your account safe — use a strong, unique password.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Form card ── */}
        <View style={s.card}>
          <View style={[s.accentStrip, { backgroundColor: ACCENT }]} />
          <View style={s.cardInner}>
            <Text style={s.sectionLabel}>Your passwords</Text>

            <PasswordField
              label="Current Password"
              placeholder="Enter current password"
              value={current}
              onChangeText={t => { setCurrent(t); setError(''); }}
            />
            <PasswordField
              label="New Password"
              placeholder="Enter new password"
              value={newPass}
              onChangeText={t => { setNewPass(t); setError(''); }}
            />
            <PasswordField
              label="Confirm New Password"
              placeholder="Confirm new password"
              value={confirm}
              onChangeText={t => { setConfirm(t); setError(''); }}
            />

            {/* Rules checklist */}
            <View style={s.divider} />
            <Text style={s.sectionLabel}>Password requirements</Text>
            <View style={s.ruleList}>
              {passwordRules.map(rule => {
                const met = rule.test(newPass);
                return (
                  <View key={rule.label} style={s.ruleRow}>
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName={met ? 'checkmark-circle' : 'ellipse-outline'}
                      size={15}
                      color={met ? theme.colors.success : theme.colors.textMuted}
                    />
                    <Text style={[s.ruleText, met && s.ruleTextMet]}>{rule.label}</Text>
                  </View>
                );
              })}
              {!!confirm && (
                <View style={s.ruleRow}>
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName={newPass === confirm ? 'checkmark-circle' : 'close-circle'}
                    size={15}
                    color={newPass === confirm ? theme.colors.success : theme.colors.danger}
                  />
                  <Text
                    style={[
                      s.ruleText,
                      newPass === confirm ? s.ruleTextMet : s.ruleTextFail,
                    ]}
                  >
                    Passwords match
                  </Text>
                </View>
              )}
            </View>

            {!!error && (
              <View style={s.errorBox}>
                <VectorIcon iconSet="Ionicons" iconName="alert-circle" size={16} color={theme.colors.danger} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.button, { backgroundColor: ACCENT }, !canSubmit && s.buttonDisabled]}
              onPress={handleChange}
              activeOpacity={0.85}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <VectorIcon iconSet="Ionicons" iconName="checkmark-circle-outline" size={16} color="#fff" />
                  <Text style={s.buttonText}>Change Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Success acknowledgement */}
      <Modal
        transparent
        visible={!!successMsg}
        animationType="fade"
        onRequestClose={() => navigation.goBack()}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalIconWrap}>
              <VectorIcon iconSet="Ionicons" iconName="checkmark-circle" size={44} color={theme.colors.success} />
            </View>
            <Text style={s.modalTitle}>Password Changed</Text>
            <Text style={s.modalDesc}>{successMsg}</Text>
            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: ACCENT }]}
              activeOpacity={0.9}
              onPress={() => {
                setSuccessMsg('');
                navigation.goBack();
              }}
            >
              <Text style={s.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default ChangePasswordScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },

  // Card
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  accentStrip: { height: 5 },
  cardInner: { padding: 18 },

  // Hero
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 19, fontWeight: '800', color: theme.colors.textPrimary, lineHeight: 25 },
  heroSub: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginTop: 4 },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Fields
  fieldWrap: { marginBottom: 14 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.2,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 14,
    height: 50,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    padding: 0,
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 14,
  },

  // Rules
  ruleList: { gap: 7 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { fontSize: 12.5, color: theme.colors.textSecondary, lineHeight: 18 },
  ruleTextMet: { color: theme.colors.success, fontWeight: '600' },
  ruleTextFail: { color: theme.colors.danger, fontWeight: '600' },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 14,
  },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600', color: theme.colors.danger },

  // Submit
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: theme.colors.white, fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },

  // Success modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary, textAlign: 'center' },
  modalDesc: {
    marginTop: 6,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalBtn: {
    marginTop: 22,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { fontSize: 15, fontWeight: '700', color: theme.colors.white },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

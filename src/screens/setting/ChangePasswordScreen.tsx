import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { updatePassword } from '../../api/authApi';
import { DocHeader } from '../more/docUi';
import { AppDialog } from '../../components/AppDialog';

// Mirrors the backend update-password validation rules so the checklist
// and the API accept exactly the same passwords.
const passwordRules: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'One lowercase letter (a-z)', test: p => /[a-z]/.test(p) },
  { label: 'One uppercase letter (A-Z)', test: p => /[A-Z]/.test(p) },
  { label: 'One number (0-9)', test: p => /[0-9]/.test(p) },
  { label: 'One special character (@ $ ! % * # ? &)', test: p => /[@$!%*#?&]/.test(p) },
];

// ── Password field: label, plain bordered input, show/hide toggle ─────────────
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
    <View>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputRow, focused && s.inputRowFocused]}>
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
  const matches = newPass === confirm;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <DocHeader title="Change Password" />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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

        {/* Requirements checklist */}
        <View style={s.rules}>
          {passwordRules.map(rule => {
            const met = rule.test(newPass);
            return (
              <View key={rule.label} style={s.ruleRow}>
                <VectorIcon
                  iconSet="Ionicons"
                  iconName={met ? 'checkmark' : 'ellipse-outline'}
                  size={14}
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
                iconName={matches ? 'checkmark' : 'close'}
                size={14}
                color={matches ? theme.colors.success : theme.colors.danger}
              />
              <Text style={[s.ruleText, matches ? s.ruleTextMet : s.ruleTextFail]}>
                Passwords match
              </Text>
            </View>
          )}
        </View>

        {!!error && <Text style={s.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[s.button, !canSubmit && s.buttonDisabled]}
          onPress={handleChange}
          activeOpacity={0.85}
          disabled={!canSubmit}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.white} size="small" />
          ) : (
            <Text style={s.buttonText}>Change Password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Success acknowledgement */}
      <AppDialog
        visible={!!successMsg}
        title="Password changed"
        message={successMsg}
        actions={[
          {
            text: 'Done',
            onPress: () => {
              setSuccessMsg('');
              navigation.goBack();
            },
          },
        ]}
        onRequestClose={() => navigation.goBack()}
      />
    </KeyboardAvoidingView>
  );
};

export default ChangePasswordScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 18 },

  // Fields
  label: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
  },
  inputRowFocused: { borderColor: theme.colors.primary },
  input: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, padding: 0 },

  // Rules
  rules: { gap: 6 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 18 },
  ruleTextMet: { color: theme.colors.success },
  ruleTextFail: { color: theme.colors.danger },

  // Error
  errorText: { fontSize: 13, color: theme.colors.danger, lineHeight: 18 },

  // Submit
  button: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { updateAdminPassword } from '../../api/adminProfileApi';
import { DocHeader } from '../more/docUi';
import { FormError, SubmitButton } from './adminFormUi';
import { PASSWORD_RULES, PasswordField, PasswordRules, useRevealFocused } from './adminProfileUi';

/**
 * Change Password — the panel's password panel: the current password, a new
 * one and the same again, each with its own eye, and the panel's checklist
 * (8 characters, upper and lower case, a number, a symbol) ticking as the new
 * one is typed. It checks what the panel checks — every field, a new password
 * that differs from the current one and meets the rules, and a matching
 * confirmation — and the server checks the current password.
 */

const AdminChangePasswordScreen = ({ navigation }: any) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();

  const typed = (set: (v: string) => void) => (v: string) => {
    set(v);
    setError('');
  };

  const save = async () => {
    if (!current) return setError('Enter your current password.');
    if (!next) return setError('Enter a new password.');
    if (next === current) return setError('The new password must be different from the current password.');
    if (!PASSWORD_RULES.every(r => r.test(next))) return setError('The new password must meet every rule below.');
    if (!confirm) return setError('Confirm the new password.');
    if (confirm !== next) return setError('The confirm password must match the new password.');
    setSaving(true);
    try {
      await updateAdminPassword({ current_password: current, new_password: next, new_password_confirmation: confirm });
      setCurrent('');
      setNext('');
      setConfirm('');
      AppAlert.alert('Done', 'Password updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      setError(apiErr(e, 'Could not update password.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title="Change Password" onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <Text style={s.intro}>Set a new strong password for the admin login.</Text>

          <PasswordField label="Current Password" value={current} onChangeText={typed(setCurrent)} />
          <PasswordField label="New Password" value={next} onChangeText={typed(setNext)} />
          <PasswordField label="Confirm Password" value={confirm} onChangeText={typed(setConfirm)} />

          <PasswordRules password={next} />

          <View style={s.submit}>
            <FormError>{error}</FormError>
            <SubmitButton label="Update Password" busy={saving} onPress={save} />
          </View>

          <View style={s.tail} />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

export default AdminChangePasswordScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  tail: { height: 48 },
  intro: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, marginBottom: 6 },
  submit: { marginTop: 28, gap: 12 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

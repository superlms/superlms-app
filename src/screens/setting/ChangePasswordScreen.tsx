import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { updatePassword } from '../../api/authApi';
import { DocHeader } from '../more/docUi';
import { AppDialog } from '../../components/AppDialog';
import { useRevealFocused } from '../admin/adminProfileUi';
import {
  FormHeading,
  OutlinedPasswordField,
  PasswordBox,
  PasswordWrong,
  SaveButton,
  SaveState,
  passwordServerWrong,
} from '../teacherStudents/outlinedFormUi';

/**
 * Change Password, drawn as Add Student is: each box an outline with its name
 * in the top border (and an eye to show what was typed), a quiet heading over
 * each block, and Change Password at the foot, above the keyboard. A box the
 * save stops at turns red with what is wrong under it, one at a time, until
 * it is typed in again.
 */

// A met rule's tick and text: a deeper green than the theme's success colour,
// which is too light to read as text on white.
const MET = '#15803D';

// Mirrors the backend update-password validation rules so the checklist
// and the API accept exactly the same passwords.
const passwordRules: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'One lowercase letter (a-z)', test: p => /[a-z]/.test(p) },
  { label: 'One uppercase letter (A-Z)', test: p => /[A-Z]/.test(p) },
  { label: 'One number (0-9)', test: p => /[0-9]/.test(p) },
  { label: 'One special character (@ $ ! % * # ? &)', test: p => /[@$!%*#?&]/.test(p) },
];

const ChangePasswordScreen = () => {
  const navigation = useNavigation<any>();
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  // The box the last save stopped at (or none, for what the server said of the whole).
  const [wrong, setWrong] = useState<PasswordWrong | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [successMsg, setSuccessMsg] = useState('');
  // A quick second tap, before the button has greyed out, does nothing.
  const busy = useRef(false);

  const currentRef = useRef<TextInput>(null);
  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const refs: Record<PasswordBox, React.RefObject<TextInput | null>> = {
    current: currentRef,
    next: nextRef,
    confirm: confirmRef,
  };

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();

  // Typing in the box that was wrong clears it.
  const typed = (box: PasswordBox, set: (v: string) => void) => (v: string) => {
    set(v);
    setWrong(w => (w && (w.box === box || w.box === null) ? null : w));
  };
  const errorOf = (box: PasswordBox) => (wrong?.box === box ? wrong.message : null);

  const stop = (w: PasswordWrong) => {
    setWrong(w);
    if (w.box) refs[w.box].current?.focus();
  };

  const handleChange = async () => {
    if (busy.current) return;
    if (!current) return stop({ box: 'current', message: 'Enter your current password.' });
    if (!newPass) return stop({ box: 'next', message: 'Enter a new password.' });
    const unmet = passwordRules.find(r => !r.test(newPass));
    if (unmet) return stop({ box: 'next', message: `Password needs: ${unmet.label.toLowerCase()}.` });
    if (!confirm) return stop({ box: 'confirm', message: 'Enter the new password again.' });
    if (newPass !== confirm) return stop({ box: 'confirm', message: 'Passwords do not match.' });

    setWrong(null);
    busy.current = true;
    setSaveState('saving');
    try {
      const res = await updatePassword(current, newPass, confirm);
      setSaveState('done');
      setSuccessMsg(res.message || 'Your password has been changed.');
    } catch (err: any) {
      busy.current = false;
      setSaveState('idle');
      stop(passwordServerWrong(err, 'Failed to change password. Please try again.'));
    }
  };

  const matches = newPass === confirm;

  return (
    <View style={s.root}>
      <DocHeader title="Change Password" />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <FormHeading title="Current" first />
          <OutlinedPasswordField
            ref={currentRef}
            required
            label="Current Password"
            placeholder="Enter current password"
            value={current}
            onChangeText={typed('current', setCurrent)}
            error={errorOf('current')}
            returnKeyType="next"
            onSubmitEditing={() => nextRef.current?.focus()}
          />

          <FormHeading title="New" />
          <OutlinedPasswordField
            ref={nextRef}
            required
            label="New Password"
            placeholder="Enter new password"
            value={newPass}
            onChangeText={typed('next', setNewPass)}
            error={errorOf('next')}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <OutlinedPasswordField
            ref={confirmRef}
            required
            label="Confirm New Password"
            placeholder="Confirm new password"
            value={confirm}
            onChangeText={typed('confirm', setConfirm)}
            error={errorOf('confirm')}
            returnKeyType="done"
            onSubmitEditing={handleChange}
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
                    color={met ? MET : theme.colors.textSecondary}
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
                  color={matches ? MET : theme.colors.danger}
                />
                <Text style={[s.ruleText, matches ? s.ruleTextMet : s.ruleTextFail]}>Passwords match</Text>
              </View>
            )}
          </View>

          {/* What the server said that is about none of the boxes */}
          {!!wrong && !wrong.box && <Text style={s.errorText}>{wrong.message}</Text>}

          <View style={s.tail} />
        </ScrollView>

        {/* Change Password stays in reach at the foot */}
        <View style={s.footer}>
          <SaveButton
            state={saveState}
            icon="lock-closed-outline"
            label="Change Password"
            busyLabel="Changing password"
            doneLabel="Password changed"
            onPress={handleChange}
          />
        </View>
      </Animated.View>

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
    </View>
  );
};

export default ChangePasswordScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 24 },

  // Rules
  rules: { gap: 6, marginTop: 18 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Unmet rules in the secondary text colour (not the faint muted one)
  ruleText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
  ruleTextMet: { color: MET },
  ruleTextFail: { color: theme.colors.danger },

  // Error
  errorText: { fontSize: 13, color: theme.colors.danger, lineHeight: 18, marginTop: 16 },

  // Save, at the foot (the app's root keeps clear of the phone's own bar below)
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

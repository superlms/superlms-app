import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { updateAdminPassword } from '../../api/adminProfileApi';
import { DocHeader } from '../more/docUi';
import {
  FormHeading,
  OutlinedPasswordField,
  PasswordBox,
  PasswordWrong,
  SaveButton,
  SaveState,
  passwordServerWrong,
} from '../teacherStudents/outlinedFormUi';
import { PASSWORD_RULES, PasswordRules, useRevealFocused } from './adminProfileUi';

/**
 * Change Password — the panel's password panel, drawn as Add Student is: the
 * current password, a new one and the same again, each an outline with its
 * name in the top border and its own eye, and the panel's checklist (8
 * characters, upper and lower case, a number, a symbol) ticking as the new one
 * is typed. It checks what the panel checks — every field, a new password that
 * differs from the current one and meets the rules, and a matching
 * confirmation — and the server checks the current password. A box the save
 * stops at turns red with what is wrong under it, until it is typed in again;
 * Update Password stays at the foot, above the keyboard.
 */

const AdminChangePasswordScreen = ({ navigation }: any) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  // The box the last save stopped at (or none, for what the server said of the whole).
  const [wrong, setWrong] = useState<PasswordWrong | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
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

  const save = async () => {
    if (busy.current) return;
    if (!current) return stop({ box: 'current', message: 'Enter your current password.' });
    if (!next) return stop({ box: 'next', message: 'Enter a new password.' });
    if (next === current) {
      return stop({ box: 'next', message: 'The new password must be different from the current password.' });
    }
    if (!PASSWORD_RULES.every(r => r.test(next))) {
      return stop({ box: 'next', message: 'The new password must meet every rule below.' });
    }
    if (!confirm) return stop({ box: 'confirm', message: 'Confirm the new password.' });
    if (confirm !== next) return stop({ box: 'confirm', message: 'The confirm password must match the new password.' });

    setWrong(null);
    busy.current = true;
    setSaveState('saving');
    try {
      await updateAdminPassword({ current_password: current, new_password: next, new_password_confirmation: confirm });
      setSaveState('done');
      AppAlert.alert('Done', 'Password updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      stop(passwordServerWrong(e, 'Could not update password.'));
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title="Change Password" onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <Text style={s.intro}>Set a new strong password for the admin login.</Text>

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
            value={next}
            onChangeText={typed('next', setNext)}
            error={errorOf('next')}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <OutlinedPasswordField
            ref={confirmRef}
            required
            label="Confirm Password"
            placeholder="Enter the new password again"
            value={confirm}
            onChangeText={typed('confirm', setConfirm)}
            error={errorOf('confirm')}
            returnKeyType="done"
            onSubmitEditing={save}
          />

          <PasswordRules password={next} />

          {/* What the server said that is about none of the boxes */}
          {!!wrong && !wrong.box && <Text style={s.errorText}>{wrong.message}</Text>}

          <View style={s.tail} />
        </ScrollView>

        {/* Update Password stays in reach at the foot */}
        <View style={s.footer}>
          <SaveButton
            state={saveState}
            icon="lock-closed-outline"
            label="Update Password"
            busyLabel="Updating password"
            doneLabel="Password updated"
            onPress={save}
          />
        </View>
      </Animated.View>
    </View>
  );
};

export default AdminChangePasswordScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  tail: { height: 24 },
  intro: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
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

import React, { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import VectorIcon from '../../components/VectorIcon';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { pickImage } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { AccountUser, AccountUserForm, fieldErrorOf, saveAccountUser } from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import {
  FieldPair,
  FormHeading,
  OutlinedField,
  OutlinedPasswordField,
  SaveButton,
  SaveState,
} from '../teacherStudents/outlinedFormUi';
import { useRevealFocused } from './adminProfileUi';
import { initialsOf } from './adminTransportUi';
import { FormFoot, Quiet } from './feeSetupUi';

/**
 * Add / Edit Accounts user — the panel's slide-in: a photo, the name, the
 * email they sign in with and a password (8–16 characters; left blank when
 * editing, it stays), then their mobile numbers, designation, department,
 * employee ID and address. A new login, and a changed password, are emailed
 * to them.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TWO_MB = 2 * 1024 * 1024;
const PHOTO = 84;

type Field = keyof AccountUserForm;

const AdminFeeAccountUserFormScreen = ({ navigation, route }: any) => {
  const user: AccountUser | undefined = route.params?.user;
  const editing = !!user;

  const [form, setForm] = useState<AccountUserForm>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    mobile_number: user?.mobile_number ?? '',
    alternate_mobile: user?.alternate_mobile ?? '',
    designation: user?.designation ?? '',
    department: user?.department ?? 'accounts',
    employee_id: user?.employee_id ?? '',
    address: user?.address ?? '',
    image: null,
  });
  const [wrong, setWrong] = useState<{ field: string; message: string } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const busy = useRef(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();
  const errorOf = (f: string) => (wrong?.field === f ? wrong.message : null);

  const set = (k: Field, v: any) => {
    setForm(f => ({ ...f, [k]: v }));
    setWrong(w => (w?.field === k ? null : w));
  };

  const stop = (field: string, message: string) => {
    setWrong({ field, message });
    AppAlert.alert('Check the form', message);
  };

  const pick = async () => {
    const f: PickedFile | null = await pickImage({ maxSide: 1024 });
    if (!f) return;
    if (f.size && f.size > TWO_MB) return stop('image', 'Image must not be larger than 2MB.');
    set('image', f);
  };

  const save = async () => {
    if (busy.current) return;
    if (!form.name.trim()) return stop('name', 'Enter the full name.');
    if (!EMAIL.test(form.email.trim())) return stop('email', 'Enter a valid email address.');
    if (!editing && !form.password) return stop('password', 'Enter a password (8-16 characters).');
    if (form.password && (form.password.length < 8 || form.password.length > 16)) {
      return stop('password', 'The password must be 8 to 16 characters.');
    }
    setWrong(null);
    busy.current = true;
    setSaveState('saving');
    try {
      const msg = await saveAccountUser(form, user?.id);
      setSaveState('done');
      AppAlert.alert('Saved', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      const w = fieldErrorOf(e);
      if (w?.field) stop(w.field, w.message);
      else AppAlert.alert('Not saved', w?.message ?? 'Could not save the user.');
    }
  };

  const photo = form.image?.uri ?? user?.image ?? null;

  return (
    <View style={s.root}>
      <DocHeader title={editing ? 'Edit Accounts user' : 'Add Accounts user'} onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <TouchableOpacity style={s.photoWrap} activeOpacity={0.7} onPress={pick}>
            {photo ? (
              <Image source={{ uri: photo }} style={s.photo} />
            ) : (
              <View style={[s.photo, s.photoEmpty]}>
                <Text style={s.initials}>{form.name.trim() ? initialsOf(form.name) : ''}</Text>
                {!form.name.trim() && <VectorIcon iconSet="Ionicons" iconName="camera-outline" size={24} color={theme.colors.primary} />}
              </View>
            )}
            <Text style={s.photoText}>{photo ? 'Change photo' : 'Add a photo'}</Text>
          </TouchableOpacity>
          {!!errorOf('image') && <Text style={s.error}>{errorOf('image')}</Text>}

          <FormHeading title="Login" first />
          <OutlinedField required label="Full Name" placeholder="Enter full name" value={form.name} onChangeText={(v: string) => set('name', v)} error={errorOf('name')} maxLength={255} />
          <OutlinedField
            required
            label="Email"
            placeholder="Enter email address"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={form.email}
            onChangeText={(v: string) => set('email', v)}
            error={errorOf('email')}
          />
          <OutlinedPasswordField
            required={!editing}
            label="Password"
            placeholder={editing ? 'Leave blank to keep current' : 'Enter password (8-16 chars)'}
            value={form.password}
            onChangeText={(v: string) => set('password', v)}
            error={errorOf('password')}
            maxLength={16}
          />
          <Quiet>{editing ? 'A new password is emailed to them.' : 'Their login is emailed to them.'}</Quiet>

          <FormHeading title="Contact" />
          <FieldPair>
            <OutlinedField half label="Mobile Number" placeholder="Primary mobile" keyboardType="phone-pad" value={form.mobile_number} onChangeText={(v: string) => set('mobile_number', v)} error={errorOf('mobile_number')} maxLength={15} />
            <OutlinedField half label="Alternate Mobile" placeholder="Alternate mobile" keyboardType="phone-pad" value={form.alternate_mobile} onChangeText={(v: string) => set('alternate_mobile', v)} error={errorOf('alternate_mobile')} maxLength={15} />
          </FieldPair>

          <FormHeading title="Work" />
          <FieldPair>
            <OutlinedField half label="Designation" placeholder="e.g. Accountant" value={form.designation} onChangeText={(v: string) => set('designation', v)} maxLength={255} />
            <OutlinedField half label="Department" placeholder="e.g. Accounts" value={form.department} onChangeText={(v: string) => set('department', v)} maxLength={255} />
          </FieldPair>
          <OutlinedField label="Employee ID" placeholder="Enter employee ID" value={form.employee_id} onChangeText={(v: string) => set('employee_id', v)} maxLength={255} />
          <OutlinedField multiline label="Address" placeholder="Enter full address" value={form.address} onChangeText={(v: string) => set('address', v)} maxLength={500} />
          <View style={s.tail} />
        </ScrollView>
        <FormFoot>
          <SaveButton
            state={saveState}
            icon="person-add-outline"
            label={editing ? 'Update User' : 'Add User'}
            busyLabel={editing ? 'Updating user' : 'Adding user'}
            doneLabel={editing ? 'User updated' : 'User added'}
            onPress={save}
          />
        </FormFoot>
      </Animated.View>
    </View>
  );
};

export default AdminFeeAccountUserFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  photoWrap: { alignItems: 'center', gap: 8 },
  photo: { width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2, backgroundColor: theme.colors.background },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primaryLight },
  initials: { fontSize: 26, fontWeight: '700', color: theme.colors.primary },
  photoText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  error: { fontSize: 12, color: theme.colors.danger, textAlign: 'center', marginTop: 4 },
  tail: { height: 24 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

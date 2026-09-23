import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import Select from '../../components/Select';
import { theme } from '../../utils/theme';
import { apiErr, pickImage } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { Field, ToggleRow } from './AdminStandardScreen';
import {
  TeacherPayload, UsernameCheck, checkTeacherUsername, createTeacher, getTeacher, updateTeacher,
} from '../../api/adminTeacherApi';
import { AppAlert } from '../../components/AppDialog';

const GENDERS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

const emptyForm: TeacherPayload = {
  name: '', email: '', username: '', mobile: '', dob: '', gender: '',
  employee_id: '', date_of_joining: '', qualification: '',
  address: '', pincode: '', emergency_contact: '', state: '', city: '',
  is_active: true, image: null,
};

const AdminTeacherFormScreen = ({ navigation, route }: any) => {
  const editId: number | undefined = route?.params?.id;

  const [form, setForm] = useState<TeacherPayload>(emptyForm);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof TeacherPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  // The username: what the teacher signs in with and resets a password by.
  // Until one is typed in, a new teacher's name offers a free one.
  const [editUserId, setEditUserId] = useState<number | undefined>();
  const usernameTyped = useRef(false);
  const [check, setCheck] = useState<UsernameCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const checkSeq = useRef(0);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const d = await getTeacher(editId);
        setForm({
          name: d.name ?? '', email: d.email ?? '', username: d.username ?? '', mobile: d.phone ?? '',
          dob: d.dob ?? '', gender: d.gender ?? '',
          employee_id: d.employee_id ?? '', date_of_joining: d.date_of_joining ?? '',
          qualification: d.qualification ?? '', address: d.address ?? '',
          pincode: d.pincode ?? '', emergency_contact: d.emergency_contact ?? '',
          state: d.state ?? '', city: d.city ?? '', is_active: d.is_active, image: null,
        });
        setEditUserId(d.user_id);
        usernameTyped.current = !!d.username;
      } catch (e) {
        AppAlert.alert('Error', apiErr(e, 'Could not load teacher.'));
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, navigation]);

  // A new teacher's name suggests a free username, until one is typed in.
  useEffect(() => {
    if (editId || usernameTyped.current || !form.name.trim()) return;
    const t = setTimeout(async () => {
      try {
        const res = await checkTeacherUsername({ name: form.name.trim() });
        if (!usernameTyped.current && res.suggestions[0]) set('username', res.suggestions[0]);
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [form.name, editId]);

  // Whether the username is free, said as it is typed.
  useEffect(() => {
    const u = form.username.trim();
    if (!u) { setCheck(null); setChecking(false); return; }
    const seq = ++checkSeq.current;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await checkTeacherUsername({ username: u, ignore_user_id: editUserId });
        if (seq === checkSeq.current) setCheck(res);
      } catch {
        if (seq === checkSeq.current) setCheck(null);
      } finally {
        if (seq === checkSeq.current) setChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.username, editUserId]);

  const onUsername = (v: string) => {
    usernameTyped.current = true;
    set('username', v.toLowerCase().replace(/[^a-z0-9._]/g, ''));
  };

  const choosePhoto = async () => {
    const f = await pickImage();
    if (f) { setPhoto(f); set('image', f); }
  };

  const save = async () => {
    const required = ['name', 'email', 'username', 'mobile', 'dob', 'gender', 'employee_id', 'date_of_joining', 'qualification', 'address', 'pincode', 'emergency_contact'] as (keyof TeacherPayload)[];
    if (required.some(k => !String(form[k] ?? '').trim())) {
      return AppAlert.alert('Required', 'Please fill all required fields.');
    }
    if (check && check.username === form.username.trim() && !check.available) {
      return AppAlert.alert('Username', check.problems.join(' '));
    }
    setSaving(true);
    try {
      if (editId) {
        await updateTeacher(editId, form);
        AppAlert.alert('Success', 'Teacher updated successfully.');
      } else {
        await createTeacher(form);
        AppAlert.alert('Success', 'Teacher created successfully. Login credentials have been emailed to the teacher.');
      }
      navigation.goBack();
    } catch (e) {
      AppAlert.alert('Error', apiErr(e, 'Could not save teacher.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.root}>
        <Header title={editId ? 'Edit Teacher' : 'New Teacher'} onBackPress={() => navigation.goBack()} />
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Header title={editId ? 'Edit Teacher' : 'New Teacher'} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.photoBtn} onPress={choosePhoto} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="camera-outline" size={16} color={theme.colors.primary} />
            <Text style={s.photoBtnText} numberOfLines={1}>{photo ? photo.name : 'Add photo (optional)'}</Text>
          </TouchableOpacity>

          <Field label="Full Name" value={form.name} onChangeText={(v: string) => set('name', v)} placeholder="Teacher name" />
          <Field label="Email" value={form.email} onChangeText={(v: string) => set('email', v)} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Username" value={form.username} onChangeText={onUsername} placeholder="e.g. meera.sharma" autoCapitalize="none" autoCorrect={false} maxLength={30} />
          <UsernameHint check={check} checking={checking} username={form.username.trim()} onPick={onUsername} />
          <Field label="Mobile" value={form.mobile} onChangeText={(v: string) => set('mobile', v)} placeholder="10-digit" keyboardType="number-pad" />
          <Field label="Date of Birth" value={form.dob} onChangeText={(v: string) => set('dob', v)} placeholder="YYYY-MM-DD" />
          <Select label="Gender" placeholder="Select gender" value={form.gender || null} options={GENDERS} onChange={(v) => set('gender', v)} />
          <Field label="Employee ID" value={form.employee_id} onChangeText={(v: string) => set('employee_id', v)} placeholder="e.g. EMP001" />
          <Field label="Date of Joining" value={form.date_of_joining} onChangeText={(v: string) => set('date_of_joining', v)} placeholder="YYYY-MM-DD" />
          <Field label="Qualification" value={form.qualification} onChangeText={(v: string) => set('qualification', v)} placeholder="e.g. B.Ed, M.Sc" />
          <Field label="Emergency Contact" value={form.emergency_contact} onChangeText={(v: string) => set('emergency_contact', v)} placeholder="10-digit" keyboardType="number-pad" />
          <Field label="Address" value={form.address} onChangeText={(v: string) => set('address', v)} placeholder="Full address" multiline />
          <Field label="State" value={form.state} onChangeText={(v: string) => set('state', v)} placeholder="Optional" />
          <Field label="City" value={form.city} onChangeText={(v: string) => set('city', v)} placeholder="Optional" />
          <Field label="Pincode" value={form.pincode} onChangeText={(v: string) => set('pincode', v)} placeholder="6 digits" keyboardType="number-pad" />
          <ToggleRow label="Active" value={form.is_active} onValueChange={(v: boolean) => set('is_active', v)} />

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving} activeOpacity={0.9}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{editId ? 'Update Teacher' : 'Create Teacher'}</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

/**
 * Under the username: whether it is free, and when it is not, what is wrong,
 * the rules it must follow and free ones to tap.
 */
const UsernameHint = ({ check, checking, username, onPick }: {
  check: UsernameCheck | null; checking: boolean; username: string; onPick: (u: string) => void;
}) => {
  if (!username) {
    return <Text style={s.hint}>The teacher signs in with this. Two teachers may share an email, never a username.</Text>;
  }
  if (checking || !check || check.username !== username) {
    return <Text style={s.hint}>Checking…</Text>;
  }
  if (check.available) {
    return (
      <View style={s.hintRow}>
        <VectorIcon iconSet="Ionicons" iconName="checkmark-circle" size={14} color={theme.colors.success} />
        <Text style={[s.hint, { color: theme.colors.success, marginTop: 0 }]}>Available — the teacher signs in with it.</Text>
      </View>
    );
  }
  return (
    <View>
      {check.problems.map(p => <Text key={p} style={[s.hint, { color: theme.colors.danger }]}>{p}</Text>)}
      <Text style={s.hint}>A username must be:</Text>
      {check.rules.map(r => <Text key={r} style={s.rule}>• {r}</Text>)}
      {check.suggestions.length > 0 && (
        <View style={s.suggestRow}>
          {check.suggestions.map(u => (
            <TouchableOpacity key={u} style={s.suggest} onPress={() => onPick(u)} activeOpacity={0.8}>
              <Text style={s.suggestText}>{u}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

export default AdminTeacherFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  photoBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, maxWidth: '80%' },
  saveBtn: { marginTop: 22, height: 50, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  hint: { marginTop: 6, fontSize: 12, color: theme.colors.textMuted },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  rule: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, marginLeft: 4 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  suggest: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.primary },
  suggestText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
});

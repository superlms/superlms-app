import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { TeacherPayload, createTeacher, getTeacher, updateTeacher } from '../../api/adminTeacherApi';

const GENDERS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

const emptyForm: TeacherPayload = {
  name: '', email: '', mobile: '', dob: '', gender: '',
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

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const d = await getTeacher(editId);
        setForm({
          name: d.name ?? '', email: d.email ?? '', mobile: d.phone ?? '',
          dob: d.dob ?? '', gender: d.gender ?? '',
          employee_id: d.employee_id ?? '', date_of_joining: d.date_of_joining ?? '',
          qualification: d.qualification ?? '', address: d.address ?? '',
          pincode: d.pincode ?? '', emergency_contact: d.emergency_contact ?? '',
          state: d.state ?? '', city: d.city ?? '', is_active: d.is_active, image: null,
        });
      } catch (e) {
        Alert.alert('Error', apiErr(e, 'Could not load teacher.'));
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, navigation]);

  const choosePhoto = async () => {
    const f = await pickImage();
    if (f) { setPhoto(f); set('image', f); }
  };

  const save = async () => {
    const required = ['name', 'email', 'mobile', 'dob', 'gender', 'employee_id', 'date_of_joining', 'qualification', 'address', 'pincode', 'emergency_contact'] as (keyof TeacherPayload)[];
    if (required.some(k => !String(form[k] ?? '').trim())) {
      return Alert.alert('Required', 'Please fill all required fields.');
    }
    setSaving(true);
    try {
      if (editId) {
        await updateTeacher(editId, form);
        Alert.alert('Success', 'Teacher updated successfully.');
      } else {
        await createTeacher(form);
        Alert.alert('Success', 'Teacher created successfully. Login credentials have been emailed to the teacher.');
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save teacher.'));
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

export default AdminTeacherFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  photoBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, maxWidth: '80%' },
  saveBtn: { marginTop: 22, height: 50, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

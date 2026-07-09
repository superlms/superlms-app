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
import {
  StudentLookups,
  StudentPayload,
  createStudent,
  getStudent,
  getStudentLookups,
  updateStudent,
} from '../../api/adminStudentApi';

const GENDERS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

const emptyForm: StudentPayload = {
  name: '', email: '', mobile: '', dob: '', gender: '',
  standard_id: 0, section_id: 0, father_name: '', mother_name: '',
  date_of_admission: '', aadhar_no: '', pincode: '', religion: '',
  local_address: '', permanent_address: '', state: '', city: '',
  appar_id: '', registration_number: '',
  is_active: true, transportation_required: false, route_id: null, image: null,
};

const AdminStudentFormScreen = ({ navigation, route }: any) => {
  const editId: number | undefined = route?.params?.id;

  const [form, setForm] = useState<StudentPayload>(emptyForm);
  const [lookups, setLookups] = useState<StudentLookups | null>(null);
  const [formSections, setFormSections] = useState<StudentLookups['sections']>([]);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof StudentPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    getStudentLookups().then(setLookups).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const d = await getStudent(editId);
        setForm({
          name: d.full_name ?? '', email: d.email ?? '', mobile: d.phone ?? '',
          dob: d.dob ?? '', gender: d.gender ?? '',
          standard_id: d.standard_id ?? 0, section_id: d.section_id ?? 0,
          father_name: d.father_name ?? '', mother_name: d.mother_name ?? '',
          date_of_admission: d.date_of_admission ?? '', aadhar_no: d.aadhar_no ?? '',
          pincode: d.pincode ?? '', religion: d.religion ?? '',
          local_address: d.local_address ?? '', permanent_address: d.permanent_address ?? '',
          state: d.state ?? '', city: d.city ?? '',
          appar_id: d.appar_id ?? '', registration_number: d.registration_number ?? '',
          is_active: d.is_active, transportation_required: d.transportation_required,
          route_id: d.route_id ?? null, image: null,
        });
        if (d.standard_id) {
          const lk = await getStudentLookups(d.standard_id);
          setFormSections(lk.sections);
        }
      } catch (e) {
        Alert.alert('Error', apiErr(e, 'Could not load student.'));
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, navigation]);

  const onClassChange = async (id: number) => {
    set('standard_id', id);
    set('section_id', 0);
    try {
      const lk = await getStudentLookups(id);
      setFormSections(lk.sections);
    } catch {
      setFormSections([]);
    }
  };

  const choosePhoto = async () => {
    const f = await pickImage();
    if (f) {
      setPhoto(f);
      set('image', f);
    }
  };

  const save = async () => {
    if (
      !form.name.trim() || !form.email.trim() || !form.mobile.trim() ||
      !form.gender || !form.standard_id || !form.section_id ||
      !form.father_name.trim() || !form.dob
    ) {
      return Alert.alert('Required', 'Name, email, mobile, DOB, gender, class, section and father name are required.');
    }
    setSaving(true);
    try {
      if (editId) {
        await updateStudent(editId, form);
        Alert.alert('Success', 'Student updated successfully.');
      } else {
        await createStudent(form);
        Alert.alert('Success', 'Student created successfully. Login credentials have been emailed to the student.');
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save student.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.root}>
        <Header title={editId ? 'Edit Student' : 'New Student'} onBackPress={() => navigation.goBack()} />
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Header title={editId ? 'Edit Student' : 'New Student'} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.photoBtn} onPress={choosePhoto} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="camera-outline" size={16} color={theme.colors.primary} />
            <Text style={s.photoBtnText} numberOfLines={1}>{photo ? photo.name : 'Add photo (optional)'}</Text>
          </TouchableOpacity>

          <Field label="Full Name" value={form.name} onChangeText={(v: string) => set('name', v)} placeholder="Student name" />
          <Field label="Email" value={form.email} onChangeText={(v: string) => set('email', v)} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Mobile" value={form.mobile} onChangeText={(v: string) => set('mobile', v)} placeholder="10-digit" keyboardType="number-pad" />
          <Field label="Date of Birth" value={form.dob} onChangeText={(v: string) => set('dob', v)} placeholder="YYYY-MM-DD" />

          <Select label="Gender" placeholder="Select gender" value={form.gender || null} options={GENDERS} onChange={(v) => set('gender', v)} />
          <Select label="Class" placeholder="Select class" value={form.standard_id || null}
            options={(lookups?.classes ?? []).map(c => ({ label: c.name, value: c.id }))}
            onChange={(v) => onClassChange(Number(v))} />
          <Select label="Section" placeholder={form.standard_id ? 'Select section' : 'Select a class first'} value={form.section_id || null}
            options={formSections.map(x => ({ label: x.name, value: x.id }))}
            onChange={(v) => set('section_id', Number(v))} disabled={!form.standard_id} />

          <Field label="Father Name" value={form.father_name} onChangeText={(v: string) => set('father_name', v)} placeholder="Father's name" />
          <Field label="Mother Name" value={form.mother_name} onChangeText={(v: string) => set('mother_name', v)} placeholder="Optional" />
          <Field label="Date of Admission" value={form.date_of_admission} onChangeText={(v: string) => set('date_of_admission', v)} placeholder="YYYY-MM-DD (optional)" />
          <Field label="Religion" value={form.religion} onChangeText={(v: string) => set('religion', v)} placeholder="Optional" />
          <Field label="Aadhar No" value={form.aadhar_no} onChangeText={(v: string) => set('aadhar_no', v)} placeholder="12 digits (optional)" keyboardType="number-pad" />
          <Field label="Apaar ID" value={form.appar_id} onChangeText={(v: string) => set('appar_id', v)} placeholder="Optional" />
          <Field label="Registration Number" value={form.registration_number} onChangeText={(v: string) => set('registration_number', v)} placeholder="Optional" />
          <Field label="State" value={form.state} onChangeText={(v: string) => set('state', v)} placeholder="Optional" />
          <Field label="City" value={form.city} onChangeText={(v: string) => set('city', v)} placeholder="Optional" />
          <Field label="Pincode" value={form.pincode} onChangeText={(v: string) => set('pincode', v)} placeholder="6 digits (optional)" keyboardType="number-pad" />
          <Field label="Local Address" value={form.local_address} onChangeText={(v: string) => set('local_address', v)} placeholder="Optional" multiline />
          <Field label="Permanent Address" value={form.permanent_address} onChangeText={(v: string) => set('permanent_address', v)} placeholder="Optional" multiline />

          <ToggleRow label="Transport Required" value={form.transportation_required} onValueChange={(v: boolean) => set('transportation_required', v)} />
          {form.transportation_required && (
            <Select label="Route" placeholder="Select route" value={form.route_id ?? null}
              options={(lookups?.routes ?? []).map(rt => ({ label: rt.route_name, value: rt.id }))}
              onChange={(v) => set('route_id', Number(v))} />
          )}
          <ToggleRow label="Active" value={form.is_active} onValueChange={(v: boolean) => set('is_active', v)} />

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving} activeOpacity={0.9}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{editId ? 'Update Student' : 'Create Student'}</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminStudentFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  photoBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, maxWidth: '80%' },
  saveBtn: { marginTop: 22, height: 50, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import Select from '../../components/Select';
import { AppAlert, AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, takePhoto } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { DocHeader } from '../more/docUi';
import { FormField, FormPair, FormSection, FormToggle } from '../teacherStudents/studentFormUi';
import {
  StudentLookups,
  StudentPayload,
  createStudent,
  getStudent,
  getStudentLookups,
  updateStudent,
} from '../../api/adminStudentApi';

/**
 * Adding or editing one student — the admin panel's Students form, drawn as a
 * class teacher's own is: the photo at the top, then blocks (student, family,
 * school, address, transport & access) of fields that are an outline and
 * nothing else, with the short ones two to a line.
 *
 * The school's admin keeps every class, so unlike a teacher's form this one
 * asks which class and section the student goes into.
 */

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
  const [savedPhoto, setSavedPhoto] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
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
        setSavedPhoto(d.image ?? null);
        if (d.standard_id) {
          const lk = await getStudentLookups(d.standard_id);
          setFormSections(lk.sections);
        }
      } catch (e) {
        AppAlert.alert('Error', apiErr(e, 'Could not load this student.'));
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

  // The photo: the camera, or the gallery.
  const choose = async (from: 'camera' | 'gallery') => {
    setAsking(false);
    const f = from === 'camera' ? await takePhoto() : await pickImage();
    if (!f) return;
    setPhoto(f);
    set('image', f);
  };

  const save = async () => {
    if (
      !form.name.trim() || !form.email.trim() || !form.mobile.trim() ||
      !form.gender || !form.dob || !form.father_name.trim()
    ) {
      return AppAlert.alert('Something is missing', 'Name, email, mobile, date of birth, gender and father’s name are needed.');
    }
    if (!form.standard_id || !form.section_id) {
      return AppAlert.alert('No class', 'Pick the class and section the student goes into.');
    }
    setSaving(true);
    try {
      if (editId) {
        await updateStudent(editId, form);
        AppAlert.alert('Saved', 'The student has been updated.');
      } else {
        await createStudent(form);
        AppAlert.alert('Added', 'The student has been added. Their login has been emailed to them.');
      }
      navigation.goBack();
    } catch (e) {
      AppAlert.alert('Not saved', apiErr(e, 'Could not save this student.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.root}>
        <DocHeader title="Edit Student" onBackPress={() => navigation.goBack()} />
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      </View>
    );
  }

  const shown = photo?.uri ?? savedPhoto;

  return (
    <View style={s.root}>
      <DocHeader title={editId ? 'Edit Student' : 'Add Student'} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* The photo */}
          <View style={s.photoBlock}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setAsking(true)}>
              {shown ? (
                <Image source={{ uri: shown }} style={s.photo} />
              ) : (
                <View style={[s.photo, s.photoEmpty]}>
                  <VectorIcon iconSet="Ionicons" iconName="person" size={34} color={theme.colors.textMuted} />
                </View>
              )}
              <View style={s.camera}>
                <VectorIcon iconSet="Ionicons" iconName="camera" size={15} color={theme.colors.white} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setAsking(true)} hitSlop={8} activeOpacity={0.6}>
              <Text style={s.photoText}>{shown ? 'Change photo' : 'Add a photo'}</Text>
            </TouchableOpacity>
          </View>

          <FormSection title="Student" first />
          <FormField label="Full Name" value={form.name} onChangeText={(v: string) => set('name', v)} placeholder="Student name" />
          <FormField label="Email" value={form.email} onChangeText={(v: string) => set('email', v)} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" hint="Their login is emailed here." />
          <FormPair>
            <FormField half label="Mobile" value={form.mobile} onChangeText={(v: string) => set('mobile', v)} placeholder="10-digit" keyboardType="number-pad" maxLength={10} />
            <FormField half label="Date of Birth" value={form.dob} onChangeText={(v: string) => set('dob', v)} placeholder="YYYY-MM-DD" />
          </FormPair>
          <View style={s.select}>
            <Select plain label="Gender" placeholder="Select gender" value={form.gender || null} options={GENDERS} onChange={v => set('gender', v)} />
          </View>

          <FormSection title="Class" />
          <View style={s.select}>
            <Select plain label="Class" placeholder="Select class" value={form.standard_id || null}
              options={(lookups?.classes ?? []).map(c => ({ label: c.name, value: c.id }))}
              onChange={v => onClassChange(Number(v))} />
          </View>
          <View style={s.select}>
            <Select plain label="Section" placeholder={form.standard_id ? 'Select section' : 'Select a class first'}
              value={form.section_id || null}
              options={formSections.map(x => ({ label: x.name, value: x.id }))}
              onChange={v => set('section_id', Number(v))} disabled={!form.standard_id} />
          </View>

          <FormSection title="Family" />
          <FormField label="Father’s Name" value={form.father_name} onChangeText={(v: string) => set('father_name', v)} placeholder="Father’s name" />
          <FormField label="Mother’s Name" value={form.mother_name} onChangeText={(v: string) => set('mother_name', v)} placeholder="Optional" />

          <FormSection title="School" />
          <FormField label="Date of Admission" value={form.date_of_admission} onChangeText={(v: string) => set('date_of_admission', v)} placeholder="YYYY-MM-DD (optional)" />
          <FormPair>
            <FormField half label="Religion" value={form.religion} onChangeText={(v: string) => set('religion', v)} placeholder="Optional" />
            <FormField half label="Aadhaar No." value={form.aadhar_no} onChangeText={(v: string) => set('aadhar_no', v)} placeholder="12 digits" keyboardType="number-pad" maxLength={12} />
          </FormPair>
          <FormPair>
            <FormField half label="Apaar ID" value={form.appar_id} onChangeText={(v: string) => set('appar_id', v)} placeholder="Optional" />
            <FormField half label="Registration No." value={form.registration_number} onChangeText={(v: string) => set('registration_number', v)} placeholder="Optional" />
          </FormPair>

          <FormSection title="Address" />
          <FormPair>
            <FormField half label="City" value={form.city} onChangeText={(v: string) => set('city', v)} placeholder="Optional" />
            <FormField half label="State" value={form.state} onChangeText={(v: string) => set('state', v)} placeholder="Optional" />
          </FormPair>
          <FormField label="Pincode" value={form.pincode} onChangeText={(v: string) => set('pincode', v)} placeholder="6 digits (optional)" keyboardType="number-pad" maxLength={6} />
          <FormField label="Local Address" value={form.local_address} onChangeText={(v: string) => set('local_address', v)} placeholder="Optional" multiline />
          <FormField label="Permanent Address" value={form.permanent_address} onChangeText={(v: string) => set('permanent_address', v)} placeholder="Optional" multiline />

          <FormSection title="Transport & Access" />
          <FormToggle
            label="Takes the bus"
            note={form.transportation_required ? 'Billed on the route below' : 'No transport fee'}
            value={!!form.transportation_required}
            onValueChange={(v: boolean) => set('transportation_required', v)}
          />
          {form.transportation_required && (
            <View style={s.select}>
              <Select
                plain
                label="Route"
                placeholder="Select route"
                value={form.route_id ?? null}
                options={(lookups?.routes ?? []).map(rt => ({ label: rt.route_name, value: rt.id }))}
                onChange={v => set('route_id', Number(v))}
              />
            </View>
          )}
          <FormToggle
            label="Active"
            note={form.is_active ? 'Can sign in to the app' : 'Signed out of the app'}
            value={!!form.is_active}
            onValueChange={(v: boolean) => set('is_active', v)}
          />

          <TouchableOpacity style={[s.saveBtn, saving && s.idle]} onPress={save} disabled={saving} activeOpacity={0.9}>
            {saving ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={s.saveText}>{editId ? 'Save changes' : 'Add student'}</Text>
            )}
          </TouchableOpacity>

          <View style={s.tail} />
        </ScrollView>
      </KeyboardAvoidingView>

      <AppDialog
        visible={asking}
        title="Student photo"
        message="Take one now, or pick a picture already on this phone."
        actions={[
          { text: 'Camera', onPress: () => choose('camera') },
          { text: 'Gallery', onPress: () => choose('gallery') },
          { text: 'Cancel', style: 'cancel', onPress: () => setAsking(false) },
        ]}
        onRequestClose={() => setAsking(false)}
      />
    </View>
  );
};

export default AdminStudentFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 48 },

  // Photo
  photoBlock: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  photo: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.background },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.card,
  },
  photoText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary, marginTop: 10 },

  // Select sits in the fields' rhythm
  select: { marginTop: 12 },

  saveBtn: {
    marginTop: 28,
    height: 50,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { opacity: 0.7 },
  saveText: { fontSize: 15, fontWeight: '700', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

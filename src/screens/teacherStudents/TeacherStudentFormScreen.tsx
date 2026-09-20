import React, { useCallback, useEffect, useState } from 'react';
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
import { Field, ToggleRow } from '../admin/AdminStandardScreen';
import {
  StudentLookups,
  StudentPayload,
  TeacherClass,
  createStudent,
  getMyClasses,
  getStudent,
  getStudentLookups,
  updateStudent,
} from '../../api/teacherStudentApi';

/**
 * Adding or editing one student of the class a teacher is class teacher of —
 * the admin panel's Students form, field for field, with the class and section
 * fixed to their own (a picker only when they are class teacher of more than
 * one). The photo is taken with the camera or picked from the gallery.
 *
 * Route params: id (edit), classes (what the list already knows they own).
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

const classLabel = (c: TeacherClass) => [c.class, c.section].filter(Boolean).join(' · ');
const classKey = (standardId: number, sectionId: number | null) => `${standardId}-${sectionId ?? 0}`;

const TeacherStudentFormScreen = ({ navigation, route }: any) => {
  const editId: number | undefined = route?.params?.id;

  const [form, setForm] = useState<StudentPayload>(emptyForm);
  const [classes, setClasses] = useState<TeacherClass[]>(route?.params?.classes ?? []);
  const [lookups, setLookups] = useState<StudentLookups | null>(null);
  const [sections, setSections] = useState<StudentLookups['sections']>([]);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [savedPhoto, setSavedPhoto] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof StudentPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  // A class teacher of one class has nothing to choose — it is filled in.
  const only = classes.length === 1 ? classes[0] : null;
  // Class teacher of a whole class rather than one section of it: the section
  // is theirs to pick. Otherwise it is fixed, and the server would refuse it.
  const ownsWholeClass = classes.some(c => c.standard_id === form.standard_id && c.section_id === null);

  useEffect(() => {
    getStudentLookups().then(setLookups).catch(() => {});
    if (!route?.params?.classes) getMyClasses().then(setClasses).catch(() => {});
  }, [route?.params?.classes]);

  // The sections of whichever class is picked, for a teacher who owns a whole
  // class rather than one section of it.
  const loadSections = useCallback(async (standardId: number) => {
    try {
      const lk = await getStudentLookups(standardId);
      setSections(lk.sections);
    } catch {
      setSections([]);
    }
  }, []);

  useEffect(() => {
    if (editId || !only) return;
    setForm(prev => ({ ...prev, standard_id: only.standard_id, section_id: only.section_id ?? 0 }));
    if (!only.section_id) loadSections(only.standard_id);
  }, [editId, only, loadSections]);

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
        if (d.standard_id) loadSections(d.standard_id);
      } catch (e) {
        AppAlert.alert('Error', apiErr(e, 'Could not load this student.'));
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, navigation, loadSections]);

  const onPickClass = (key: string) => {
    const picked = classes.find(c => classKey(c.standard_id, c.section_id) === key);
    if (!picked) return;
    set('standard_id', picked.standard_id);
    set('section_id', picked.section_id ?? 0);
    if (!picked.section_id) loadSections(picked.standard_id);
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
      !form.gender || !form.standard_id || !form.section_id ||
      !form.father_name.trim() || !form.dob
    ) {
      return AppAlert.alert('Required', 'Name, email, mobile, date of birth, gender, class, section and father name are needed.');
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
        <View style={s.loader}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  const shown = photo?.uri ?? savedPhoto;

  return (
    <View style={s.root}>
      <DocHeader title={editId ? 'Edit Student' : 'Add Student'} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Photo — taken here, or from the gallery */}
          <TouchableOpacity style={s.photoRow} activeOpacity={0.8} onPress={() => setAsking(true)}>
            {shown ? (
              <Image source={{ uri: shown }} style={s.photo} />
            ) : (
              <View style={[s.photo, s.photoEmpty]}>
                <VectorIcon iconSet="Ionicons" iconName="person-outline" size={24} color={theme.colors.textMuted} />
              </View>
            )}
            <View style={s.flex}>
              <Text style={s.photoTitle}>{shown ? 'Change photo' : 'Add a photo'}</Text>
              <Text style={s.photoSub}>Take one with the camera, or pick from the gallery</Text>
            </View>
            <VectorIcon iconSet="Ionicons" iconName="camera-outline" size={20} color={theme.colors.primary} />
          </TouchableOpacity>

          {/* The class — theirs, and fixed unless they own more than one */}
          {only && only.section_id ? (
            <View style={s.classBox}>
              <Text style={s.classLabel}>Class</Text>
              <Text style={s.classValue}>{classLabel(only)}</Text>
            </View>
          ) : (
            <Select
              label="Class"
              placeholder="Select class"
              value={form.standard_id ? classKey(form.standard_id, form.section_id || null) : null}
              options={classes.map(c => ({ label: classLabel(c), value: classKey(c.standard_id, c.section_id) }))}
              onChange={v => onPickClass(String(v))}
            />
          )}
          {/* A whole class is theirs section by section; one section is fixed */}
          {ownsWholeClass && (
            <Select
              label="Section"
              placeholder={form.standard_id ? 'Select section' : 'Select a class first'}
              value={form.section_id || null}
              options={sections.map(x => ({ label: x.name, value: x.id }))}
              onChange={v => set('section_id', Number(v))}
              disabled={!form.standard_id}
            />
          )}

          <Field label="Full Name" value={form.name} onChangeText={(v: string) => set('name', v)} placeholder="Student name" />
          <Field label="Email" value={form.email} onChangeText={(v: string) => set('email', v)} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Mobile" value={form.mobile} onChangeText={(v: string) => set('mobile', v)} placeholder="10-digit" keyboardType="number-pad" />
          <Field label="Date of Birth" value={form.dob} onChangeText={(v: string) => set('dob', v)} placeholder="YYYY-MM-DD" />

          <Select label="Gender" placeholder="Select gender" value={form.gender || null} options={GENDERS} onChange={v => set('gender', v)} />

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
            <Select
              label="Route"
              placeholder="Select route"
              value={form.route_id ?? null}
              options={(lookups?.routes ?? []).map(rt => ({ label: rt.route_name, value: rt.id }))}
              onChange={v => set('route_id', Number(v))}
            />
          )}
          <ToggleRow label="Active" value={form.is_active} onValueChange={(v: boolean) => set('is_active', v)} />

          <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnIdle]} onPress={save} disabled={saving} activeOpacity={0.9}>
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

export default TeacherStudentFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 12 },
  tail: { height: 40 },

  // Photo
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  photo: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.background },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  photoTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  photoSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  // The class, where it cannot be changed
  classBox: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  classLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },
  classValue: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 2 },

  saveBtn: {
    marginTop: 22,
    height: 50,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnIdle: { opacity: 0.7 },
  saveText: { fontSize: 15, fontWeight: '700', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

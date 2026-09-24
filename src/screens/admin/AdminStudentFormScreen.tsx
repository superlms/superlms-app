import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import VectorIcon from '../../components/VectorIcon';
import Select from '../../components/Select';
import { AppAlert, AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, takePhoto } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { DocHeader } from '../more/docUi';
import { FormField, FormPair, FormSection, FormToggle } from '../teacherStudents/studentFormUi';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { fromApiDate, toApiDate, typeDate } from '../../utils/dayMonthYear';
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
 *
 * A field that holds something, or is being typed in, wears the accent's
 * outline. Dates are typed DD/MM/YYYY and sent as YYYY-MM-DD; the photo is
 * scaled down before it goes up, to stay inside the server's 2 MB. The page
 * rides above the keyboard, and the box being typed in is scrolled into view.
 * Saved, an edit goes back to the student's page.
 */

// A profile picture needs no more than this on its longest side.
const PHOTO_SIDE = 1024;

// Every box here wears the accent's outline once it holds something.
const Field = (props: any) => <FormField markFilled {...props} />;

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

  // The page rides above the keyboard, and the box being typed in is scrolled
  // up to sit clear of it — when the keyboard opens, and when another box is
  // tapped while it is open.
  const lift = useKeyboardLiftStyle();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const reveal = () => {
    const top = keyboardTop.current;
    const input: any = TextInput.State.currentlyFocusedInput?.();
    if (top == null || !input?.measureInWindow) return;
    input.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      const overlap = y + h + 24 - top;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
    });
  };
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      keyboardTop.current = e.endCoordinates.screenY;
      // The page has lifted by now; the box goes above the keyboard.
      setTimeout(reveal, 120);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
          dob: fromApiDate(d.dob), gender: d.gender ?? '',
          standard_id: d.standard_id ?? 0, section_id: d.section_id ?? 0,
          father_name: d.father_name ?? '', mother_name: d.mother_name ?? '',
          date_of_admission: fromApiDate(d.date_of_admission), aadhar_no: d.aadhar_no ?? '',
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
    const f = from === 'camera' ? await takePhoto({ maxSide: PHOTO_SIDE }) : await pickImage({ maxSide: PHOTO_SIDE });
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
    // What the server would refuse, said here first and plainly.
    const today = new Date().toISOString().slice(0, 10);
    const dob = toApiDate(form.dob);
    const admitted = toApiDate(form.date_of_admission);
    const problem =
      !/^\S+@\S+\.\S+$/.test(form.email.trim()) ? 'Enter a valid email address.'
      : !/^\d{10}$/.test(form.mobile.trim()) ? 'The mobile number must be 10 digits.'
      : !dob ? 'Enter the date of birth as DD/MM/YYYY — a real date.'
      : dob >= today ? 'The date of birth must be before today.'
      : admitted === null ? 'Enter the date of admission as DD/MM/YYYY — a real date — or leave it empty.'
      : admitted && admitted > today ? 'The date of admission cannot be after today.'
      : !form.standard_id || !form.section_id ? 'Pick the class and section the student goes into.'
      : form.aadhar_no && !/^\d{12}$/.test(form.aadhar_no) ? 'The Aadhaar number must be 12 digits.'
      : form.pincode && !/^\d{6}$/.test(form.pincode) ? 'The pincode must be 6 digits.'
      : form.transportation_required && !form.route_id ? 'Pick the bus route, or turn off “Takes the bus”.'
      : null;
    if (problem) return AppAlert.alert('Please check', problem);

    // Checked above: the date of birth is a real one by now.
    const payload = { ...form, email: form.email.trim(), mobile: form.mobile.trim(), dob: dob as string, date_of_admission: admitted || '' };
    setSaving(true);
    try {
      if (editId) {
        await updateStudent(editId, payload);
        AppAlert.alert('Saved', 'The student has been updated.');
      } else {
        await createStudent(payload);
        AppAlert.alert('Added', 'The student has been added. Their login has been emailed to them.');
      }
      // An edit goes back to the student's page, which shows what was saved.
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
      <Animated.View style={[s.flex, lift]}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }}
          // Another box tapped while the keyboard is open comes into view too.
          onTouchEnd={() => setTimeout(reveal, 250)}
        >

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
          <Field label="Full Name" value={form.name} onChangeText={(v: string) => set('name', v)} placeholder="Student name" />
          <Field label="Email" value={form.email} onChangeText={(v: string) => set('email', v)} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" hint="Their login is emailed here." />
          <FormPair>
            <Field half label="Mobile" value={form.mobile} onChangeText={(v: string) => set('mobile', v)} placeholder="10-digit" keyboardType="number-pad" maxLength={10} />
            <Field half label="Date of Birth" value={form.dob} onChangeText={(v: string) => set('dob', typeDate(v, form.dob))} placeholder="DD/MM/YYYY" keyboardType="number-pad" maxLength={10} />
          </FormPair>
          <View style={s.select}>
            <Select plain markChosen label="Gender" placeholder="Select gender" value={form.gender || null} options={GENDERS} onChange={v => set('gender', v)} />
          </View>

          <FormSection title="Class" />
          <View style={s.select}>
            <Select plain markChosen label="Class" placeholder="Select class" value={form.standard_id || null}
              options={(lookups?.classes ?? []).map(c => ({ label: c.name, value: c.id }))}
              onChange={v => onClassChange(Number(v))} />
          </View>
          <View style={s.select}>
            <Select plain markChosen label="Section" placeholder={form.standard_id ? 'Select section' : 'Select a class first'}
              value={form.section_id || null}
              options={formSections.map(x => ({ label: x.name, value: x.id }))}
              onChange={v => set('section_id', Number(v))} disabled={!form.standard_id} />
          </View>

          <FormSection title="Family" />
          <Field label="Father’s Name" value={form.father_name} onChangeText={(v: string) => set('father_name', v)} placeholder="Father’s name" />
          <Field label="Mother’s Name" value={form.mother_name} onChangeText={(v: string) => set('mother_name', v)} placeholder="Optional" />

          <FormSection title="School" />
          <Field label="Date of Admission" value={form.date_of_admission} onChangeText={(v: string) => set('date_of_admission', typeDate(v, form.date_of_admission ?? ''))} placeholder="DD/MM/YYYY (optional)" keyboardType="number-pad" maxLength={10} />
          <FormPair>
            <Field half label="Religion" value={form.religion} onChangeText={(v: string) => set('religion', v)} placeholder="Optional" />
            <Field half label="Aadhaar No." value={form.aadhar_no} onChangeText={(v: string) => set('aadhar_no', v)} placeholder="12 digits" keyboardType="number-pad" maxLength={12} />
          </FormPair>
          <FormPair>
            <Field half label="Apaar ID" value={form.appar_id} onChangeText={(v: string) => set('appar_id', v)} placeholder="Optional" />
            <Field half label="Registration No." value={form.registration_number} onChangeText={(v: string) => set('registration_number', v)} placeholder="Optional" />
          </FormPair>

          <FormSection title="Address" />
          <FormPair>
            <Field half label="City" value={form.city} onChangeText={(v: string) => set('city', v)} placeholder="Optional" />
            <Field half label="State" value={form.state} onChangeText={(v: string) => set('state', v)} placeholder="Optional" />
          </FormPair>
          <Field label="Pincode" value={form.pincode} onChangeText={(v: string) => set('pincode', v)} placeholder="6 digits (optional)" keyboardType="number-pad" maxLength={6} />
          <Field label="Local Address" value={form.local_address} onChangeText={(v: string) => set('local_address', v)} placeholder="Optional" multiline />
          <Field label="Permanent Address" value={form.permanent_address} onChangeText={(v: string) => set('permanent_address', v)} placeholder="Optional" multiline />

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
                markChosen
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
              <Text style={s.saveText}>{editId ? 'Update Student' : 'Add Student'}</Text>
            )}
          </TouchableOpacity>

          <View style={s.tail} />
        </ScrollView>
      </Animated.View>

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

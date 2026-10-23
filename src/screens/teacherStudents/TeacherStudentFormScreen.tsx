import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { HeaderIconButton } from '../../components/Header';
import Select from '../../components/Select';
import { AppAlert, AppDialog } from '../../components/AppDialog';
import PhotoEditor, { type PhotoEdit } from '../../components/PhotoEditor';
import CroppedPhoto from '../../components/CroppedPhoto';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, takePhoto } from '../../utils/filePickers';
import { fromApiDate, toApiDate, typeDate } from '../../utils/dayMonthYear';
import { quietCaps } from '../../utils/quietCaps';
import { PickedFile } from '../../api/adminProfileApi';
import { DocHeader } from '../more/docUi';
import { CheckCard, FieldPair, FormHeading, OutlinedField } from './outlinedFormUi';
import {
  StudentLookups,
  StudentPayload,
  TeacherClass,
  createStudent,
  deleteStudent,
  getMyClasses,
  getStudent,
  getStudentLookups,
  newClientRef,
  updateStudent,
} from '../../api/teacherStudentApi';

/**
 * Adding or editing one student of the class a teacher is class teacher of —
 * the admin panel's Students form, field for field, in blocks: the photo, the
 * student, their family, the school's numbers, where they live and the bus.
 *
 * The class is not asked for. A class teacher has one, and the student goes
 * into it; the line under the photo says which. A class teacher of two or
 * more sections is asked which of them a new student goes into. The photo is
 * taken with the camera there and then, or picked from the gallery, and cropped
 * from any side in the photo editor (PhotoEditor, which shows the circle the
 * lists will show); the photo already saved can be cropped again with Crop.
 * The server cuts the photo to the part kept. Editing has Delete in the
 * header, which asks first and then goes back to the list.
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

// A photo is picked no bigger than this on its longest side (as the profile
// photo is); the square cut from it is at most 512.
const PHOTO_SIDE = 1600;

// The photo's circle on the form.
const PHOTO = 92;

// "Class 6 · Section A" — names the school typed in capitals brought down.
const classLabel = (c?: TeacherClass | null) =>
  c ? [quietCaps(c.class), quietCaps(c.section)].filter(Boolean).join(' · ') : '';

// One class-and-section, as the section picker tells its options apart.
const sectionKey = (standardId: number, sectionId?: number | null) => `${standardId}:${sectionId || 0}`;

const TeacherStudentFormScreen = ({ navigation, route }: any) => {
  const editId: number | undefined = route?.params?.id;

  const [form, setForm] = useState<StudentPayload>(emptyForm);
  const [classes, setClasses] = useState<TeacherClass[]>(route?.params?.classes ?? []);
  const [lookups, setLookups] = useState<StudentLookups | null>(null);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [savedPhoto, setSavedPhoto] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  // The photo in the cropper: one just picked (file), or the one shown.
  const [cropping, setCropping] = useState<{ uri: string; file: PickedFile | null } | null>(null);
  // The part kept of the photo shown (and its circle, for the preview) — sent with the save.
  const [crop, setCrop] = useState<PhotoEdit | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Held from the moment Add is pressed until the answer comes, before the
  // button has had time to grey out: a quick second tap does nothing.
  const busy = useRef(false);
  // This form's mark, sent with every Add: pressed again after the network
  // lost the answer, the server hands back the student it already added.
  const clientRef = useRef(newClientRef());

  const set = (k: keyof StudentPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  // The class the student belongs to: the teacher's own, and for a teacher of
  // more than one, the first — the class is never asked for here.
  const own = classes[0] ?? null;

  // Every section a new student may go into: one per section they are class
  // teacher of, and each section of a class that is theirs whole.
  const choices = useMemo(() => {
    const all: TeacherClass[] = [];
    classes.forEach(c => {
      const sections = c.section_id
        ? []
        : (lookups?.sections ?? []).filter(x => Number(x.standard_id) === Number(c.standard_id));
      if (sections.length === 0) all.push(c);
      else sections.forEach(x => all.push({ ...c, section_id: x.id, section: x.name }));
    });
    const keys = all.map(c => sectionKey(c.standard_id, c.section_id));
    return all.filter((_, i) => keys.indexOf(keys[i]) === i);
  }, [classes, lookups]);
  // With two or more the teacher says which; with one it is never asked.
  const asksSection = !editId && choices.length > 1;
  const oneClass = choices.every(c => c.standard_id === choices[0].standard_id);

  useEffect(() => {
    getStudentLookups().then(setLookups).catch(() => {});
    if (!route?.params?.classes) getMyClasses().then(setClasses).catch(() => {});
  }, [route?.params?.classes]);

  /** Their class, and its first section when the whole class is theirs. */
  const fillClass = useCallback(async (c: TeacherClass) => {
    setForm(prev => ({ ...prev, standard_id: c.standard_id, section_id: c.section_id ?? 0 }));
    if (c.section_id) return;
    try {
      const lk = await getStudentLookups(c.standard_id);
      // A whole class of several sections: the form asks which, below.
      if (lk.sections.length > 1) {
        setLookups(prev => prev ?? lk);
        return;
      }
      const first = lk.sections[0];
      if (first) setForm(prev => ({ ...prev, section_id: first.id }));
    } catch {
      // The save will ask for it again if it never arrives.
    }
  }, []);

  useEffect(() => {
    if (editId || !own) return;
    // Class teacher of several sections: the form asks which, below.
    if (choices.length > 1) return;
    fillClass(own);
  }, [editId, own, choices.length, fillClass]);

  const chosenKey = form.standard_id ? sectionKey(form.standard_id, form.section_id) : null;
  const chosen = asksSection ? choices.find(c => sectionKey(c.standard_id, c.section_id) === chosenKey) ?? null : null;

  const pickSection = (key: string | number) => {
    const c = choices.find(x => sectionKey(x.standard_id, x.section_id) === key);
    if (c) setForm(prev => ({ ...prev, standard_id: c.standard_id, section_id: c.section_id ?? 0 }));
  };

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
      } catch (e) {
        AppAlert.alert('Error', apiErr(e, 'Could not load this student.'));
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, navigation]);

  // The photo: the camera, or the gallery — then fitted in its circle.
  const choose = async (from: 'camera' | 'gallery') => {
    setAsking(false);
    const f = from === 'camera' ? await takePhoto({ maxSide: PHOTO_SIDE }) : await pickImage({ maxSide: PHOTO_SIDE });
    if (!f) return;
    setCropping({ uri: f.uri, file: f });
  };

  // Use photo: a photo just picked becomes the one shown; the part kept goes
  // with the save. Cancel leaves everything as it was.
  const cropped = (edit: PhotoEdit) => {
    if (cropping?.file) {
      setPhoto(cropping.file);
      set('image', cropping.file);
    }
    setCrop(edit);
    setCropping(null);
  };

  const save = async () => {
    if (busy.current) return;
    if (
      !form.name.trim() || !form.email.trim() || !form.mobile.trim() ||
      !form.gender || !form.dob || !form.father_name.trim()
    ) {
      return AppAlert.alert('Something is missing', 'Name, email, mobile, date of birth, gender and father’s name are needed.');
    }
    if (asksSection && !chosen) {
      return AppAlert.alert('Section', 'Select the section this student goes into.');
    }
    if (!form.standard_id || !form.section_id) {
      return AppAlert.alert('No class', 'Your class could not be read. Pull the list to refresh and try again.');
    }
    // The boxes hold DD/MM/YYYY; the server takes YYYY-MM-DD.
    const dob = toApiDate(form.dob);
    if (!dob) {
      return AppAlert.alert('Date of birth', 'Write it as DD/MM/YYYY — a real date, like 12/04/2015.');
    }
    const admitted = toApiDate(form.date_of_admission);
    if (admitted === null) {
      return AppAlert.alert('Date of admission', 'Write it as DD/MM/YYYY, or leave it empty.');
    }
    const payload = { ...form, dob, date_of_admission: admitted, crop: crop?.crop ?? null };
    busy.current = true;
    setSaving(true);
    try {
      if (editId) {
        await updateStudent(editId, payload);
        AppAlert.alert('Saved', 'The student has been updated.');
      } else {
        await createStudent({ ...payload, client_ref: clientRef.current });
        AppAlert.alert('Added', 'The student has been added. Their login has been emailed to them.');
      }
      navigation.goBack();
    } catch (e) {
      AppAlert.alert('Not saved', apiErr(e, 'Could not save this student.'));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editId || removing) return;
    setRemoving(true);
    try {
      await deleteStudent(editId);
      setConfirming(false);
      // Straight back to the list: the student's own page has nobody to show now.
      navigation.navigate('TeacherStudents');
    } catch (e) {
      AppAlert.alert('Could not remove', apiErr(e, 'Please try again.'));
    } finally {
      setRemoving(false);
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
  // Fit the photo shown again: a new one from the file picked, the saved one as it is.
  const cropShown = () => shown && setCropping({ uri: shown, file: photo });
  // The line under the photo: the student's own section when editing, the one
  // picked when the form asks, and the teacher's only one otherwise.
  const inClass = asksSection
    ? chosen ? classLabel(chosen) : (oneClass ? quietCaps(choices[0].class) : '')
    : classLabel(
        editId
          ? classes.find(c => c.standard_id === form.standard_id && c.section_id === form.section_id) ??
              classes.find(c => c.standard_id === form.standard_id) ??
              own
          : own,
      );

  return (
    <View style={s.root}>
      <DocHeader
        title={editId ? 'Edit Student' : 'Add Student'}
        onBackPress={() => navigation.goBack()}
        rightSlot={editId ? <HeaderIconButton icon="trash-outline" onPress={() => setConfirming(true)} /> : undefined}
      />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* The photo, and the class the student goes into */}
          <View style={s.photoBlock}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setAsking(true)} style={s.photoRing}>
              {shown && crop ? (
                <CroppedPhoto uri={shown} crop={crop.circle} size={PHOTO} style={s.photo} />
              ) : shown ? (
                <Image source={{ uri: shown }} style={s.photo} />
              ) : (
                <View style={[s.photo, s.photoEmpty]}>
                  <VectorIcon iconSet="Ionicons" iconName="person-outline" size={36} color={theme.colors.textMuted} />
                </View>
              )}
              <View style={s.camera}>
                <VectorIcon iconSet="Ionicons" iconName="camera" size={14} color={theme.colors.white} />
              </View>
            </TouchableOpacity>

            <View style={s.photoLinks}>
              <TouchableOpacity onPress={() => setAsking(true)} hitSlop={8} activeOpacity={0.6}>
                <Text style={s.photoText}>{shown ? 'Change photo' : 'Add a photo'}</Text>
              </TouchableOpacity>
              {!!shown && (
                <>
                  <Text style={s.photoDot}>·</Text>
                  <TouchableOpacity onPress={cropShown} hitSlop={8} activeOpacity={0.6}>
                    <Text style={s.photoText}>Crop</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            {!!inClass && (
              <View style={s.classPill}>
                <VectorIcon iconSet="Ionicons" iconName="school-outline" size={13} color={theme.colors.textSecondary} />
                <Text style={s.classPillText}>{inClass}</Text>
              </View>
            )}
          </View>

          <FormHeading title="Student" first />
          <OutlinedField required label="Full Name" value={form.name} onChangeText={(v: string) => set('name', v)} placeholder="As in school records" />
          <OutlinedField required label="Email" value={form.email} onChangeText={(v: string) => set('email', v)} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" hint="Their login is emailed here." />
          <FieldPair>
            <OutlinedField required half label="Mobile" value={form.mobile} onChangeText={(v: string) => set('mobile', v)} placeholder="10 digits" keyboardType="number-pad" maxLength={10} />
            <OutlinedField required half label="Date of Birth" value={form.dob} onChangeText={(v: string) => set('dob', typeDate(v, form.dob))} placeholder="DD/MM/YYYY" keyboardType="number-pad" maxLength={10} />
          </FieldPair>
          <Select notched required label="Gender" placeholder="Select" value={form.gender || null} options={GENDERS} onChange={v => set('gender', v)} />

          {/* Class teacher of two or more sections: which one the student goes into */}
          {asksSection && (
            <>
              <FormHeading title="Class" />
              <Select
                notched
                required
                label={oneClass ? 'Section' : 'Class & Section'}
                placeholder="Select section"
                value={chosen ? chosenKey : null}
                options={choices.map(c => ({
                  label: oneClass ? quietCaps(c.section ?? c.class) : classLabel(c),
                  value: sectionKey(c.standard_id, c.section_id),
                }))}
                onChange={pickSection}
              />
            </>
          )}

          <FormHeading title="Family" />
          <OutlinedField required label="Father’s Name" value={form.father_name} onChangeText={(v: string) => set('father_name', v)} />
          <OutlinedField label="Mother’s Name" value={form.mother_name} onChangeText={(v: string) => set('mother_name', v)} />

          <FormHeading title="School" />
          <OutlinedField label="Date of Admission" value={form.date_of_admission} onChangeText={(v: string) => set('date_of_admission', typeDate(v, form.date_of_admission ?? ''))} placeholder="DD/MM/YYYY" keyboardType="number-pad" maxLength={10} />
          <FieldPair>
            <OutlinedField half label="Religion" value={form.religion} onChangeText={(v: string) => set('religion', v)} />
            <OutlinedField half label="Aadhaar No." value={form.aadhar_no} onChangeText={(v: string) => set('aadhar_no', v)} placeholder="12 digits" keyboardType="number-pad" maxLength={12} />
          </FieldPair>
          <FieldPair>
            <OutlinedField half label="Apaar ID" value={form.appar_id} onChangeText={(v: string) => set('appar_id', v)} />
            <OutlinedField half label="Registration No." value={form.registration_number} onChangeText={(v: string) => set('registration_number', v)} />
          </FieldPair>

          <FormHeading title="Address" />
          <FieldPair>
            <OutlinedField half label="City" value={form.city} onChangeText={(v: string) => set('city', v)} />
            <OutlinedField half label="State" value={form.state} onChangeText={(v: string) => set('state', v)} />
          </FieldPair>
          <OutlinedField label="Pincode" value={form.pincode} onChangeText={(v: string) => set('pincode', v)} placeholder="6 digits" keyboardType="number-pad" maxLength={6} />
          <OutlinedField label="Local Address" value={form.local_address} onChangeText={(v: string) => set('local_address', v)} multiline />
          <OutlinedField label="Permanent Address" value={form.permanent_address} onChangeText={(v: string) => set('permanent_address', v)} multiline />

          <FormHeading title="Transport & Access" />
          <CheckCard
            icon="bus-outline"
            label="Takes the bus"
            note={form.transportation_required ? 'Transport fee on the route below' : 'No transport fee'}
            value={!!form.transportation_required}
            onValueChange={(v: boolean) => set('transportation_required', v)}
          />
          {form.transportation_required && (
            <Select
              notched
              label="Route"
              placeholder="Select route"
              value={form.route_id ?? null}
              options={(lookups?.routes ?? []).map(rt => ({ label: rt.route_name, value: rt.id }))}
              onChange={v => set('route_id', Number(v))}
            />
          )}
          <CheckCard
            icon="phone-portrait-outline"
            label="App login active"
            note={form.is_active ? 'Can sign in to the app' : 'Can’t sign in to the app'}
            value={!!form.is_active}
            onValueChange={(v: boolean) => set('is_active', v)}
          />

          <View style={s.tail} />
        </ScrollView>

        {/* Save stays in reach at the foot, however far down the form is */}
        <View style={s.footer}>
          <TouchableOpacity style={[s.saveBtn, saving && s.idle]} onPress={save} disabled={saving} activeOpacity={0.9}>
            {saving ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <>
                <VectorIcon iconSet="Ionicons" iconName={editId ? 'checkmark' : 'person-add-outline'} size={18} color={theme.colors.white} />
                <Text style={s.saveText}>{editId ? 'Save changes' : 'Add student'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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

      <PhotoEditor uri={cropping?.uri ?? null} doneLabel="Use photo" onCancel={() => setCropping(null)} onDone={cropped} />

      <AppDialog
        visible={confirming}
        title="Remove this student?"
        message={`${form.name || 'This student'} and their login will be deleted. This cannot be undone.`}
        actions={[
          { text: 'Cancel', style: 'cancel', onPress: () => setConfirming(false) },
          { text: 'Remove', style: 'destructive', onPress: remove, loading: removing },
        ]}
        onRequestClose={() => setConfirming(false)}
      />
    </View>
  );
};

export default TeacherStudentFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 28 },

  // Photo, and the class it belongs to
  photoBlock: { alignItems: 'center', paddingTop: 16, paddingBottom: 4 },
  // A soft ring a few points out from the photo.
  photoRing: {
    padding: 4,
    borderRadius: PHOTO / 2 + 6,
    borderWidth: 1.5,
    borderColor: theme.colors.primary + '33',
  },
  photo: { width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2, overflow: 'hidden', backgroundColor: theme.colors.background },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  camera: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: theme.colors.card,
  },
  photoLinks: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  photoText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  photoDot: { fontSize: 13, color: theme.colors.textMuted },
  classPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.background,
  },
  classPillText: { fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },

  // Save, at the foot
  // (The app's root keeps clear of the phone's own bar below, so no inset here.)
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  saveBtn: {
    flexDirection: 'row',
    gap: 8,
    height: 50,
    borderRadius: 14,
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

import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import VectorIcon from '../../components/VectorIcon';
import Select from '../../components/Select';
import { Skeleton } from '../../components/Skeleton';
import { AppAlert, AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, takePhoto } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { DocHeader } from '../more/docUi';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { fromApiDate, toApiDate, typeDate } from '../../utils/dayMonthYear';
import {
  CheckCard,
  FieldPair,
  FormHeading,
  OutlinedField,
  SaveButton,
  SaveState,
  SkeletonCheck,
  SkeletonField,
} from '../teacherStudents/outlinedFormUi';
import { useRevealFocused } from './adminProfileUi';
import {
  StudentDetail,
  StudentLookups,
  StudentPayload,
  createStudent,
  getStudent,
  getStudentLookups,
  newClientRef,
  updateStudent,
} from '../../api/adminStudentApi';

/**
 * Adding or editing one student — the admin panel's Students form, drawn as
 * Change Password and a class teacher's own form are: the photo in a soft ring
 * at the top, then blocks (student, class, family, school, address, transport &
 * access), each opening with a quiet heading and a hairline, of fields that are
 * a thin outline with their name set into the top border and a red star on the
 * ones the form will not save without. The yes-or-no choices are cards that
 * tick. The school's admin keeps every class, so unlike a teacher's form this
 * one asks which class and section the student goes into.
 *
 * Save checks the fields in the order they stand and stops at the first one
 * that is empty or wrongly written: the popup names that one alone, the field
 * turns red with what is wrong under it, and the form scrolls to it; typing in
 * it takes the red off. The server's own refusal (422) is shown the same way.
 * Save stays at the foot, above the keyboard: while it saves a light sweeps
 * across it (filling up as the photo goes up); saved, it turns green with a
 * tick before the form closes.
 *
 * Opened to edit, the form is first drawn as a skeleton of the student's own
 * values — what the student's page showed, else what was kept the last time
 * they were opened here. Dates are typed DD/MM/YYYY and sent as YYYY-MM-DD; the
 * photo is scaled down before it goes up, to stay inside the server's 2 MB.
 */

// A profile picture needs no more than this on its longest side.
const PHOTO_SIDE = 1024;
// The photo's circle on the form.
const PHOTO = 92;
// How long the green "added" stays on the button before the form closes.
const DONE_HOLD = 750;

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

// ── What can be wrong, one field at a time ──────────────────────────────────
type FieldKey =
  | 'name' | 'email' | 'mobile' | 'dob' | 'gender' | 'class' | 'section' | 'father_name' | 'mother_name'
  | 'date_of_admission' | 'religion' | 'aadhar_no' | 'appar_id' | 'registration_number'
  | 'city' | 'state' | 'pincode' | 'local_address' | 'permanent_address' | 'route_id';

interface Wrong {
  /** The field to mark; null when the trouble is not one field's. */
  field: FieldKey | null;
  /** The popup's title: the field's name. */
  title: string;
  /** What is wrong, said once — in the popup and under the field. */
  message: string;
}

const LABEL: Record<FieldKey, string> = {
  name: 'Full Name',
  email: 'Email',
  mobile: 'Mobile',
  dob: 'Date of Birth',
  gender: 'Gender',
  class: 'Class',
  section: 'Section',
  father_name: 'Father’s Name',
  mother_name: 'Mother’s Name',
  date_of_admission: 'Date of Admission',
  religion: 'Religion',
  aadhar_no: 'Aadhaar No.',
  appar_id: 'Apaar ID',
  registration_number: 'Registration No.',
  city: 'City',
  state: 'State',
  pincode: 'Pincode',
  local_address: 'Local Address',
  permanent_address: 'Permanent Address',
  route_id: 'Route',
};

// The server's names for the fields, in the order the form shows them.
const SERVER_FIELDS: [string, FieldKey | null][] = [
  ['name', 'name'],
  ['email', 'email'],
  ['mobile', 'mobile'],
  ['dob', 'dob'],
  ['gender', 'gender'],
  ['standard_id', 'class'],
  ['section_id', 'section'],
  ['father_name', 'father_name'],
  ['mother_name', 'mother_name'],
  ['date_of_admission', 'date_of_admission'],
  ['religion', 'religion'],
  ['aadhar_no', 'aadhar_no'],
  ['appar_id', 'appar_id'],
  ['registration_number', 'registration_number'],
  ['city', 'city'],
  ['state', 'state'],
  ['pincode', 'pincode'],
  ['local_address', 'local_address'],
  ['permanent_address', 'permanent_address'],
  ['route_id', 'route_id'],
  ['image', null],
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const digitsOnly = (v?: string | null) => (v ?? '').replace(/\D/g, '');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The server's refusal as one field: a 422's first field in form order, its first message. */
const serverWrong = (e: any): Wrong | null => {
  const res = e?.response;
  if (res?.status !== 422) return null;
  const errors = res?.data?.errors;
  if (errors && typeof errors === 'object') {
    const known = SERVER_FIELDS.find(([key]) => Array.isArray(errors[key]) && errors[key].length);
    const [key, field] = known ?? [Object.keys(errors)[0], null];
    const first = Array.isArray(errors[key]) ? errors[key][0] : String(errors[key] ?? '');
    if (key && first) {
      return { field, title: field ? LABEL[field] : key === 'image' ? 'Photo' : 'Not saved', message: String(first) };
    }
  }
  const message = res?.data?.message;
  if (typeof message === 'string' && message) {
    const field: FieldKey | null = /e-?mail/i.test(message) ? 'email' : null;
    return { field, title: field ? LABEL[field] : 'Not saved', message };
  }
  return null;
};

// ── The form while a student loads, drawn from what is known of them ───────
const FormSkeleton = ({ d }: { d: Partial<StudentDetail> }) => {
  const v = (x?: string | null) => (x ?? '').trim();
  const gender = v(d.gender);
  return (
    <ScrollView contentContainerStyle={s.scroll} scrollEnabled={false} showsVerticalScrollIndicator={false}>
      <View style={s.photoBlock}>
        <View style={s.photoRing}>
          <Skeleton width={PHOTO} height={PHOTO} radius={PHOTO / 2} />
        </View>
        <View style={s.photoLinks}>
          <Skeleton width={90} height={11} radius={5} />
        </View>
      </View>

      <FormHeading title="Student" first skeleton />
      <SkeletonField label="Full Name *" value={v(d.full_name)} />
      <SkeletonField label="Email *" value={v(d.email)} />
      <FieldPair>
        <SkeletonField half label="Mobile *" value={v(d.phone)} />
        <SkeletonField half label="Date of Birth *" value={fromApiDate(d.dob)} />
      </FieldPair>
      <SkeletonField label="Gender *" value={gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : ''} />

      <FormHeading title="Class" skeleton />
      <FieldPair>
        <SkeletonField half label="Class *" value={v(d.class)} />
        <SkeletonField half label="Section *" value={v(d.section)} />
      </FieldPair>

      <FormHeading title="Family" skeleton />
      <SkeletonField label="Father’s Name *" value={v(d.father_name)} />
      <SkeletonField label="Mother’s Name" value={v(d.mother_name)} />

      <FormHeading title="School" skeleton />
      <SkeletonField label="Date of Admission" value={fromApiDate(d.date_of_admission)} />
      <FieldPair>
        <SkeletonField half label="Religion" value={v(d.religion)} />
        <SkeletonField half label="Aadhaar No." value={v(d.aadhar_no)} />
      </FieldPair>
      <FieldPair>
        <SkeletonField half label="Apaar ID" value={v(d.appar_id)} />
        <SkeletonField half label="Registration No." value={v(d.registration_number)} />
      </FieldPair>

      <FormHeading title="Address" skeleton />
      <FieldPair>
        <SkeletonField half label="City" value={v(d.city)} />
        <SkeletonField half label="State" value={v(d.state)} />
      </FieldPair>
      <SkeletonField label="Pincode" value={v(d.pincode)} />
      <SkeletonField label="Local Address" value={v(d.local_address)} multiline />
      <SkeletonField label="Permanent Address" value={v(d.permanent_address)} multiline />

      <FormHeading title="Transport & Access" skeleton />
      <SkeletonCheck label="Takes the bus" note={d.transportation_required ? 'Billed on the route below' : 'No transport fee'} />
      {!!d.transportation_required && <SkeletonField label="Route" value={v(d.route_name)} />}
      <SkeletonCheck label="App login active" note={d.is_active === false ? 'Can’t sign in to the app' : 'Can sign in to the app'} />
      <View style={s.tail} />
    </ScrollView>
  );
};

const AdminStudentFormScreen = ({ navigation, route }: any) => {
  const editId: number | undefined = route?.params?.id;
  // The student as the page that opened the form showed them.
  const openedWith: Partial<StudentDetail> | undefined = route?.params?.row;

  const [form, setForm] = useState<StudentPayload>(emptyForm);
  const [lookups, setLookups] = useState<StudentLookups | null>(null);
  const [formSections, setFormSections] = useState<StudentLookups['sections']>([]);
  // The class last picked, so a slower answer for an earlier pick is dropped.
  const pickedClass = useRef(0);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [savedPhoto, setSavedPhoto] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // The one field the last save stopped at.
  const [wrong, setWrong] = useState<Wrong | null>(null);
  // Held from the moment Add is pressed until the answer comes, before the
  // button has had time to grey out: a quick second tap does nothing.
  const busy = useRef(false);
  // This form's mark, sent with every Add: pressed again after the network
  // lost the answer, the server hands back the student it already added.
  const clientRef = useRef(newClientRef());
  // The form closing after the green tick — not if it has gone already.
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (closing.current) clearTimeout(closing.current);
    },
    [],
  );
  // The student last opened here, for the skeleton when the page that opened
  // the form did not pass them (the student's page keeps the same).
  const [lastHere] = useLastLoaded<StudentDetail>(editId ? `admin-student:${editId}` : null);

  // The page rides above the keyboard, and the box being typed in is scrolled
  // up to sit clear of it.
  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();

  // Where each field is, to scroll to (and type in) the one that is wrong.
  const contentRef = useRef<View>(null);
  const spots = useRef<Partial<Record<FieldKey, View | null>>>({});
  const inputs = useRef<Partial<Record<FieldKey, TextInput | null>>>({});
  const spot = (k: FieldKey) => (el: View | null) => {
    spots.current[k] = el;
  };
  const input = (k: FieldKey) => (el: TextInput | null) => {
    inputs.current[k] = el;
  };
  const errorOf = (k: FieldKey) => (wrong?.field === k ? wrong.message : null);

  const fieldOf = (k: keyof StudentPayload): FieldKey | null =>
    k === 'standard_id' ? 'class' : k === 'section_id' ? 'section' : k in LABEL ? (k as FieldKey) : null;

  const set = (k: keyof StudentPayload, v: any) => {
    setForm(prev => ({ ...prev, [k]: v }));
    // Typing in the field that was wrong takes the red off it.
    const f = fieldOf(k);
    setWrong(w => (w && f && w.field === f ? null : w));
  };

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
          setFormSections(lk.sections.filter(x => Number(x.standard_id) === Number(d.standard_id)));
        }
      } catch (e) {
        AppAlert.alert('Could not open', apiErr(e, 'Could not load this student.'));
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, navigation]);

  const onClassChange = async (id: number) => {
    setForm(prev => ({ ...prev, standard_id: id, section_id: 0 }));
    setWrong(w => (w?.field === 'class' || w?.field === 'section' ? null : w));
    pickedClass.current = id;
    try {
      const lk = await getStudentLookups(id);
      // The answer for a class picked before this one is dropped, and only
      // this class's own sections are offered.
      if (pickedClass.current !== id) return;
      const own = lk.sections.filter(x => Number(x.standard_id) === Number(id));
      setFormSections(own);
      // A class with a single section: that one, without asking.
      if (own.length === 1) setForm(prev => ({ ...prev, section_id: own[0].id }));
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

  /** The first field, in the order they stand, that is empty or wrongly written. */
  const check = (): Wrong | null => {
    const need = (field: FieldKey, message: string): Wrong => ({ field, title: LABEL[field], message });

    if (!form.name.trim()) return need('name', 'Write the student’s full name.');

    const email = form.email.trim();
    if (!email) return need('email', 'Write an email address — their login is sent there.');
    if (!EMAIL.test(email)) return need('email', `“${email}” is not an email address. Write it like name@example.com.`);

    const mobile = form.mobile.trim();
    if (!mobile) return need('mobile', 'Write a 10-digit mobile number.');
    if (!/^\d{10}$/.test(mobile)) return need('mobile', `A mobile number has 10 digits — this one has ${digitsOnly(mobile).length}.`);

    if (!form.dob.trim()) return need('dob', 'Write the date of birth as DD/MM/YYYY.');
    const dob = toApiDate(form.dob);
    if (!dob) return need('dob', 'Write it as DD/MM/YYYY — a real date, like 12/04/2015.');
    if (dob >= today()) return need('dob', 'The date of birth has to be before today.');

    if (!form.gender) return need('gender', 'Select the student’s gender.');

    if (!form.standard_id) return need('class', 'Select the class the student goes into.');
    if (!form.section_id) return need('section', 'Select the section the student goes into.');

    if (!form.father_name.trim()) return need('father_name', 'Write the father’s name.');

    const admitted = toApiDate(form.date_of_admission);
    if (admitted === null) return need('date_of_admission', 'Write it as DD/MM/YYYY — a real date — or leave it empty.');
    if (admitted && admitted > today()) return need('date_of_admission', 'The date of admission can’t be after today.');

    const aadhaar = (form.aadhar_no ?? '').trim();
    if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
      return need('aadhar_no', `An Aadhaar number has 12 digits — this one has ${digitsOnly(aadhaar).length}. Or leave it empty.`);
    }

    const pin = (form.pincode ?? '').trim();
    if (pin && !/^\d{6}$/.test(pin)) {
      return need('pincode', `A pincode has 6 digits — this one has ${digitsOnly(pin).length}. Or leave it empty.`);
    }

    if (form.transportation_required && !form.route_id) {
      return need('route_id', 'Select the bus route, or untick “Takes the bus”.');
    }
    return null;
  };

  // Bring the wrong field into view, and the keyboard up on it when it is typed in.
  const goTo = (field: FieldKey | null) => {
    if (!field) return;
    const el = spots.current[field];
    const content = contentRef.current;
    if (el && content) {
      el.measureLayout(
        content as any,
        (_x: number, y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 28), animated: true }),
        () => {},
      );
    }
    // After the popup has gone, so the keyboard isn't closed with it.
    setTimeout(() => inputs.current[field]?.focus(), 350);
  };

  // One field at a time: the popup names that one, and nothing else.
  const tell = (w: Wrong) => {
    setWrong(w.field ? w : null);
    goTo(w.field);
    AppAlert.alert(w.title, w.message);
  };

  const save = async () => {
    if (busy.current) return;
    const problem = check();
    if (problem) return tell(problem);
    setWrong(null);

    // The boxes hold DD/MM/YYYY; the server takes YYYY-MM-DD.
    const payload = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      mobile: form.mobile.trim(),
      dob: toApiDate(form.dob) as string,
      date_of_admission: toApiDate(form.date_of_admission) || '',
    };
    busy.current = true;
    setSaveState('saving');
    try {
      if (editId) await updateStudent(editId, payload);
      else await createStudent({ ...payload, client_ref: clientRef.current });
      setSaveState('done');
      // The green tick has a moment on the button, then the form closes — an
      // edit back to the student's page, which shows what was saved.
      closing.current = setTimeout(() => {
        closing.current = null;
        navigation.goBack();
        AppAlert.alert(
          editId ? 'Saved' : 'Student added',
          editId ? 'The student has been updated.' : 'Their login has been emailed to them.',
        );
      }, DONE_HOLD);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      const w = serverWrong(e);
      if (w) tell(w);
      else AppAlert.alert('Not saved', apiErr(e, 'Could not save this student. Please try again.'));
    }
  };

  if (loading) {
    return (
      <View style={s.root}>
        <DocHeader title="Edit Student" onBackPress={() => navigation.goBack()} />
        <FormSkeleton d={openedWith ?? lastHere ?? {}} />
      </View>
    );
  }

  const shown = photo?.uri ?? savedPhoto;

  return (
    <View style={s.root}>
      <DocHeader title={editId ? 'Edit Student' : 'Add Student'} onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <View ref={contentRef} collapsable={false}>
            {/* The photo */}
            <View style={s.photoBlock}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setAsking(true)} style={s.photoRing}>
                {shown ? (
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
              </View>
            </View>

            <FormHeading title="Student" first />
            <View ref={spot('name')} collapsable={false}>
              <OutlinedField
                ref={input('name')}
                required
                label="Full Name"
                value={form.name}
                onChangeText={(v: string) => set('name', v)}
                placeholder="As in school records"
                error={errorOf('name')}
              />
            </View>
            <View ref={spot('email')} collapsable={false}>
              <OutlinedField
                ref={input('email')}
                required
                label="Email"
                value={form.email}
                onChangeText={(v: string) => set('email', v)}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                hint="Their login is emailed here."
                error={errorOf('email')}
              />
            </View>
            <View ref={spot('mobile')} collapsable={false}>
              {/* The pair shares one spot: mobile and date of birth are on one line */}
              <View ref={spot('dob')} collapsable={false}>
                <FieldPair>
                  <OutlinedField
                    ref={input('mobile')}
                    required
                    half
                    label="Mobile"
                    value={form.mobile}
                    onChangeText={(v: string) => set('mobile', v)}
                    placeholder="10 digits"
                    keyboardType="number-pad"
                    maxLength={10}
                    error={errorOf('mobile')}
                  />
                  <OutlinedField
                    ref={input('dob')}
                    required
                    half
                    label="Date of Birth"
                    value={form.dob}
                    onChangeText={(v: string) => set('dob', typeDate(v, form.dob))}
                    placeholder="DD/MM/YYYY"
                    keyboardType="number-pad"
                    maxLength={10}
                    error={errorOf('dob')}
                  />
                </FieldPair>
              </View>
            </View>
            <View ref={spot('gender')} collapsable={false}>
              <Select
                notched
                required
                label="Gender"
                placeholder="Select"
                value={form.gender || null}
                options={GENDERS}
                onChange={v => set('gender', v)}
                error={errorOf('gender')}
              />
            </View>

            <FormHeading title="Class" />
            <View ref={spot('class')} collapsable={false}>
              <Select
                notched
                required
                label="Class"
                placeholder="Select class"
                value={form.standard_id || null}
                options={(lookups?.classes ?? []).map(c => ({ label: c.name, value: c.id }))}
                onChange={v => onClassChange(Number(v))}
                error={errorOf('class')}
              />
            </View>
            <View ref={spot('section')} collapsable={false}>
              <Select
                notched
                required
                label="Section"
                placeholder={form.standard_id ? 'Select section' : 'Select a class first'}
                value={form.section_id || null}
                options={formSections.map(x => ({ label: x.name, value: x.id }))}
                onChange={v => set('section_id', Number(v))}
                disabled={!form.standard_id}
                error={errorOf('section')}
              />
            </View>

            <FormHeading title="Family" />
            <View ref={spot('father_name')} collapsable={false}>
              <OutlinedField
                ref={input('father_name')}
                required
                label="Father’s Name"
                value={form.father_name}
                onChangeText={(v: string) => set('father_name', v)}
                error={errorOf('father_name')}
              />
            </View>
            <View ref={spot('mother_name')} collapsable={false}>
              <OutlinedField
                ref={input('mother_name')}
                label="Mother’s Name"
                value={form.mother_name}
                onChangeText={(v: string) => set('mother_name', v)}
                error={errorOf('mother_name')}
              />
            </View>

            <FormHeading title="School" />
            <View ref={spot('date_of_admission')} collapsable={false}>
              <OutlinedField
                ref={input('date_of_admission')}
                label="Date of Admission"
                value={form.date_of_admission}
                onChangeText={(v: string) => set('date_of_admission', typeDate(v, form.date_of_admission ?? ''))}
                placeholder="DD/MM/YYYY"
                keyboardType="number-pad"
                maxLength={10}
                error={errorOf('date_of_admission')}
              />
            </View>
            <View ref={spot('religion')} collapsable={false}>
              <View ref={spot('aadhar_no')} collapsable={false}>
                <FieldPair>
                  <OutlinedField
                    ref={input('religion')}
                    half
                    label="Religion"
                    value={form.religion}
                    onChangeText={(v: string) => set('religion', v)}
                    error={errorOf('religion')}
                  />
                  <OutlinedField
                    ref={input('aadhar_no')}
                    half
                    label="Aadhaar No."
                    value={form.aadhar_no}
                    onChangeText={(v: string) => set('aadhar_no', v)}
                    placeholder="12 digits"
                    keyboardType="number-pad"
                    maxLength={12}
                    error={errorOf('aadhar_no')}
                  />
                </FieldPair>
              </View>
            </View>
            <View ref={spot('appar_id')} collapsable={false}>
              <View ref={spot('registration_number')} collapsable={false}>
                <FieldPair>
                  <OutlinedField
                    ref={input('appar_id')}
                    half
                    label="Apaar ID"
                    value={form.appar_id}
                    onChangeText={(v: string) => set('appar_id', v)}
                    error={errorOf('appar_id')}
                  />
                  <OutlinedField
                    ref={input('registration_number')}
                    half
                    label="Registration No."
                    value={form.registration_number}
                    onChangeText={(v: string) => set('registration_number', v)}
                    error={errorOf('registration_number')}
                  />
                </FieldPair>
              </View>
            </View>

            <FormHeading title="Address" />
            <View ref={spot('city')} collapsable={false}>
              <View ref={spot('state')} collapsable={false}>
                <FieldPair>
                  <OutlinedField
                    ref={input('city')}
                    half
                    label="City"
                    value={form.city}
                    onChangeText={(v: string) => set('city', v)}
                    error={errorOf('city')}
                  />
                  <OutlinedField
                    ref={input('state')}
                    half
                    label="State"
                    value={form.state}
                    onChangeText={(v: string) => set('state', v)}
                    error={errorOf('state')}
                  />
                </FieldPair>
              </View>
            </View>
            <View ref={spot('pincode')} collapsable={false}>
              <OutlinedField
                ref={input('pincode')}
                label="Pincode"
                value={form.pincode}
                onChangeText={(v: string) => set('pincode', v)}
                placeholder="6 digits"
                keyboardType="number-pad"
                maxLength={6}
                error={errorOf('pincode')}
              />
            </View>
            <View ref={spot('local_address')} collapsable={false}>
              <OutlinedField
                ref={input('local_address')}
                label="Local Address"
                value={form.local_address}
                onChangeText={(v: string) => set('local_address', v)}
                multiline
                error={errorOf('local_address')}
              />
            </View>
            <View ref={spot('permanent_address')} collapsable={false}>
              <OutlinedField
                ref={input('permanent_address')}
                label="Permanent Address"
                value={form.permanent_address}
                onChangeText={(v: string) => set('permanent_address', v)}
                multiline
                error={errorOf('permanent_address')}
              />
            </View>

            <FormHeading title="Transport & Access" />
            <CheckCard
              icon="bus-outline"
              label="Takes the bus"
              note={form.transportation_required ? 'Billed on the route below' : 'No transport fee'}
              value={!!form.transportation_required}
              onValueChange={(v: boolean) => {
                set('transportation_required', v);
                if (!v) setWrong(w => (w?.field === 'route_id' ? null : w));
              }}
            />
            {form.transportation_required && (
              <View ref={spot('route_id')} collapsable={false}>
                <Select
                  notched
                  required
                  label="Route"
                  placeholder="Select route"
                  value={form.route_id ?? null}
                  options={(lookups?.routes ?? []).map(rt => ({ label: rt.route_name, value: rt.id }))}
                  onChange={v => set('route_id', Number(v))}
                  error={errorOf('route_id')}
                />
              </View>
            )}
            <CheckCard
              icon="phone-portrait-outline"
              label="App login active"
              note={form.is_active ? 'Can sign in to the app' : 'Can’t sign in to the app'}
              value={!!form.is_active}
              onValueChange={(v: boolean) => set('is_active', v)}
            />

            <View style={s.tail} />
          </View>
        </ScrollView>

        {/* Save stays in reach at the foot, above the keyboard */}
        <View style={s.footer}>
          <SaveButton
            state={saveState}
            icon={editId ? 'checkmark' : 'person-add-outline'}
            label={editId ? 'Update Student' : 'Add Student'}
            busyLabel={editId ? 'Updating student' : 'Adding student'}
            doneLabel={editId ? 'Student updated' : 'Student added'}
            onPress={save}
          />
        </View>
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
        onBackdropPress={() => setAsking(false)}
      />
    </View>
  );
};

export default AdminStudentFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 24 },

  // Photo, in a soft ring a few points out from it
  photoBlock: { alignItems: 'center', paddingTop: 16, paddingBottom: 4 },
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
  photoLinks: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, minHeight: 18 },
  photoText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

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

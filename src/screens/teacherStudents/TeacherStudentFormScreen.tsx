import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import Select from '../../components/Select';
import { AppAlert, AppDialog } from '../../components/AppDialog';
import { Skeleton } from '../../components/Skeleton';
import PhotoEditor, { type PhotoEdit } from '../../components/PhotoEditor';
import CroppedPhoto from '../../components/CroppedPhoto';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, takePhoto } from '../../utils/filePickers';
import { fromApiDate, toApiDate, typeDate } from '../../utils/dayMonthYear';
import { quietCaps } from '../../utils/quietCaps';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { PickedFile } from '../../api/adminProfileApi';
import { DocHeader } from '../more/docUi';
import {
  CheckCard,
  FieldPair,
  FormHeading,
  OutlinedField,
  SaveButton,
  SaveState,
  SkeletonCheck,
  SkeletonField,
} from './outlinedFormUi';
import {
  StudentDetail,
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
 * Save checks the fields in the order they stand and stops at the first one
 * that is empty or wrongly written: the popup names that one alone, the field
 * turns red with what is wrong under it, and the form scrolls to it. The
 * server's own check (a 422) is shown the same way — its first field only.
 * While it saves, the button says so with a light sweeping across it; saved,
 * it turns green with a tick before the form closes.
 *
 * Route params: id (edit), classes (what the list already knows they own),
 * row (the student as the page that opened the form showed them, for the
 * skeleton while they load).
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

// How long the green "added" stays on the button before the form closes.
const DONE_HOLD = 750;

// "Class 6 · Section A" — names the school typed in capitals brought down.
const classLabel = (c?: TeacherClass | null) =>
  c ? [quietCaps(c.class), quietCaps(c.section)].filter(Boolean).join(' · ') : '';

// One class-and-section, as the section picker tells its options apart.
const sectionKey = (standardId: number, sectionId?: number | null) => `${standardId}:${sectionId || 0}`;

// ── What can be wrong, one field at a time ──────────────────────────────────
type FieldKey =
  | 'name' | 'email' | 'mobile' | 'dob' | 'gender' | 'section' | 'father_name' | 'mother_name'
  | 'date_of_admission' | 'religion' | 'aadhar_no' | 'appar_id' | 'registration_number'
  | 'city' | 'state' | 'pincode' | 'local_address' | 'permanent_address' | 'route_id';

interface Wrong {
  /** The field to mark; null when the trouble is not one field's (the class unread, the photo). */
  field: FieldKey | null;
  /** The popup's title: the field's name. */
  title: string;
  /** What is wrong, said once — in the popup and under the field. */
  message: string;
}

// Each field's name, as the form shows it.
const LABEL: Record<FieldKey, string> = {
  name: 'Full Name',
  email: 'Email',
  mobile: 'Mobile',
  dob: 'Date of Birth',
  gender: 'Gender',
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

// The server's names for the fields, in the order the form shows them, and
// the field each one marks.
const SERVER_FIELDS: [string, FieldKey | null][] = [
  ['name', 'name'],
  ['email', 'email'],
  ['mobile', 'mobile'],
  ['dob', 'dob'],
  ['gender', 'gender'],
  ['standard_id', 'section'],
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

/**
 * The server's refusal, as one field: a 422's first field in form order, its
 * first message. Anything else is not a field's, and is said as it came.
 */
const serverWrong = (e: any, asksSection: boolean): Wrong | null => {
  const res = e?.response;
  if (res?.status !== 422) return null;
  const errors = res?.data?.errors;
  if (errors && typeof errors === 'object') {
    const known = SERVER_FIELDS.find(([key]) => Array.isArray(errors[key]) && errors[key].length);
    const [key, field] = known ?? [Object.keys(errors)[0], null];
    const first = Array.isArray(errors[key]) ? errors[key][0] : String(errors[key] ?? '');
    if (key && first) {
      // The class and section are never asked for unless there is a choice.
      const marks = field === 'section' && !asksSection ? null : field;
      return {
        field: marks,
        title: marks ? LABEL[marks] : key === 'image' ? 'Photo' : 'Not saved',
        message: String(first),
      };
    }
  }
  const message = res?.data?.message;
  if (typeof message === 'string' && message) {
    // "This email belongs to a school account…" is the email's.
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
        {(!!d.class || !!d.section) && (
          <View style={s.skPill}>
            <Skeleton width={120} height={22} radius={11} />
          </View>
        )}
      </View>

      <FormHeading title="Student" first skeleton />
      <SkeletonField label="Full Name *" value={v(d.full_name)} />
      <SkeletonField label="Email *" value={v(d.email)} />
      <FieldPair>
        <SkeletonField half label="Mobile *" value={v(d.phone)} />
        <SkeletonField half label="Date of Birth *" value={fromApiDate(d.dob)} />
      </FieldPair>
      <SkeletonField label="Gender *" value={gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : ''} />

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
      <SkeletonCheck
        label="Takes the bus"
        note={d.transportation_required ? 'Transport fee on the route below' : 'No transport fee'}
      />
      {!!d.transportation_required && <SkeletonField label="Route" value={v(d.route_name)} />}
      <SkeletonCheck label="App login active" note={d.is_active === false ? 'Can’t sign in to the app' : 'Can sign in to the app'} />
      <View style={s.tail} />
    </ScrollView>
  );
};

const TeacherStudentFormScreen = ({ navigation, route }: any) => {
  const editId: number | undefined = route?.params?.id;
  // The student as the page that opened the form showed them.
  const openedWith: Partial<StudentDetail> | undefined = route?.params?.row;

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
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [removing, setRemoving] = useState(false);
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
  useEffect(() => () => {
    if (closing.current) clearTimeout(closing.current);
  }, []);
  // The student last opened here, for the skeleton when the page that opened
  // the form did not pass them.
  const [lastHere] = useLastLoaded<StudentDetail>(editId ? `teacher-student:${editId}` : null);

  // Where each field is, to scroll to (and type in) the one that is wrong.
  const scrollRef = useRef<ScrollView>(null);
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

  const set = (k: keyof StudentPayload, v: any) => {
    setForm(prev => ({ ...prev, [k]: v }));
    // Typing in the field that was wrong takes the red off it.
    setWrong(w => (w && w.field === (k === 'standard_id' || k === 'section_id' ? 'section' : k) ? null : w));
  };

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
    if (c) {
      setForm(prev => ({ ...prev, standard_id: c.standard_id, section_id: c.section_id ?? 0 }));
      setWrong(w => (w?.field === 'section' ? null : w));
    }
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
        AppAlert.alert('Could not open', apiErr(e, 'Could not load this student.'));
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

  /** The first field, in the order they stand, that is empty or wrongly written. */
  const check = (): Wrong | null => {
    const need = (field: FieldKey, message: string): Wrong => ({ field, title: LABEL[field], message });

    if (!form.name.trim()) return need('name', 'Write the student’s full name.');

    const email = form.email.trim();
    if (!email) return need('email', 'Write an email address — their login is sent there.');
    if (!EMAIL.test(email)) return need('email', `“${email}” is not an email address. Write it like name@example.com.`);
    if (email.length > 50) return need('email', 'An email can be at most 50 characters long.');

    const mobile = form.mobile.trim();
    if (!mobile) return need('mobile', 'Write a 10-digit mobile number.');
    if (!/^\d{10}$/.test(mobile)) {
      const n = digitsOnly(mobile).length;
      return need('mobile', `A mobile number has 10 digits — this one has ${n}.`);
    }

    if (!form.dob.trim()) return need('dob', 'Write the date of birth as DD/MM/YYYY.');
    const dob = toApiDate(form.dob);
    if (!dob) return need('dob', 'Write it as DD/MM/YYYY — a real date, like 12/04/2015.');
    if (dob >= today()) return need('dob', 'The date of birth has to be before today.');

    if (!form.gender) return need('gender', 'Select the student’s gender.');

    if (asksSection && !chosen) return need('section', 'Select the section this student goes into.');

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

    if (!form.standard_id || !form.section_id) {
      return {
        field: null,
        title: 'No class',
        message: 'Your class could not be read. Go back, pull the list to refresh, and try again.',
      };
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
      date_of_admission: toApiDate(form.date_of_admission) ?? '',
      crop: crop?.crop ?? null,
    };
    busy.current = true;
    setSaveState('saving');
    try {
      if (editId) await updateStudent(editId, payload);
      else await createStudent({ ...payload, client_ref: clientRef.current });
      setSaveState('done');
      // The green tick has a moment on the button, then the form closes.
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
      const w = serverWrong(e, asksSection);
      if (w) tell(w);
      else AppAlert.alert('Not saved', apiErr(e, 'Could not save this student. Please try again.'));
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
        <FormSkeleton d={openedWith ?? lastHere ?? {}} />
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
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View ref={contentRef} collapsable={false}>
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

            {/* Class teacher of two or more sections: which one the student goes into */}
            {asksSection && (
              <>
                <FormHeading title="Class" />
                <View ref={spot('section')} collapsable={false}>
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
                    error={errorOf('section')}
                  />
                </View>
              </>
            )}

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
              note={form.transportation_required ? 'Transport fee on the route below' : 'No transport fee'}
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

        {/* Save stays in reach at the foot, however far down the form is */}
        <View style={s.footer}>
          <SaveButton
            state={saveState}
            icon={editId ? 'checkmark' : 'person-add-outline'}
            label={editId ? 'Save changes' : 'Add student'}
            busyLabel={editId ? 'Saving changes' : 'Adding student'}
            doneLabel={editId ? 'Saved' : 'Student added'}
            onPress={save}
          />
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
        onBackdropPress={() => setAsking(false)}
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
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 24 },

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
  photoLinks: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, minHeight: 18 },
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
  skPill: { marginTop: 10 },

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
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

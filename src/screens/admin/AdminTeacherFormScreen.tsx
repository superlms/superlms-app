import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import VectorIcon from '../../components/VectorIcon';
import Select from '../../components/Select';
import { Skeleton } from '../../components/Skeleton';
import { AppAlert, AppDialog } from '../../components/AppDialog';
import type { PhotoEdit } from '../../components/PhotoEditor';
import PassportPhoto from '../../components/PassportPhoto';
import CroppedPhoto from '../../components/CroppedPhoto';
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
import { withinOneMb } from './adminFormUi';
import {
  TeacherDetail,
  TeacherPayload,
  UsernameCheck,
  checkTeacherUsername,
  createTeacher,
  getTeacher,
  getTeacherLookups,
  updateTeacher,
} from '../../api/adminTeacherApi';

/**
 * Adding or editing one teacher — the panel's Add / Edit Teacher, drawn as
 * Change Password and the Add Student form are: the photo in a soft ring at
 * the top, then blocks (teacher, school, contact & address, access), each
 * opening with a quiet heading and a hairline, of fields that are a thin
 * outline with their name set into the top border and a red star on the ones
 * the form will not save without. Active is a card that ticks.
 *
 * It asks what the panel asks and holds it to the panel's rules: a name of
 * letters and spaces (up to 50), an email, a username that is free, a 10-digit
 * mobile, a date of birth before today, a gender, an employee ID (up to 20), a
 * qualification (up to 50), an address and a 6-digit pincode; the date of
 * joining (not after today) and a 10-digit emergency contact may be left out.
 * State and City are picked from the panel's lists, the city from the chosen
 * state's. The photo is optional and up to 1 MB; picked or taken, it is set in
 * a passport-size frame (35 × 45 mm, PassportPhoto) before it is used, and the
 * one shown can be set again with Crop — the server cuts it to the frame. A
 * new teacher's name offers a free username until one is typed in; the
 * username says, as it is typed, whether it is free.
 *
 * Save checks the fields in the order they stand and stops at the first one
 * that is wrong: the popup names it, the field turns red with what is wrong
 * under it and the form scrolls to it. The server's own refusal (422) is shown
 * the same way. Save stays at the foot, above the keyboard, with the saving
 * sweep (filling up as the photo goes up) and the green tick. Opened to edit,
 * the form is first drawn as a skeleton of the teacher's own values.
 */

// A profile picture needs no more than this on its longest side.
const PHOTO_SIDE = 1024;
const PHOTO = 92;
// How long the green "added" stays on the button before the form closes.
const DONE_HOLD = 750;

const GENDERS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

const emptyForm: TeacherPayload = {
  name: '', email: '', username: '', mobile: '', dob: '', gender: '',
  employee_id: '', date_of_joining: '', qualification: '',
  address: '', pincode: '', emergency_contact: '', state: '', city: '',
  // New teachers start Active, as on the panel.
  is_active: true, image: null,
};

// Only what each box may hold, as the panel's boxes allow it.
const lettersOnly = (v: string) => v.replace(/[^A-Za-z ]/g, '');
const digitsOnly = (v?: string | null) => (v ?? '').replace(/\D/g, '');

/** A list that also holds what is saved, when the saved one is not in it. */
const withSaved = (list: string[], saved?: string) =>
  (saved && !list.includes(saved) ? [saved, ...list] : list).map(v => ({ label: v, value: v }));

// ── What can be wrong, one field at a time ──────────────────────────────────
type FieldKey =
  | 'name' | 'email' | 'username' | 'mobile' | 'dob' | 'gender' | 'employee_id' | 'date_of_joining'
  | 'qualification' | 'emergency_contact' | 'pincode' | 'state' | 'city' | 'address';

interface Wrong {
  field: FieldKey | null;
  title: string;
  message: string;
}

const LABEL: Record<FieldKey, string> = {
  name: 'Full Name',
  email: 'Email',
  username: 'Username',
  mobile: 'Mobile',
  dob: 'Date of Birth',
  gender: 'Gender',
  employee_id: 'Employee ID',
  date_of_joining: 'Date of Joining',
  qualification: 'Qualification',
  emergency_contact: 'Emergency Contact',
  pincode: 'Pincode',
  state: 'State',
  city: 'City',
  address: 'Address',
};

// The server's names for the fields, in the order the form shows them.
const SERVER_FIELDS: [string, FieldKey | null][] = [
  ['name', 'name'],
  ['email', 'email'],
  ['username', 'username'],
  ['mobile', 'mobile'],
  ['phone', 'mobile'],
  ['dob', 'dob'],
  ['gender', 'gender'],
  ['employee_id', 'employee_id'],
  ['date_of_joining', 'date_of_joining'],
  ['qualification', 'qualification'],
  ['emergency_contact', 'emergency_contact'],
  ['pincode', 'pincode'],
  ['state', 'state'],
  ['city', 'city'],
  ['address', 'address'],
  ['image', null],
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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
    const field: FieldKey | null = /username/i.test(message) ? 'username' : /e-?mail/i.test(message) ? 'email' : null;
    return { field, title: field ? LABEL[field] : 'Not saved', message };
  }
  return null;
};

// ── The form while a teacher loads, drawn from what is known of them ───────
const FormSkeleton = ({ d }: { d: Partial<TeacherDetail> }) => {
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

      <FormHeading title="Teacher" first skeleton />
      <SkeletonField label="Full Name *" value={v(d.name)} />
      <SkeletonField label="Email *" value={v(d.email)} />
      <SkeletonField label="Username *" value={v(d.username)} />
      <FieldPair>
        <SkeletonField half label="Mobile *" value={v(d.phone)} />
        <SkeletonField half label="Date of Birth *" value={fromApiDate(d.dob)} />
      </FieldPair>
      <SkeletonField label="Gender *" value={gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : ''} />

      <FormHeading title="School" skeleton />
      <FieldPair>
        <SkeletonField half label="Employee ID *" value={v(d.employee_id)} />
        <SkeletonField half label="Date of Joining" value={fromApiDate(d.date_of_joining)} />
      </FieldPair>
      <SkeletonField label="Qualification *" value={v(d.qualification)} />

      <FormHeading title="Contact & Address" skeleton />
      <FieldPair>
        <SkeletonField half label="Emergency Contact" value={v(d.emergency_contact)} />
        <SkeletonField half label="Pincode *" value={v(d.pincode)} />
      </FieldPair>
      <FieldPair>
        <SkeletonField half label="State" value={v(d.state)} />
        <SkeletonField half label="City" value={v(d.city)} />
      </FieldPair>
      <SkeletonField label="Address *" value={v(d.address)} multiline />

      <FormHeading title="Access" skeleton />
      <SkeletonCheck label="App login active" note={d.is_active === false ? 'Can’t sign in to the app' : 'Can sign in to the app'} />
      <View style={s.tail} />
    </ScrollView>
  );
};

const AdminTeacherFormScreen = ({ navigation, route }: any) => {
  const editId: number | undefined = route?.params?.id;
  // The teacher as the page that opened the form showed them.
  const openedWith: Partial<TeacherDetail> | undefined = route?.params?.row;

  const [form, setForm] = useState<TeacherPayload>(emptyForm);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [savedPhoto, setSavedPhoto] = useState<string | null>(null);
  // The photo in the passport frame: one just picked (file), or the one shown.
  const [cropping, setCropping] = useState<{ uri: string; file: PickedFile | null } | null>(null);
  // The frame set on the photo shown (and its circle, for the ring) — sent with the save.
  const [crop, setCrop] = useState<PhotoEdit | null>(null);
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [wrong, setWrong] = useState<Wrong | null>(null);
  const busy = useRef(false);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (closing.current) clearTimeout(closing.current);
    },
    [],
  );
  // The teacher last opened here (the teacher's page keeps the same).
  const [lastHere] = useLastLoaded<TeacherDetail>(editId ? `admin-teacher:${editId}` : null);

  // The username: what the teacher signs in with and resets a password by.
  // Until one is typed in, a new teacher's name offers a free one.
  const [editUserId, setEditUserId] = useState<number | undefined>();
  const usernameTyped = useRef(false);
  const [check, setCheck] = useState<UsernameCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const checkSeq = useRef(0);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();

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

  const set = (k: keyof TeacherPayload, v: any) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setWrong(w => (w && w.field === k ? null : w));
  };

  // The panel's states.
  useEffect(() => {
    getTeacherLookups().then(l => setStates(l.states ?? [])).catch(() => {});
  }, []);

  // A state's cities, for City.
  useEffect(() => {
    const st = form.state?.trim();
    if (!st) {
      setCities([]);
      return;
    }
    let live = true;
    getTeacherLookups(st)
      .then(l => {
        if (live) setCities(l.cities ?? []);
      })
      .catch(() => {
        if (live) setCities([]);
      });
    return () => {
      live = false;
    };
  }, [form.state]);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const d = await getTeacher(editId);
        setForm({
          name: d.name ?? '', email: d.email ?? '', username: d.username ?? '', mobile: d.phone ?? '',
          dob: fromApiDate(d.dob), gender: d.gender ?? '',
          employee_id: d.employee_id ?? '', date_of_joining: fromApiDate(d.date_of_joining),
          qualification: d.qualification ?? '', address: d.address ?? '',
          pincode: d.pincode ?? '', emergency_contact: d.emergency_contact ?? '',
          state: d.state ?? '', city: d.city ?? '', is_active: d.is_active, image: null,
        });
        setSavedPhoto(d.image ?? null);
        setEditUserId(d.user_id);
        usernameTyped.current = !!d.username;
      } catch (e) {
        AppAlert.alert('Could not open', apiErr(e, 'Could not load teacher.'));
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
        if (!usernameTyped.current && res.suggestions[0]) setForm(prev => ({ ...prev, username: res.suggestions[0] }));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [form.name, editId]);

  // Whether the username is free, said as it is typed.
  useEffect(() => {
    const u = form.username.trim();
    if (!u) {
      setCheck(null);
      setChecking(false);
      return;
    }
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
    set('username', v.toLowerCase().replace(/[^a-z0-9._@]/g, ''));
  };

  // The photo: the camera, or the gallery — up to 1 MB, as on the panel —
  // then set in the passport frame.
  const choose = async (from: 'camera' | 'gallery') => {
    setAsking(false);
    const f = from === 'camera' ? await takePhoto({ maxSide: PHOTO_SIDE }) : await pickImage({ maxSide: PHOTO_SIDE });
    if (!f || !withinOneMb(f, 'The photo')) return;
    setCropping({ uri: f.uri, file: f });
  };

  // Use photo: a photo just picked becomes the one shown; the frame goes with
  // the save. Cancel leaves everything as it was.
  const cropped = (edit: PhotoEdit) => {
    if (cropping?.file) {
      setPhoto(cropping.file);
      set('image', cropping.file);
    }
    setCrop(edit);
    setCropping(null);
  };

  /** The first field, in the order they stand, that is empty or wrongly written. */
  const firstWrong = (): Wrong | null => {
    const need = (field: FieldKey, message: string): Wrong => ({ field, title: LABEL[field], message });

    const name = form.name.trim();
    if (!name) return need('name', 'Write the teacher’s full name.');
    if (!/^[A-Za-z ]+$/.test(name)) return need('name', 'A name may hold only letters and spaces.');
    if (name.length > 50) return need('name', 'A name can be at most 50 characters long.');

    const email = form.email.trim();
    if (!email) return need('email', 'Write an email address — the login is sent there.');
    if (!EMAIL.test(email)) return need('email', `“${email}” is not an email address. Write it like name@example.com.`);

    const username = form.username.trim();
    if (!username) return need('username', 'Write the username the teacher signs in with.');
    if (check && check.username === username && !check.available) return need('username', check.problems.join(' '));

    const mobile = form.mobile.trim();
    if (!mobile) return need('mobile', 'Write a 10-digit mobile number.');
    if (!/^\d{10}$/.test(mobile)) return need('mobile', `A mobile number has 10 digits — this one has ${digitsOnly(mobile).length}.`);

    if (!form.dob.trim()) return need('dob', 'Write the date of birth as DD/MM/YYYY.');
    const dob = toApiDate(form.dob);
    if (!dob) return need('dob', 'Write it as DD/MM/YYYY — a real date, like 12/04/1990.');
    if (dob >= today()) return need('dob', 'The date of birth has to be before today.');

    if (!form.gender) return need('gender', 'Select the teacher’s gender.');

    const emp = form.employee_id.trim();
    if (!emp) return need('employee_id', 'Write the teacher’s employee ID.');
    if (emp.length > 20) return need('employee_id', 'An employee ID can be at most 20 characters long.');

    const joined = toApiDate(form.date_of_joining);
    if (joined === null) return need('date_of_joining', 'Write it as DD/MM/YYYY — a real date — or leave it empty.');
    if (joined && joined > today()) return need('date_of_joining', 'The date of joining can’t be after today.');

    const qual = form.qualification.trim();
    if (!qual) return need('qualification', 'Write the teacher’s qualification, like B.Ed or M.Sc.');
    if (qual.length > 50) return need('qualification', 'A qualification can be at most 50 characters long.');

    const sos = form.emergency_contact.trim();
    if (sos && !/^\d{10}$/.test(sos)) {
      return need('emergency_contact', `A phone number has 10 digits — this one has ${digitsOnly(sos).length}. Or leave it empty.`);
    }

    const pin = form.pincode.trim();
    if (!pin) return need('pincode', 'Write the 6-digit pincode.');
    if (!/^\d{6}$/.test(pin)) return need('pincode', `A pincode has 6 digits — this one has ${digitsOnly(pin).length}.`);

    const address = form.address.trim();
    if (!address) return need('address', 'Write the teacher’s address.');
    if (address.length > 1000) return need('address', 'An address can be at most 1000 characters long.');
    return null;
  };

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
    setTimeout(() => inputs.current[field]?.focus(), 350);
  };

  const tell = (w: Wrong) => {
    setWrong(w.field ? w : null);
    goTo(w.field);
    AppAlert.alert(w.title, w.message);
  };

  const save = async () => {
    if (busy.current) return;
    const problem = firstWrong();
    if (problem) return tell(problem);
    setWrong(null);

    // Checked above: the date of birth is a real one by now.
    const payload: TeacherPayload = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      username: form.username.trim(),
      mobile: form.mobile.trim(),
      employee_id: form.employee_id.trim(),
      qualification: form.qualification.trim(),
      emergency_contact: form.emergency_contact.trim(),
      pincode: form.pincode.trim(),
      dob: toApiDate(form.dob) as string,
      date_of_joining: toApiDate(form.date_of_joining) || '',
      crop: crop?.crop ?? null,
    };
    busy.current = true;
    setSaveState('saving');
    try {
      if (editId) await updateTeacher(editId, payload);
      else await createTeacher(payload);
      setSaveState('done');
      closing.current = setTimeout(() => {
        closing.current = null;
        // An edit goes back to the teacher's page, which shows what was saved.
        navigation.goBack();
        AppAlert.alert(
          editId ? 'Saved' : 'Teacher added',
          editId ? 'The teacher has been updated.' : 'Their login has been emailed to them.',
        );
      }, DONE_HOLD);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      const w = serverWrong(e);
      if (w) tell(w);
      else AppAlert.alert('Not saved', apiErr(e, 'Could not save this teacher. Please try again.'));
    }
  };

  if (loading) {
    return (
      <View style={s.root}>
        <DocHeader title="Edit Teacher" onBackPress={() => navigation.goBack()} />
        <FormSkeleton d={openedWith ?? lastHere ?? {}} />
      </View>
    );
  }

  const shown = photo?.uri ?? savedPhoto;
  // Set the photo shown in the frame again: a new one from the file picked, the saved one as it is.
  const cropShown = () => shown && setCropping({ uri: shown, file: photo });

  return (
    <View style={s.root}>
      <DocHeader title={editId ? 'Edit Teacher' : 'Add Teacher'} onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <View ref={contentRef} collapsable={false}>
            {/* The photo */}
            <View style={s.photoBlock}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setAsking(true)} style={s.photoRing}>
                {shown && crop ? (
                  <CroppedPhoto uri={shown} crop={crop.circle} size={PHOTO} style={s.photo} />
                ) : shown ? (
                  <Image source={{ uri: shown }} style={s.photo} resizeMethod="resize" />
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
                <Text style={s.photoDot}>·</Text>
                {shown ? (
                  <TouchableOpacity onPress={cropShown} hitSlop={8} activeOpacity={0.6}>
                    <Text style={s.photoText}>Crop</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={s.photoNote}>Optional, up to 1 MB</Text>
                )}
              </View>
            </View>

            <FormHeading title="Teacher" first />
            <View ref={spot('name')} collapsable={false}>
              <OutlinedField
                ref={input('name')}
                required
                label="Full Name"
                value={form.name}
                onChangeText={(v: string) => set('name', lettersOnly(v))}
                placeholder="Letters and spaces"
                maxLength={50}
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
                hint={editId ? 'A new email gets the login sent to it.' : 'The login is emailed here when the teacher is added.'}
                error={errorOf('email')}
              />
            </View>
            <View ref={spot('username')} collapsable={false}>
              <OutlinedField
                ref={input('username')}
                required
                label="Username"
                value={form.username}
                onChangeText={onUsername}
                placeholder="e.g. meera@tds"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={50}
                error={errorOf('username')}
              />
              {!errorOf('username') && (
                <UsernameHint check={check} checking={checking} username={form.username.trim()} onPick={onUsername} />
              )}
            </View>
            <View ref={spot('mobile')} collapsable={false}>
              <View ref={spot('dob')} collapsable={false}>
                <FieldPair>
                  <OutlinedField
                    ref={input('mobile')}
                    required
                    half
                    label="Mobile"
                    value={form.mobile}
                    onChangeText={(v: string) => set('mobile', digitsOnly(v))}
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

            <FormHeading title="School" />
            <View ref={spot('employee_id')} collapsable={false}>
              <View ref={spot('date_of_joining')} collapsable={false}>
                <FieldPair>
                  <OutlinedField
                    ref={input('employee_id')}
                    required
                    half
                    label="Employee ID"
                    value={form.employee_id}
                    onChangeText={(v: string) => set('employee_id', v)}
                    placeholder="e.g. EMP001"
                    maxLength={20}
                    error={errorOf('employee_id')}
                  />
                  <OutlinedField
                    ref={input('date_of_joining')}
                    half
                    label="Date of Joining"
                    value={form.date_of_joining}
                    onChangeText={(v: string) => set('date_of_joining', typeDate(v, form.date_of_joining ?? ''))}
                    placeholder="DD/MM/YYYY"
                    keyboardType="number-pad"
                    maxLength={10}
                    error={errorOf('date_of_joining')}
                  />
                </FieldPair>
              </View>
            </View>
            <View ref={spot('qualification')} collapsable={false}>
              <OutlinedField
                ref={input('qualification')}
                required
                label="Qualification"
                value={form.qualification}
                onChangeText={(v: string) => set('qualification', v)}
                placeholder="e.g. B.Ed, M.Sc"
                maxLength={50}
                error={errorOf('qualification')}
              />
            </View>

            <FormHeading title="Contact & Address" />
            <View ref={spot('emergency_contact')} collapsable={false}>
              <View ref={spot('pincode')} collapsable={false}>
                <FieldPair>
                  <OutlinedField
                    ref={input('emergency_contact')}
                    half
                    label="Emergency Contact"
                    value={form.emergency_contact}
                    onChangeText={(v: string) => set('emergency_contact', digitsOnly(v))}
                    placeholder="10 digits"
                    keyboardType="number-pad"
                    maxLength={10}
                    error={errorOf('emergency_contact')}
                  />
                  <OutlinedField
                    ref={input('pincode')}
                    required
                    half
                    label="Pincode"
                    value={form.pincode}
                    onChangeText={(v: string) => set('pincode', digitsOnly(v))}
                    placeholder="6 digits"
                    keyboardType="number-pad"
                    maxLength={6}
                    error={errorOf('pincode')}
                  />
                </FieldPair>
              </View>
            </View>
            <View ref={spot('state')} collapsable={false}>
              <Select
                notched
                label="State"
                placeholder="Select state"
                value={form.state || null}
                options={withSaved(states, form.state)}
                onChange={v => {
                  setForm(prev => ({ ...prev, state: String(v), city: prev.state === v ? prev.city : '' }));
                  setWrong(w => (w?.field === 'state' || w?.field === 'city' ? null : w));
                }}
                error={errorOf('state')}
              />
            </View>
            <View ref={spot('city')} collapsable={false}>
              <Select
                notched
                label="City"
                placeholder={form.state ? 'Select city' : 'Select a state first'}
                value={form.city || null}
                options={withSaved(cities, form.city)}
                onChange={v => set('city', String(v))}
                disabled={!form.state}
                error={errorOf('city')}
              />
            </View>
            <View ref={spot('address')} collapsable={false}>
              <OutlinedField
                ref={input('address')}
                required
                label="Address"
                value={form.address}
                onChangeText={(v: string) => set('address', v)}
                placeholder="Full address"
                multiline
                maxLength={1000}
                error={errorOf('address')}
              />
            </View>

            <FormHeading title="Access" />
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
            label={editId ? 'Update Teacher' : 'Create Teacher'}
            busyLabel={editId ? 'Updating teacher' : 'Creating teacher'}
            doneLabel={editId ? 'Teacher updated' : 'Teacher added'}
            onPress={save}
          />
        </View>
      </Animated.View>

      <AppDialog
        visible={asking}
        title="Teacher photo"
        message="Take one now, or pick a picture already on this phone (up to 1 MB)."
        actions={[
          { text: 'Camera', onPress: () => choose('camera') },
          { text: 'Gallery', onPress: () => choose('gallery') },
          { text: 'Cancel', style: 'cancel', onPress: () => setAsking(false) },
        ]}
        onRequestClose={() => setAsking(false)}
        onBackdropPress={() => setAsking(false)}
      />

      <PassportPhoto uri={cropping?.uri ?? null} doneLabel="Use photo" onCancel={() => setCropping(null)} onDone={cropped} />
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
        <VectorIcon iconSet="Ionicons" iconName="checkmark-circle" size={13} color={theme.colors.success} />
        <Text style={[s.hint, s.hintOk]}>Available — the teacher signs in with it.</Text>
      </View>
    );
  }
  return (
    <View>
      {check.problems.map(p => <Text key={p} style={[s.hint, s.hintBad]}>{p}</Text>)}
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
  photoDot: { fontSize: 13, color: theme.colors.textMuted },
  photoNote: { fontSize: 12, color: theme.colors.textMuted },

  // Username — under its box, where an outlined field's hint sits
  hint: { marginTop: 4, marginLeft: 14, fontSize: 11, lineHeight: 15, color: theme.colors.textMuted },
  hintOk: { color: theme.colors.success, marginTop: 0, marginLeft: 0 },
  hintBad: { color: theme.colors.danger },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: 14 },
  rule: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2, marginLeft: 18 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginLeft: 14 },
  suggest: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.primary },
  suggestText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },

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

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
import { withinOneMb } from './adminFormUi';
import {
  TeacherPayload,
  UsernameCheck,
  checkTeacherUsername,
  createTeacher,
  getTeacher,
  getTeacherLookups,
  updateTeacher,
} from '../../api/adminTeacherApi';

/**
 * Adding or editing one teacher — the panel's Add / Edit Teacher, drawn as the
 * Add Student form is: the photo at the top, then blocks (teacher, school,
 * contact & address, access) of fields that are an outline and nothing else,
 * with the short ones two to a line.
 *
 * It asks what the panel asks and holds it to the panel's rules: a name of
 * letters and spaces (up to 50), an email, a username that is free, a 10-digit
 * mobile, a date of birth before today, a gender, an employee ID (up to 20), a
 * qualification (up to 50), an address and a 6-digit pincode; the date of
 * joining (not after today) and a 10-digit emergency contact may be left out.
 * State and City are picked from the panel's lists, the city from the chosen
 * state's. The photo is optional and up to 1 MB.
 *
 * Dates are typed DD/MM/YYYY and sent as YYYY-MM-DD. A new teacher's name
 * offers a free username until one is typed in; the username says, as it is
 * typed, whether it is free. Saved, a new teacher is emailed their login, and
 * an edit goes back to the teacher's page.
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

const emptyForm: TeacherPayload = {
  name: '', email: '', username: '', mobile: '', dob: '', gender: '',
  employee_id: '', date_of_joining: '', qualification: '',
  address: '', pincode: '', emergency_contact: '', state: '', city: '',
  // New teachers start Active, as on the panel.
  is_active: true, image: null,
};

// Only what each box may hold, as the panel's boxes allow it.
const lettersOnly = (v: string) => v.replace(/[^A-Za-z ]/g, '');
const digitsOnly = (v: string) => v.replace(/\D/g, '');

/** A list that also holds what is saved, when the saved one is not in it. */
const withSaved = (list: string[], saved?: string) =>
  (saved && !list.includes(saved) ? [saved, ...list] : list).map(v => ({ label: v, value: v }));

const AdminTeacherFormScreen = ({ navigation, route }: any) => {
  const editId: number | undefined = route?.params?.id;

  const [form, setForm] = useState<TeacherPayload>(emptyForm);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [savedPhoto, setSavedPhoto] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  const set = (k: keyof TeacherPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  // The username: what the teacher signs in with and resets a password by.
  // Until one is typed in, a new teacher's name offers a free one.
  const [editUserId, setEditUserId] = useState<number | undefined>();
  const usernameTyped = useRef(false);
  const [check, setCheck] = useState<UsernameCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const checkSeq = useRef(0);

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

  // The panel's states.
  useEffect(() => {
    getTeacherLookups().then(l => setStates(l.states ?? [])).catch(() => {});
  }, []);

  // A state's cities, for City.
  useEffect(() => {
    const st = form.state?.trim();
    if (!st) { setCities([]); return; }
    let live = true;
    getTeacherLookups(st).then(l => { if (live) setCities(l.cities ?? []); }).catch(() => { if (live) setCities([]); });
    return () => { live = false; };
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
    set('username', v.toLowerCase().replace(/[^a-z0-9._@]/g, ''));
  };

  // The photo: the camera, or the gallery — up to 1 MB, as on the panel.
  const choose = async (from: 'camera' | 'gallery') => {
    setAsking(false);
    const f = from === 'camera' ? await takePhoto({ maxSide: PHOTO_SIDE }) : await pickImage({ maxSide: PHOTO_SIDE });
    if (!f || !withinOneMb(f, 'The photo')) return;
    setPhoto(f);
    set('image', f);
  };

  const save = async () => {
    const required = ['name', 'email', 'username', 'mobile', 'dob', 'gender', 'employee_id', 'qualification', 'address', 'pincode'] as (keyof TeacherPayload)[];
    if (required.some(k => !String(form[k] ?? '').trim())) {
      return AppAlert.alert(
        'Something is missing',
        'Name, email, username, mobile, date of birth, gender, employee ID, qualification, address and pincode are needed.',
      );
    }
    // What the panel would refuse, said here first and plainly.
    const today = new Date().toISOString().slice(0, 10);
    const dob = toApiDate(form.dob);
    const joined = toApiDate(form.date_of_joining);
    const name = form.name.trim();
    const problem =
      !/^[A-Za-z ]+$/.test(name) ? 'Name may contain only letters and spaces.'
      : name.length > 50 ? 'Name may not be longer than 50 characters.'
      : !/^\S+@\S+\.\S+$/.test(form.email.trim()) ? 'Enter a valid email address.'
      : !/^\d{10}$/.test(form.mobile.trim()) ? 'Mobile number must be exactly 10 digits.'
      : !dob ? 'Enter the date of birth as DD/MM/YYYY — a real date.'
      : dob >= today ? 'The date of birth must be before today.'
      : form.employee_id.trim().length > 20 ? 'Employee ID may not be longer than 20 characters.'
      : joined === null ? 'Enter the date of joining as DD/MM/YYYY — a real date — or leave it empty.'
      : joined && joined > today ? 'The date of joining cannot be after today.'
      : form.qualification.trim().length > 50 ? 'Qualification may not be longer than 50 characters.'
      : form.emergency_contact.trim() && !/^\d{10}$/.test(form.emergency_contact.trim()) ? 'Emergency contact must be exactly 10 digits.'
      : form.address.trim().length > 1000 ? 'Address may not be longer than 1000 characters.'
      : !/^\d{6}$/.test(form.pincode.trim()) ? 'Pincode must be exactly 6 digits.'
      : null;
    if (problem) return AppAlert.alert('Please check', problem);
    if (check && check.username === form.username.trim() && !check.available) {
      return AppAlert.alert('Username', check.problems.join(' '));
    }

    // Checked above: the date of birth is a real one by now.
    const payload: TeacherPayload = {
      ...form,
      name,
      email: form.email.trim(),
      mobile: form.mobile.trim(),
      employee_id: form.employee_id.trim(),
      qualification: form.qualification.trim(),
      emergency_contact: form.emergency_contact.trim(),
      pincode: form.pincode.trim(),
      dob: dob as string,
      date_of_joining: joined || '',
    };
    setSaving(true);
    try {
      if (editId) {
        await updateTeacher(editId, payload);
        AppAlert.alert('Saved', 'The teacher has been updated.');
      } else {
        await createTeacher(payload);
        AppAlert.alert('Added', 'The teacher has been added. Their login has been emailed to them.');
      }
      // An edit goes back to the teacher's page, which shows what was saved.
      navigation.goBack();
    } catch (e) {
      AppAlert.alert('Not saved', apiErr(e, 'Could not save this teacher.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.root}>
        <DocHeader title="Edit Teacher" onBackPress={() => navigation.goBack()} />
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      </View>
    );
  }

  const shown = photo?.uri ?? savedPhoto;

  return (
    <View style={s.root}>
      <DocHeader title={editId ? 'Edit Teacher' : 'Add Teacher'} onBackPress={() => navigation.goBack()} />
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
                <Image source={{ uri: shown }} style={s.photo} resizeMethod="resize" />
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
            <Text style={s.photoNote}>Optional, up to 1 MB</Text>
          </View>

          <FormSection title="Teacher" first />
          <Field label="Full Name" value={form.name} onChangeText={(v: string) => set('name', lettersOnly(v))} placeholder="Teacher name" maxLength={50} />
          <Field
            label="Email"
            value={form.email}
            onChangeText={(v: string) => set('email', v)}
            placeholder="email@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            hint={editId ? 'A new email gets the login sent to it.' : 'The login is emailed here when the teacher is added.'}
          />
          <Field label="Username" value={form.username} onChangeText={onUsername} placeholder="e.g. meera@tds" autoCapitalize="none" autoCorrect={false} maxLength={50} />
          <UsernameHint check={check} checking={checking} username={form.username.trim()} onPick={onUsername} />
          <FormPair>
            <Field half label="Mobile" value={form.mobile} onChangeText={(v: string) => set('mobile', digitsOnly(v))} placeholder="10-digit" keyboardType="number-pad" maxLength={10} />
            <Field half label="Date of Birth" value={form.dob} onChangeText={(v: string) => set('dob', typeDate(v, form.dob))} placeholder="DD/MM/YYYY" keyboardType="number-pad" maxLength={10} />
          </FormPair>
          <View style={s.select}>
            <Select plain markChosen label="Gender" placeholder="Select gender" value={form.gender || null} options={GENDERS} onChange={v => set('gender', v)} />
          </View>

          <FormSection title="School" />
          <FormPair>
            <Field half label="Employee ID" value={form.employee_id} onChangeText={(v: string) => set('employee_id', v)} placeholder="e.g. EMP001" maxLength={20} />
            <Field half label="Date of Joining" value={form.date_of_joining} onChangeText={(v: string) => set('date_of_joining', typeDate(v, form.date_of_joining ?? ''))} placeholder="DD/MM/YYYY" keyboardType="number-pad" maxLength={10} />
          </FormPair>
          <Field label="Qualification" value={form.qualification} onChangeText={(v: string) => set('qualification', v)} placeholder="e.g. B.Ed, M.Sc" maxLength={50} />

          <FormSection title="Contact & Address" />
          <FormPair>
            <Field half label="Emergency Contact" value={form.emergency_contact} onChangeText={(v: string) => set('emergency_contact', digitsOnly(v))} placeholder="Optional" keyboardType="number-pad" maxLength={10} />
            <Field half label="Pincode" value={form.pincode} onChangeText={(v: string) => set('pincode', digitsOnly(v))} placeholder="6 digits" keyboardType="number-pad" maxLength={6} />
          </FormPair>
          <View style={s.select}>
            <Select
              plain
              markChosen
              label="State"
              placeholder="Select state"
              value={form.state || null}
              options={withSaved(states, form.state)}
              onChange={v => setForm(prev => ({ ...prev, state: String(v), city: prev.state === v ? prev.city : '' }))}
            />
          </View>
          <View style={s.select}>
            <Select
              plain
              markChosen
              label="City"
              placeholder={form.state ? 'Select city' : 'Select a state first'}
              value={form.city || null}
              options={withSaved(cities, form.city)}
              onChange={v => set('city', String(v))}
              disabled={!form.state}
            />
          </View>
          <Field label="Address" value={form.address} onChangeText={(v: string) => set('address', v)} placeholder="Full address" multiline maxLength={1000} />

          <FormSection title="Access" />
          <FormToggle
            label="Active"
            note={form.is_active ? 'Can sign in to the app' : 'Cannot sign in to the app'}
            value={!!form.is_active}
            onValueChange={(v: boolean) => set('is_active', v)}
          />

          <TouchableOpacity style={[s.saveBtn, saving && s.idle]} onPress={save} disabled={saving} activeOpacity={0.9}>
            {saving ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={s.saveText}>{editId ? 'Update Teacher' : 'Create Teacher'}</Text>
            )}
          </TouchableOpacity>

          <View style={s.tail} />
        </ScrollView>
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
      />
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
  photoNote: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },

  // Select sits in the fields' rhythm
  select: { marginTop: 12 },

  // Username
  hint: { marginTop: 6, fontSize: 12, color: theme.colors.textMuted },
  hintOk: { color: theme.colors.success, marginTop: 0 },
  hintBad: { color: theme.colors.danger },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  rule: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, marginLeft: 4 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  suggest: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.primary },
  suggestText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },

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

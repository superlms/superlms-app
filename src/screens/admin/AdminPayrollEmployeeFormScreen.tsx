import React, { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import Select from '../../components/Select';
import { AppDialog } from '../../components/AppDialog';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, takePhoto } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { EMP_TYPES, EmpType, EmployeeForm, getEmployee, saveEmployee } from '../../api/adminPayrollApi';
import { DocHeader } from '../more/docUi';
import { FormField, FormPair, FormSection } from '../teacherStudents/studentFormUi';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { fromApiDate, toApiDate, typeDate } from '../../utils/dayMonthYear';
import { FormError, Hint, SubmitButton } from './adminFormUi';

/**
 * Add or edit someone on payroll — the panel's Employee form, drawn as Add
 * Student is: the photo at the top, then blocks (employee, contact, bank) of
 * fields that are an outline and nothing else, with the short ones two to a
 * line. It asks what the panel asks — photo, name, type, designation, salary,
 * joining date, mobile, email, address and bank — and checks it as the panel
 * does (a 10-digit mobile, a 6–20 digit account, a real IFSC, a photo up to
 * 1 MB). The joining date is typed DD/MM/YYYY and sent as YYYY-MM-DD. The
 * page rides above the keyboard, and the box being typed in is scrolled into
 * view.
 */

// A profile picture needs no more than this on its longest side — it keeps the
// upload inside the panel's 1 MB.
const PHOTO_SIDE = 1024;

// Every box here wears the accent's outline once it holds something.
const Field = (props: any) => <FormField markFilled {...props} />;

const TYPE_OPTIONS = EMP_TYPES.map(t => ({ label: t.label, value: t.key }));

const blank: EmployeeForm = {
  name: '', type: 'employee', designation: '', mobile: '', email: '', salary: '', joining_date: '',
  address: '', bank_name: '', bank_holder_name: '', bank_account_no: '', bank_ifsc: '', bank_branch: '', photo: null,
};

const AdminPayrollEmployeeFormScreen = ({ navigation, route }: any) => {
  const editId: number | undefined = route?.params?.id;
  const [form, setForm] = useState<EmployeeForm>(blank);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!editId);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const set = <K extends keyof EmployeeForm>(k: K, v: EmployeeForm[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setError('');
  };

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
    if (!editId) return;
    (async () => {
      try {
        const d = await getEmployee(editId);
        setForm({
          name: d.name ?? '', type: d.type, designation: d.designation ?? '', mobile: d.mobile ?? '', email: d.email ?? '',
          salary: String(Number(d.salary || 0)), joining_date: fromApiDate(d.joining_date), address: d.address ?? '',
          bank_name: d.bank_name ?? '', bank_holder_name: d.bank_holder_name ?? '', bank_account_no: d.bank_account_no ?? '',
          bank_ifsc: d.bank_ifsc ?? '', bank_branch: d.bank_branch ?? '', photo: null,
        });
        setPhotoUri(d.photo ?? null);
      } catch (e) {
        setError(apiErr(e, 'Could not load this employee.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  // The photo: the camera, or the gallery.
  const choose = async (from: 'camera' | 'gallery') => {
    setAsking(false);
    applyPhoto(from === 'camera' ? await takePhoto({ maxSide: PHOTO_SIDE }) : await pickImage({ maxSide: PHOTO_SIDE }));
  };
  const applyPhoto = (f: PickedFile | null) => {
    if (!f) return;
    if (f.size && f.size > 1024 * 1024) {
      setError('Photo must be 1 MB or smaller.');
      return;
    }
    set('photo', f);
    setPhotoUri(f.uri);
  };

  const save = async () => {
    if (!form.name.trim()) return setError('Enter the name.');
    if (form.salary.trim() === '' || !Number.isFinite(Number(form.salary)) || Number(form.salary) < 0) return setError('Enter the monthly salary as a number.');
    // The joining date is typed; it may be left empty, but not after today.
    const joined = toApiDate(form.joining_date);
    if (joined === null) return setError('Enter the joining date as DD/MM/YYYY — a real date — or leave it empty.');
    if (joined && joined > moment().format('YYYY-MM-DD')) return setError('The joining date cannot be after today.');
    if (form.mobile && !/^[6-9]\d{9}$/.test(form.mobile)) return setError('Enter a valid 10-digit mobile number.');
    if (form.bank_account_no && !/^\d{6,20}$/.test(form.bank_account_no)) return setError('Account number must be 6–20 digits.');
    if (form.bank_ifsc && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(form.bank_ifsc)) return setError('Enter a valid IFSC code (e.g. HDFC0001234).');
    setSaving(true);
    try {
      setSavedMsg(await saveEmployee({ ...form, joining_date: joined || '' }, editId));
    } catch (e) {
      setError(apiErr(e, 'Could not save this employee.'));
    } finally {
      setSaving(false);
    }
  };

  const closeSaved = () => {
    setSavedMsg('');
    navigation.goBack();
  };

  return (
    <View style={s.root}>
      <DocHeader title={editId ? 'Edit Employee' : 'Add Employee'} onBackPress={() => navigation.goBack()} />
      {loading ? (
        <View style={s.skeleton}>
          {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} width="100%" height={54} radius={12} />)}
        </View>
      ) : (
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
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={s.photo} resizeMethod="resize" />
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
                <Text style={s.photoText}>{photoUri ? 'Change photo' : 'Add a photo'}</Text>
              </TouchableOpacity>
            </View>

            <FormSection title="Employee" first />
            <Field label="Full Name" value={form.name} onChangeText={(t: string) => set('name', t)} placeholder="Full name" maxLength={255} autoCapitalize="words" />
            <View style={s.select}>
              <Select plain markChosen label="Type" placeholder="Select type" value={form.type} options={TYPE_OPTIONS} onChange={v => set('type', v as EmpType)} />
              {form.type === 'driver' && !editId && <Hint>A driver who is on Transport → Drivers is listed here on their own.</Hint>}
            </View>
            <Field label="Designation" value={form.designation} onChangeText={(t: string) => set('designation', t)} placeholder="e.g. Accountant" maxLength={100} />
            <FormPair>
              <Field half label="Salary (₹ a month)" value={form.salary} onChangeText={(t: string) => set('salary', t.replace(/[^0-9.]/g, ''))} placeholder="0" keyboardType="decimal-pad" maxLength={10} />
              <Field half label="Joining Date" value={form.joining_date} onChangeText={(t: string) => set('joining_date', typeDate(t, form.joining_date))} placeholder="DD/MM/YYYY" keyboardType="number-pad" maxLength={10} />
            </FormPair>

            <FormSection title="Contact" />
            <Field label="Mobile" value={form.mobile} onChangeText={(t: string) => set('mobile', t.replace(/\D/g, ''))} placeholder="10 digits (optional)" keyboardType="number-pad" maxLength={10} />
            <Field label="Email" value={form.email} onChangeText={(t: string) => set('email', t.trim())} placeholder="Optional" keyboardType="email-address" autoCapitalize="none" maxLength={255} />
            <Field label="Address" value={form.address} onChangeText={(t: string) => set('address', t)} placeholder="Optional" multiline maxLength={500} />

            <FormSection title="Bank" />
            <Field label="Bank Name" value={form.bank_name} onChangeText={(t: string) => set('bank_name', t)} placeholder="Optional" maxLength={100} />
            <Field label="Account Holder" value={form.bank_holder_name} onChangeText={(t: string) => set('bank_holder_name', t)} placeholder="Optional" maxLength={100} />
            <FormPair>
              <Field half label="Account No." value={form.bank_account_no} onChangeText={(t: string) => set('bank_account_no', t.replace(/\D/g, ''))} placeholder="6–20 digits" keyboardType="number-pad" maxLength={20} />
              <Field half label="IFSC" value={form.bank_ifsc} onChangeText={(t: string) => set('bank_ifsc', t.toUpperCase())} placeholder="HDFC0001234" autoCapitalize="characters" maxLength={11} />
            </FormPair>
            <Field label="Branch" value={form.bank_branch} onChangeText={(t: string) => set('bank_branch', t)} placeholder="Optional" maxLength={100} />

            <View style={s.submit}>
              <FormError>{error}</FormError>
              <SubmitButton label={editId ? 'Save changes' : 'Add Employee'} busy={saving} onPress={save} />
            </View>

            <View style={s.tail} />
          </ScrollView>
        </Animated.View>
      )}

      <AppDialog
        visible={asking}
        title="Employee photo"
        message="Take one now, or pick a picture already on this phone (up to 1 MB)."
        actions={[
          { text: 'Camera', onPress: () => choose('camera') },
          { text: 'Gallery', onPress: () => choose('gallery') },
          { text: 'Cancel', style: 'cancel', onPress: () => setAsking(false) },
        ]}
        onRequestClose={() => setAsking(false)}
      />
      <AppDialog
        visible={!!savedMsg}
        title={editId ? 'Employee updated' : 'Employee added'}
        message={savedMsg}
        actions={[{ text: 'Done', onPress: closeSaved }]}
        onRequestClose={closeSaved}
      />
    </View>
  );
};

export default AdminPayrollEmployeeFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  skeleton: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
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

  submit: { marginTop: 28, gap: 12 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

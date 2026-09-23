import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { AppDialog, AppAlert } from '../../components/AppDialog';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, takePhoto } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { EMP_TYPES, EmpType, EmployeeForm, getEmployee, saveEmployee } from '../../api/adminPayrollApi';
import { DocHeader } from '../more/docUi';
import { DateSheet, FieldLabel, FormCard, FormError, Hint, PickerCard, SubmitButton } from './adminFormUi';
import { initialsOf } from './adminTransportUi';

/**
 * Add or edit someone on payroll — the panel's Employee form: photo, name,
 * type, designation, mobile, email, salary, joining date, address and bank,
 * checked as the panel checks them (a 10-digit mobile, a 6–20 digit account,
 * a real IFSC, a photo up to 1 MB).
 */

const blank: EmployeeForm = {
  name: '', type: 'employee', designation: '', mobile: '', email: '', salary: '', joining_date: '',
  address: '', bank_name: '', bank_holder_name: '', bank_account_no: '', bank_ifsc: '', bank_branch: '', photo: null,
};

const AdminPayrollEmployeeFormScreen = ({ navigation, route }: any) => {
  const editId: number | undefined = route?.params?.id;
  const [form, setForm] = useState<EmployeeForm>(blank);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!editId);
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const set = <K extends keyof EmployeeForm>(k: K, v: EmployeeForm[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setError('');
  };

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const d = await getEmployee(editId);
        setForm({
          name: d.name ?? '', type: d.type, designation: d.designation ?? '', mobile: d.mobile ?? '', email: d.email ?? '',
          salary: String(Number(d.salary || 0)), joining_date: d.joining_date ?? '', address: d.address ?? '',
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

  const choosePhoto = () =>
    AppAlert.alert('Photo', 'Take a new one, or pick one from the gallery.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Camera', onPress: async () => applyPhoto(await takePhoto()) },
      { text: 'Gallery', onPress: async () => applyPhoto(await pickImage()) },
    ]);
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
    if (form.mobile && !/^[6-9]\d{9}$/.test(form.mobile)) return setError('Enter a valid 10-digit mobile number.');
    if (form.bank_account_no && !/^\d{6,20}$/.test(form.bank_account_no)) return setError('Account number must be 6–20 digits.');
    if (form.bank_ifsc && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(form.bank_ifsc)) return setError('Enter a valid IFSC code (e.g. HDFC0001234).');
    setSaving(true);
    try {
      setSavedMsg(await saveEmployee(form, editId));
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
        <View style={s.scroll}>
          {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} width="100%" height={54} radius={12} />)}
        </View>
      ) : (
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={s.photoWrap} onPress={choosePhoto} activeOpacity={0.8}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={s.photo} />
              ) : (
                <View style={[s.photo, s.photoEmpty]}>
                  <Text style={s.initials}>{initialsOf(form.name) || '+'}</Text>
                </View>
              )}
              <View style={s.camera}>
                <VectorIcon iconSet="Ionicons" iconName="camera" size={14} color={theme.colors.white} />
              </View>
            </TouchableOpacity>

            <FormCard label="Name" value={form.name} onChangeText={t => set('name', t)} placeholder="Full name" maxLength={255} autoCapitalize="words" />

            <View style={s.group}>
              <FieldLabel>Type</FieldLabel>
              <View style={s.chips}>
                {EMP_TYPES.map(t => {
                  const on = form.type === t.key;
                  return (
                    <TouchableOpacity key={t.key} style={[s.chip, on && s.chipOn]} onPress={() => set('type', t.key as EmpType)} activeOpacity={0.7}>
                      <Text style={[s.chipText, on && s.chipTextOn]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {form.type === 'driver' && !editId && <Hint>A driver who is on Transport → Drivers is listed here on their own.</Hint>}
            </View>

            <FormCard label="Designation" value={form.designation} onChangeText={t => set('designation', t)} placeholder="e.g. Accountant" maxLength={100} />
            <View style={s.pair}>
              <FormCard label="Mobile" value={form.mobile} onChangeText={t => set('mobile', t.replace(/\D/g, ''))} placeholder="10 digits" keyboardType="number-pad" maxLength={10} style={s.flex} />
              <FormCard label="Salary (₹ a month)" value={form.salary} onChangeText={t => set('salary', t.replace(/[^0-9.]/g, ''))} placeholder="0" keyboardType="decimal-pad" maxLength={10} style={s.flex} />
            </View>
            <FormCard label="Email" value={form.email} onChangeText={t => set('email', t.trim())} placeholder="Optional" keyboardType="email-address" autoCapitalize="none" maxLength={255} />
            <PickerCard label="Joining date" value={form.joining_date ? moment(form.joining_date).format('DD MMM YYYY') : null} placeholder="Optional" icon="calendar-outline" onPress={() => setDateOpen(true)} />
            <FormCard label="Address" value={form.address} onChangeText={t => set('address', t)} placeholder="Optional" multiline minHeight={70} maxLength={500} />

            <Text style={s.sectionTitle}>Bank</Text>
            <FormCard label="Bank name" value={form.bank_name} onChangeText={t => set('bank_name', t)} placeholder="Optional" maxLength={100} />
            <FormCard label="Account holder" value={form.bank_holder_name} onChangeText={t => set('bank_holder_name', t)} placeholder="Optional" maxLength={100} />
            <View style={s.pair}>
              <FormCard label="Account no." value={form.bank_account_no} onChangeText={t => set('bank_account_no', t.replace(/\D/g, ''))} placeholder="6–20 digits" keyboardType="number-pad" maxLength={20} style={s.flex} />
              <FormCard label="IFSC" value={form.bank_ifsc} onChangeText={t => set('bank_ifsc', t.toUpperCase())} placeholder="HDFC0001234" autoCapitalize="characters" maxLength={11} style={s.flex} />
            </View>
            <FormCard label="Branch" value={form.bank_branch} onChangeText={t => set('bank_branch', t)} placeholder="Optional" maxLength={100} />

            <FormError>{error}</FormError>
            <SubmitButton label={editId ? 'Save changes' : 'Add Employee'} busy={saving} onPress={save} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <DateSheet
        visible={dateOpen}
        value={form.joining_date || null}
        title="Joining date"
        maxDate={moment().format('YYYY-MM-DD')}
        onPick={d => { set('joining_date', d); setDateOpen(false); }}
        onClose={() => setDateOpen(false)}
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
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  pair: { flexDirection: 'row', gap: 12 },
  group: { gap: 8 },
  photoWrap: { alignSelf: 'center', marginBottom: 4 },
  photo: { width: 88, height: 88, borderRadius: 44 },
  photoEmpty: { backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 28, fontWeight: '600', color: theme.colors.textSecondary },
  camera: {
    position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: theme.colors.card,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  chipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  chipTextOn: { color: theme.colors.white },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr, pickImage } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { FormModal, Field, ToggleRow, ChipPicker } from './AdminStandardScreen';
import {
  TeacherRow,
  TeacherStats,
  TeacherPayload,
  createTeacher,
  deleteTeacher,
  getTeacher,
  getTeachers,
  updateTeacher,
} from '../../api/adminTeacherApi';

const GENDERS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
];

const emptyForm: TeacherPayload = {
  name: '', email: '', mobile: '', dob: '', gender: '',
  employee_id: '', date_of_joining: '', qualification: '',
  address: '', pincode: '', emergency_contact: '', state: '', city: '',
  is_active: true, image: null,
};

const AdminTeachersScreen = ({ navigation }: any) => {
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<TeacherPayload>(emptyForm);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof TeacherPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTeachers({ search });
      setRows(res.teachers);
      setStats(res.stats);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load teachers.'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);
  const { refreshing, onRefresh } = useRefresh(load);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setPhoto(null);
    setModal(true);
  };

  const openEdit = async (id: number) => {
    try {
      const d = await getTeacher(id);
      setEditId(id);
      setForm({
        name: d.name ?? '', email: d.email ?? '', mobile: d.phone ?? '',
        dob: d.dob ?? '', gender: d.gender ?? '',
        employee_id: d.employee_id ?? '', date_of_joining: d.date_of_joining ?? '',
        qualification: d.qualification ?? '', address: d.address ?? '',
        pincode: d.pincode ?? '', emergency_contact: d.emergency_contact ?? '',
        state: d.state ?? '', city: d.city ?? '', is_active: d.is_active, image: null,
      });
      setPhoto(null);
      setModal(true);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load teacher.'));
    }
  };

  const choosePhoto = async () => {
    const f = await pickImage();
    if (f) { setPhoto(f); set('image', f); }
  };

  const save = async () => {
    const required = ['name', 'email', 'mobile', 'dob', 'gender', 'employee_id', 'date_of_joining', 'qualification', 'address', 'pincode', 'emergency_contact'] as (keyof TeacherPayload)[];
    if (required.some(k => !String(form[k] ?? '').trim())) {
      return Alert.alert('Required', 'Please fill all required fields.');
    }
    setSaving(true);
    try {
      if (editId) await updateTeacher(editId, form);
      else await createTeacher(form);
      setModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save teacher.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = (r: TeacherRow) =>
    Alert.alert('Delete Teacher', `Delete "${r.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteTeacher(r.id); await load(); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <View style={s.topbar}>
        <TouchableOpacity style={s.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Teachers</Text>
      </View>

      <View style={s.statRow}>
        {[
          { label: 'Total', value: stats?.total, color: '#8B5CF6' },
          { label: 'Active', value: stats?.active, color: '#22C55E' },
          { label: 'Inactive', value: stats?.inactive, color: '#EF4444' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.searchRow}>
        <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Search name, email, employee ID"
          placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} returnKeyType="search" />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity>}
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {rows.length === 0 && <Text style={s.empty}>No teachers found.</Text>}
          {rows.map(r => (
            <View key={r.id} style={s.card}>
              <View style={s.cardMain}>
                {r.image ? <Image source={{ uri: r.image }} style={s.avatarImg} /> : (
                  <View style={[s.avatar, { backgroundColor: '#8B5CF618' }]}>
                    <Text style={s.avatarInit}>{(r.name || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{r.name}</Text>
                  <Text style={s.cardSub}>{r.employee_id ?? '—'}{r.qualification ? ` · ${r.qualification}` : ''}</Text>
                  <Text style={s.cardMeta}>{r.email}{r.phone ? ` · ${r.phone}` : ''}</Text>
                </View>
                {!r.is_active && <View style={s.inactiveTag}><Text style={s.inactiveTagText}>Inactive</Text></View>}
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.act} onPress={() => openEdit(r.id)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={17} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => remove(r)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={openCreate} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>

      <FormModal visible={modal} title={editId ? 'Edit Teacher' : 'New Teacher'}
        onClose={() => setModal(false)} onSave={save} saving={saving} saveLabel={editId ? 'Update' : 'Create'}>
        <TouchableOpacity style={s.photoBtn} onPress={choosePhoto} activeOpacity={0.85}>
          <VectorIcon iconSet="Ionicons" iconName="camera-outline" size={16} color={theme.colors.primary} />
          <Text style={s.photoBtnText} numberOfLines={1}>{photo ? photo.name : 'Add photo (optional)'}</Text>
        </TouchableOpacity>

        <Field label="Full Name" value={form.name} onChangeText={(v: string) => set('name', v)} placeholder="Teacher name" />
        <Field label="Email" value={form.email} onChangeText={(v: string) => set('email', v)} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label="Mobile" value={form.mobile} onChangeText={(v: string) => set('mobile', v)} placeholder="10-digit" keyboardType="number-pad" />
        <Field label="Date of Birth" value={form.dob} onChangeText={(v: string) => set('dob', v)} placeholder="YYYY-MM-DD" />
        <Text style={s.fieldLabel}>Gender</Text>
        <ChipPicker items={GENDERS} selected={form.gender ? [form.gender] : []} onToggle={(id: string) => set('gender', id)} />
        <Field label="Employee ID" value={form.employee_id} onChangeText={(v: string) => set('employee_id', v)} placeholder="e.g. EMP001" />
        <Field label="Date of Joining" value={form.date_of_joining} onChangeText={(v: string) => set('date_of_joining', v)} placeholder="YYYY-MM-DD" />
        <Field label="Qualification" value={form.qualification} onChangeText={(v: string) => set('qualification', v)} placeholder="e.g. B.Ed, M.Sc" />
        <Field label="Emergency Contact" value={form.emergency_contact} onChangeText={(v: string) => set('emergency_contact', v)} placeholder="10-digit" keyboardType="number-pad" />
        <Field label="Address" value={form.address} onChangeText={(v: string) => set('address', v)} placeholder="Full address" multiline />
        <Field label="State" value={form.state} onChangeText={(v: string) => set('state', v)} placeholder="Optional" />
        <Field label="City" value={form.city} onChangeText={(v: string) => set('city', v)} placeholder="Optional" />
        <Field label="Pincode" value={form.pincode} onChangeText={(v: string) => set('pincode', v)} placeholder="6 digits" keyboardType="number-pad" />
        <ToggleRow label="Active" value={form.is_active} onValueChange={(v: boolean) => set('is_active', v)} />
      </FormModal>
    </View>
  );
};

export default AdminTeachersScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, flex: 1 },

  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  scroll: { paddingHorizontal: 16, paddingTop: 10 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 44, height: 44, borderRadius: 14 },
  avatarInit: { fontSize: 18, fontWeight: '900', color: '#8B5CF6' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },
  inactiveTag: { backgroundColor: '#FEE2E2', borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  inactiveTagText: { fontSize: 10, fontWeight: '800', color: theme.colors.danger },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  act: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  photoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  photoBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary, maxWidth: '80%' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
});

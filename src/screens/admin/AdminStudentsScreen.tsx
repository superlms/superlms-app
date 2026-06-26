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
  StudentRow,
  StudentStats,
  StudentLookups,
  StudentPayload,
  createStudent,
  deleteStudent,
  getStudent,
  getStudentLookups,
  getStudents,
  updateStudent,
} from '../../api/adminStudentApi';

const GENDERS = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
];

const emptyForm: StudentPayload = {
  name: '', email: '', mobile: '', dob: '', gender: '',
  standard_id: 0, section_id: 0, father_name: '', mother_name: '',
  date_of_admission: '', aadhar_no: '', pincode: '', religion: '',
  local_address: '', permanent_address: '', state: '', city: '',
  appar_id: '', registration_number: '',
  is_active: true, transportation_required: false, route_id: null, image: null,
};

const AdminStudentsScreen = ({ navigation }: any) => {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookups, setLookups] = useState<StudentLookups | null>(null);

  const [search, setSearch] = useState('');
  const [fClass, setFClass] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<StudentPayload>(emptyForm);
  const [formSections, setFormSections] = useState<StudentLookups['sections']>([]);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof StudentPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStudents({ search, class: fClass ?? undefined });
      setRows(res.students);
      setStats(res.stats);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load students.'));
    } finally {
      setLoading(false);
    }
  }, [search, fClass]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getStudentLookups().then(setLookups).catch(() => {}); }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    setFormSections([]);
    setPhoto(null);
    setModal(true);
  };

  const openEdit = async (id: number) => {
    try {
      const d = await getStudent(id);
      setEditId(id);
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
      setPhoto(null);
      if (d.standard_id) {
        const lk = await getStudentLookups(d.standard_id);
        setFormSections(lk.sections);
      }
      setModal(true);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load student.'));
    }
  };

  const onClassChange = async (id: number) => {
    set('standard_id', id);
    set('section_id', 0);
    try {
      const lk = await getStudentLookups(id);
      setFormSections(lk.sections);
    } catch { setFormSections([]); }
  };

  const choosePhoto = async () => {
    const f = await pickImage();
    if (f) { setPhoto(f); set('image', f); }
  };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.mobile.trim() || !form.gender || !form.standard_id || !form.section_id || !form.father_name.trim() || !form.dob) {
      return Alert.alert('Required', 'Name, email, mobile, DOB, gender, class, section and father name are required.');
    }
    setSaving(true);
    try {
      if (editId) await updateStudent(editId, form);
      else await createStudent(form);
      setModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save student.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = (r: StudentRow) =>
    Alert.alert('Delete Student', `Delete "${r.full_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteStudent(r.id); await load(); }
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
        <Text style={s.title}>Students</Text>
        <TouchableOpacity style={s.menuBtn} onPress={() => setShowFilters(v => !v)} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="filter" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={s.statRow}>
        {[
          { label: 'Total', value: stats?.total, color: '#6366F1' },
          { label: 'Active', value: stats?.active, color: '#22C55E' },
          { label: 'This Year', value: stats?.this_year, color: '#0EA5E9' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.searchRow}>
        <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Search name, admission, roll, phone"
          placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} returnKeyType="search" />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity>}
      </View>

      {showFilters && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
          <TouchableOpacity style={[s.pchip, !fClass && s.pchipActive]} onPress={() => setFClass(null)}>
            <Text style={[s.pchipText, !fClass && s.pchipTextActive]}>All</Text>
          </TouchableOpacity>
          {lookups?.classes.map(c => {
            const active = fClass === c.id;
            return (
              <TouchableOpacity key={c.id} style={[s.pchip, active && s.pchipActive]} onPress={() => setFClass(c.id)}>
                <Text style={[s.pchipText, active && s.pchipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {rows.length === 0 && <Text style={s.empty}>No students found.</Text>}
          {rows.map(r => (
            <View key={r.id} style={s.card}>
              <View style={s.cardMain}>
                {r.image ? <Image source={{ uri: r.image }} style={s.avatarImg} /> : (
                  <View style={[s.avatar, { backgroundColor: '#6366F118' }]}>
                    <Text style={s.avatarInit}>{(r.full_name || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{r.full_name}</Text>
                  <Text style={s.cardSub}>{r.class ?? '—'}{r.section ? ` · ${r.section}` : ''}{r.roll_no ? ` · Roll ${r.roll_no}` : ''}</Text>
                  <Text style={s.cardMeta}>{r.admission_no ?? ''}{r.phone ? ` · ${r.phone}` : ''}</Text>
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

      <FormModal visible={modal} title={editId ? 'Edit Student' : 'New Student'}
        onClose={() => setModal(false)} onSave={save} saving={saving} saveLabel={editId ? 'Update' : 'Create'}>
        <TouchableOpacity style={s.photoBtn} onPress={choosePhoto} activeOpacity={0.85}>
          <VectorIcon iconSet="Ionicons" iconName="camera-outline" size={16} color={theme.colors.primary} />
          <Text style={s.photoBtnText} numberOfLines={1}>{photo ? photo.name : 'Add photo (optional)'}</Text>
        </TouchableOpacity>

        <Field label="Full Name" value={form.name} onChangeText={(v: string) => set('name', v)} placeholder="Student name" />
        <Field label="Email" value={form.email} onChangeText={(v: string) => set('email', v)} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label="Mobile" value={form.mobile} onChangeText={(v: string) => set('mobile', v)} placeholder="10-digit" keyboardType="number-pad" />
        <Field label="Date of Birth" value={form.dob} onChangeText={(v: string) => set('dob', v)} placeholder="YYYY-MM-DD" />
        <Text style={s.fieldLabel}>Gender</Text>
        <ChipPicker items={GENDERS} selected={form.gender ? [form.gender] : []} onToggle={(id: string) => set('gender', id)} />

        <Text style={s.fieldLabel}>Class</Text>
        <ChipPicker items={(lookups?.classes ?? []).map(c => ({ id: c.id, label: c.name }))} selected={form.standard_id ? [form.standard_id] : []} onToggle={onClassChange} />
        <Text style={s.fieldLabel}>Section</Text>
        <ChipPicker items={formSections.map(x => ({ id: x.id, label: x.name }))} selected={form.section_id ? [form.section_id] : []} onToggle={(id: number) => set('section_id', id)} />

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
          <>
            <Text style={s.fieldLabel}>Route</Text>
            <ChipPicker items={(lookups?.routes ?? []).map(rt => ({ id: rt.id, label: rt.route_name }))} selected={form.route_id ? [form.route_id] : []} onToggle={(id: number) => set('route_id', id)} />
          </>
        )}
        <ToggleRow label="Active" value={form.is_active} onValueChange={(v: boolean) => set('is_active', v)} />
      </FormModal>
    </View>
  );
};

export default AdminStudentsScreen;

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

  filterBar: { maxHeight: 44, paddingLeft: 16, marginTop: 10 },
  filterContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
  pchip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  pchipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pchipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  pchipTextActive: { color: '#fff' },

  scroll: { paddingHorizontal: 16, paddingTop: 10 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 44, height: 44, borderRadius: 14 },
  avatarInit: { fontSize: 18, fontWeight: '900', color: '#6366F1' },
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

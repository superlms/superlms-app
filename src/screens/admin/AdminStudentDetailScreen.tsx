import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { StudentDetail, deleteStudent, getStudent } from '../../api/adminStudentApi';

const Row = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  ) : null;

const AdminStudentDetailScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const [d, setD] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getStudent(id);
      setD(res);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load student.'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = () =>
    Alert.alert('Delete Student', `Delete "${d?.full_name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteStudent(id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', apiErr(e, 'Could not delete.'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);

  return (
    <View style={s.root}>
      <Header title="Student Details" onBackPress={() => navigation.goBack()} />

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : !d ? null : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Identity */}
          <View style={s.hero}>
            {d.image ? (
              <Image source={{ uri: d.image }} style={s.avatarImg} />
            ) : (
              <View style={[s.avatar, { backgroundColor: '#6366F118' }]}>
                <Text style={s.avatarInit}>{(d.full_name || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={s.name}>{d.full_name}</Text>
            <Text style={s.sub}>
              {(d.class ?? '—')}{d.section ? ` · ${d.section}` : ''}{d.roll_no ? ` · Roll ${d.roll_no}` : ''}
            </Text>
            <View style={[s.statusTag, d.is_active ? s.statusActive : s.statusInactive]}>
              <Text style={[s.statusText, d.is_active ? s.statusTextActive : s.statusTextInactive]}>
                {d.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>

          {/* Academic */}
          <Text style={s.section}>Academic</Text>
          <View style={s.card}>
            <Row label="Admission No" value={d.admission_no} />
            <Row label="Roll No" value={d.roll_no} />
            <Row label="Class" value={d.class} />
            <Row label="Section" value={d.section} />
            <Row label="Board" value={d.board} />
            <Row label="Date of Admission" value={d.date_of_admission} />
            <Row label="Registration No" value={d.registration_number} />
            <Row label="Apaar ID" value={d.appar_id} />
          </View>

          {/* Personal */}
          <Text style={s.section}>Personal</Text>
          <View style={s.card}>
            <Row label="Email" value={d.email} />
            <Row label="Phone" value={d.phone} />
            <Row label="Gender" value={d.gender ? d.gender.charAt(0).toUpperCase() + d.gender.slice(1) : null} />
            <Row label="Date of Birth" value={d.dob} />
            <Row label="Religion" value={d.religion} />
            <Row label="Aadhar No" value={d.aadhar_no} />
            <Row label="Father Name" value={d.father_name} />
            <Row label="Mother Name" value={d.mother_name} />
          </View>

          {/* Address */}
          <Text style={s.section}>Address</Text>
          <View style={s.card}>
            <Row label="Local Address" value={d.local_address} />
            <Row label="Permanent Address" value={d.permanent_address} />
            <Row label="City" value={d.city} />
            <Row label="State" value={d.state} />
            <Row label="Pincode" value={d.pincode} />
          </View>

          {/* Transport */}
          {d.transportation_required && (
            <>
              <Text style={s.section}>Transport</Text>
              <View style={s.card}>
                <Row label="Route" value={d.route_name ?? '—'} />
              </View>
            </>
          )}

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity style={[s.actBtn, s.editBtn]} activeOpacity={0.9}
              onPress={() => navigation.navigate('AdminStudentForm', { id })}>
              <VectorIcon iconSet="Ionicons" iconName="create-outline" size={18} color="#fff" />
              <Text style={s.actBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actBtn, s.deleteBtn]} activeOpacity={0.9} onPress={remove} disabled={deleting}>
              {deleting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={18} color="#fff" />
                  <Text style={s.actBtnText}>Delete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
};

export default AdminStudentDetailScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },

  hero: { alignItems: 'center', paddingVertical: 12 },
  avatar: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 76, height: 76, borderRadius: 24 },
  avatarInit: { fontSize: 30, fontWeight: '900', color: '#6366F1' },
  name: { fontSize: 19, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 10, textAlign: 'center' },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3, textAlign: 'center' },
  statusTag: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: theme.radius.full },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusInactive: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '800' },
  statusTextActive: { color: '#15803D' },
  statusTextInactive: { color: theme.colors.danger },

  section: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { fontSize: 13, color: theme.colors.textSecondary, flexShrink: 0 },
  rowValue: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },

  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  actBtn: { flex: 1, height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  editBtn: { backgroundColor: theme.colors.primary },
  deleteBtn: { backgroundColor: theme.colors.danger },
  actBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

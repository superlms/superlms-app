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
import { TeacherDetail, deleteTeacher, getTeacher } from '../../api/adminTeacherApi';

const Row = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  ) : null;

const AdminTeacherDetailScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const [d, setD] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setD(await getTeacher(id));
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load teacher.'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = () =>
    Alert.alert('Delete Teacher', `Delete "${d?.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteTeacher(id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', apiErr(e, 'Could not delete.'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);

  if (loading || !d) {
    return (
      <View style={s.root}>
        <Header title="Teacher Details" onBackPress={() => navigation.goBack()} />
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      </View>
    );
  }

  const assignments = (d.assignments ?? []).filter(a => a.class || a.section);

  return (
    <View style={s.root}>
      <Header title="Teacher Details" onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          {d.image ? (
            <Image source={{ uri: d.image }} style={s.avatarImg} />
          ) : (
            <View style={[s.avatar, { backgroundColor: '#8B5CF618' }]}>
              <Text style={s.avatarInit}>{(d.name || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={s.name}>{d.name}</Text>
          <Text style={s.sub}>{d.employee_id ?? '—'}{d.qualification ? ` · ${d.qualification}` : ''}</Text>
          <View style={[s.statusTag, d.is_active ? s.statusActive : s.statusInactive]}>
            <Text style={[s.statusText, d.is_active ? s.statusTextActive : s.statusTextInactive]}>
              {d.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        <Text style={s.section}>Contact</Text>
        <View style={s.card}>
          <Row label="Email" value={d.email} />
          <Row label="Phone" value={d.phone} />
          <Row label="Emergency Contact" value={d.emergency_contact} />
        </View>

        <Text style={s.section}>Personal</Text>
        <View style={s.card}>
          <Row label="Gender" value={d.gender ? d.gender.charAt(0).toUpperCase() + d.gender.slice(1) : null} />
          <Row label="Date of Birth" value={d.dob} />
          <Row label="Date of Joining" value={d.date_of_joining} />
          <Row label="Qualification" value={d.qualification} />
        </View>

        <Text style={s.section}>Address</Text>
        <View style={s.card}>
          <Row label="Address" value={d.address} />
          <Row label="City" value={d.city} />
          <Row label="State" value={d.state} />
          <Row label="Pincode" value={d.pincode} />
        </View>

        {assignments.length > 0 && (
          <>
            <Text style={s.section}>Assignments</Text>
            <View style={s.card}>
              {assignments.map((a, i) => (
                <View key={i} style={[s.row, i === assignments.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={s.rowLabel}>Class</Text>
                  <Text style={s.rowValue}>{a.class ?? '—'}{a.section ? ` - ${a.section}` : ''}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={s.actions}>
          <TouchableOpacity style={[s.actBtn, s.editBtn]} activeOpacity={0.9}
            onPress={() => navigation.navigate('AdminTeacherForm', { id })}>
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
    </View>
  );
};

export default AdminTeacherDetailScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  hero: { alignItems: 'center', paddingVertical: 12 },
  avatar: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 76, height: 76, borderRadius: 24 },
  avatarInit: { fontSize: 30, fontWeight: '900', color: '#8B5CF6' },
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
  rowLabel: { fontSize: 13, color: theme.colors.textSecondary },
  rowValue: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  actBtn: { flex: 1, height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  editBtn: { backgroundColor: theme.colors.primary },
  deleteBtn: { backgroundColor: theme.colors.danger },
  actBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

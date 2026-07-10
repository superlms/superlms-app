import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';
import { AdmissionRow } from '../../api/adminMoreApi';

const STATUS_COLOR: Record<string, string> = { pending: '#F59E0B', updated: '#0EA5E9', admitted: '#22C55E' };
const inr = (n?: number | null) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const Row = ({ icon, label, value }: { icon: string; label: string; value?: string | null }) =>
  value == null || value === '' ? null : (
    <View style={s.row}>
      <VectorIcon iconSet="Ionicons" iconName={icon} size={16} color={theme.colors.textMuted} />
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );

const AdminAdmissionDetailScreen = ({ navigation, route }: any) => {
  const a: AdmissionRow = route.params?.admission;
  if (!a) {
    return (
      <View style={s.root}>
        <Header title="Admission" onBackPress={() => navigation.goBack()} />
        <Text style={s.empty}>Not found.</Text>
      </View>
    );
  }
  const color = STATUS_COLOR[a.status] ?? '#9CA3AF';
  const marks = a.obtained_marks != null && a.total_marks != null ? `${a.obtained_marks} / ${a.total_marks}` : null;

  return (
    <View style={s.root}>
      <Header title="Admission" onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.badge, { backgroundColor: color + '18' }]}>
          <Text style={[s.badgeText, { color }]}>{a.status}</Text>
        </View>
        <Text style={s.name}>{a.student_name}</Text>

        <Text style={s.section}>Applicant</Text>
        <View style={s.card}>
          <Row icon="school-outline" label="Class" value={a.class} />
          <Row icon="git-branch-outline" label="Stream" value={a.stream} />
          <Row icon="person-outline" label="Guardian" value={a.guardian_name} />
          <Row icon="call-outline" label="Mobile" value={a.mobile} />
          <Row icon="mail-outline" label="Email" value={a.email} />
          <Row icon="location-outline" label="Address" value={a.address} />
        </View>

        <Text style={s.section}>Fee</Text>
        <View style={s.card}>
          <Row icon="pricetag-outline" label="Admission fee" value={inr(a.admission_fee)} />
          <Row icon="cash-outline" label="Collected" value={inr(a.collected_amount)} />
        </View>

        {(marks || a.remarks) && (
          <>
            <Text style={s.section}>Result</Text>
            <View style={s.card}>
              <Row icon="ribbon-outline" label="Marks" value={marks} />
              <Row icon="chatbox-outline" label="Remarks" value={a.remarks} />
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

export default AdminAdmissionDetailScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  name: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 10 },
  section: { fontSize: 11, fontWeight: '800', color: theme.colors.textMuted, marginTop: 18, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  card: { backgroundColor: theme.colors.card, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600', width: 96 },
  rowValue: { flex: 1, fontSize: 13, color: theme.colors.textPrimary, fontWeight: '700', textAlign: 'right' },
});

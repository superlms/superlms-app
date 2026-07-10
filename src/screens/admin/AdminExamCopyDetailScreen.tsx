import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';
import { ExamCopyRow } from '../../api/adminExamExtraApi';

const pctColor = (p?: number | null) => (p == null ? '#9CA3AF' : p >= 75 ? '#22C55E' : p >= 40 ? '#F59E0B' : '#EF4444');

const Row = ({ icon, label, value }: { icon: string; label: string; value?: string | null }) =>
  value == null || value === '' ? null : (
    <View style={s.row}>
      <VectorIcon iconSet="Ionicons" iconName={icon} size={16} color={theme.colors.textMuted} />
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );

const AdminExamCopyDetailScreen = ({ navigation, route }: any) => {
  const c: ExamCopyRow = route.params?.copy;
  if (!c) {
    return (
      <View style={s.root}>
        <Header title="Exam Copy" onBackPress={() => navigation.goBack()} />
        <Text style={s.empty}>Not found.</Text>
      </View>
    );
  }
  const color = c.is_absent ? '#EF4444' : pctColor(c.percentage);
  const openPdf = () => {
    if (c.pdf_url) Linking.openURL(c.pdf_url);
    else Alert.alert('No PDF', 'This copy has no uploaded PDF yet.');
  };

  return (
    <View style={s.root}>
      <Header title="Exam Copy" onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.badge, { backgroundColor: color + '18' }]}>
          <Text style={[s.badgeText, { color }]}>{c.is_absent ? 'Absent' : (c.grade || (c.percentage != null ? `${c.percentage}%` : 'Not graded'))}</Text>
        </View>
        <Text style={s.name}>{c.student}</Text>

        <Text style={s.section}>Result</Text>
        <View style={s.card}>
          <Row icon="document-text-outline" label="Exam" value={c.exam} />
          <Row icon="book-outline" label="Subject" value={c.subject} />
          <Row icon="school-outline" label="Class" value={c.class ? `${c.class}${c.section ? ` - ${c.section}` : ''}` : null} />
          <Row icon="ribbon-outline" label="Marks" value={c.marks_obtained != null ? `${c.marks_obtained} / ${c.max_marks ?? '—'}` : null} />
          <Row icon="stats-chart-outline" label="Percentage" value={c.percentage != null ? `${c.percentage}%` : null} />
          <Row icon="medal-outline" label="Grade" value={c.grade} />
          <Row icon="chatbox-outline" label="Remarks" value={c.remarks} />
        </View>

        {c.has_pdf && (
          <TouchableOpacity style={s.pdfBtn} onPress={openPdf} activeOpacity={0.9}>
            <VectorIcon iconSet="Ionicons" iconName="document-text" size={18} color="#fff" />
            <Text style={s.pdfText}>Open answer copy (PDF)</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

export default AdminExamCopyDetailScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  badgeText: { fontSize: 11, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 10 },
  section: { fontSize: 11, fontWeight: '800', color: theme.colors.textMuted, marginTop: 18, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  card: { backgroundColor: theme.colors.card, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600', width: 96 },
  rowValue: { flex: 1, fontSize: 13, color: theme.colors.textPrimary, fontWeight: '700', textAlign: 'right' },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, backgroundColor: theme.colors.primary, marginTop: 20 },
  pdfText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

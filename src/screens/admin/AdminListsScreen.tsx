import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';

// Lists — quick access to the exportable rosters. The web "Lists" builder makes
// filtered PDFs; on mobile we route to the Students / Teachers screens which
// already support filtering and CSV export.
const OPTIONS = [
  { title: 'Students List', subtitle: 'Filter by class/section & export CSV', icon: 'people', accent: '#6366F1', route: 'AdminStudents' },
  { title: 'Teachers List', subtitle: 'Filter staff & export CSV', icon: 'person', accent: '#8B5CF6', route: 'AdminTeachers' },
  { title: 'Admissions List', subtitle: 'Admission enquiries pipeline', icon: 'person-add', accent: '#22C55E', route: 'AdminAdmissions' },
];

const AdminListsScreen = ({ navigation }: any) => (
  <View style={s.root}>
    <Header title="Lists" onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} />
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <Text style={s.sectionTitle}>Rosters & exports</Text>
      <Text style={s.sectionDesc}>Open a roster to filter and export it.</Text>
      {OPTIONS.map(o => (
        <TouchableOpacity key={o.route} style={s.card} activeOpacity={0.85} onPress={() => navigation.navigate(o.route)}>
          <View style={[s.accentStrip, { backgroundColor: o.accent }]} />
          <View style={s.cardInner}>
            <View style={[s.iconWrap, { backgroundColor: o.accent + '18' }]}>
              <VectorIcon iconSet="Ionicons" iconName={o.icon} size={22} color={o.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{o.title}</Text>
              <Text style={s.subtitle} numberOfLines={1}>{o.subtitle}</Text>
            </View>
            <View style={s.chevron}>
              <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textSecondary} />
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

export default AdminListsScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, marginBottom: 16 },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  accentStrip: { height: 4, width: '100%' },
  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconWrap: { width: 46, height: 46, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 2 },
  subtitle: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '500' },
  chevron: { width: 30, height: 30, borderRadius: theme.radius.sm, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
});

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';

// Admin "More" hub — mirrors the web admin More page, in the student app's More
// visual language (accent-strip cards). Items route to their own screens; the
// info/policy items reuse the existing shared content screens.
interface MoreItem {
  title: string;
  subtitle: string;
  icon: string;
  accent: string;
  route: string;
}

const ITEMS: MoreItem[] = [
  { title: 'Users', subtitle: 'Staff & sub-admin accounts', icon: 'people', accent: '#6366F1', route: 'AdminUsers' },
  { title: 'Admissions', subtitle: 'Admission enquiries & pipeline', icon: 'person-add', accent: '#22C55E', route: 'AdminAdmissions' },
  { title: 'Lists', subtitle: 'Student & staff lists / exports', icon: 'list', accent: '#0EA5E9', route: 'AdminLists' },
  { title: 'Rules & Regulation', subtitle: 'School rules and code of conduct', icon: 'shield-checkmark', accent: '#F59E0B', route: 'RulesRegulationsMore' },
  { title: 'Contact Admin', subtitle: 'Messages from students & teachers', icon: 'chatbubbles', accent: '#EC4899', route: 'AdminEnquiries' },
  { title: 'About App', subtitle: 'Version, team & app overview', icon: 'information-circle', accent: theme.colors.primary, route: 'AboutAppMore' },
  { title: 'Rate LMS', subtitle: 'Share your feedback with us', icon: 'star', accent: '#F59E0B', route: 'AdminRateLms' },
  { title: 'Terms & Conditions', subtitle: 'Platform terms and company info', icon: 'document-text', accent: '#8B5CF6', route: 'TermsConditionsMore' },
  { title: 'Privacy Policy', subtitle: 'How we handle your data', icon: 'lock-closed', accent: '#6366F1', route: 'PrivacyPolicyMore' },
  { title: 'Terms of Use', subtitle: 'Rules for using the app', icon: 'reader', accent: '#0EA5E9', route: 'TermsOfUseMore' },
];

const Card = ({ item, onPress }: { item: MoreItem; onPress: () => void }) => (
  <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={s.card}>
    <View style={[s.accentStrip, { backgroundColor: item.accent }]} />
    <View style={s.cardInner}>
      <View style={[s.iconWrap, { backgroundColor: item.accent + '18' }]}>
        <VectorIcon iconSet="Ionicons" iconName={item.icon} size={22} color={item.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{item.title}</Text>
        <Text style={s.subtitle} numberOfLines={1}>{item.subtitle}</Text>
      </View>
      <View style={s.chevron}>
        <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textSecondary} />
      </View>
    </View>
  </TouchableOpacity>
);

const AdminMoreScreen = ({ navigation }: any) => (
  <View style={s.root}>
    <Header
      title="More"
      onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
    />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <Text style={s.sectionTitle}>Manage & Information</Text>
      <Text style={s.sectionDesc}>Everything else — admissions, users, lists, policies and app info.</Text>
      {ITEMS.map(item => (
        <Card key={item.route} item={item} onPress={() => navigation.navigate(item.route)} />
      ))}
    </ScrollView>
  </View>
);

export default AdminMoreScreen;

const __mk = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, marginBottom: 16 },
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, overflow: 'hidden', marginBottom: 12,
    shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  accentStrip: { height: 4, width: '100%' },
  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconWrap: { width: 46, height: 46, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 2 },
  subtitle: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '500' },
  chevron: { width: 30, height: 30, borderRadius: theme.radius.sm, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
});

let s = __mk();
onThemeChange(() => { s = __mk(); });

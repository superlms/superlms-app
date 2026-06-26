import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * "More" hub — links to the read-only info screens (About App, School Info,
 * policies, etc.). Each item has its own accent color matching the screen it
 * opens, in the announcement-card visual language.
 */

interface MoreItem {
  title: string;
  subtitle: string;
  icon: string;
  iconSet: 'Ionicons' | 'Feather' | 'MaterialCommunityIcons';
  accent: string;
  route: string;
}

const ITEMS: MoreItem[] = [
  {
    title: 'About App',
    subtitle: 'Version, team & app overview',
    icon: 'information-circle',
    iconSet: 'Ionicons',
    accent: theme.colors.primary,
    route: 'AboutAppMore',
  },
  {
    title: 'School Info',
    subtitle: 'About the school, vision & contact',
    icon: 'school',
    iconSet: 'Ionicons',
    accent: '#10B981',
    route: 'SchoolInfoMore',
  },
  {
    title: 'Rules & Regulations',
    subtitle: 'School rules and code of conduct',
    icon: 'shield-checkmark',
    iconSet: 'Ionicons',
    accent: '#F59E0B',
    route: 'RulesRegulationsMore',
  },
  {
    title: 'Terms & Conditions',
    subtitle: 'Platform terms and company info',
    icon: 'document-text',
    iconSet: 'Ionicons',
    accent: '#8B5CF6',
    route: 'TermsConditionsMore',
  },
  {
    title: 'Privacy Policy',
    subtitle: 'How we handle your data',
    icon: 'lock-closed',
    iconSet: 'Ionicons',
    accent: '#6366F1',
    route: 'PrivacyPolicyMore',
  },
  {
    title: 'Terms of Use',
    subtitle: 'Rules for using the app',
    icon: 'reader',
    iconSet: 'Ionicons',
    accent: '#0EA5E9',
    route: 'TermsOfUseMore',
  },
];

const MoreItemCard = ({ item, onPress }: { item: MoreItem; onPress: () => void }) => (
  <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={s.card}>
    <View style={[s.accentStrip, { backgroundColor: item.accent }]} />
    <View style={s.cardInner}>
      <View style={[s.iconWrap, { backgroundColor: item.accent + '18' }]}>
        <VectorIcon iconSet={item.iconSet as any} iconName={item.icon} size={22} color={item.accent} />
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

const MoreScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={s.root}>
      <Header title="More" onBackPress={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <Text style={s.sectionTitle}>Information</Text>
        <Text style={s.sectionDesc}>
          Quick access to school info, policies and app details.
        </Text>

        {ITEMS.map(item => (
          <MoreItemCard
            key={item.route}
            item={item}
            onPress={() => navigation.navigate(item.route)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

export default MoreScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 32 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, marginBottom: 16 },

  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  accentStrip: { height: 4, width: '100%' },
  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 2 },
  subtitle: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '500' },
  chevron: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

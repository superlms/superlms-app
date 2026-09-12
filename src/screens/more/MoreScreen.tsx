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
 * "More" hub — one plain list linking to the read-only info screens (About
 * App, School Info, policies, etc.), matching the minimal info screens.
 */

interface MoreItem {
  title: string;
  icon: string;
  route: string;
}

const ITEMS: MoreItem[] = [
  { title: 'About App', icon: 'information-circle-outline', route: 'AboutAppMore' },
  { title: 'School Info', icon: 'school-outline', route: 'SchoolInfoMore' },
  { title: 'Rules & Regulations', icon: 'shield-checkmark-outline', route: 'RulesRegulationsMore' },
  { title: 'Terms & Conditions', icon: 'document-text-outline', route: 'TermsConditionsMore' },
  { title: 'Privacy Policy', icon: 'lock-closed-outline', route: 'PrivacyPolicyMore' },
  { title: 'Terms of Use', icon: 'reader-outline', route: 'TermsOfUseMore' },
];

const MoreScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={s.root}>
      <Header title="More" onBackPress={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <View style={s.list}>
          {ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.route}
              activeOpacity={0.6}
              onPress={() => navigation.navigate(item.route)}
              style={[s.row, i < ITEMS.length - 1 && s.rowBorder]}
            >
              <View style={s.iconWrap}>
                <VectorIcon iconSet="Ionicons" iconName={item.icon} size={18} color={theme.colors.primary} />
              </View>
              <Text style={s.title}>{item.title}</Text>
              <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default MoreScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 32 },

  list: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

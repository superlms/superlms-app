import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import { DocHeader } from './docUi';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * "More" hub — one plain list on a white page linking to the read-only info
 * screens (About App, School Info, policies, etc.), in the same minimal
 * language as those screens: plain icons and inset hairline separators.
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
      <DocHeader title="More" onBackPress={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {ITEMS.map((item, i) => (
          <TouchableOpacity
            key={item.route}
            activeOpacity={0.6}
            onPress={() => navigation.navigate(item.route)}
            style={s.row}
          >
            <View style={s.icon}>
              <VectorIcon iconSet="Ionicons" iconName={item.icon} size={20} color={theme.colors.textSecondary} />
            </View>
            <View style={[s.rowMain, i < ITEMS.length - 1 && s.rowBorder]}>
              <Text style={s.title}>{item.title}</Text>
              <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default MoreScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 24, alignItems: 'center' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  title: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

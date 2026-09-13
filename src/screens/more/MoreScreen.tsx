import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DocHeader } from './docUi';
import { MenuRow, menuStyles } from './menuUi';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * "More" hub — the read-only info screens (About App, School Info, policies),
 * as a plain list like Exams: each entry an icon, its name and a line on what
 * it holds.
 */

interface MoreItem {
  title: string;
  description: string;
  icon: string;
  route: string;
}

const ITEMS: MoreItem[] = [
  {
    title: 'About App',
    description: 'What the app does and the version you are on',
    icon: 'information-circle-outline',
    route: 'AboutAppMore',
  },
  {
    title: 'School Info',
    description: "Your school's details, contacts and address",
    icon: 'school-outline',
    route: 'SchoolInfoMore',
  },
  {
    title: 'Rules & Regulations',
    description: 'The rules everyone at school follows',
    icon: 'shield-checkmark-outline',
    route: 'RulesRegulationsMore',
  },
  {
    title: 'Terms & Conditions',
    description: "The terms for using the school's services",
    icon: 'document-text-outline',
    route: 'TermsConditionsMore',
  },
  {
    title: 'Privacy Policy',
    description: 'How your personal data is collected and used',
    icon: 'lock-closed-outline',
    route: 'PrivacyPolicyMore',
  },
  {
    title: 'Terms of Use',
    description: 'What you agree to when you use this app',
    icon: 'reader-outline',
    route: 'TermsOfUseMore',
  },
];

const MoreScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={s.root}>
      <DocHeader title="More" onBackPress={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={menuStyles.list}>
        {ITEMS.map((item, i) => (
          <MenuRow
            key={item.route}
            icon={item.icon}
            title={item.title}
            description={item.description}
            onPress={() => navigation.navigate(item.route)}
            isLast={i === ITEMS.length - 1}
          />
        ))}
      </ScrollView>
    </View>
  );
};

export default MoreScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { DocHeader } from '../more/docUi';
import { MenuRow, menuStyles } from '../more/menuUi';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * Admin "More" hub — mirrors the web admin More page, drawn like the student
 * app's More: a plain list, each entry an icon, its name and a few words on
 * what it holds (kept to one line). Items route to their own screens; the
 * info/policy items reuse the shared content screens.
 */
interface MoreItem {
  title: string;
  description: string;
  icon: string;
  route: string;
}

const ITEMS: MoreItem[] = [
  { title: 'Profile', description: 'Your details and photo', icon: 'person-circle-outline', route: 'AdminProfile' },
  { title: 'Users', description: 'Staff and sub-admin accounts', icon: 'people-outline', route: 'AdminUsers' },
  { title: 'Admissions', description: 'Admission enquiries and pipeline', icon: 'person-add-outline', route: 'AdminAdmissions' },
  { title: 'Lists', description: 'Student and staff lists', icon: 'list-outline', route: 'AdminLists' },
  { title: 'Rules & Regulation', description: 'School rules to follow', icon: 'shield-checkmark-outline', route: 'RulesRegulationsMore' },
  { title: 'Contact Admin', description: 'Messages from students and teachers', icon: 'chatbubbles-outline', route: 'AdminEnquiries' },
  { title: 'About App', description: 'App details and version', icon: 'information-circle-outline', route: 'AboutAppMore' },
  { title: 'Rate LMS', description: 'Share your feedback with us', icon: 'star-outline', route: 'AdminRateLms' },
  { title: 'Terms & Conditions', description: 'Terms of our services', icon: 'document-text-outline', route: 'TermsConditionsMore' },
  { title: 'Privacy Policy', description: 'How your data is used', icon: 'lock-closed-outline', route: 'PrivacyPolicyMore' },
  { title: 'Terms of Use', description: 'Rules for using the app', icon: 'reader-outline', route: 'TermsOfUseMore' },
];

const AdminMoreScreen = ({ navigation }: any) => (
  <View style={s.root}>
    <DocHeader
      title="More"
      onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
    />
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

export default AdminMoreScreen;

const __mk = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

let s = __mk();
onThemeChange(() => { s = __mk(); });

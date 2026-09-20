import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DocHeader } from './docUi';
import { MenuRow, menuStyles } from './menuUi';
import { getStoredRole } from '../../api/authApi';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * "More" hub — the read-only info screens (About App, School Info, policies),
 * as a plain list like Exams: each entry an icon, its name and a few words on
 * what it holds (kept to one line). A teacher opens on Students, where a class
 * teacher keeps their own class.
 */

interface MoreItem {
  title: string;
  description: string;
  icon: string;
  route: string;
}

// A teacher's own class, above everything else.
const TEACHER_ITEM: MoreItem = {
  title: 'Students',
  description: 'Your class · add, edit, remove',
  icon: 'people-outline',
  route: 'TeacherStudents',
};

const ITEMS: MoreItem[] = [
  {
    title: 'About App',
    description: 'App details and version',
    icon: 'information-circle-outline',
    route: 'AboutAppMore',
  },
  {
    title: 'School Info',
    description: 'Contacts and address',
    icon: 'school-outline',
    route: 'SchoolInfoMore',
  },
  {
    title: 'Rules & Regulations',
    description: 'School rules to follow',
    icon: 'shield-checkmark-outline',
    route: 'RulesRegulationsMore',
  },
  {
    title: 'Terms & Conditions',
    description: 'Terms of our services',
    icon: 'document-text-outline',
    route: 'TermsConditionsMore',
  },
  {
    title: 'Privacy Policy',
    description: 'How your data is used',
    icon: 'lock-closed-outline',
    route: 'PrivacyPolicyMore',
  },
  {
    title: 'Terms of Use',
    description: 'Rules for using the app',
    icon: 'reader-outline',
    route: 'TermsOfUseMore',
  },
];

const MoreScreen = () => {
  const navigation = useNavigation<any>();
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    let live = true;
    getStoredRole().then(r => {
      if (live) setIsTeacher(r === 'teacher');
    });
    return () => {
      live = false;
    };
  }, []);

  const items = isTeacher ? [TEACHER_ITEM, ...ITEMS] : ITEMS;

  return (
    <View style={s.root}>
      <DocHeader title="More" onBackPress={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={menuStyles.list}>
        {items.map((item, i) => (
          <MenuRow
            key={item.route}
            icon={item.icon}
            title={item.title}
            description={item.description}
            onPress={() => navigation.navigate(item.route)}
            isLast={i === items.length - 1}
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

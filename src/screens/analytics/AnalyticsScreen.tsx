import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import StudentAnalytics from './StudentAnalytics';
import TeacherAnalytics from './TeacherAnalytics';

const TITLE = 'Analytics';

/**
 * Analytics for a student or a teacher: a row of tabs, one for each part of the
 * app, over cards of graphs and figures on the page's grey.
 */
const AnalyticsScreen = ({ navigation, route }: any) => {
  const role = route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      {role === 'teacher' ? <TeacherAnalytics navigation={navigation} /> : <StudentAnalytics navigation={navigation} />}
    </View>
  );
};

export default AnalyticsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

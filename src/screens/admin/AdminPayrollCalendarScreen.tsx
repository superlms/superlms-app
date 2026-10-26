import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import PayrollCalendarView from './PayrollCalendarView';

/**
 * One person's attendance on its own page (from their Employee page) — the
 * same months the Attendance tab shows once the person is picked there.
 */

const AdminPayrollCalendarScreen = ({ navigation, route }: any) => (
  <View style={s.root}>
    <DocHeader title="Attendance" onBackPress={() => navigation.goBack()} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <PayrollCalendarView employeeId={route?.params?.id} name={route?.params?.name} />
    </ScrollView>
  </View>
);

export default AdminPayrollCalendarScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

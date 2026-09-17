import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { ExamList } from './examUi';
import { useExamList } from './useExamList';

/**
 * Admit Card (students): the exams, listed as on the Exams screen, each
 * opening onto its admit card as the school issued it (ExamAdmitCard).
 */

const TITLE = 'Admit Card';

const AdmitCardScreen = ({ navigation }: any) => {
  const list = useExamList('admit-card');

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <ExamList
        {...list}
        onPressExam={exam => navigation.navigate('ExamAdmitCard', { exam })}
        emptySubtitle="Exams the school schedules for your class will appear here."
      />
    </View>
  );
};

export default AdmitCardScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

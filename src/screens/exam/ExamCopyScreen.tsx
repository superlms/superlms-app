import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { ExamList } from './examUi';
import { useExamList } from './useExamList';

/**
 * Exam Copy, step one: the exams, listed as on the Exams screen. An exam
 * opens onto its subjects and the copy the teacher uploaded for each
 * (ExamCopies), and a copy onto the sheet itself (ExamCopyView).
 */

const TITLE = 'Exam Copy';

const ExamCopyScreen = ({ navigation }: any) => {
  const list = useExamList('exam-copies');

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <ExamList
        {...list}
        onPressExam={exam => navigation.navigate('ExamCopies', { exam })}
        emptySubtitle="Exams the school schedules for your class will appear here, with your checked copies once your teachers upload them."
      />
    </View>
  );
};

export default ExamCopyScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

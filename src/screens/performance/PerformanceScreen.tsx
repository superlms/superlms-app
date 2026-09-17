import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { ExamList } from '../exam/examUi';
import { useExamList } from '../exam/useExamList';

/**
 * A student's performance, exam by exam: the exams as the Exams screen lists
 * them, each opening onto its result subject by subject (ExamResult).
 */

const TITLE = 'My Performance';

const PerformanceScreen = ({ navigation }: any) => {
  const list = useExamList('performance');

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <ExamList
        {...list}
        onPressExam={exam => navigation.navigate('ExamResult', { exam })}
        emptySubtitle="Exams the school schedules for your class will appear here, with your marks once they are added."
      />
    </View>
  );
};

export default PerformanceScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

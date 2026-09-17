import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { ExamList } from './examUi';
import { useExamList } from './useExamList';

/**
 * Date Sheet, for students and teachers: the exams, listed as on the Exams
 * screen, each opening onto its papers day by day (ExamDateSheet).
 *
 * Route params:
 *   teacher – true on a teacher's Exams, whose sheet has their own subjects
 */

const TITLE = 'Date Sheet';

const DateSheetScreen = ({ navigation, route }: any) => {
  const teacher = !!route?.params?.teacher;
  const list = useExamList(teacher ? 'datesheet:teacher' : 'datesheet');

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <ExamList
        {...list}
        onPressExam={exam => navigation.navigate('ExamDateSheet', { exam, teacher })}
        emptySubtitle={
          teacher
            ? 'Exams set for the classes and subjects you teach will appear here.'
            : 'Exams the school schedules for your class will appear here.'
        }
      />
    </View>
  );
};

export default DateSheetScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { ExamList } from '../exam/examUi';
import { useExamList } from '../exam/useExamList';

/**
 * Upload Marks, step one: the exams, listed as on the Exams screen. An exam
 * opens onto the classes the teacher teaches (MarksClasses), and a class onto
 * its students' marks (MarksSheet).
 */

const TITLE = 'Upload Marks';

const UploadMarksScreen = ({ navigation }: any) => {
  const list = useExamList('upload-marks');

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <ExamList
        {...list}
        onPressExam={exam => navigation.navigate('MarksClasses', { exam })}
        emptySubtitle="Exams set for the classes and subjects you teach will appear here."
      />
    </View>
  );
};

export default UploadMarksScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

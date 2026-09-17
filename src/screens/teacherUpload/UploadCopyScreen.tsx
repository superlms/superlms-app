import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { ExamList } from '../exam/examUi';
import { useExamList } from '../exam/useExamList';

/**
 * Upload Copy, step one: the exams, listed as on the Exams screen. An exam
 * opens onto the classes the teacher teaches (CopyClasses), and a class onto
 * its students' copies (CopySheet).
 */

const TITLE = 'Upload Copy';

const UploadCopyScreen = ({ navigation }: any) => {
  const list = useExamList('upload-copies');

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <ExamList
        {...list}
        onPressExam={exam => navigation.navigate('CopyClasses', { exam })}
        emptySubtitle="Exams set for the classes and subjects you teach will appear here."
      />
    </View>
  );
};

export default UploadCopyScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

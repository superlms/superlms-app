import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { ExamList } from './examUi';
import { useExamList } from './useExamList';

/**
 * Exam Syllabus, for students and teachers: the exams, listed as on the Exams
 * screen. An exam opens onto its subjects (ExamSyllabusSubjects), and a subject
 * onto the chapters the exam covers (ExamSyllabusChapters) — a student's class,
 * or the teacher's own classes and subjects.
 *
 * Route params:
 *   teacher – true on a teacher's Exams
 */

const TITLE = 'Exam Syllabus';

const ExamSyllabusScreen = ({ navigation, route }: any) => {
  const teacher = !!route?.params?.teacher;
  const list = useExamList(teacher ? 'syllabus:teacher' : 'syllabus');

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <ExamList
        {...list}
        onPressExam={exam => navigation.navigate('ExamSyllabusSubjects', { exam, teacher })}
        emptySubtitle={
          teacher
            ? 'Exams set for the classes and subjects you teach will appear here.'
            : 'Exams the school schedules for your class will appear here.'
        }
      />
    </View>
  );
};

export default ExamSyllabusScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

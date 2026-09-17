import React from 'react';
import { ExamHub, type HubEntry } from './ExamMainScreen';

/**
 * A teacher's "Exams" hub, laid out as the student's: the exams, what each
 * covers in the teacher's subjects, and when their papers are.
 */
const TEACHER_ENTRIES: HubEntry[] = [
  {
    title: 'Exams',
    sub: 'Upcoming, ongoing and completed exams',
    icon: 'calendar-outline',
    route: 'ExamsScreen',
    params: { teacher: true },
  },
  {
    title: 'Exam Syllabus',
    sub: 'What each exam covers in your subjects',
    icon: 'book-outline',
    route: 'TeacherExamsScreen',
  },
  {
    title: 'Date Sheet',
    sub: 'Which of your papers is on which day',
    icon: 'calendar-number-outline',
    route: 'DateSheet',
    params: { teacher: true },
  },
];

const TeacherExamMainScreen = ({ navigation }: any) => <ExamHub navigation={navigation} entries={TEACHER_ENTRIES} />;

export default TeacherExamMainScreen;

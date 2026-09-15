import React from 'react';
import { StudentSubjectList } from './subjectLists';

// A student's subjects, as the list alone — a subject opens nothing.
const SubjectsScreen = ({ navigation }: any) => <StudentSubjectList navigation={navigation} title="Subjects" />;

export default SubjectsScreen;

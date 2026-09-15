import React from 'react';
import { TeacherSubjectList } from './subjectLists';

// The classes and subjects taught; each opens onto that class's chapters.
const TeacherSubjectsScreen = ({ navigation }: any) => (
  <TeacherSubjectList
    navigation={navigation}
    title="Subjects"
    onOpen={combo => navigation.navigate('SubjectDetails', { combo })}
  />
);

export default TeacherSubjectsScreen;

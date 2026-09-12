import React from 'react';
import { TeacherSubjectList } from '../subjects/subjectLists';

// The classes and subjects taught first; each opens onto its syllabus, where
// the edit button leads on to managing it.
const TeacherSyllabusScreen = ({ navigation }: any) => (
  <TeacherSubjectList
    navigation={navigation}
    title="Syllabus"
    onOpen={combo => navigation.navigate('SyllabusDetail', { combo })}
  />
);

export default TeacherSyllabusScreen;

import React from 'react';
import { TeacherSubjectList } from '../subjects/subjectLists';

// The classes and subjects taught first; each opens onto its topics, where
// material is added. Chapters and topics themselves are made on Syllabus.
const TeacherContentScreen = ({ navigation }: any) => (
  <TeacherSubjectList
    navigation={navigation}
    title="Study Content"
    onOpen={combo => navigation.navigate('ContentDetail', { combo })}
  />
);

export default TeacherContentScreen;

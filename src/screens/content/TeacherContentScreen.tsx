import React from 'react';
import { TeacherSubjectList } from '../subjects/subjectLists';
import { SAMPLE_TEACHER_SUBJECTS } from './contentUi';

// Kept on the phone, so the list draws itself from its own subjects while it loads.
const KEEP = { name: 'content:subjects:teacher', sample: SAMPLE_TEACHER_SUBJECTS };

// The classes and subjects taught first; each opens onto its topics, where
// material is added. Chapters and topics themselves are made on Syllabus.
const TeacherContentScreen = ({ navigation }: any) => (
  <TeacherSubjectList
    navigation={navigation}
    title="Study Content"
    keep={KEEP}
    onOpen={combo => navigation.navigate('ContentDetail', { combo })}
  />
);

export default TeacherContentScreen;

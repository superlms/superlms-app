import React from 'react';
import { StudentSubjectList } from '../subjects/subjectLists';

// The subjects first, the same as Subjects; each opens onto its syllabus.
const StudentSyllabusScreen = ({ navigation }: any) => (
  <StudentSubjectList
    navigation={navigation}
    title="Syllabus"
    onOpen={sub =>
      navigation.navigate('SyllabusDetail', {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectImage: sub.image,
      })
    }
  />
);

export default StudentSyllabusScreen;

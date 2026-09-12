import React from 'react';
import { StudentSubjectList } from './subjectLists';

const SubjectsScreen = ({ navigation }: any) => (
  <StudentSubjectList
    navigation={navigation}
    title="Subjects"
    onOpen={sub =>
      navigation.navigate('SubjectDetails', {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectImage: sub.image,
      })
    }
  />
);

export default SubjectsScreen;

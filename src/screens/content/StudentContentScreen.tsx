import React from 'react';
import { plural } from '../subjects/subjectsUi';
import { StudentSubjectList, type SubjectWithChapters } from '../subjects/subjectLists';
import { hasMaterial } from './contentUi';

// "3 of 10 topics with material" — how much of the subject there is to read.
const materialMeta = (sub: SubjectWithChapters) => {
  const topics = sub.chapters.flatMap(c => c.topics);
  if (topics.length === 0) return sub.chapters.length > 0 ? 'No topics yet' : 'No chapters yet';
  const ready = topics.filter(hasMaterial).length;
  return ready > 0 ? `${ready} of ${plural(topics.length, 'topic')} with material` : 'No material yet';
};

// The subjects first, the same as Subjects; each opens onto its study material.
const StudentContentScreen = ({ navigation }: any) => (
  <StudentSubjectList
    navigation={navigation}
    title="Study Content"
    metaFor={materialMeta}
    onOpen={sub =>
      navigation.navigate('ContentDetail', {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectImage: sub.image,
      })
    }
  />
);

export default StudentContentScreen;

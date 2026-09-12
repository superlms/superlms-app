import React from 'react';
import { quietCaps } from '../../utils/quietCaps';
import { getChapters } from '../../api/contentApi';
import { OutlineScreen } from './outlineUi';

const SubjectDetailsScreen = ({ navigation, route }: any) => {
  const subjectId: number = route?.params?.subjectId;
  const subjectName: string = route?.params?.subjectName ?? 'Subject';

  return (
    <OutlineScreen
      navigation={navigation}
      headerTitle="Subject"
      title={subjectName}
      image={route?.params?.subjectImage}
      fetchChapters={() => getChapters({ subject_id: subjectId })}
      emptyChapters={{
        title: 'No chapters yet',
        subtitle: `Chapters for ${quietCaps(subjectName)} will appear here once your teacher adds them.`,
      }}
    />
  );
};

export default SubjectDetailsScreen;

import React from 'react';
import { quietCaps } from '../../utils/quietCaps';
import { getChapters, type TeacherCombo } from '../../api/contentApi';
import { OutlineScreen, comboChapters, comboClass } from './outlineUi';

/**
 * One subject's chapters. A student arrives with the subject; a teacher
 * arrives with a class-and-subject pair.
 */
const SubjectDetailsScreen = ({ navigation, route }: any) => {
  const combo: TeacherCombo | undefined = route?.params?.combo;
  const subjectId: number | undefined = route?.params?.subjectId;
  const subjectName: string = combo?.subjectName ?? route?.params?.subjectName ?? 'Subject';

  return (
    <OutlineScreen
      navigation={navigation}
      headerTitle="Subject"
      title={subjectName}
      subtitle={combo ? comboClass(combo) : null}
      image={combo ? combo.subjectImage : route?.params?.subjectImage}
      fetchChapters={() => (combo ? comboChapters(combo) : getChapters({ subject_id: subjectId }))}
      emptyChapters={
        combo
          ? { title: 'No chapters yet', subtitle: 'Add chapters and topics from Syllabus.' }
          : {
              title: 'No chapters yet',
              subtitle: `Chapters for ${quietCaps(subjectName)} will appear here once your teacher adds them.`,
            }
      }
    />
  );
};

export default SubjectDetailsScreen;

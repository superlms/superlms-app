import React from 'react';
import { getChapters, type TeacherCombo } from '../../api/contentApi';
import { OutlineScreen, comboChapters, comboClass } from '../subjects/outlineUi';

/**
 * One subject's syllabus. A student arrives with the subject; a teacher
 * arrives with a class-and-subject pair, and can go on to manage it.
 */
const SyllabusDetailScreen = ({ navigation, route }: any) => {
  const combo: TeacherCombo | undefined = route?.params?.combo;
  const subjectId: number | undefined = route?.params?.subjectId;
  const subjectName: string = combo?.subjectName ?? route?.params?.subjectName ?? 'Subject';

  return (
    <OutlineScreen
      navigation={navigation}
      headerTitle="Syllabus"
      title={subjectName}
      subtitle={combo ? comboClass(combo) : null}
      image={combo ? combo.subjectImage : route?.params?.subjectImage}
      fetchChapters={() => (combo ? comboChapters(combo) : getChapters({ subject_id: subjectId }))}
      rightIcon={combo ? 'create-outline' : undefined}
      onRightPress={combo ? () => navigation.navigate('ManageSyllabus', { combo }) : undefined}
      emptyChapters={
        combo
          ? { title: 'No chapters yet', subtitle: 'Add chapters and topics with the edit button above.' }
          : {
              title: 'No chapters yet',
              subtitle: `Chapters for ${subjectName} will appear here once your teacher adds them.`,
            }
      }
    />
  );
};

export default SyllabusDetailScreen;

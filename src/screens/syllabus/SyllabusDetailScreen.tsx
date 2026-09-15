import React, { useState } from 'react';
import { Platform, StyleSheet, ToastAndroid, View } from 'react-native';
import { HeaderIconButton } from '../../components/Header';
import { getChapters, type TeacherCombo } from '../../api/contentApi';
import { OutlineScreen, comboChapters, comboClass } from '../subjects/outlineUi';
import { AddToSyllabusSheet } from './AddToSyllabusSheet';

/**
 * One subject's syllabus. A student arrives with the subject; a teacher
 * arrives with a class-and-subject pair, can add a chapter or a topic with +,
 * and can go on to manage it with the pencil.
 */
const SyllabusDetailScreen = ({ navigation, route }: any) => {
  const combo: TeacherCombo | undefined = route?.params?.combo;
  const subjectId: number | undefined = route?.params?.subjectId;
  const subjectName: string = combo?.subjectName ?? route?.params?.subjectName ?? 'Subject';
  const [adding, setAdding] = useState(false);

  return (
    <OutlineScreen
      navigation={navigation}
      headerTitle="Syllabus"
      title={subjectName}
      subtitle={combo ? comboClass(combo) : null}
      image={combo ? combo.subjectImage : route?.params?.subjectImage}
      fetchChapters={() => (combo ? comboChapters(combo) : getChapters({ subject_id: subjectId }))}
      rightSlot={
        combo ? (
          <View style={s.headActions}>
            <HeaderIconButton icon="add" size={22} onPress={() => setAdding(true)} />
            <HeaderIconButton
              icon="create-outline"
              onPress={() => navigation.navigate('ManageSyllabus', { combo })}
            />
          </View>
        ) : undefined
      }
      renderExtra={outline =>
        combo ? (
          <AddToSyllabusSheet
            visible={adding}
            combo={combo}
            chapters={outline.chapters ?? []}
            onClose={() => setAdding(false)}
            onAdded={(kind, chapterId) => {
              setAdding(false);
              // A new topic shows in its chapter, opened.
              if (kind === 'topic') outline.openChapter(chapterId);
              outline.load();
              if (Platform.OS === 'android') {
                ToastAndroid.show(kind === 'topic' ? 'Topic added' : 'Chapter added', ToastAndroid.SHORT);
              }
            }}
          />
        ) : null
      }
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

const s = StyleSheet.create({
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

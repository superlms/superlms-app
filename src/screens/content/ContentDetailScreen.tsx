import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import {
  getChapters,
  type SyllabusChapter,
  type SyllabusTopic,
  type TeacherCombo,
} from '../../api/contentApi';
import { OutlineScreen, TopicLine, comboChapters, comboClass } from '../subjects/outlineUi';
import { MaterialMarks, hasMaterial, materialSummary } from './contentUi';

/**
 * One subject's study material, laid out like its syllabus. A student opens a
 * topic to read it; a teacher (arriving with a class-and-subject pair) opens a
 * topic to add material to it.
 */
const ContentDetailScreen = ({ navigation, route }: any) => {
  const combo: TeacherCombo | undefined = route?.params?.combo;
  const subjectId: number | undefined = route?.params?.subjectId;
  const subjectName: string = combo?.subjectName ?? route?.params?.subjectName ?? 'Subject';
  const teacher = !!combo;

  const openTopic = (chapter: SyllabusChapter, topic: SyllabusTopic) =>
    navigation.navigate(teacher ? 'EditTopicContent' : 'ViewContent', {
      topic,
      chapterName: chapter.name,
      subjectName,
    });

  return (
    <OutlineScreen
      navigation={navigation}
      headerTitle="Study Content"
      title={subjectName}
      subtitle={combo ? comboClass(combo) : null}
      image={combo ? combo.subjectImage : route?.params?.subjectImage}
      fetchChapters={() => (combo ? comboChapters(combo) : getChapters({ subject_id: subjectId }))}
      summaryExtra={materialSummary}
      emptyChapters={
        teacher
          ? {
              title: 'No chapters yet',
              subtitle: 'Add chapters and topics on the Syllabus screen, then add material to each topic here.',
            }
          : {
              title: 'No content yet',
              subtitle: `Study material for ${subjectName} will appear here once your teacher adds it.`,
            }
      }
      renderTopics={(chapter, number) =>
        chapter.topics.map((topic, i) => {
          const ready = hasMaterial(topic);
          // A student has nothing to open in an empty topic, and is told so;
          // a teacher opens it to fill it.
          return (
            <TopicLine
              key={topic.id}
              label={`${number}.${i + 1}`}
              name={topic.name}
              muted={!teacher && !ready}
              onPress={teacher || ready ? () => openTopic(chapter, topic) : undefined}
              right={
                ready ? (
                  <View style={s.right}>
                    <MaterialMarks topic={topic} />
                    <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={14} color={theme.colors.textMuted} />
                  </View>
                ) : teacher ? (
                  <Text style={s.add}>Add</Text>
                ) : (
                  <Text style={s.nothing}>Nothing yet</Text>
                )
              }
            />
          );
        })
      }
    />
  );
};

export default ContentDetailScreen;

const __mk_s = () => StyleSheet.create({
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  add: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  nothing: { fontSize: 12, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

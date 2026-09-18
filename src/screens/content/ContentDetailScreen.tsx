import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { SkeletonIcon, SkeletonText } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import {
  getChapters,
  type SyllabusChapter,
  type SyllabusTopic,
  type TeacherCombo,
} from '../../api/contentApi';
import { OutlineScreen, TopicLine, comboChapters, comboClass } from '../subjects/outlineUi';
import { MaterialMarks, SAMPLE_CHAPTERS, hasMaterial, materialSummary } from './contentUi';

/**
 * One subject's study material, laid out like its syllabus, a hairline between
 * topics. A topic with material opens to be read — for a teacher (arriving with
 * a class-and-subject pair) with an edit button in the header; a teacher opens
 * an empty topic straight onto adding its material. While it loads, the page
 * draws itself as a skeleton from the chapters and topics it held last time on
 * this phone (or ordinary ones before that), under the subject's own name.
 */
const ContentDetailScreen = ({ navigation, route }: any) => {
  const combo: TeacherCombo | undefined = route?.params?.combo;
  const subjectId: number | undefined = route?.params?.subjectId;
  const subjectName: string = combo?.subjectName ?? route?.params?.subjectName ?? 'Subject';
  const teacher = !!combo;

  const openTopic = (chapter: SyllabusChapter, topic: SyllabusTopic) =>
    navigation.navigate(hasMaterial(topic) ? 'ViewContent' : 'EditTopicContent', {
      topic,
      chapterName: chapter.name,
      subjectName,
      canEdit: teacher,
    });

  return (
    <OutlineScreen
      navigation={navigation}
      headerTitle="Study Content"
      title={subjectName}
      subtitle={combo ? comboClass(combo) : null}
      image={combo ? combo.subjectImage : route?.params?.subjectImage}
      fetchChapters={() => (combo ? comboChapters(combo) : getChapters({ subject_id: subjectId }))}
      keep={{ name: `content:${combo ? combo.key : subjectId}`, sample: SAMPLE_CHAPTERS }}
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
      renderTopics={(chapter, number, skeleton) =>
        chapter.topics.map((topic, i) => {
          const ready = hasMaterial(topic);
          if (skeleton) {
            return (
              <TopicLine
                key={topic.id}
                label={`${number}.${i + 1}`}
                name={topic.name}
                divider={i < chapter.topics.length - 1}
                skeleton
                right={
                  ready ? (
                    <View style={s.right}>
                      <MaterialMarks topic={topic} skeleton />
                      <SkeletonIcon iconName="chevron-forward" size={14} />
                    </View>
                  ) : (
                    <SkeletonText style={teacher ? s.add : s.nothing}>{teacher ? 'Add' : 'Nothing yet'}</SkeletonText>
                  )
                }
              />
            );
          }
          // A student has nothing to open in an empty topic, and is told so;
          // a teacher opens it to fill it.
          return (
            <TopicLine
              key={topic.id}
              label={`${number}.${i + 1}`}
              name={topic.name}
              muted={!teacher && !ready}
              divider={i < chapter.topics.length - 1}
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

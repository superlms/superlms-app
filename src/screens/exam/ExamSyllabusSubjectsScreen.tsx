import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { SubjectRow } from '../subjects/subjectLists';
import { plural } from '../subjects/subjectsUi';
import {
  getExamSyllabusGroups,
  examErrorMessage,
  syllabusClassLabel,
  type ApiSyllabusGroup,
} from '../../api/examApi';
import type { Exam } from './examData';
import { Words } from './examUi';

/**
 * Exam Syllabus, step two: the subjects the exam covers, as the Subjects list
 * draws them — a student's class, or each of a teacher's classes and
 * subjects — each with how many chapters and topics it takes in. A subject
 * opens its chapters (ExamSyllabusChapters).
 *
 * A load — the first, a pull to refresh, Try again — draws the page as a
 * skeleton from the subjects it shows, those this exam had last time, those of
 * the last exam opened, or ordinary ones.
 */

export const groupKey = (g: ApiSyllabusGroup) => `${g.standard_id}-${g.section_id ?? 0}-${g.subject_id}`;

// "4 chapters · 12 topics"
export const groupSize = (g: ApiSyllabusGroup) => {
  const topics = g.chapters.reduce((sum, c) => sum + (c.topics?.length ?? 0), 0);
  return [plural(g.chapters.length, 'chapter'), topics > 0 ? plural(topics, 'topic') : null]
    .filter(Boolean)
    .join(' · ');
};

const sampleGroup = (id: number, subject: string, chapters: string[][]): ApiSyllabusGroup => ({
  standard_id: -1,
  standard_name: 'Class 6',
  section_id: -1,
  section_name: 'A',
  subject_id: -id,
  subject_name: subject,
  subject_image: null,
  chapter_count: chapters.length,
  chapters: chapters.map(([name, ...topics], i) => ({
    id: -(id * 10 + i),
    name,
    description: null,
    order: i + 1,
    topics: topics.map((t, j) => ({ id: -(id * 100 + i * 10 + j), topic_name: t })),
  })),
});

// Ordinary subjects, for an exam never opened on this phone.
export const SAMPLE_GROUPS: ApiSyllabusGroup[] = [
  sampleGroup(1, 'English', [['Reading Comprehension', 'Unseen passage', 'Vocabulary'], ['Grammar', 'Tenses', 'Articles']]),
  sampleGroup(2, 'Mathematics', [['Numbers', 'Place value', 'Comparing numbers'], ['Geometry', 'Lines and angles', 'Shapes']]),
  sampleGroup(3, 'Science', [['Food and Health', 'Nutrients', 'Balanced diet'], ['Materials', 'Solids and liquids']]),
  sampleGroup(4, 'Social Science', [['Our Earth', 'Maps and globes', 'Landforms']]),
];

export const isGroupList = (v: ApiSyllabusGroup[] | null | undefined): v is ApiSyllabusGroup[] =>
  Array.isArray(v) && v.every(g => Array.isArray(g?.chapters));

const ExamSyllabusSubjectsScreen = ({ navigation, route }: any) => {
  const exam: Exam = route.params.exam;
  const teacher = !!route.params?.teacher;
  const who = teacher ? 'teacher' : 'student';

  const [groups, setGroups] = useState<ApiSyllabusGroup[] | null>(null);
  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back to the screen updates it in place.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastHere, rememberHere] = useLastLoaded<ApiSyllabusGroup[]>(`exam-syllabus:${who}:${exam.id}`);
  const [lastAny, rememberAny] = useLastLoaded<ApiSyllabusGroup[]>(`exam-syllabus:${who}`);

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const next = await getExamSyllabusGroups(exam.id);
        setGroups(next);
        rememberHere(next);
        if (next.length > 0) rememberAny(next);
      } catch (e: any) {
        console.log('[getExamSyllabusGroups] Error:', e?.response?.status, e?.message);
        setError(examErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [exam.id, rememberHere, rememberAny],
  );

  const reload = useCallback(() => load(true), [load]);

  useFocusLoad(() => load());

  // What the page is drawn from: while loading, what it last showed.
  const shown: ApiSyllabusGroup[] | null = loading
    ? groups ?? (isGroupList(lastHere) ? lastHere : isGroupList(lastAny) ? lastAny : SAMPLE_GROUPS)
    : groups;

  const renderPage = (list: ApiSyllabusGroup[], skeleton: boolean) => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[s.list, list.length === 0 && s.grow]}
      // The skeleton stands in for the spinner.
      refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
    >
      {list.length === 0 ? (
        <DocNoData
          icon="book-outline"
          title="No syllabus yet"
          subtitle={
            teacher
              ? 'What this exam covers in your subjects will appear here once the school sets it.'
              : 'What this exam covers will appear here once the school sets it.'
          }
          skeleton={skeleton}
        />
      ) : (
        <>
          <Words skeleton={skeleton} style={s.count}>
            {plural(list.length, 'subject')}
          </Words>
          {list.map((g, i) => (
            <SubjectRow
              key={groupKey(g)}
              image={g.subject_image}
              title={g.subject_name || 'Subject'}
              meta={[teacher ? syllabusClassLabel(g) : null, groupSize(g)].filter(Boolean).join(' · ')}
              isLast={i === list.length - 1}
              skeleton={skeleton}
              onPress={() => navigation.navigate('ExamSyllabusChapters', { exam, group: g, teacher })}
            />
          ))}
        </>
      )}
    </ScrollView>
  );

  const renderBody = () => {
    if (loading && shown) return renderPage(shown, true);

    if (!groups) {
      return (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error ?? 'Something went wrong. Please try again.'}</Text>
          <TouchableOpacity onPress={reload} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return renderPage(groups, false);
  };

  return (
    <View style={s.root}>
      <DocHeader title={exam.name} onBackPress={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};

export default ExamSyllabusSubjectsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  grow: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, marginTop: 12, marginBottom: 2 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

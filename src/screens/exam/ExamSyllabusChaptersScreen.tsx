import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { SubjectIcon } from '../subjects/subjectIcon';
import { ChapterRow } from '../subjects/outlineUi';
import type { SyllabusChapter } from '../../api/contentApi';
import {
  getExamSyllabusGroups,
  examErrorMessage,
  syllabusClassLabel,
  type ApiSyllabusChapter,
  type ApiSyllabusGroup,
} from '../../api/examApi';
import type { Exam } from './examData';
import { Words } from './examUi';
import { groupKey, groupSize } from './ExamSyllabusSubjectsScreen';

/**
 * Exam Syllabus, step three: the chapters one subject's exam covers, laid out
 * as Syllabus lays a subject out — its icon, name and size, then the chapters
 * numbered on hairlines, each opening onto its topics.
 *
 * Route params:
 *   exam    – the exam
 *   group   – the class, section and subject, with its chapters, from step two
 *   teacher – true for a teacher, whose page names the class
 *
 * A load — the first, a pull to refresh, Try again — draws the page as a
 * skeleton from the chapters it shows (on the first, those step two passed).
 */

const toChapter = (c: ApiSyllabusChapter): SyllabusChapter => ({
  id: c.id,
  name: c.name,
  description: c.description,
  order: c.order,
  topics: (c.topics ?? []).map((t, i) => ({ id: t.id, name: t.topic_name, order: i })),
});

const ExamSyllabusChaptersScreen = ({ navigation, route }: any) => {
  const exam: Exam = route.params.exam;
  const passed: ApiSyllabusGroup = route.params.group;
  const teacher = !!route.params?.teacher;

  const [group, setGroup] = useState<ApiSyllabusGroup | null>(null);
  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back to the screen updates it in place.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Every chapter starts closed; the reader opens the ones they want.
  const [openIds, setOpenIds] = useState<number[]>([]);

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const list = await getExamSyllabusGroups(exam.id, passed.subject_id);
        const same = list.find(g => groupKey(g) === groupKey(passed));
        // Gone from the exam since: nothing left to list.
        setGroup(same ?? { ...passed, chapter_count: 0, chapters: [] });
      } catch (e: any) {
        console.log('[getExamSyllabusGroups] Error:', e?.response?.status, e?.message);
        setError(examErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [exam.id, passed],
  );

  const reload = useCallback(() => load(true), [load]);

  useFocusLoad(() => load());

  const toggle = (id: number) =>
    setOpenIds(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  // While loading: the chapters on screen, or those step two passed along.
  const shown: ApiSyllabusGroup | null = loading ? group ?? passed : group;

  const renderPage = (g: ApiSyllabusGroup, skeleton: boolean) => {
    const chapters = g.chapters.map(toChapter);
    const size = [teacher ? syllabusClassLabel(g) : null, chapters.length ? groupSize(g) : 'No chapters']
      .filter(Boolean)
      .join(' · ');

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, chapters.length === 0 && s.grow]}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {/* The subject, and how much of it the exam takes in */}
        <View style={s.head}>
          {skeleton ? (
            <Skeleton width={39} height={39} radius={8} />
          ) : (
            <SubjectIcon image={g.subject_image} size={39} />
          )}
          <View style={s.headText}>
            <Words skeleton={skeleton} style={s.title}>
              {g.subject_name || 'Subject'}
            </Words>
            <Words skeleton={skeleton} style={s.size}>
              {size}
            </Words>
          </View>
        </View>
        <View style={s.divider} />

        {chapters.length === 0 ? (
          <DocNoData
            icon="albums-outline"
            title="No chapters"
            subtitle="No chapters of this subject are set for this exam."
            skeleton={skeleton}
          />
        ) : (
          <View style={s.list}>
            {chapters.map((chapter, i) => (
              <ChapterRow
                key={chapter.id}
                number={i + 1}
                chapter={chapter}
                open={openIds.includes(chapter.id)}
                onToggle={() => toggle(chapter.id)}
                isLast={i === chapters.length - 1}
                skeleton={skeleton}
              />
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderBody = () => {
    if (loading && shown) return renderPage(shown, true);

    if (!group) {
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

    return renderPage(group, false);
  };

  return (
    <View style={s.root}>
      <DocHeader title={exam.name} onBackPress={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};

export default ExamSyllabusChaptersScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },
  grow: { flexGrow: 1 },

  // Head — as on Syllabus
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
  },
  headText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 29, color: theme.colors.textPrimary },
  size: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },
  divider: { height: 1, backgroundColor: theme.colors.divider },

  // Chapters
  list: { paddingHorizontal: 20 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

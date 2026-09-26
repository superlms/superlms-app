import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeaderIconButton } from '../../components/Header';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { SyllabusChapter as ApiChapter, SyllabusGroup, getSyllabus } from '../../api/adminExamApi';
import type { SyllabusChapter } from '../../api/contentApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { SubjectIcon } from '../subjects/subjectIcon';
import { ChapterRow } from '../subjects/outlineUi';
import { plural } from '../subjects/subjectsUi';
import { ErrorState, classLabel } from './adminExamUi';

/**
 * One exam's syllabus for a class and subject, laid out as the student's Exam
 * Syllabus lays a subject out — its icon, name and size, then the chapters
 * numbered on hairlines, each opening onto its topics — as the panel's view of
 * a syllabus lists them. The pencil opens it to edit; unticking every chapter
 * there removes it.
 *
 * Route params: group – the exam, class, section and subject, from the list.
 */

const toChapter = (c: ApiChapter, i: number): SyllabusChapter => ({
  id: c.id,
  name: c.name,
  description: c.description,
  order: i + 1,
  topics: (c.topics ?? []).map((t, j) => ({ id: c.id * 1000 + j, name: t, order: j })),
});

const AdminExamSyllabusDetailScreen = ({ navigation, route }: any) => {
  const group: SyllabusGroup = route.params.group;

  const [chapters, setChapters] = useState<SyllabusChapter[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openIds, setOpenIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getSyllabus({
        exam_id: group.exam_id,
        standard_id: group.standard_id,
        section_id: group.section_id ?? undefined,
        subject_id: group.subject_id,
      });
      setChapters(res.mode === 'detail' ? res.chapters.map(toChapter) : []);
    } catch (e) {
      setError(apiErr(e, 'Could not load this syllabus.'));
    } finally {
      setLoading(false);
    }
  }, [group]);

  // Coming back from Edit shows the syllabus as saved.
  useFocusLoad(load);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = (id: number) => setOpenIds(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const list = chapters ?? [];
  const topics = list.reduce((n, c) => n + c.topics.length, 0);
  const size = [
    classLabel(group.standard_name, group.section_name),
    chapters ? (list.length ? plural(list.length, 'chapter') : 'No chapters') : plural(group.chapter_count, 'chapter'),
    topics > 0 ? plural(topics, 'topic') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={s.root}>
      <DocHeader
        title={group.exam_name}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeaderIconButton icon="create-outline" onPress={() => navigation.navigate('AdminExamSyllabusForm', { group })} />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, chapters?.length === 0 && s.grow]}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* The subject, its class, and how much of it the exam takes in */}
        <View style={s.head}>
          <SubjectIcon size={39} />
          <View style={s.headText}>
            <Text style={s.title}>{group.subject_name}</Text>
            <Text style={s.size}>{size}</Text>
          </View>
        </View>
        <View style={s.divider} />

        {loading ? (
          <View style={s.list}>
            {Array.from({ length: Math.min(Math.max(group.chapter_count, 3), 8) }, (_, i) => (
              <View key={i} style={[s.skRow, i > 0 && s.skDivider]}>
                <Skeleton width={12} height={15} />
                <View style={s.skBody}>
                  <Skeleton width="60%" height={15} />
                  <Skeleton width="22%" height={12} />
                </View>
              </View>
            ))}
          </View>
        ) : error && !chapters ? (
          <ErrorState message={error} onRetry={load} />
        ) : list.length === 0 ? (
          <DocNoData
            icon="albums-outline"
            title="No chapters"
            subtitle="No syllabus is configured for this exam, class and subject. The pencil picks its chapters."
          />
        ) : (
          <View style={s.list}>
            {list.map((chapter, i) => (
              <ChapterRow
                key={chapter.id}
                number={i + 1}
                chapter={chapter}
                open={openIds.includes(chapter.id)}
                onToggle={() => toggle(chapter.id)}
                isLast={i === list.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default AdminExamSyllabusDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },
  grow: { flexGrow: 1 },

  // Head — as on the student's Exam Syllabus
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  headText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 29, color: theme.colors.textPrimary },
  size: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },
  divider: { height: 1, backgroundColor: theme.colors.divider },

  // Chapters
  list: { paddingHorizontal: 20 },
  skRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  skDivider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  skBody: { flex: 1, gap: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

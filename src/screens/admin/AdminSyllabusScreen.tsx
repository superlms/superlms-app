import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad, useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { apiErr } from '../../utils/filePickers';
import { getAcademicLookups, LookupClass } from '../../api/adminStandardApi';
import { getCurriculumSubjects, CurriculumSubject } from '../../api/adminCurriculumApi';
import {
  OutlineChapter,
  OutlineTopic,
  SyllabusOutline,
  SyllabusStats,
  deleteChapter,
  deleteTopic,
  getSyllabusOutline,
} from '../../api/adminSyllabusApi';
import type { SyllabusChapter } from '../../api/contentApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { useChapters } from '../subjects/useChapters';
import { ChapterOutline, TopicLine } from '../subjects/outlineUi';
import { confirmDestructive, OptionSheet } from './adminFormUi';
import { DropPill } from './adminTransportUi';
import type { CurriculumSelection } from './AdminCurriculumFilter';

/**
 * The school's Syllabus, as the admin panel keeps it and a teacher's Manage
 * Syllabus draws it. A class, a section (or all of them) and a subject the
 * class is taught are picked from the pills; the subject then opens as its
 * outline — every chapter it has, in order, each opening onto its topics.
 *
 * The + in the header opens the subject's chapters as one set to add to,
 * rename, reorder or take off, as the panel's chapter manager does; an open
 * chapter's Topics does the same for its topics. A topic is shown, renamed or
 * removed from its own row, and a chapter edited on its own or removed.
 */

const TITLE = 'Syllabus';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The outline as the shared chapter rows read it.
const asChapters = (list: OutlineChapter[]): SyllabusChapter[] =>
  list.map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    order: c.order,
    topics: c.topics.map(t => ({ id: t.id, name: t.name, order: t.order })),
  }));

const AdminSyllabusScreen = ({ navigation }: any) => {
  const [classes, setClasses] = useState<LookupClass[]>([]);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [standardId, setStandardId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<null | 'class' | 'section' | 'subject'>(null);
  const [stats, setStats] = useState<SyllabusStats | null>(null);
  const [subject, setSubject] = useState<SyllabusOutline['subject']>(null);
  const [raw, setRaw] = useState<OutlineChapter[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const pickedRef = useRef({ standardId, sectionId, subjectId });
  pickedRef.current = { standardId, sectionId, subjectId };

  useEffect(() => {
    getAcademicLookups()
      .then(r => setClasses(r.classes ?? []))
      .catch(() => setClasses([]));
  }, []);

  const outline = useChapters(async () => {
    const p = pickedRef.current;
    const d = await getSyllabusOutline({ standard_id: p.standardId, section_id: p.sectionId, subject_id: p.subjectId });
    setStats(d.stats);
    setSubject(d.subject);
    setRaw(d.chapters ?? []);
    return asChapters(d.chapters ?? []);
  });
  const { refreshing, onRefresh } = useRefresh(outline.load);

  // Back from a manager, the outline shows what was saved.
  useFocusLoad(outline.load);

  const reload = useCallback(() => {
    outline.setChapters(null);
    outline.load();
  }, [outline]);

  const cls = classes.find(c => c.id === standardId) ?? null;
  const sec = cls?.sections.find(x => x.id === sectionId) ?? null;
  const sub = subjects.find(x => x.id === subjectId) ?? null;
  const picked = !!standardId && !!subjectId;

  const loadSubjects = async (std: number, section: number | null) => {
    try {
      setSubjects(await getCurriculumSubjects(std, section));
    } catch {
      setSubjects([]);
    }
  };

  const pickClass = (id: number) => {
    setStandardId(id);
    setSectionId(null);
    setSubjectId(null);
    setSubjects([]);
    pickedRef.current = { standardId: id, sectionId: null, subjectId: null };
    loadSubjects(id, null);
    reload();
  };

  const pickSection = (id: number | null) => {
    setSectionId(id);
    setSubjectId(null);
    setSubjects([]);
    pickedRef.current = { standardId, sectionId: id, subjectId: null };
    if (standardId) loadSubjects(standardId, id);
    reload();
  };

  const pickSubject = (id: number) => {
    setSubjectId(id);
    pickedRef.current = { standardId, sectionId, subjectId: id };
    reload();
  };

  const sel: CurriculumSelection = {
    standardId,
    sectionId,
    subjectId,
    standardName: cls?.name,
    sectionName: sec?.name,
    subjectName: subject?.name ?? sub?.name,
  };

  // The + in the header: the subject's chapters as one set, as the panel's manager opens them.
  const manageChapters = () => {
    if (!picked) return AppAlert.alert('Select subject', 'Pick a class and subject first.');
    navigation.navigate('AdminSyllabusChapterForm', { sel, chapters: raw });
  };

  const manageTopics = (chapterId: number) => {
    const c = raw.find(x => x.id === chapterId);
    if (!c) return;
    navigation.navigate('AdminSyllabusTopicForm', { chapterId: c.id, chapterName: c.name, topics: c.topics });
  };

  const editChapter = (chapterId: number) => {
    const c = raw.find(x => x.id === chapterId);
    if (c) navigation.navigate('AdminSyllabusChapterForm', { chapter: c });
  };

  const removeChapter = (c: SyllabusChapter) =>
    confirmDestructive('Delete chapter?', `"${quietCaps(c.name)}" and its topics will be removed.`, 'Delete', async () => {
      setBusyId(c.id);
      try {
        await deleteChapter(c.id);
        await outline.load();
      } catch (e) {
        AppAlert.alert('Not deleted', apiErr(e, 'Could not delete this chapter.'));
      } finally {
        setBusyId(null);
      }
    });

  // A topic's own row: where it sits, as the panel's View shows it.
  const viewTopic = (c: SyllabusChapter, t: { name: string }) =>
    AppAlert.alert(
      quietCaps(t.name),
      [
        cls ? `${cls.name}${sec ? ` / ${sec.name}` : ''}` : null,
        subject?.name ?? sub?.name,
        quietCaps(c.name),
      ]
        .filter(Boolean)
        .join(' · '),
    );

  const editTopic = (t: OutlineTopic | { id: number; name: string }) =>
    navigation.navigate('AdminSyllabusTopicForm', { topic: { id: t.id, name: t.name } });

  const removeTopic = (t: { id: number; name: string }) =>
    confirmDestructive('Delete topic?', `"${quietCaps(t.name)}" will be removed.`, 'Delete', async () => {
      try {
        await deleteTopic(t.id);
        await outline.load();
      } catch (e) {
        AppAlert.alert('Not deleted', apiErr(e, 'Could not delete this topic.'));
      }
    });

  const statLine = stats
    ? [plural(stats.standards, 'class', 'classes'), plural(stats.subjects, 'subject'), plural(stats.chapters, 'chapter'), plural(stats.topics, 'topic')].join(' · ')
    : null;

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightIcon="add"
        onRightPress={manageChapters}
      />

      <View style={s.filters}>
        <DropPill label={cls ? cls.name : 'Class'} active={!!cls} onPress={() => setSheet('class')} />
        {!!cls && cls.sections.length > 0 && (
          <DropPill label={sec ? `Section ${sec.name}` : 'All sections'} active={!!sec} onPress={() => setSheet('section')} />
        )}
        {!!cls && <DropPill label={sub ? sub.name : 'Subject'} active={!!sub} onPress={() => setSheet('subject')} />}
      </View>
      {!!statLine && <Text style={s.stats}>{statLine}</Text>}

      {!picked ? (
        <DocNoData icon="library-outline" title="Pick a class and subject" subtitle="Its chapters and topics show here, to add to and change." />
      ) : outline.chapters !== null && !subject ? (
        <DocNoData icon="library-outline" title="Not taught here" subtitle="This subject isn't taught in the class or section picked." />
      ) : (
        <ChapterOutline
          outline={outline}
          title={subject?.name ?? sub?.name ?? ''}
          subtitle={[cls?.name, sec ? `Section ${sec.name}` : null].filter(Boolean).join(' · ') || null}
          image={subject?.image}
          refreshing={refreshing}
          onRefresh={onRefresh}
          emptyChapters={{ title: 'No chapters yet', subtitle: 'Add them with + above.' }}
          // Every chapter opens here, even an empty one — its topics are managed from inside.
          chapterExpandable={() => true}
          renderTrailing={c => (busyId === c.id ? <ActivityIndicator size="small" color={theme.colors.primary} /> : undefined)}
          renderTopics={(chapter, number) => (
            <>
              {chapter.topics.length === 0 && <Text style={s.noTopics}>No topics yet.</Text>}
              {chapter.topics.map((topic, i) => (
                <React.Fragment key={topic.id}>
                  {i > 0 && <View style={s.topicDivider} />}
                  <TopicLine
                    label={`${number}.${i + 1}`}
                    name={topic.name}
                    onPress={() => viewTopic(chapter, topic)}
                    right={
                      <View style={s.topicActions}>
                        <TouchableOpacity hitSlop={8} activeOpacity={0.6} onPress={() => editTopic(topic)}>
                          <VectorIcon iconSet="Ionicons" iconName="create-outline" size={17} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity hitSlop={8} activeOpacity={0.6} onPress={() => removeTopic(topic)}>
                          <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    }
                  />
                </React.Fragment>
              ))}
              <View style={s.chapterActions}>
                <TouchableOpacity hitSlop={8} activeOpacity={0.6} onPress={() => manageTopics(chapter.id)}>
                  <Text style={s.actionPrimary}>{chapter.topics.length ? 'Topics' : 'Add topics'}</Text>
                </TouchableOpacity>
                <TouchableOpacity hitSlop={8} activeOpacity={0.6} onPress={() => editChapter(chapter.id)}>
                  <Text style={s.action}>Edit chapter</Text>
                </TouchableOpacity>
                <TouchableOpacity hitSlop={8} activeOpacity={0.6} onPress={() => removeChapter(chapter)}>
                  <Text style={s.actionDanger}>Delete</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        />
      )}

      <OptionSheet
        visible={sheet === 'class'}
        title="Class"
        options={classes.map(c => ({ key: String(c.id), label: c.name }))}
        selected={cls ? [String(cls.id)] : []}
        onPick={k => {
          setSheet(null);
          pickClass(Number(k));
        }}
        onClose={() => setSheet(null)}
        emptyText="No classes yet."
      />
      <OptionSheet
        visible={sheet === 'section'}
        title="Section"
        options={[{ key: '', label: 'All sections' }, ...(cls?.sections ?? []).map(x => ({ key: String(x.id), label: `Section ${x.name}` }))]}
        selected={[sec ? String(sec.id) : '']}
        onPick={k => {
          setSheet(null);
          pickSection(k ? Number(k) : null);
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'subject'}
        title="Subject"
        options={subjects.map(x => ({ key: String(x.id), label: x.name }))}
        selected={sub ? [String(sub.id)] : []}
        onPick={k => {
          setSheet(null);
          pickSubject(Number(k));
        }}
        onClose={() => setSheet(null)}
        emptyText="No subjects are taught here yet."
      />
    </View>
  );
};

export default AdminSyllabusScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  stats: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 2 },

  // Inside an open chapter
  noTopics: { fontSize: 13, color: theme.colors.textMuted, paddingVertical: 6 },
  topicActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  topicDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  chapterActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 22, paddingTop: 10 },
  actionPrimary: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  action: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  actionDanger: { fontSize: 13, fontWeight: '500', color: theme.colors.danger },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

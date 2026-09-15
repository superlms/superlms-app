import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader, DocNoData } from '../more/docUi';
import AttachmentPreviewModal from '../announcement/AttachmentPreviewModal';
import {
  getTeacherHomework,
  deleteHomework,
  homeworkErrorMessage,
  type HomeworkItem,
} from '../../api/homeworkApi';
import { getTeacherClassesSubjects } from '../../api/marksApi';
import {
  DateStrip,
  DayHead,
  ErrorBox,
  HOMEWORK_DAYS,
  HomeworkRow,
  RowActions,
  SkeletonList,
  homeworkToDraw,
  periodLabel,
  tasks,
  todayKey,
  useLastHomework,
} from './homeworkUi';
import { AppAlert } from '../../components/AppDialog';

const TITLE = 'Homework';

const TeacherHomeworkScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  // The list on screen came from the school, not a failed load.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noSubjects, setNoSubjects] = useState(false);
  const [selected, setSelected] = useState(todayKey);
  const [preview, setPreview] = useState<string | null>(null);
  const [last, rememberLast] = useLastHomework('teacher');

  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back from Add updates the list in place.
  const load = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    setError(null);
    try {
      const [res, subs] = await Promise.all([
        getTeacherHomework(HOMEWORK_DAYS),
        getTeacherClassesSubjects().catch(() => []),
      ]);
      const list = res?.homeworks ?? [];
      const none = (subs?.length ?? 0) === 0;
      setItems(list);
      setNoSubjects(none);
      setLoaded(true);
      rememberLast({ items: list, noSubjects: none });
    } catch (e: any) {
      console.log('[getTeacherHomework] Error:', e?.response?.status, e?.message);
      setError(homeworkErrorMessage(e));
      setItems([]);
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [rememberLast]);

  const reload = useCallback(() => load(true), [load]);

  // Refetch whenever the screen gains focus (e.g. returning from Add).
  useFocusLoad(load);

  const confirmDelete = (hw: HomeworkItem) => {
    AppAlert.alert('Delete homework', `Remove "${hw.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHomework(hw.id);
            setItems(prev => prev.filter(h => h.id !== hw.id));
          } catch (e: any) {
            AppAlert.alert('Error', homeworkErrorMessage(e));
          }
        },
      },
    ]);
  };

  const marked = useMemo(
    () => new Set(items.map(h => h.assigned_date).filter(Boolean) as string[]),
    [items],
  );

  // While it loads, the page is drawn as a skeleton from the homework it shows
  // — and, before the first load, from whether there were subjects last time.
  const shown = loading ? homeworkToDraw(loaded, items, last, selected) : items;
  const dayItems = shown.filter(h => h.assigned_date === selected);
  const noSubjectsShown = loading && !loaded ? !!last?.noSubjects : noSubjects;

  // "Mathematics · 10th (A)" — the section as its last letter.
  const headingFor = (hw: HomeworkItem) => {
    const letter = hw.section?.trim().slice(-1).toUpperCase();
    return [quietCaps(hw.subject?.name), [hw.standard, letter && `(${letter})`].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(' · ');
  };

  const canAdd = !noSubjectsShown && !error;

  const noSubjectsNote = (skeleton: boolean) => (
    <DocNoData
      icon="book-outline"
      title="No subject assigned"
      subtitle="No classes or subjects are assigned to you in the timetable yet."
      skeleton={skeleton}
    />
  );

  // The chosen day — its heading, then its homework or that there is none.
  const page = (skeleton: boolean) => (
    <>
      <DayHead day={selected} line={dayItems.length > 0 ? tasks(dayItems.length) : null} skeleton={skeleton} />

      {dayItems.length === 0 ? (
        <DocNoData
          icon="create-outline"
          title="No homework"
          subtitle={
            selected === todayKey()
              ? 'Add today’s homework with the + above.'
              : 'Nothing was set on this day.'
          }
          skeleton={skeleton}
        />
      ) : (
        dayItems.map((hw, i) => (
          <HomeworkRow
            key={hw.id}
            hw={hw}
            period={periodLabel(hw)}
            heading={headingFor(hw)}
            isLast={i === dayItems.length - 1}
            onPreviewImage={setPreview}
            skeleton={skeleton}
            trailing={
              <RowActions
                skeleton={skeleton}
                onEdit={() => navigation.navigate('AddHomework', { homework: hw })}
                onDelete={() => confirmDelete(hw)}
              />
            }
          />
        ))
      )}
    </>
  );

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightIcon={canAdd ? 'add' : undefined}
        onRightPress={canAdd ? () => navigation.navigate('AddHomework') : undefined}
      />

      {noSubjectsShown && !error ? (
        loading ? (
          <SkeletonList bare>{noSubjectsNote(true)}</SkeletonList>
        ) : (
          <ScrollView
            contentContainerStyle={s.grow}
            refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
          >
            {noSubjectsNote(false)}
          </ScrollView>
        )
      ) : (
        <>
          <DateStrip selected={selected} onSelect={setSelected} marked={marked} />
          <View style={s.fullDivider} />

          {loading ? (
            <SkeletonList>{page(true)}</SkeletonList>
          ) : error && items.length === 0 ? (
            <ErrorBox message={error} onRetry={reload} />
          ) : (
            <ScrollView
              style={s.fill}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[s.list, dayItems.length === 0 && s.grow]}
              // The skeleton stands in for the spinner.
              refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
            >
              {page(false)}
            </ScrollView>
          )}
        </>
      )}

      <AttachmentPreviewModal
        visible={!!preview}
        accentColor={theme.colors.primary}
        imageUrl={preview ?? undefined}
        onClose={() => setPreview(null)}
      />
    </View>
  );
};

export default TeacherHomeworkScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

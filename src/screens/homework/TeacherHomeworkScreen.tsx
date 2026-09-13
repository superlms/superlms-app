import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
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
  HomeworkSkeleton,
  periodLabel,
  tasks,
  todayKey,
} from './homeworkUi';
import { AppAlert } from '../../components/AppDialog';

const TITLE = 'Homework';

const TeacherHomeworkScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noSubjects, setNoSubjects] = useState(false);
  const [selected, setSelected] = useState(todayKey);
  const [preview, setPreview] = useState<string | null>(null);

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
      setItems(res?.homeworks ?? []);
      setNoSubjects((subs?.length ?? 0) === 0);
    } catch (e: any) {
      console.log('[getTeacherHomework] Error:', e?.response?.status, e?.message);
      setError(homeworkErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
  const dayItems = items.filter(h => h.assigned_date === selected);

  // "Mathematics · 10th (A)" — the section as its last letter.
  const headingFor = (hw: HomeworkItem) => {
    const letter = hw.section?.trim().slice(-1).toUpperCase();
    return [quietCaps(hw.subject?.name), [hw.standard, letter && `(${letter})`].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(' · ');
  };

  const canAdd = !noSubjects && !error;

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightIcon={canAdd ? 'add' : undefined}
        onRightPress={canAdd ? () => navigation.navigate('AddHomework') : undefined}
      />

      {noSubjects && !loading && !error ? (
        <ScrollView
          contentContainerStyle={s.grow}
          refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
        >
          <DocNoData
            icon="book-outline"
            title="No subject assigned"
            subtitle="No classes or subjects are assigned to you in the timetable yet."
          />
        </ScrollView>
      ) : (
        <>
          <DateStrip selected={selected} onSelect={setSelected} marked={marked} />
          <View style={s.fullDivider} />

          {loading ? (
            <HomeworkSkeleton trailing="actions" />
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
              <DayHead day={selected} line={dayItems.length > 0 ? tasks(dayItems.length) : null} />

              {dayItems.length === 0 ? (
                <DocNoData
                  icon="create-outline"
                  title="No homework"
                  subtitle={
                    selected === todayKey()
                      ? 'Add today’s homework with the + above.'
                      : 'Nothing was set on this day.'
                  }
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
                    trailing={
                      <View style={s.actions}>
                        <TouchableOpacity
                          onPress={() => navigation.navigate('AddHomework', { homework: hw })}
                          hitSlop={10}
                          activeOpacity={0.6}
                        >
                          <VectorIcon iconSet="Ionicons" iconName="create-outline" size={17} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDelete(hw)} hitSlop={10} activeOpacity={0.6}>
                          <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    }
                  />
                ))
              )}
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
  // Edit and delete, side by side
  actions: { flexDirection: 'row', gap: 18 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

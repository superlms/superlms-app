import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import AttachmentPreviewModal from '../announcement/AttachmentPreviewModal';
import {
  HomeworkItem,
  HomeworkLookups,
  HwSubject,
  deleteHomework,
  getHomeworkDays,
  getHomeworkLookups,
  getHomeworkSubjects,
  getHomeworks,
} from '../../api/adminHomeworkApi';
import { DateStrip, DayHead, HomeworkRow, RowActions, SkeletonList, tasks, todayKey } from '../homework/homeworkUi';
import { ErrorState, FilterBar, FilterChip, SearchField } from './adminExamUi';
import { OptionSheet, confirmDestructive } from './adminFormUi';
import { HeadBtn } from './adminAdmitCardUi';
import { SAMPLE_ROWS, WINDOW_DAYS, asRowItem, rowHeading } from './adminHomeworkUi';

/**
 * Homework — the panel's Homework tab, drawn as the teacher's Homework is: the
 * last 30 days as dated pills (a dot on a day that has homework), then the
 * chosen day's homework as plain rows — its file, subject and who set it, the
 * title and the task — with edit and delete; a row opens its details.
 *
 * As on the panel, nothing is listed until it knows whose homework it is: the
 * day, a class and a section are the scope (a class with no sections is its
 * whole-class homework), and a subject, a teacher or the search only narrow
 * it. Subject and teacher are two ways of narrowing the same list, so picking
 * a teacher drops the subject; a teacher's homework is what they entered and
 * what was set for the subjects they teach there. A new class clears the
 * section and subject, a new section the subject; the day leaves them all be.
 * + adds homework (for the class and section on screen).
 */

const PER_PAGE = 20;
type Sheet = 'class' | 'section' | 'subject' | 'teacher' | null;

const AdminHomeworkListScreen = ({ navigation }: any) => {
  const [lookups, setLookups] = useState<HomeworkLookups | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [day, setDay] = useState(todayKey);
  const [subjects, setSubjects] = useState<HwSubject[]>([]);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<HomeworkItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState({ current: 1, last: 1 });
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const moreBusy = useRef(false);

  const loadLookups = useCallback(() => {
    setLookupError(null);
    getHomeworkLookups()
      .then(setLookups)
      .catch(e => setLookupError(apiErr(e, 'Could not load the classes.')));
  }, []);
  useEffect(loadLookups, [loadLookups]);

  const classes = lookups?.classes ?? [];
  const teachers = lookups?.teachers ?? [];
  const cls = classes.find(c => c.id === classId) ?? null;
  const sections = cls?.sections ?? [];
  const sec = sections.find(x => x.id === sectionId) ?? null;
  const noSections = !!cls && sections.length === 0;
  const ready = !!cls && (!!sec || noSections);
  const subject = subjects.find(x => x.id === subjectId) ?? null;
  const teacher = teachers.find(x => x.id === teacherId) ?? null;

  // The class's (or the section's) subjects, for the Subject pill.
  useEffect(() => {
    setSubjects([]);
    if (!classId) return;
    let alive = true;
    getHomeworkSubjects(classId, sectionId)
      .then(list => alive && setSubjects(list))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [classId, sectionId]);

  const q = query.trim();
  const filters = useMemo(
    () =>
      classId
        ? {
            standard_id: classId,
            // A class without sections: its whole-class homework.
            section_id: sectionId ?? 0,
            subject_id: subjectId,
            teacher: teacherId,
            search: q || undefined,
          }
        : null,
    [classId, sectionId, subjectId, teacherId, q],
  );

  // The days that have homework under these filters — the strip's dots.
  const loadMarks = useCallback(async () => {
    if (!ready || !filters) return;
    try {
      setMarks(await getHomeworkDays(filters));
    } catch {
      // the strip stays without its dots
    }
  }, [ready, filters]);

  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!ready || !filters) return;
    const mine = ++seq.current;
    setError(null);
    try {
      const list = await getHomeworks({ ...filters, date: day, per_page: PER_PAGE, page: 1 });
      if (mine !== seq.current) return;
      setRows(list.data);
      setTotal(list.pagination?.total ?? list.data.length);
      setPage({ current: list.pagination?.current_page ?? 1, last: list.pagination?.last_page ?? 1 });
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load homework.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [ready, filters, day]);

  // A new scope or day shows the skeleton and asks again; typing waits a moment.
  useEffect(() => {
    setRows(null);
    if (!ready) return;
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, ready, q]);

  useEffect(() => {
    setMarks({});
    if (!ready) return;
    const t = setTimeout(loadMarks, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadMarks, ready, q]);

  // Back from adding, editing or deleting, the list is fresh.
  const loadRef = useRef({ load, loadMarks });
  loadRef.current = { load, loadMarks };
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      loadRef.current.load();
      loadRef.current.loadMarks();
    }, []),
  );

  const loadMore = async () => {
    if (moreBusy.current || !rows || !filters || page.current >= page.last) return;
    const mine = seq.current;
    moreBusy.current = true;
    setLoadingMore(true);
    try {
      const list = await getHomeworks({ ...filters, date: day, per_page: PER_PAGE, page: page.current + 1 });
      if (mine !== seq.current) return;
      setRows(prev => {
        const have = new Set((prev ?? []).map(x => x.id));
        return [...(prev ?? []), ...list.data.filter(x => !have.has(x.id))];
      });
      setPage({ current: list.pagination?.current_page ?? page.current + 1, last: list.pagination?.last_page ?? page.last });
    } catch {
      // The next scroll asks again.
    } finally {
      moreBusy.current = false;
      setLoadingMore(false);
    }
  };

  const remove = (h: HomeworkItem) =>
    confirmDestructive('Delete Homework?', 'This removes the homework and its attachment for good.', 'Delete', async () => {
      try {
        await deleteHomework(h.id);
        setRows(prev => (prev ?? []).filter(x => x.id !== h.id));
        setTotal(n => Math.max(0, n - 1));
        loadMarks();
      } catch (e) {
        AppAlert.alert('Error Deleting Homework', apiErr(e, 'Please try again.'));
      }
    });

  const narrowed = !!(q || classId || sectionId || subjectId || teacherId || day !== todayKey());
  const clearAll = () => {
    setQuery('');
    setClassId(null);
    setSectionId(null);
    setSubjectId(null);
    setTeacherId(null);
    setDay(todayKey());
  };

  const missing = [!cls && 'class', !sec && !noSections && 'section'].filter(Boolean).join(', ');
  const marked = useMemo(() => new Set(ready ? Object.keys(marks) : []), [marks, ready]);

  const sheetProps =
    sheet === 'class'
      ? {
          title: 'Class',
          options: classes.map(c => ({ key: String(c.id), label: c.name })),
          selected: [String(classId ?? '')],
          onPick: (k: string) => {
            setClassId(Number(k));
            setSectionId(null);
            setSubjectId(null);
          },
        }
      : sheet === 'section'
      ? {
          title: 'Section',
          options: sections.map(x => ({ key: String(x.id), label: x.name })),
          selected: [String(sectionId ?? '')],
          onPick: (k: string) => {
            setSectionId(Number(k));
            setSubjectId(null);
          },
        }
      : sheet === 'subject'
      ? {
          title: 'Subject',
          options: [{ key: '', label: 'All Subjects' }, ...subjects.map(x => ({ key: String(x.id), label: x.name }))],
          selected: [String(subjectId ?? '')],
          onPick: (k: string) => setSubjectId(k ? Number(k) : null),
        }
      : {
          title: 'Teacher',
          options: [{ key: '', label: 'All Teachers' }, ...teachers.map(x => ({ key: String(x.id), label: x.name }))],
          selected: [String(teacherId ?? '')],
          onPick: (k: string) => {
            setTeacherId(k ? Number(k) : null);
            // Subject and teacher are never both on.
            if (k) setSubjectId(null);
          },
        };

  const list = rows ?? [];
  const emptyNote = teacherId
    ? "Nothing for this teacher's subjects on this day — try another date, or clear the teacher."
    : q || subjectId
    ? 'Try another subject or search term, or another date.'
    : 'Nothing was set for this class and section on this day.';

  const renderRow = (h: HomeworkItem, i: number, count: number, skeleton = false) => (
    <TouchableOpacity
      key={h.id}
      activeOpacity={0.7}
      disabled={skeleton}
      onPress={() => navigation.navigate('AdminHomeworkDetail', { item: h })}
    >
      <HomeworkRow
        hw={asRowItem(h)}
        heading={rowHeading(h)}
        isLast={i === count - 1}
        onPreviewImage={setPreview}
        skeleton={skeleton}
        trailing={
          <RowActions
            skeleton={skeleton}
            onEdit={() => navigation.navigate('AdminHomeworkForm', { item: h })}
            onDelete={() => remove(h)}
          />
        }
      />
    </TouchableOpacity>
  );

  let body: React.ReactNode;
  if (!lookups && lookupError) {
    body = <ErrorState message={lookupError} onRetry={loadLookups} />;
  } else if (!ready) {
    body = (
      <DocNoData
        icon="options-outline"
        title="Pick a class and a section"
        subtitle={`Still to choose: ${missing || 'class, section'}. Subject and teacher then narrow that day's list.`}
      />
    );
  } else if (rows === null && error) {
    body = <ErrorState message={error} onRetry={load} />;
  } else if (rows === null) {
    body = (
      <SkeletonList>
        <DayHead day={day} line={tasks(SAMPLE_ROWS.length)} skeleton />
        {SAMPLE_ROWS.map((h, i) => renderRow(h, i, SAMPLE_ROWS.length, true))}
      </SkeletonList>
    );
  } else {
    body = (
      <FlatList
        style={s.fill}
        data={list}
        keyExtractor={x => String(x.id)}
        contentContainerStyle={[s.list, list.length === 0 && s.grow]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
              loadMarks();
            }}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={<DayHead day={day} line={total > 0 ? tasks(total) : null} />}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={s.more} color={theme.colors.primary} /> : null}
        ListEmptyComponent={<DocNoData icon="create-outline" title="No homework found" subtitle={emptyNote} />}
        renderItem={({ item, index }) => renderRow(item, index, list.length)}
      />
    );
  }

  return (
    <View style={s.root}>
      <DocHeader
        title="Homework"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeadBtn
            icon="add"
            onPress={() => navigation.navigate('AdminHomeworkForm', { classId, sectionId })}
          />
        }
      />

      <SearchField value={query} onChangeText={setQuery} placeholder="Search title, description, teacher…" />

      <FilterBar onClear={narrowed ? clearAll : undefined}>
        <FilterChip label={cls?.name ?? 'Select class'} active={!!cls} disabled={classes.length === 0} onPress={() => setSheet('class')} />
        <FilterChip
          label={sec ? `Section ${sec.name}` : noSections ? 'No sections' : 'Select section'}
          active={!!sec}
          disabled={!cls || noSections}
          onPress={() => setSheet('section')}
        />
        {!teacherId && (
          <FilterChip label={subject?.name ?? 'All Subjects'} active={!!subject} disabled={!cls} onPress={() => setSheet('subject')} />
        )}
        <FilterChip label={teacher?.name ?? 'All Teachers'} active={!!teacher} disabled={teachers.length === 0} onPress={() => setSheet('teacher')} />
      </FilterBar>

      <DateStrip selected={day} onSelect={setDay} marked={marked} days={WINDOW_DAYS + 1} />
      <View style={s.fullDivider} />

      {body}

      <OptionSheet
        visible={sheet !== null}
        title={sheetProps.title}
        options={sheetProps.options}
        selected={sheetProps.selected}
        onPick={sheetProps.onPick}
        onClose={() => setSheet(null)}
        emptyText={sheet === 'subject' ? 'No subjects are mapped to this class/section.' : undefined}
      />

      <AttachmentPreviewModal
        visible={!!preview}
        accentColor={theme.colors.primary}
        imageUrl={preview ?? undefined}
        onClose={() => setPreview(null)}
      />
    </View>
  );
};

export default AdminHomeworkListScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  more: { paddingVertical: 16 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

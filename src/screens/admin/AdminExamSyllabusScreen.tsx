import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { SyllabusGroup, SyllabusOptions, getSyllabus, getSyllabusOptions } from '../../api/adminExamApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { SubjectRow } from '../subjects/subjectLists';
import { plural } from '../subjects/subjectsUi';
import { OptionSheet } from './adminFormUi';
import { ErrorState, FilterBar, FilterChip, RowsSkeleton, adminExamStyles as ui, classLabel } from './adminExamUi';

/**
 * Exam Syllabus — which chapters each exam covers, class by class and subject
 * by subject. Laid out as the student's syllabus lists are: under each exam,
 * a subject per row with its class and how many chapters it takes in. The
 * panel's filters narrow it, each after the one before it: exam, class,
 * section, subject. A row opens its chapters; + adds a syllabus.
 */

const TITLE = 'Exam Syllabus';

type Sheet = 'exam' | 'class' | 'section' | 'subject' | null;

const NONE = '';

const AdminExamSyllabusScreen = ({ navigation }: any) => {
  const [groups, setGroups] = useState<SyllabusGroup[]>([]);
  const [opt, setOpt] = useState<SyllabusOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [exam, setExam] = useState(NONE);
  const [std, setStd] = useState(NONE);
  const [sec, setSec] = useState(NONE);
  const [sub, setSub] = useState(NONE);
  const [sheet, setSheet] = useState<Sheet>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(
    async (showSkeleton = !loadedOnce.current) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        // The subject is narrowed here rather than asked for: exam, class and
        // subject together would bring one syllabus's chapters, not the list.
        const [res, o] = await Promise.all([
          getSyllabus({
            exam_id: exam ? Number(exam) : undefined,
            standard_id: std ? Number(std) : undefined,
            section_id: sec ? Number(sec) : undefined,
          }),
          getSyllabusOptions({
            standard_id: std ? Number(std) : undefined,
            section_id: sec ? Number(sec) : undefined,
          }),
        ]);
        setGroups(res.mode === 'list' ? res.groups : []);
        setOpt(o);
        loadedOnce.current = true;
      } catch (e) {
        setError(apiErr(e, 'Could not load the exam syllabus.'));
      } finally {
        setLoading(false);
      }
    },
    [exam, std, sec],
  );

  useEffect(() => {
    load(true);
  }, [load]);
  const firstFocus = useRef(true);
  useFocusLoad(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    load(false);
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  // Under each exam in the panel's order (earliest first), classes in their
  // order, then section and subject.
  const sections = useMemo(() => {
    const examOrder = new Map((opt?.exams ?? []).map((e, i) => [e.id, i]));
    const classOrder = new Map((opt?.standards ?? []).map((c, i) => [c.id, i]));
    const list = (sub ? groups.filter(g => String(g.subject_id) === sub) : groups).slice().sort(
      (a, b) =>
        (examOrder.get(a.exam_id) ?? 1e6) - (examOrder.get(b.exam_id) ?? 1e6) ||
        a.exam_id - b.exam_id ||
        (classOrder.get(a.standard_id) ?? 1e6) - (classOrder.get(b.standard_id) ?? 1e6) ||
        (a.section_name ?? '').localeCompare(b.section_name ?? '') ||
        a.subject_name.localeCompare(b.subject_name),
    );
    const out: { examId: number; title: string; data: SyllabusGroup[] }[] = [];
    list.forEach(g => {
      const last = out[out.length - 1];
      if (last && last.examId === g.exam_id) last.data.push(g);
      else out.push({ examId: g.exam_id, title: g.exam_name, data: [g] });
    });
    return out;
  }, [groups, opt, sub]);

  const count = sections.reduce((n, x) => n + x.data.length, 0);
  const narrowed = !!(exam || std || sec || sub);

  const examName = opt?.exams.find(e => String(e.id) === exam)?.exam_name;
  const className = opt?.standards.find(c => String(c.id) === std)?.name;
  const sectionName = opt?.sections.find(c => String(c.id) === sec)?.name;
  const subjectName = opt?.subjects.find(c => String(c.id) === sub)?.name;

  // Each filter clears the ones after it, as on the panel.
  const pickExam = (k: string) => {
    setExam(k);
    setStd(NONE);
    setSec(NONE);
    setSub(NONE);
  };
  const pickClass = (k: string) => {
    setStd(k);
    setSec(NONE);
    setSub(NONE);
  };
  const pickSection = (k: string) => {
    setSec(k);
    setSub(NONE);
  };

  const sheetProps =
    sheet === 'exam'
      ? {
          title: 'Exam',
          options: [
            { key: NONE, label: 'All Exams' },
            ...(opt?.exams ?? []).map(e => ({ key: String(e.id), label: e.exam_name, sub: e.academic_year })),
          ],
          selected: [exam],
          onPick: pickExam,
        }
      : sheet === 'class'
      ? {
          title: 'Class',
          options: [{ key: NONE, label: 'All Classes' }, ...(opt?.standards ?? []).map(c => ({ key: String(c.id), label: c.name }))],
          selected: [std],
          onPick: pickClass,
        }
      : sheet === 'section'
      ? {
          title: 'Section',
          options: [{ key: NONE, label: 'All Sections' }, ...(opt?.sections ?? []).map(c => ({ key: String(c.id), label: c.name }))],
          selected: [sec],
          onPick: pickSection,
        }
      : {
          title: 'Subject',
          options: [{ key: NONE, label: 'All Subjects' }, ...(opt?.subjects ?? []).map(c => ({ key: String(c.id), label: c.name }))],
          selected: [sub],
          onPick: setSub,
        };

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={<HeaderIconButton icon="add" size={22} onPress={() => navigation.navigate('AdminExamSyllabusForm', {})} />}
      />

      <FilterBar onClear={narrowed ? () => pickExam(NONE) : undefined}>
        <FilterChip label={examName ?? 'All Exams'} active={!!exam} onPress={() => setSheet('exam')} />
        <FilterChip label={className ?? 'All Classes'} active={!!std} disabled={!exam} onPress={() => setSheet('class')} />
        <FilterChip label={sectionName ?? 'All Sections'} active={!!sec} disabled={!std} onPress={() => setSheet('section')} />
        <FilterChip label={subjectName ?? 'All Subjects'} active={!!sub} disabled={!sec} onPress={() => setSheet('subject')} />
      </FilterBar>

      {loading ? (
        <RowsSkeleton lead="icon" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : (
        <ScrollView
          style={s.fill}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[ui.list, count === 0 && s.grow]}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {count === 0 ? (
            <DocNoData
              icon="book-outline"
              title="No syllabus configured yet"
              subtitle={
                narrowed
                  ? 'No syllabus matches these filters.'
                  : 'Tap + to choose the chapters for an exam, class, section and subject.'
              }
            />
          ) : (
            <>
              <Text style={s.count}>
                {plural(count, 'subject')} in {plural(sections.length, 'exam')}
              </Text>
              {sections.map(x => (
                <View key={x.examId}>
                  <Text style={s.examHead}>{x.title}</Text>
                  {x.data.map((g, i) => (
                    <SubjectRow
                      key={`${g.standard_id}-${g.section_id ?? 0}-${g.subject_id}`}
                      title={g.subject_name}
                      meta={[classLabel(g.standard_name, g.section_name), plural(g.chapter_count, 'chapter')].join(' · ')}
                      isLast={i === x.data.length - 1}
                      onPress={() => navigation.navigate('AdminExamSyllabusDetail', { group: g })}
                    />
                  ))}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <OptionSheet
        visible={sheet !== null}
        title={sheetProps.title}
        options={sheetProps.options}
        selected={sheetProps.selected}
        onPick={sheetProps.onPick}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminExamSyllabusScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, marginTop: 14 },
  examHead: { paddingTop: 18, paddingBottom: 2, fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

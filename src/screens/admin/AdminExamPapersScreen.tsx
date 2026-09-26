import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  ExamPaper,
  PAPER_SUBJECT_OTHER,
  PaperOptions,
  getExamPapers,
  getPaperOptions,
} from '../../api/adminExamApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { plural } from '../subjects/subjectsUi';
import { OptionSheet } from './adminFormUi';
import { ErrorState, FilterBar, FilterChip, PlainRow, RowsSkeleton, adminExamStyles as ui, classLabel } from './adminExamUi';

/**
 * Exam Papers — the question papers uploaded for the school's exams, newest
 * first, as the panel lists them: each with its exam, class and section,
 * subject (or Other) and the day it was uploaded, drawn as plain rows led by a
 * round icon. The panel's filters narrow them: exam, class, section (once a
 * class is chosen) and subject. A row opens the paper; + uploads one.
 */

const TITLE = 'Exam Papers';

type Sheet = 'exam' | 'class' | 'section' | 'subject' | null;

const NONE = '';

export const paperLines = (p: ExamPaper) => [
  [p.exam_name, classLabel(p.standard_name, p.section_name)].filter(Boolean).join(' · '),
  [p.subject_name, p.created_at ? moment(p.created_at).format('D MMM YYYY') : null].filter(Boolean).join(' · '),
];

const AdminExamPapersScreen = ({ navigation }: any) => {
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [opt, setOpt] = useState<PaperOptions | null>(null);
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
        const [res, o] = await Promise.all([
          getExamPapers({
            exam_id: exam ? Number(exam) : undefined,
            standard_id: std ? Number(std) : undefined,
            section_id: sec ? Number(sec) : undefined,
            subject_id: sub ? (sub === PAPER_SUBJECT_OTHER ? sub : Number(sub)) : undefined,
          }),
          getPaperOptions({
            standard_id: std ? Number(std) : undefined,
            section_id: sec ? Number(sec) : undefined,
          }),
        ]);
        setPapers(res.papers);
        setOpt(o);
        loadedOnce.current = true;
      } catch (e) {
        setError(apiErr(e, 'Could not load the exam papers.'));
      } finally {
        setLoading(false);
      }
    },
    [exam, std, sec, sub],
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

  const narrowed = !!(exam || std || sec || sub);
  const clearAll = () => {
    setExam(NONE);
    setStd(NONE);
    setSec(NONE);
    setSub(NONE);
  };

  // The class clears its section and subject; the section clears the subject.
  const pickClass = (k: string) => {
    setStd(k);
    setSec(NONE);
    setSub(NONE);
  };
  const pickSection = (k: string) => {
    setSec(k);
    setSub(NONE);
  };

  const examName = opt?.exams.find(e => String(e.id) === exam)?.exam_name;
  const className = opt?.standards.find(c => String(c.id) === std)?.name;
  const sectionName = opt?.sections.find(c => String(c.id) === sec)?.name;
  const subjectName = sub === PAPER_SUBJECT_OTHER ? 'Other' : opt?.subjects.find(c => String(c.id) === sub)?.name;

  const sheetProps =
    sheet === 'exam'
      ? {
          title: 'Exam',
          options: [
            { key: NONE, label: 'All Exams' },
            ...(opt?.exams ?? []).map(e => ({ key: String(e.id), label: e.exam_name, sub: e.academic_year })),
          ],
          selected: [exam],
          onPick: setExam,
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
          options: [
            { key: NONE, label: 'All Subjects' },
            ...(opt?.subjects ?? []).map(c => ({ key: String(c.id), label: c.name })),
            { key: PAPER_SUBJECT_OTHER, label: 'Other' },
          ],
          selected: [sub],
          onPick: setSub,
        };

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={<HeaderIconButton icon="add" size={22} onPress={() => navigation.navigate('AdminExamPaperForm', {})} />}
      />

      <FilterBar onClear={narrowed ? clearAll : undefined}>
        <FilterChip label={examName ?? 'All Exams'} active={!!exam} onPress={() => setSheet('exam')} />
        <FilterChip label={className ?? 'All Classes'} active={!!std} onPress={() => setSheet('class')} />
        <FilterChip label={sectionName ?? 'All Sections'} active={!!sec} disabled={!std} onPress={() => setSheet('section')} />
        <FilterChip label={subjectName ?? 'All Subjects'} active={!!sub} onPress={() => setSheet('subject')} />
      </FilterBar>

      {loading ? (
        <RowsSkeleton lead="icon" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : (
        <ScrollView
          style={s.fill}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[ui.list, papers.length === 0 && s.grow]}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {papers.length === 0 ? (
            <DocNoData
              icon="document-text-outline"
              title="No exam papers uploaded"
              subtitle={narrowed ? 'No paper matches these filters.' : 'Tap + to upload a question paper for an exam.'}
            />
          ) : (
            <>
              <Text style={s.count}>{plural(papers.length, 'paper')}</Text>
              {papers.map((p, i) => (
                <PlainRow
                  key={p.id}
                  icon="document-text-outline"
                  title={p.title}
                  lines={paperLines(p)}
                  isLast={i === papers.length - 1}
                  onPress={() => navigation.navigate('AdminExamPaperDetail', { paper: p })}
                />
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

export default AdminExamPapersScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, marginTop: 14, marginBottom: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

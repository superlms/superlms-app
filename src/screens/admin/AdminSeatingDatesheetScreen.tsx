import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AdminDatesheet, datesheetPdfUrl, deleteDatesheet, getDatesheet } from '../../api/adminSeatingApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { ErrorState, FilterBar, FilterChip, RowsSkeleton, adminExamStyles as ui } from './adminExamUi';
import { HeadActions, HeadBtn } from './adminAdmitCardUi';
import { OptionSheet, QuietAction, confirmDestructive } from './adminFormUi';
import { DatesheetPaperRow, plural, useSeatingLookups } from './adminSeatingUi';

/**
 * Datesheet — the panel's Datesheet tab: an exam, a class and a section, and
 * only then a sheet — the section's own, else the class-wide one it inherits —
 * its papers by date as a student's date sheet draws them; a subject narrows it
 * to that paper. The header prints it (the panel's Print, as a PDF), edits it
 * and creates one (starting from the filters); Delete sits at the foot.
 *
 * Route params: examId, standardId, sectionId – the sheet just saved.
 */

type SheetKey = 'exam' | 'class' | 'section' | 'subject' | null;

const AdminSeatingDatesheetScreen = ({ navigation, route }: any) => {
  const lookups = useSeatingLookups();

  const [examId, setExamId] = useState<number | null>(null);
  const [standardId, setStandardId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetKey>(null);

  const [datesheet, setDatesheet] = useState<AdminDatesheet | null>(null);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // The sheet just saved: the filters point at it, so it is on screen. A
  // class-wide sheet keeps the section picked, if it is of the same class.
  const saved = route?.params;
  const standardNow = useRef(standardId);
  standardNow.current = standardId;
  useEffect(() => {
    if (!saved?.examId) return;
    const sameClass = standardNow.current === saved.standardId;
    setExamId(saved.examId);
    setStandardId(saved.standardId);
    if (saved.sectionId) setSectionId(saved.sectionId);
    else if (!sameClass) setSectionId(null);
    setSubjectId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.at]);

  const load = useCallback(
    async (showSkeleton = true) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const res = await getDatesheet({ exam_id: examId, standard_id: standardId, section_id: sectionId, subject_id: subjectId });
        setDatesheet(res.datesheet);
        setSubjects(res.subjects);
        setTotal(res.total);
      } catch (e) {
        setError(apiErr(e, 'Could not load the datesheet.'));
      } finally {
        setLoading(false);
      }
    },
    [examId, standardId, sectionId, subjectId],
  );

  useEffect(() => {
    load(true);
  }, [load]);
  // Back from the form: the sheet as it now is.
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

  const exams = lookups?.exams ?? [];
  const standards = lookups?.standards ?? [];
  const sections = (lookups?.sections ?? []).filter(x => x.standard_id === standardId);
  const exam = exams.find(e => e.id === examId);
  const standard = standards.find(c => c.id === standardId);
  const section = sections.find(x => x.id === sectionId);
  const subject = subjects.find(x => x.id === subjectId);
  const picked = !!(examId && standardId && sectionId);

  const clear = () => {
    setExamId(null);
    setStandardId(null);
    setSectionId(null);
    setSubjectId(null);
  };

  // "Create" starts from whatever the filters point at.
  const create = () => navigation.navigate('AdminSeatingDatesheetForm', { examId, standardId, sectionId });
  const edit = () => datesheet && navigation.navigate('AdminSeatingDatesheetForm', { datesheetId: datesheet.id });
  const print = () =>
    datesheet &&
    navigation.navigate('AdminSeatingPdf', {
      title: 'Datesheet',
      uri: datesheetPdfUrl(datesheet.id, { subject: subjectId, section: sectionId }),
      fileName: `datesheet_${(datesheet.standard_name ?? '').replace(/[^A-Za-z0-9_-]+/g, '_')}_${section?.name ?? ''}`,
    });

  const remove = () =>
    datesheet &&
    confirmDestructive(
      'Delete datesheet?',
      'Every paper on this sheet goes with it. Admit cards already issued keep their own copy.',
      'Delete',
      async () => {
        setDeleting(true);
        try {
          await deleteDatesheet(datesheet.id);
          await load(false);
        } catch (e) {
          AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
        } finally {
          setDeleting(false);
        }
      },
    );

  const createLink = (
    <TouchableOpacity style={s.emptyAction} onPress={create} hitSlop={10}>
      <Text style={s.linkText}>Create a datesheet</Text>
    </TouchableOpacity>
  );

  const papers = datesheet?.papers ?? [];
  const showShift = papers.some(p => (p.shift || 1) > 1);
  const sectionLabel = datesheet?.section_name ?? section?.name;

  return (
    <View style={s.root}>
      <DocHeader
        title="Datesheet"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeadActions>
            {!!datesheet && <HeadBtn icon="print-outline" onPress={print} />}
            {!!datesheet && <HeadBtn icon="create-outline" onPress={edit} />}
            <HeadBtn icon="add" onPress={create} />
          </HeadActions>
        }
      />

      <FilterBar onClear={examId || standardId || sectionId || subjectId ? clear : undefined}>
        <FilterChip label={exam?.exam_name ?? 'Exam'} active={!!examId} onPress={() => setSheet('exam')} />
        <FilterChip label={standard?.name ?? 'Class'} active={!!standardId} disabled={!examId} onPress={() => setSheet('class')} />
        <FilterChip
          label={section ? `Section ${section.name}` : 'Section'}
          active={!!sectionId}
          disabled={!standardId}
          onPress={() => setSheet('section')}
        />
        <FilterChip
          label={subject?.name ?? 'All subjects'}
          active={!!subjectId}
          disabled={subjects.length === 0}
          onPress={() => setSheet('subject')}
        />
      </FilterBar>

      {loading ? (
        <RowsSkeleton lead="date" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : (
        <ScrollView
          style={s.fill}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[ui.list, !datesheet && s.grow]}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {!picked ? (
            <View>
              <DocNoData
                icon="calendar-outline"
                title="Pick an exam, a class and a section"
                subtitle="The datesheet appears once a section is chosen."
              />
              {total === 0 && createLink}
            </View>
          ) : !datesheet ? (
            <View>
              <DocNoData
                icon="calendar-outline"
                title="No datesheet for this section yet"
                subtitle="Neither the section nor the class has one for this exam."
              />
              {createLink}
            </View>
          ) : (
            <>
              {/* Whose sheet, and how many papers */}
              <View style={s.intro}>
                <Text style={s.introTitle} numberOfLines={2}>
                  {`${datesheet.exam_name ?? 'Exam'} · ${datesheet.standard_name ?? ''}${sectionLabel ? ` — ${sectionLabel}` : ''}`}
                </Text>
                <Text style={s.introMeta}>
                  {[
                    plural(papers.length, 'paper'),
                    datesheet.class_wide ? 'class-wide sheet' : null,
                    subjectId ? 'filtered to one subject' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>

              {papers.length === 0 ? (
                <Text style={s.none}>No paper for this subject on the sheet.</Text>
              ) : (
                papers.map((p, i) => (
                  <DatesheetPaperRow key={p.id ?? p.subject_id} paper={p} showShift={showShift} isLast={i === papers.length - 1} />
                ))
              )}

              <View style={s.foot}>
                <QuietAction icon="trash-2" label="Delete datesheet" danger busy={deleting} onPress={remove} />
              </View>
            </>
          )}
        </ScrollView>
      )}

      <OptionSheet
        visible={sheet === 'exam'}
        title="Exam"
        options={exams.map(e => ({ key: String(e.id), label: e.exam_name, sub: e.academic_year ?? undefined }))}
        selected={examId ? [String(examId)] : []}
        onPick={k => {
          setExamId(Number(k));
          setSubjectId(null);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        emptyText="No exams yet."
      />
      <OptionSheet
        visible={sheet === 'class'}
        title="Class"
        options={standards.map(c => ({ key: String(c.id), label: c.name }))}
        selected={standardId ? [String(standardId)] : []}
        onPick={k => {
          setStandardId(Number(k));
          setSectionId(null);
          setSubjectId(null);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        emptyText="No classes yet."
      />
      <OptionSheet
        visible={sheet === 'section'}
        title="Section"
        options={sections.map(x => ({ key: String(x.id), label: `Section ${x.name}` }))}
        selected={sectionId ? [String(sectionId)] : []}
        onPick={k => {
          setSectionId(Number(k));
          setSubjectId(null);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        emptyText="This class has no sections."
      />
      <OptionSheet
        visible={sheet === 'subject'}
        title="Subject"
        options={[{ key: 'all', label: 'All subjects' }, ...subjects.map(x => ({ key: String(x.id), label: x.name }))]}
        selected={[subjectId ? String(subjectId) : 'all']}
        onPick={k => {
          setSubjectId(k === 'all' ? null : Number(k));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminSeatingDatesheetScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  emptyAction: { alignSelf: 'center', marginTop: 16 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  // The sheet's class and how many papers, as a student's date sheet heads it
  intro: {
    paddingTop: 16,
    paddingBottom: 14,
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  introTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  introMeta: { fontSize: 13, color: theme.colors.textSecondary },
  none: { fontSize: 14, color: theme.colors.textMuted, paddingVertical: 20, textAlign: 'center' },
  foot: { paddingTop: 18, borderTopWidth: 1, borderTopColor: theme.colors.border },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

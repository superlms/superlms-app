import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DatesheetFormRow, getDatesheetForm, saveDatesheet } from '../../api/adminSeatingApi';
import { DocHeader } from '../more/docUi';
import { DateSheet, FormError, Hint, OptionSheet, PickerCard, Segment, SubmitButton, TimeSheet, clock12 } from './adminFormUi';
import { longDay, useSeatingLookups } from './adminSeatingUi';

/**
 * Create / Edit Datesheet, as the panel's datesheet panel has it: an exam and a class,
 * a section or all of them, and then each of the class's (or section's)
 * subjects with its date, start and end time and shift — a subject left
 * without a date is skipped. One class cannot sit two papers at once: the
 * server checks the form and every sheet the class already has, as the panel
 * does, and names the clash. Saved, the sheet replaces what was there.
 *
 * Route params: datesheetId (edit), or examId, standardId, sectionId (to start from).
 */

type Picking = { i: number; field: 'date' | 'start' | 'end' } | null;
type SheetKey = 'exam' | 'class' | 'section' | null;

const SHIFTS: { key: '1' | '2'; label: string }[] = [
  { key: '1', label: 'Shift 1' },
  { key: '2', label: 'Shift 2' },
];

const ALL_SECTIONS = 'all';

const AdminSeatingDatesheetFormScreen = ({ navigation, route }: any) => {
  const lookups = useSeatingLookups();
  const editId: number | null = route?.params?.datesheetId ?? null;
  const isEdit = !!editId;

  const [examId, setExamId] = useState<number | null>(route?.params?.examId ?? null);
  const [standardId, setStandardId] = useState<number | null>(route?.params?.standardId ?? null);
  const [sectionId, setSectionId] = useState<number | null>(route?.params?.sectionId ?? null);
  const [rows, setRows] = useState<DatesheetFormRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [pick, setPick] = useState<Picking>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // The rows: an edited sheet's own, or the class's (section's) subjects, blank.
  const loadRows = async (p: { datesheet_id?: number | null; standard_id?: number | null; section_id?: number | null }) => {
    setLoadingRows(true);
    try {
      const f = await getDatesheetForm(p);
      if (p.datesheet_id) {
        setExamId(f.exam_id);
        setStandardId(f.standard_id);
        setSectionId(f.section_id);
      }
      setRows(f.papers.map(r => ({ ...r, shift: r.shift || 1 })));
    } catch (e) {
      setError(apiErr(e, 'Could not load the subjects.'));
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    if (editId) loadRows({ datesheet_id: editId });
    else if (standardId) loadRows({ standard_id: standardId, section_id: sectionId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exams = lookups?.exams ?? [];
  const standards = lookups?.standards ?? [];
  const sections = (lookups?.sections ?? []).filter(x => x.standard_id === standardId);
  const exam = exams.find(e => e.id === examId);
  const standard = standards.find(c => c.id === standardId);
  const section = sections.find(x => x.id === sectionId);

  const setRow = (i: number, patch: Partial<DatesheetFormRow>) => {
    setRows(prev => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setError('');
  };

  const save = async () => {
    if (!examId) return setError('Select an exam.');
    if (!standardId) return setError('Select a class.');
    if (!rows.some(r => !!r.exam_date)) return setError('Set a date for at least one subject.');

    setError('');
    setSaving(true);
    try {
      const res = await saveDatesheet({ datesheet_id: editId, exam_id: examId, standard_id: standardId, section_id: sectionId, papers: rows });
      setSavedMsg(res.message || (isEdit ? 'Datesheet updated.' : 'Datesheet saved.'));
    } catch (e) {
      setError(apiErr(e, 'Could not save the datesheet.'));
    } finally {
      setSaving(false);
    }
  };

  // Back to the tab, its filters pointing at the sheet just saved.
  const closeSaved = () => {
    setSavedMsg('');
    navigation.popTo('AdminSeatingDatesheet', { examId, standardId, sectionId, at: Date.now() });
  };

  const picked = pick ? rows[pick.i] : null;

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Datesheet' : 'Create Datesheet'} onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Hint>
            Pick an exam and class, then set the date, time & shift per subject. One class cannot sit two papers at once.
          </Hint>

          <PickerCard label="Exam" value={exam?.exam_name} placeholder="Select exam" onPress={() => setSheet('exam')} />
          <View style={s.pair}>
            <PickerCard
              label="Class"
              value={standard?.name}
              placeholder="Select class"
              onPress={() => setSheet('class')}
              style={s.flex}
            />
            <PickerCard
              label="Section"
              value={section ? section.name : 'All sections'}
              onPress={() => setSheet('section')}
              disabled={!standardId}
              style={s.flex}
            />
          </View>

          {!standardId ? (
            <Hint>Select a class to load its subjects.</Hint>
          ) : loadingRows ? (
            <ActivityIndicator style={s.busy} color={theme.colors.primary} />
          ) : rows.length === 0 ? (
            <Hint>No subjects mapped to this class/section.</Hint>
          ) : (
            <>
              {rows.map((r, i) => (
                <View key={r.subject_id} style={[s.paper, !!r.exam_date && s.paperSet]}>
                  <View style={s.paperHead}>
                    <Text style={s.subject} numberOfLines={1}>
                      {r.name}
                    </Text>
                    {!!r.exam_date && (
                      <TouchableOpacity
                        onPress={() => setRow(i, { exam_date: null })}
                        hitSlop={8}
                        activeOpacity={0.6}
                      >
                        <Text style={s.skip}>Skip</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <PickerCard
                    label="Date"
                    value={r.exam_date ? longDay(r.exam_date) : null}
                    placeholder="No paper — skipped"
                    icon="calendar-outline"
                    onPress={() => setPick({ i, field: 'date' })}
                  />
                  <View style={s.pair}>
                    <PickerCard
                      label="Start"
                      value={r.start_time ? clock12(r.start_time) : null}
                      placeholder="—"
                      icon="time-outline"
                      onPress={() => setPick({ i, field: 'start' })}
                      style={s.flex}
                    />
                    <PickerCard
                      label="End"
                      value={r.end_time ? clock12(r.end_time) : null}
                      placeholder="—"
                      icon="time-outline"
                      onPress={() => setPick({ i, field: 'end' })}
                      style={s.flex}
                    />
                  </View>
                  <Segment options={SHIFTS} value={String(r.shift || 1) as '1' | '2'} onChange={k => setRow(i, { shift: Number(k) })} />
                  {(!!r.start_time || !!r.end_time) && (
                    <TouchableOpacity
                      style={s.clearTimes}
                      onPress={() => setRow(i, { start_time: null, end_time: null })}
                      hitSlop={6}
                    >
                      <VectorIcon iconSet="Ionicons" iconName="close" size={13} color={theme.colors.textMuted} />
                      <Text style={s.clearTimesText}>Clear times</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <Hint>Leave a subject's date blank to skip it.</Hint>
            </>
          )}

          <FormError>{error}</FormError>
          <SubmitButton label={isEdit ? 'Update Datesheet' : 'Save Datesheet'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={sheet === 'exam'}
        title="Exam"
        options={exams.map(e => ({ key: String(e.id), label: e.exam_name, sub: e.academic_year ?? undefined }))}
        selected={examId ? [String(examId)] : []}
        onPick={k => {
          setExamId(Number(k));
          setSheet(null);
          setError('');
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
          const id = Number(k);
          setSheet(null);
          setError('');
          if (id === standardId) return;
          // A new class: its subjects, blank, for all its sections.
          setStandardId(id);
          setSectionId(null);
          loadRows({ standard_id: id, section_id: null });
        }}
        onClose={() => setSheet(null)}
        emptyText="No classes yet."
      />
      <OptionSheet
        visible={sheet === 'section'}
        title="Section"
        options={[{ key: ALL_SECTIONS, label: 'All sections' }, ...sections.map(x => ({ key: String(x.id), label: `Section ${x.name}` }))]}
        selected={[sectionId ? String(sectionId) : ALL_SECTIONS]}
        onPick={k => {
          const id = k === ALL_SECTIONS ? null : Number(k);
          setSheet(null);
          setError('');
          if (id === sectionId) return;
          // A section's own subjects, blank.
          setSectionId(id);
          loadRows({ standard_id: standardId, section_id: id });
        }}
        onClose={() => setSheet(null)}
      />

      <DateSheet
        visible={pick?.field === 'date'}
        value={picked?.exam_date ?? null}
        title={picked ? `${picked.name} — date` : 'Select date'}
        onPick={d => {
          if (pick) setRow(pick.i, { exam_date: d });
          setPick(null);
        }}
        onClose={() => setPick(null)}
      />
      <TimeSheet
        visible={pick?.field === 'start' || pick?.field === 'end'}
        value={pick?.field === 'end' ? picked?.end_time : picked?.start_time}
        title={pick?.field === 'end' ? 'End time' : 'Start time'}
        onPick={t => {
          if (pick) setRow(pick.i, pick.field === 'end' ? { end_time: t } : { start_time: t });
          setPick(null);
        }}
        onClose={() => setPick(null)}
      />

      <AppDialog
        visible={!!savedMsg}
        title={isEdit ? 'Datesheet updated' : 'Datesheet saved'}
        message={savedMsg}
        actions={[{ text: 'Done', onPress: closeSaved }]}
        onRequestClose={closeSaved}
      />
    </View>
  );
};

export default AdminSeatingDatesheetFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 14 },
  pair: { flexDirection: 'row', gap: 10 },
  busy: { paddingVertical: 24 },

  // One subject's paper
  paper: {
    gap: 8,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  paperSet: { borderColor: theme.colors.primary },
  paperHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  subject: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  skip: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  clearTimes: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  clearTimesText: { fontSize: 12, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

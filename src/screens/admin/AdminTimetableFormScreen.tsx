import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import {
  TtForm,
  TtFormRow,
  TtOverview,
  getTimetableForm,
  getTimetableOverview,
  saveTimetableSchedule,
} from '../../api/adminTimetableApi';
import {
  ChipChoices,
  FieldLabel,
  FormError,
  Hint,
  OptionSheet,
  PickerCard,
  SubmitButton,
  TimeSheet,
  clock12,
} from './adminFormUi';
import {
  DAY_NUMS,
  DAY_SHORT,
  availableDaysForRow,
  formProblem,
  rowConflict,
  rowDuration,
} from './adminTimetableUi';

/**
 * A section's timetable, added or edited as the panel's form has it: the class
 * and section first — a section that already has one opens it for editing —
 * then a row per subject · time slot · teacher with the days it runs. A row
 * shows its lesson length; its days leave out those another row at the same
 * time already takes; a teacher busy then — in another class, or on another
 * row — turns the row red. Rows can be added and taken away; saving leaves out
 * rows without a subject, a teacher or a day.
 *
 * Route params: classId, className, sectionId, sectionName, locked — from a
 * section's week (Edit, or + on an empty one), where the class and section are
 * set. With none, the class and section are chosen here.
 */

type Row = TtFormRow & { _k: number };
type Sheet =
  | { kind: 'class' | 'section' }
  | { kind: 'subject' | 'teacher' | 'start' | 'end'; row: number }
  | null;

type ClassItem = TtOverview['classes'][number];

const AdminTimetableFormScreen = ({ navigation, route }: any) => {
  const p = route?.params ?? {};
  const locked = !!(p.locked && p.classId && p.sectionId);

  const [classes, setClasses] = useState<ClassItem[] | null>(null);
  const [std, setStd] = useState<{ id: number; name: string } | null>(
    p.classId ? { id: p.classId, name: p.className ?? '' } : null,
  );
  const [sec, setSec] = useState<{ id: number; name: string } | null>(
    p.sectionId ? { id: p.sectionId, name: p.sectionName ?? '' } : null,
  );

  const [form, setForm] = useState<TtForm | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingForm, setLoadingForm] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const nextKey = useRef(0);
  const keyed = (r: TtFormRow): Row => ({ ...r, days: [...(r.days ?? [])], _k: nextKey.current++ });

  const isEdit = !!form?.is_edit;
  const busy = form?.busy ?? [];
  const plainRows: TtFormRow[] = rows;

  // ── Loading ────────────────────────────────────────────────────────────────
  const formSeq = useRef(0);
  const loadForm = useCallback(async (classId: number, sectionId: number) => {
    const mine = ++formSeq.current;
    setLoadingForm(true);
    setLoadError('');
    setError('');
    setForm(null);
    setRows([]);
    try {
      const f = await getTimetableForm(classId, sectionId);
      if (mine !== formSeq.current) return;
      setForm(f);
      setRows(f.rows.map(keyed));
    } catch (e) {
      if (mine === formSeq.current) setLoadError(apiErr(e, 'Could not load the subjects.'));
    } finally {
      if (mine === formSeq.current) setLoadingForm(false);
    }
  }, []);

  useEffect(() => {
    if (locked) {
      loadForm(p.classId, p.sectionId);
      return;
    }
    getTimetableOverview()
      .then(r => setClasses(r.classes))
      .catch(e => setLoadError(apiErr(e, 'Could not load the classes.')));
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sectionsOf = (id?: number) => classes?.find(c => c.id === id)?.sections ?? [];

  // Choosing the class clears the section and its rows; a class of one section takes it at once.
  const pickClass = (key: string) => {
    const c = classes?.find(x => String(x.id) === key);
    if (!c) return;
    formSeq.current++;
    setStd({ id: c.id, name: c.name });
    setForm(null);
    setRows([]);
    setError('');
    setLoadError('');
    setLoadingForm(false);
    if (c.sections.length === 1) {
      setSec({ id: c.sections[0].id, name: c.sections[0].name });
      loadForm(c.id, c.sections[0].id);
    } else {
      setSec(null);
    }
  };

  const pickSection = (key: string) => {
    const x = sectionsOf(std?.id).find(y => String(y.id) === key);
    if (!x || !std) return;
    setSec({ id: x.id, name: x.name });
    loadForm(std.id, x.id);
  };

  // ── Rows ───────────────────────────────────────────────────────────────────
  const setRow = (i: number, patch: Partial<TtFormRow>) => {
    setError('');
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const toggleDay = (i: number, key: string) => {
    const d = Number(key);
    const days = rows[i]?.days ?? [];
    setRow(i, { days: days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort((a, b) => a - b) });
  };

  const addRow = () => {
    const first = form?.subjects?.[0];
    setError('');
    setRows(rs => [
      ...rs,
      keyed({
        subject_id: first?.id ?? 0,
        subject_name: first?.name ?? '',
        start_time: '09:00',
        end_time: '10:00',
        teacher_id: null,
        days: [],
      }),
    ]);
  };

  const removeRow = (i: number) => {
    setError('');
    setRows(rs => rs.filter((_, j) => j !== i));
  };

  const teacherName = (id?: number | null) => form?.teachers.find(t => t.id === id)?.name ?? '';

  // ── Save ───────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!std) return setError('Please select a class.');
    if (!sec) return setError('Please select a section.');
    if (!form) return;
    const problem = formProblem(plainRows, busy, isEdit);
    if (problem) return setError(problem);

    setError('');
    setSaving(true);
    try {
      await saveTimetableSchedule({
        standard_id: std.id,
        section_id: sec.id,
        is_edit: isEdit,
        rows: rows.map(({ _k, ...r }) => r),
      });
      navigation.goBack();
    } catch (e) {
      setError(apiErr(e, 'Could not save the timetable.'));
    } finally {
      setSaving(false);
    }
  };

  // ── Sheets ─────────────────────────────────────────────────────────────────
  const sheetRow = sheet && 'row' in sheet ? sheet.row : -1;
  const optionSheet = (() => {
    if (!sheet) return null;
    switch (sheet.kind) {
      case 'class':
        return {
          title: 'Class',
          options: (classes ?? []).map(c => ({
            key: String(c.id),
            label: c.name,
            sub: c.sections.length === 0 ? 'No sections' : undefined,
          })),
          selected: std ? [String(std.id)] : [],
          onPick: pickClass,
          empty: 'No classes yet. Add them under Standards first.',
        };
      case 'section':
        return {
          title: 'Section',
          options: sectionsOf(std?.id).map(x => ({
            key: String(x.id),
            label: `Section ${x.name}`,
            sub: x.has_timetable ? 'Timetable added — opens for editing' : 'No timetable yet',
          })),
          selected: sec ? [String(sec.id)] : [],
          onPick: pickSection,
          empty: 'This class has no sections. Add them under Standards first.',
        };
      case 'subject':
        return {
          title: 'Subject',
          options: (form?.subjects ?? []).map(x => ({ key: String(x.id), label: x.name })),
          selected: [String(rows[sheet.row]?.subject_id ?? '')],
          onPick: (k: string) => {
            const subj = form?.subjects.find(x => String(x.id) === k);
            if (subj) setRow(sheet.row, { subject_id: subj.id, subject_name: subj.name });
          },
          empty: 'No subjects for this section.',
        };
      case 'teacher':
        return {
          title: 'Teacher',
          options: [
            { key: '', label: 'None' },
            ...(form?.teachers ?? []).map(t => ({ key: String(t.id), label: t.name })),
          ],
          selected: [String(rows[sheet.row]?.teacher_id ?? '')],
          onPick: (k: string) => setRow(sheet.row, { teacher_id: k ? Number(k) : null }),
          empty: 'No active teachers yet.',
        };
      default:
        return null;
    }
  })();

  // ── Body ───────────────────────────────────────────────────────────────────
  const rowsBody = () => {
    if (!std || !sec) {
      return <Hint>Please select a class and section to load subjects.</Hint>;
    }
    if (loadingForm) {
      return (
        <View style={s.loading}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }
    if (loadError) {
      return (
        <View style={s.loadError}>
          <Text style={s.loadErrorText}>{loadError}</Text>
          <TouchableOpacity onPress={() => loadForm(std.id, sec.id)} hitSlop={10}>
            <Text style={s.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!form) return null;
    if (form.subjects.length === 0) {
      return (
        <View style={s.noSubjects}>
          <Text style={s.noSubjectsTitle}>No subjects mapped to this section.</Text>
          <Hint>Add subjects to the section first to schedule them here.</Hint>
        </View>
      );
    }

    return (
      <View style={s.rowsWrap}>
        <View style={s.rowsHead}>
          <Text style={s.rowsTitle}>Schedule Rows</Text>
          <Text style={s.rowsCount}>{`${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`}</Text>
        </View>

        {rows.map((r, i) => {
          const dur = rowDuration(r.start_time, r.end_time);
          const conflict = rowConflict(plainRows, i, busy);
          const available = availableDaysForRow(plainRows, i);
          const hidden = DAY_NUMS.length - available.length;
          return (
            <View key={r._k} style={[s.rowCard, !!conflict && s.rowCardConflict]}>
              <View style={s.rowTop}>
                <Text style={s.rowNo}>{`Row ${i + 1}`}</Text>
                <Text style={s.rowDur}>{dur || '—'}</Text>
                <View style={s.flex} />
                <TouchableOpacity onPress={() => removeRow(i)} hitSlop={10} activeOpacity={0.6}>
                  <VectorIcon iconSet="Ionicons" iconName="close" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>

              <PickerCard
                label="Subject"
                value={r.subject_name || form.subjects.find(x => x.id === r.subject_id)?.name}
                onPress={() => setSheet({ kind: 'subject', row: i })}
              />

              <View style={s.pair}>
                <PickerCard
                  style={s.half}
                  label="Start Time"
                  value={clock12(r.start_time)}
                  icon="time-outline"
                  onPress={() => setSheet({ kind: 'start', row: i })}
                />
                <PickerCard
                  style={s.half}
                  label="End Time"
                  value={clock12(r.end_time)}
                  icon="time-outline"
                  onPress={() => setSheet({ kind: 'end', row: i })}
                />
              </View>

              <PickerCard
                label="Teacher"
                value={teacherName(r.teacher_id)}
                placeholder="Select teacher"
                onPress={() => setSheet({ kind: 'teacher', row: i })}
              />
              {!!conflict && (
                <View style={s.conflict}>
                  <VectorIcon iconSet="Ionicons" iconName="warning-outline" size={14} color={theme.colors.danger} />
                  <Text style={s.conflictText}>{conflict}</Text>
                </View>
              )}

              <View>
                <FieldLabel>Days</FieldLabel>
                <ChipChoices
                  options={available.map(d => ({ key: String(d), label: DAY_SHORT[d] }))}
                  selected={(r.days ?? []).map(String)}
                  onToggle={k => toggleDay(i, k)}
                />
                {hidden > 0 && (
                  <Text style={s.taken}>{`${hidden} ${hidden === 1 ? 'day' : 'days'} taken at this time`}</Text>
                )}
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={s.addRow} activeOpacity={0.7} onPress={addRow}>
          <VectorIcon iconSet="Ionicons" iconName="add" size={18} color={theme.colors.primary} />
          <Text style={s.addRowText}>Add Row</Text>
        </TouchableOpacity>
        <Hint>
          Days already taken by another subject at the same time won’t appear in the list. A teacher busy in another
          class turns the row red.
        </Hint>
      </View>
    );
  };

  const timeRow = sheet && (sheet.kind === 'start' || sheet.kind === 'end') ? rows[sheet.row] : null;

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Timetable' : 'New Timetable'} onBackPress={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Hint>
          {isEdit
            ? 'Update subject, time, teacher and days for each row'
            : 'Pick class & section, then add rows: subject, time, teacher and days'}
        </Hint>

        <View style={s.pair}>
          <PickerCard
            style={s.half}
            label="Class"
            value={std?.name}
            placeholder="Select Class"
            disabled={locked || (!classes && !locked)}
            onPress={() => setSheet({ kind: 'class' })}
          />
          <PickerCard
            style={s.half}
            label="Section"
            value={sec ? sec.name : null}
            placeholder="Select Section"
            disabled={locked || !std}
            onPress={() => setSheet({ kind: 'section' })}
          />
        </View>
        {!locked && !classes && !!loadError && <FormError>{loadError}</FormError>}

        {rowsBody()}

        <FormError>{error}</FormError>

        {!!form && form.subjects.length > 0 && (
          <SubmitButton label={isEdit ? 'Update Timetable' : 'Create Timetable'} busy={saving} onPress={save} />
        )}
      </ScrollView>

      <OptionSheet
        visible={!!optionSheet}
        title={optionSheet?.title ?? ''}
        options={optionSheet?.options ?? []}
        selected={optionSheet?.selected ?? []}
        onPick={k => optionSheet?.onPick(k)}
        onClose={() => setSheet(null)}
        emptyText={optionSheet?.empty}
      />

      <TimeSheet
        visible={!!timeRow}
        title={sheet?.kind === 'end' ? 'End time' : 'Start time'}
        value={timeRow ? (sheet?.kind === 'end' ? timeRow.end_time : timeRow.start_time) : null}
        onPick={t => {
          if (sheetRow < 0) return;
          setRow(sheetRow, sheet?.kind === 'end' ? { end_time: t } : { start_time: t });
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminTimetableFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 14 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  loading: { paddingVertical: 28, alignItems: 'center' },
  loadError: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  loadErrorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  noSubjects: { gap: 4, paddingVertical: 12 },
  noSubjectsTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },

  // Rows
  rowsWrap: { gap: 12 },
  rowsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  rowsTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  rowsCount: { fontSize: 12, color: theme.colors.textMuted },
  rowCard: {
    gap: 10,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  rowCardConflict: { borderColor: theme.colors.danger },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowNo: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  rowDur: { fontSize: 12, color: theme.colors.primary, fontWeight: '500' },
  conflict: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  conflictText: { flex: 1, fontSize: 12, color: theme.colors.danger, lineHeight: 17 },
  taken: { fontSize: 11, color: theme.colors.textMuted, marginTop: 6 },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
  },
  addRowText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

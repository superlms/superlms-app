import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, Text, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AdminExam, ExamOptions, ExamPayload, createExam, updateExam } from '../../api/adminExamApi';
import { DocHeader } from '../more/docUi';
import {
  DateSheet,
  FieldLabel,
  FormCard,
  FormError,
  OptionSheet,
  PickerCard,
  Segment,
  SubmitButton,
  SwitchRow,
} from './adminFormUi';
import { EXAM_TYPES, TERMS, academicYears, longDay } from './adminExamUi';

/**
 * A new exam, or one being edited, as the panel's form has it: its name, term,
 * academic year and type; start and end dates, which may be left out (the end
 * no earlier than the start); total and passing marks — passing below total —
 * unless it uses a grading system; a description; and whether it is published.
 *
 * Route params: exam – the exam to edit; options – the list's choices.
 */

const toInt = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN);

type Sheet = 'year' | 'type' | 'start' | 'end' | null;

const AdminExamFormScreen = ({ navigation, route }: any) => {
  const editing: AdminExam | undefined = route.params?.exam;
  const options: ExamOptions | undefined = route.params?.options;
  const isEdit = !!editing;

  const years = options?.academic_years?.length ? options.academic_years : academicYears();
  const types = options?.exam_types && Object.keys(options.exam_types).length ? options.exam_types : EXAM_TYPES;
  const terms = options?.terms?.length ? options.terms : TERMS;

  const [name, setName] = useState(editing?.exam_name ?? '');
  // A new exam's term is chosen, as on the panel.
  const [term, setTerm] = useState(editing?.term ?? '');
  const [year, setYear] = useState(editing?.academic_year ?? years[0] ?? '');
  const [type, setType] = useState(editing?.exam_type ?? '');
  const [start, setStart] = useState<string | null>(editing?.start_date ?? null);
  const [end, setEnd] = useState<string | null>(editing?.end_date ?? null);
  const [grading, setGrading] = useState(!!editing?.uses_grading_system);
  const [total, setTotal] = useState(editing?.total_marks != null ? String(Number(editing.total_marks)) : '');
  const [passing, setPassing] = useState(editing?.passing_marks != null ? String(Number(editing.passing_marks)) : '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [published, setPublished] = useState(!!editing?.is_published);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // An exam saved under an older year still shows it among the choices.
  const yearChoices = year && !years.includes(year) ? [year, ...years] : years;

  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError('');
  };

  const save = async () => {
    if (!name.trim()) return setError('Enter the exam name.');
    if (!terms.includes(term)) return setError('Select the term.');
    if (!year) return setError('Select the academic year.');
    if (!type) return setError('Select the exam type.');
    if (start && end && end < start) return setError('The end date must be on or after the start date.');
    if (!grading) {
      const t = toInt(total);
      const p = toInt(passing);
      if (!(t >= 1)) return setError('Total marks must be a whole number of at least 1.');
      if (!(p >= 1)) return setError('Passing marks must be a whole number of at least 1.');
      if (p >= t) return setError('Passing marks must be less than total marks.');
    }

    const payload: ExamPayload = {
      exam_name: name.trim(),
      term,
      academic_year: year,
      start_date: start,
      end_date: end,
      exam_type: type,
      description: description.trim(),
      is_published: published,
      uses_grading_system: grading,
      total_marks: grading ? '' : toInt(total),
      passing_marks: grading ? '' : toInt(passing),
    };

    setError('');
    setSaving(true);
    try {
      if (isEdit) await updateExam(editing!.id, payload);
      else await createExam(payload);
      navigation.goBack();
    } catch (e) {
      setError(apiErr(e, 'Could not save the exam.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Exam' : 'New Exam'} onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <FormCard
            label="Exam Name"
            value={name}
            onChangeText={edit(setName)}
            placeholder="e.g. Annual Examination 2026"
            maxLength={255}
          />

          <View>
            <FieldLabel>Term</FieldLabel>
            <Segment options={terms.map(t => ({ key: t, label: t }))} value={term} onChange={edit(setTerm)} />
          </View>

          <View style={s.pair}>
            <PickerCard style={s.half} label="Academic Year" value={year} onPress={() => setSheet('year')} />
            <PickerCard
              style={s.half}
              label="Exam Type"
              value={type ? types[type] ?? type : null}
              placeholder="Select type"
              onPress={() => setSheet('type')}
            />
          </View>

          <View style={s.group}>
            <View style={s.pair}>
              <PickerCard
                style={s.half}
                label="Start Date"
                value={start ? longDay(start) : null}
                placeholder="Optional"
                icon="calendar-outline"
                onPress={() => setSheet('start')}
              />
              <PickerCard
                style={s.half}
                label="End Date"
                value={end ? longDay(end) : null}
                placeholder="Optional"
                icon="calendar-outline"
                onPress={() => setSheet('end')}
              />
            </View>
            {!!(start || end) && (
              <TouchableOpacity
                style={s.link}
                hitSlop={8}
                activeOpacity={0.6}
                onPress={() => {
                  setStart(null);
                  setEnd(null);
                  setError('');
                }}
              >
                <Text style={s.linkText}>Clear dates</Text>
              </TouchableOpacity>
            )}
          </View>

          <SwitchRow label="Use grading system (no marks)" value={grading} onValueChange={edit(setGrading)} />

          {!grading && (
            <View style={s.pair}>
              <FormCard
                style={s.half}
                label="Total Marks"
                value={total}
                onChangeText={edit(setTotal)}
                placeholder="e.g. 100"
                keyboardType="number-pad"
                maxLength={5}
              />
              <FormCard
                style={s.half}
                label="Passing Marks"
                value={passing}
                onChangeText={edit(setPassing)}
                placeholder="e.g. 33"
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
          )}

          <FormCard
            label="Description"
            value={description}
            onChangeText={edit(setDescription)}
            placeholder="Optional notes..."
            multiline
            minHeight={80}
          />

          <SwitchRow label={isEdit ? 'Published' : 'Publish immediately'} value={published} onValueChange={setPublished} />

          <FormError>{error}</FormError>

          <SubmitButton label={isEdit ? 'Update Exam' : 'Create Exam'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={sheet === 'year' || sheet === 'type'}
        title={sheet === 'year' ? 'Academic Year' : 'Exam Type'}
        options={
          sheet === 'year'
            ? yearChoices.map(y => ({ key: y, label: y }))
            : Object.entries(types).map(([k, v]) => ({ key: k, label: v }))
        }
        selected={[sheet === 'year' ? year : type]}
        onPick={k => (sheet === 'year' ? edit(setYear)(k) : edit(setType)(k))}
        onClose={() => setSheet(null)}
      />

      <DateSheet
        visible={sheet === 'start' || sheet === 'end'}
        title={sheet === 'start' ? 'Start date' : 'End date'}
        value={sheet === 'start' ? start : end ?? start}
        onPick={d => (sheet === 'start' ? edit(setStart)(d) : edit(setEnd)(d))}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminExamFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  group: { gap: 8 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  link: { alignSelf: 'flex-start' },
  linkText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

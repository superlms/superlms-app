import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Select from '../../components/Select';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { FeeStudent, getFeeStudents } from '../../api/adminFeeApi';
import {
  ConcessionRow,
  ConcessionType,
  concessionValue,
  currentAcademicYear,
  fieldErrorOf,
  plainNumber,
  saveConcession,
} from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import { FieldPair, FormHeading, OutlinedField, SaveButton, SaveState } from '../teacherStudents/outlinedFormUi';
import { useRevealFocused } from './adminProfileUi';
import { useFeeClasses } from './adminFeeUi';
import { FormFoot, Quiet, dmy } from './feeSetupUi';

/**
 * Add Concession, and Edit — the panel's slide-in: a class and section to find
 * the student by, the student, a flat amount or a percentage, what it applies
 * to (Academic, Transport, or the student's Last Year Dues), the reason and
 * the academic year. A concession on the dues needs the student to have some.
 */

const APPLIES = [
  { value: 'academic', label: 'Academic' },
  { value: 'transport', label: 'Transport' },
  { value: 'dues', label: 'Last Year Dues' },
];

const AdminFeeConcessionFormScreen = ({ navigation, route }: any) => {
  const concession: ConcessionRow | undefined = route.params?.concession;
  const editing = !!concession;
  const classes = useFeeClasses();

  const [classId, setClassId] = useState<number | null>(concession?.standard_id ?? route.params?.classId ?? null);
  const [sectionId, setSectionId] = useState<number | null>(concession?.section_id ?? route.params?.sectionId ?? null);
  const [students, setStudents] = useState<FeeStudent[]>([]);
  const [studentId, setStudentId] = useState<number | null>(concession?.student?.id ?? route.params?.studentId ?? null);
  const [type, setType] = useState<ConcessionType>(concession?.type ?? 'amount');
  const [value, setValue] = useState(concession ? plainNumber(concession.value) : '');
  const [feeType, setFeeType] = useState(concession?.fee_type ?? 'academic');
  const [reason, setReason] = useState(concession?.reason ?? '');
  const [year, setYear] = useState(concession?.year ?? currentAcademicYear());
  const [wrong, setWrong] = useState<{ field: string; message: string } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const busy = useRef(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();
  const errorOf = (f: string) => (wrong?.field === f ? wrong.message : null);

  useEffect(() => {
    let live = true;
    setStudents([]);
    if (!classId) return;
    getFeeStudents({ standard_id: classId, section_id: sectionId ?? undefined })
      .then(d => live && setStudents(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [classId, sectionId]);

  const cls = classes.find(c => c.id === classId) ?? null;
  // An older concession on every fee keeps its "All fees" when edited.
  const applies = feeType === 'all' ? [...APPLIES, { value: 'all', label: 'All fees' }] : APPLIES;

  const stop = (field: string, message: string) => {
    setWrong({ field, message });
    AppAlert.alert('Check the form', message);
  };

  const save = async () => {
    if (busy.current) return;
    if (!studentId) return stop('student_id', 'Select a student.');
    const v = Number(value);
    if (!value.trim() || isNaN(v) || v < 0.01) return stop('value', 'Enter the concession value.');
    if (type === 'percent' && v > 100) return stop('value', 'A percentage cannot be more than 100.');
    if (!year.trim()) return stop('year', 'Enter the academic year.');
    setWrong(null);
    busy.current = true;
    setSaveState('saving');
    try {
      const msg = await saveConcession(
        { student_id: studentId, type, value: value.trim(), fee_type: feeType, reason: reason.trim(), year: year.trim() },
        concession?.id,
      );
      setSaveState('done');
      AppAlert.alert('Saved', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      const w = fieldErrorOf(e);
      if (w?.field) stop(w.field, w.message);
      else AppAlert.alert('Not saved', w?.message ?? 'Could not save the concession.');
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title={editing ? 'Edit Concession' : 'Add Concession'} onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <Text style={s.intro}>Grant a student a fee discount.</Text>
          {editing && (
            <Quiet>{`Now ${concessionValue(concession!)} on ${concession!.applies_to} · granted ${dmy(concession!.granted)}`}</Quiet>
          )}

          <FormHeading title="Student" first />
          <FieldPair>
            <View style={s.half}>
              <Select
                notched
                required
                label="Class"
                placeholder="Select…"
                value={classId}
                options={classes.map(c => ({ value: c.id, label: c.name }))}
                onChange={v => {
                  setClassId(Number(v));
                  setSectionId(null);
                  setStudentId(null);
                }}
              />
            </View>
            <View style={s.half}>
              <Select
                notched
                label="Section"
                placeholder="All"
                value={sectionId ?? 0}
                disabled={!cls}
                options={[{ value: 0, label: 'All' }, ...(cls?.sections ?? []).map(x => ({ value: x.id, label: x.name }))]}
                onChange={v => {
                  setSectionId(Number(v) || null);
                  setStudentId(null);
                }}
              />
            </View>
          </FieldPair>
          <Select
            notched
            required
            label="Student"
            placeholder={classId ? 'Select student…' : 'Select a class first'}
            value={studentId}
            disabled={!classId}
            options={students.map(x => ({ value: x.id, label: x.father_name ? `${x.name} — ${x.father_name}` : x.name }))}
            onChange={v => {
              setStudentId(Number(v));
              setWrong(null);
            }}
            error={errorOf('student_id')}
          />

          <FormHeading title="Concession" />
          <FieldPair>
            <View style={s.half}>
              <Select
                notched
                label="Type"
                value={type}
                options={[
                  { value: 'amount', label: 'Flat Amount (₹)' },
                  { value: 'percent', label: 'Percentage (%)' },
                ]}
                onChange={v => setType(v as ConcessionType)}
              />
            </View>
            <OutlinedField
              half
              required
              label="Value"
              placeholder={type === 'percent' ? 'e.g. 25' : 'e.g. 2000'}
              keyboardType="decimal-pad"
              value={value}
              onChangeText={(v: string) => {
                setValue(v.replace(/[^0-9.]/g, ''));
                setWrong(null);
              }}
              error={errorOf('value')}
            />
          </FieldPair>
          <FieldPair>
            <View style={s.half}>
              <Select
                notched
                label="Applies To"
                value={feeType}
                options={applies}
                onChange={v => {
                  setFeeType(String(v));
                  setWrong(null);
                }}
                error={errorOf('fee_type')}
              />
            </View>
            <OutlinedField
              half
              required
              label="Academic Year"
              placeholder="2026-27"
              value={year}
              onChangeText={(v: string) => {
                setYear(v);
                setWrong(null);
              }}
              error={errorOf('year')}
              maxLength={20}
            />
          </FieldPair>
          <OutlinedField
            label="Reason"
            placeholder="e.g. Sibling, Staff ward"
            value={reason}
            onChangeText={setReason}
            error={errorOf('reason')}
            maxLength={255}
          />
          <View style={s.tail} />
        </ScrollView>
        <FormFoot>
          <SaveButton
            state={saveState}
            icon="checkmark-circle-outline"
            label={editing ? 'Update Concession' : 'Save Concession'}
            busyLabel="Saving concession"
            doneLabel="Concession saved"
            onPress={save}
          />
        </FormFoot>
      </Animated.View>
    </View>
  );
};

export default AdminFeeConcessionFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  half: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  intro: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  tail: { height: 24 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

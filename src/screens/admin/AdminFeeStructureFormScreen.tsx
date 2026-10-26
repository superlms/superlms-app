import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Select from '../../components/Select';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import {
  StructureGroup,
  addStructure,
  currentAcademicYear,
  editStructure,
  fieldErrorOf,
  plainNumber,
} from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import {
  CheckCard,
  FieldPair,
  FormHeading,
  OutlinedField,
  SaveButton,
  SaveState,
} from '../teacherStudents/outlinedFormUi';
import { useRevealFocused } from './adminProfileUi';
import { useFeeClasses } from './adminFeeUi';
import { AddRowButton, FormFoot, Quiet, RowHead, plural, rupees } from './feeSetupUi';

/**
 * Add Fee Structure, and Edit — the panel's slide-in, drawn as Add Student is.
 *
 * Adding: a class, the academic year, the sections it is for (none ticked is
 * every section — the All Sections structure) and the fee heads, as many as
 * needed at once, each a name and an amount; the running total under them.
 * Every head is written once for each section ticked.
 *
 * Editing one group (a class and one section, or All Sections): the class is
 * fixed, and saving replaces every fee head of the group with the ones here —
 * a head taken off is deleted.
 *
 * Save stops at the first empty or wrong field, red with what is wrong under
 * it; the server's own refusal lands on its field the same way.
 */

type Row = { name: string; amount: string };

const AdminFeeStructureFormScreen = ({ navigation, route }: any) => {
  const group: StructureGroup | undefined = route.params?.group;
  const editing = !!group;
  const classes = useFeeClasses();

  const [classId, setClassId] = useState<number | null>(group?.standard_id ?? route.params?.classId ?? null);
  const [sectionIds, setSectionIds] = useState<number[]>(
    group ? (group.section_id ? [group.section_id] : []) : route.params?.sectionId ? [route.params.sectionId] : [],
  );
  const [year, setYear] = useState(group?.year || currentAcademicYear());
  const [rows, setRows] = useState<Row[]>(
    group ? group.rows.map(r => ({ name: r.fee_name, amount: plainNumber(r.amount) })) : [{ name: '', amount: '' }],
  );
  const [wrong, setWrong] = useState<{ field: string; message: string } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const busy = useRef(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();

  const cls = classes.find(c => c.id === classId) ?? null;
  const total = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0), [rows]);
  const errorOf = (field: string) => (wrong?.field === field ? wrong.message : null);
  const clearWrong = (field: string) => setWrong(w => (w?.field === field ? null : w));

  const setRow = (i: number, key: keyof Row, v: string) => {
    setRows(prev => prev.map((r, n) => (n === i ? { ...r, [key]: v } : r)));
    clearWrong(`rows.${i}.${key}`);
  };

  const stop = (field: string, message: string) => {
    setWrong({ field, message });
    AppAlert.alert('Check the form', message);
  };

  const save = async () => {
    if (busy.current) return;
    if (!classId) return stop('standard_id', 'Select a class.');
    if (!year.trim()) return stop('academic_year', 'Enter the academic year.');
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].name.trim()) return stop(`rows.${i}.name`, `Row ${i + 1}: enter the fee name.`);
      const a = rows[i].amount.trim();
      if (a === '' || isNaN(Number(a)) || Number(a) < 0) return stop(`rows.${i}.amount`, `Row ${i + 1}: enter an amount.`);
    }

    setWrong(null);
    busy.current = true;
    setSaveState('saving');
    try {
      const body = { academic_year: year.trim(), rows: rows.map(r => ({ name: r.name.trim(), amount: r.amount.trim() })) };
      const msg = editing
        ? await editStructure({ standard_id: group!.standard_id, section_id: group!.section_id, ...body })
        : await addStructure({ standard_id: classId, section_ids: sectionIds, ...body });
      setSaveState('done');
      AppAlert.alert('Saved', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      const w = fieldErrorOf(e);
      if (w?.field) stop(w.field, w.message);
      else AppAlert.alert('Not saved', w?.message ?? 'Could not save the fee structure.');
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title={editing ? 'Edit Fee Structure' : 'Add Fee Structure'} onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <Text style={s.intro}>Pick a class and sections, then list every fee head in one go.</Text>

          <FormHeading title="Class" first />
          <Select
            notched
            required
            label="Class"
            placeholder="Select class…"
            value={classId}
            disabled={editing}
            options={classes.map(c => ({ label: c.name, value: c.id }))}
            onChange={v => {
              setClassId(Number(v));
              setSectionIds([]);
              clearWrong('standard_id');
            }}
            error={errorOf('standard_id')}
          />
          <OutlinedField
            required
            label="Academic Year"
            placeholder="2026-27"
            value={year}
            onChangeText={(v: string) => {
              setYear(v);
              clearWrong('academic_year');
            }}
            error={errorOf('academic_year')}
            maxLength={20}
          />

          {editing ? (
            <Quiet>
              Editing {group!.section_id ? `section ${group!.section}` : 'the All Sections'} structure — saving replaces every fee head below.
            </Quiet>
          ) : (
            <>
              <FormHeading title="Sections" />
              <Quiet>Leave every section unticked to apply it to all.</Quiet>
              {!cls ? (
                <Quiet>Select a class to load its sections (or leave empty for all).</Quiet>
              ) : cls.sections.length === 0 ? (
                <Quiet>This class has no sections — the structure is for the whole class.</Quiet>
              ) : (
                cls.sections.map(sec => (
                  <CheckCard
                    key={sec.id}
                    icon="people-outline"
                    label={`Section ${sec.name}`}
                    value={sectionIds.includes(sec.id)}
                    onValueChange={on => setSectionIds(prev => (on ? [...prev, sec.id] : prev.filter(x => x !== sec.id)))}
                  />
                ))
              )}
            </>
          )}

          <FormHeading title="Fee Heads" />
          <Quiet>{`${plural(rows.length, 'row')} · ${rupees(total)}`}</Quiet>
          {rows.map((r, i) => (
            <View key={i}>
              <RowHead title={`#${i + 1}`} onRemove={rows.length > 1 ? () => setRows(prev => prev.filter((_, n) => n !== i)) : undefined} />
              <FieldPair>
                <OutlinedField
                  half
                  required
                  label="Fee Name"
                  placeholder="e.g. Tuition"
                  value={r.name}
                  onChangeText={(v: string) => setRow(i, 'name', v)}
                  error={errorOf(`rows.${i}.name`)}
                  maxLength={255}
                />
                <OutlinedField
                  half
                  required
                  label="Amount (₹)"
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={r.amount}
                  onChangeText={(v: string) => setRow(i, 'amount', v.replace(/[^0-9.]/g, ''))}
                  error={errorOf(`rows.${i}.amount`)}
                />
              </FieldPair>
            </View>
          ))}
          <AddRowButton label="Add row" onPress={() => setRows(prev => [...prev, { name: '', amount: '' }])} />

          <View style={s.tail} />
        </ScrollView>

        <FormFoot>
          <SaveButton
            state={saveState}
            icon="checkmark-circle-outline"
            label={editing ? 'Update Fee Structure' : 'Save Fee Structure'}
            busyLabel="Saving fee structure"
            doneLabel="Fee structure saved"
            onPress={save}
          />
        </FormFoot>
      </Animated.View>
    </View>
  );
};

export default AdminFeeStructureFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  intro: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  tail: { height: 24 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

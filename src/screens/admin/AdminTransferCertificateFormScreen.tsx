import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Select from '../../components/Select';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { TcClass, TcItem, TcPayload, createTc, getTcLookups, updateTc } from '../../api/adminTcCertificateApi';
import { DateSheet } from './adminFormUi';
import { useRevealFocused } from './adminProfileUi';
import {
  CheckCard,
  FieldPair,
  FormHeading,
  OutlinedField,
  OutlinedPicker,
  SaveButton,
  SaveState,
} from '../teacherStudents/outlinedFormUi';
import {
  CONDUCT,
  FAILED,
  FieldWrong,
  NCC,
  PickedStudent,
  StudentPicker,
  longDate,
  serverWrong,
  today,
  useFieldSpots,
} from './adminTcUi';

/**
 * A Transfer Certificate issued, or edited, as the panel's form has it, drawn
 * as Change Password is: the student — class, section, then a search — who
 * stays fixed once it is issued, then the panel's four parts, each under a
 * quiet heading: Student & Academic, Attendance & Fees, Activities & Conduct,
 * and Issue Details, every field a thin outline with its name in the top
 * border (a red star on the ones it will not save without), the choices as
 * outlined dropdowns and SC / ST as a card that ticks. The panel's defaults
 * stand: Indian, not failed, qualified for promotion, conduct Good, both dates
 * today.
 *
 * Save stops at the first field that is missing — red, with what is wrong
 * under it, scrolled to — and the server's own refusal lands on its field the
 * same way. Issue TC (Update TC) stays at the foot, above the keyboard, with
 * the saving sweep and the green tick before the form closes.
 *
 * Route params: item — the TC to edit; classes — the picker's classes.
 */

type Field =
  | 'student'
  | 'nationality'
  | 'book_no'
  | 'last_class_studied'
  | 'exam_last_taken'
  | 'whether_failed'
  | 'qualified_for_promotion'
  | 'subjects_studied'
  | 'total_working_days'
  | 'days_present'
  | 'fees_paid_upto'
  | 'fee_concession'
  | 'is_ncc_scout'
  | 'general_conduct'
  | 'extra_activities'
  | 'application_date'
  | 'issue_date'
  | 'reason_for_leaving'
  | 'remarks';

// The server's name for each field: its own, but for the student.
const SERVER_FIELDS: Record<string, Field> = {
  student_detail_id: 'student',
  nationality: 'nationality',
  book_no: 'book_no',
  last_class_studied: 'last_class_studied',
  exam_last_taken: 'exam_last_taken',
  whether_failed: 'whether_failed',
  qualified_for_promotion: 'qualified_for_promotion',
  subjects_studied: 'subjects_studied',
  total_working_days: 'total_working_days',
  days_present: 'days_present',
  fees_paid_upto: 'fees_paid_upto',
  fee_concession: 'fee_concession',
  is_ncc_scout: 'is_ncc_scout',
  general_conduct: 'general_conduct',
  extra_activities: 'extra_activities',
  application_date: 'application_date',
  issue_date: 'issue_date',
  reason_for_leaving: 'reason_for_leaving',
  remarks: 'remarks',
};

const YES_NO = ['Yes', 'No'];
const choices = (list: string[]) => list.map(o => ({ label: o, value: o }));

// How long the green tick stays on the button before the form closes.
const DONE_HOLD = 750;

const num = (v: string) => {
  const n = parseInt(v.replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
};

const AdminTransferCertificateFormScreen = ({ navigation, route }: any) => {
  const editing: TcItem | undefined = route?.params?.item;
  const isEdit = !!editing;

  const [classes, setClasses] = useState<TcClass[]>(route?.params?.classes ?? []);
  const [student, setStudent] = useState<PickedStudent | null>(
    editing ? { id: editing.student_id, full_name: editing.student_name ?? '—', admission_no: editing.admission_no } : null,
  );
  const [f, setF] = useState({
    book_no: editing?.book_no ?? '',
    nationality: editing?.nationality ?? 'Indian',
    is_sc_st: !!editing?.is_sc_st,
    last_class_studied: editing?.last_class_studied ?? '',
    exam_last_taken: editing?.exam_last_taken ?? '',
    whether_failed: editing?.whether_failed ?? 'No',
    subjects_studied: editing?.subjects_studied ?? '',
    qualified_for_promotion: editing?.qualified_for_promotion ?? 'Yes',
    fees_paid_upto: editing?.fees_paid_upto ?? '',
    fee_concession: editing?.fee_concession ?? '',
    total_working_days: String(editing?.total_working_days ?? 0),
    days_present: String(editing?.days_present ?? 0),
    is_ncc_scout: editing?.is_ncc_scout ?? 'No',
    extra_activities: editing?.extra_activities ?? '',
    general_conduct: editing?.general_conduct ?? 'Good',
    application_date: editing?.application_date ?? today(),
    issue_date: editing?.issue_date ?? today(),
    reason_for_leaving: editing?.reason_for_leaving ?? '',
    remarks: editing?.remarks ?? '',
  });
  const [dateSheet, setDateSheet] = useState<'application' | 'issue' | null>(null);
  // The field the last save stopped at.
  const [wrong, setWrong] = useState<FieldWrong<Field> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // A quick second tap, before the button has greyed out, does nothing.
  const busy = useRef(false);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (closing.current) clearTimeout(closing.current);
    },
    [],
  );

  useEffect(() => {
    if (classes.length === 0) getTcLookups().then(l => setClasses(l.classes ?? [])).catch(() => {});
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The page rides above the keyboard, and the box typed in sits clear of it.
  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();
  const { contentRef, spot, input, goTo } = useFieldSpots<Field>(scrollRef);

  // Filling in the field that was wrong takes the red off it.
  const clear = (field: Field) => setWrong(w => (w && (w.field === field || w.field === null) ? null : w));
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => {
    setF(prev => ({ ...prev, [k]: v }));
    if (k !== 'is_sc_st') clear(k as Field);
  };
  const errorOf = (field: Field) => (wrong?.field === field ? wrong.message : null);

  const stop = (w: FieldWrong<Field>) => {
    setWrong(w.field ? w : null);
    if (w.field) goTo(w.field);
    else AppAlert.alert('Not saved', w.message);
  };

  const save = async () => {
    if (busy.current) return;
    if (!student) return stop({ field: 'student', message: 'Pick the student the TC is for.' });
    if (!f.general_conduct) return stop({ field: 'general_conduct', message: 'Pick the general conduct.' });
    if (!f.application_date) return stop({ field: 'application_date', message: 'Pick the date of application.' });
    if (!f.issue_date) return stop({ field: 'issue_date', message: 'Pick the date of issue.' });

    const payload: TcPayload = {
      student_detail_id: student.id,
      book_no: f.book_no.trim(),
      nationality: f.nationality.trim() || 'Indian',
      is_sc_st: f.is_sc_st,
      last_class_studied: f.last_class_studied.trim(),
      exam_last_taken: f.exam_last_taken.trim(),
      whether_failed: f.whether_failed,
      subjects_studied: f.subjects_studied.trim(),
      qualified_for_promotion: f.qualified_for_promotion,
      fees_paid_upto: f.fees_paid_upto.trim(),
      fee_concession: f.fee_concession.trim(),
      total_working_days: num(f.total_working_days),
      days_present: num(f.days_present),
      is_ncc_scout: f.is_ncc_scout,
      extra_activities: f.extra_activities.trim(),
      general_conduct: f.general_conduct,
      application_date: f.application_date,
      issue_date: f.issue_date,
      reason_for_leaving: f.reason_for_leaving.trim(),
      remarks: f.remarks.trim(),
    };

    setWrong(null);
    busy.current = true;
    setSaveState('saving');
    try {
      const done = isEdit ? await updateTc(editing!.id, payload) : await createTc(payload);
      setSaveState('done');
      // The green tick has a moment on the button, then the form closes — an
      // edit back to the TC's page, which shows what was saved.
      closing.current = setTimeout(() => {
        closing.current = null;
        if (isEdit) navigation.popTo('AdminTcDetail', { kind: 'tc', item: done ?? editing, classes });
        else navigation.goBack();
      }, DONE_HOLD);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      stop(serverWrong(e, SERVER_FIELDS, 'Could not save the TC.'));
    }
  };

  // A typed field of the form, in its own spot.
  const text = (
    k: Exclude<Field, 'student' | 'whether_failed' | 'qualified_for_promotion' | 'is_ncc_scout' | 'general_conduct' | 'application_date' | 'issue_date'>,
    label: string,
    more: Record<string, any> = {},
  ) => (
    <OutlinedField
      ref={input(k)}
      label={label}
      value={f[k]}
      onChangeText={set(k)}
      error={errorOf(k)}
      {...more}
    />
  );

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Transfer Certificate' : 'Issue Transfer Certificate'} onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <View ref={contentRef} collapsable={false}>
            <FormHeading title="Student" first />
            <View ref={spot('student')} collapsable={false}>
              <StudentPicker
                classes={classes}
                selected={student}
                locked={isEdit}
                error={errorOf('student')}
                onSelect={st => {
                  setStudent(st);
                  clear('student');
                }}
                onClear={() => setStudent(null)}
              />
            </View>

            {/* Student & Academic */}
            <FormHeading title="Student & Academic" />
            <View ref={spot('nationality')} collapsable={false}>
              <View ref={spot('book_no')} collapsable={false}>
                <FieldPair>
                  {text('nationality', 'Nationality', { half: true, autoCapitalize: 'words' })}
                  {text('book_no', 'Book No.', { half: true, placeholder: 'e.g. 096' })}
                </FieldPair>
              </View>
            </View>
            <CheckCard
              icon="people-outline"
              label="Scheduled Caste / Scheduled Tribe"
              note={f.is_sc_st ? 'The student belongs to SC / ST' : 'Tick if the student belongs to SC / ST'}
              value={f.is_sc_st}
              onValueChange={set('is_sc_st')}
            />
            <View ref={spot('last_class_studied')} collapsable={false}>
              <View ref={spot('whether_failed')} collapsable={false}>
                <FieldPair>
                  {text('last_class_studied', 'Class Last Studied', { half: true, placeholder: 'e.g. 12th' })}
                  <View style={s.half}>
                    <Select
                      notched
                      label="Whether Failed"
                      value={f.whether_failed}
                      options={choices(FAILED)}
                      onChange={v => set('whether_failed')(String(v))}
                      error={errorOf('whether_failed')}
                    />
                  </View>
                </FieldPair>
              </View>
            </View>
            <View ref={spot('exam_last_taken')} collapsable={false}>
              {text('exam_last_taken', 'Exam Last Taken with Result', { placeholder: 'e.g. 12th Passed' })}
            </View>
            <View ref={spot('qualified_for_promotion')} collapsable={false}>
              <Select
                notched
                label="Qualified for Promotion"
                value={f.qualified_for_promotion}
                options={choices(YES_NO)}
                onChange={v => set('qualified_for_promotion')(String(v))}
                error={errorOf('qualified_for_promotion')}
              />
            </View>
            <View ref={spot('subjects_studied')} collapsable={false}>
              {text('subjects_studied', 'Subjects Studied', { placeholder: 'e.g. Hindi, English, Mathematics, Science' })}
            </View>

            {/* Attendance & Fees */}
            <FormHeading title="Attendance & Fees" />
            <View ref={spot('total_working_days')} collapsable={false}>
              <View ref={spot('days_present')} collapsable={false}>
                <FieldPair>
                  {text('total_working_days', 'Total Working Days', {
                    half: true,
                    keyboardType: 'number-pad',
                    maxLength: 4,
                    onChangeText: (v: string) => set('total_working_days')(v.replace(/\D/g, '')),
                  })}
                  {text('days_present', 'Days Present', {
                    half: true,
                    keyboardType: 'number-pad',
                    maxLength: 4,
                    onChangeText: (v: string) => set('days_present')(v.replace(/\D/g, '')),
                  })}
                </FieldPair>
              </View>
            </View>
            <View ref={spot('fees_paid_upto')} collapsable={false}>
              <View ref={spot('fee_concession')} collapsable={false}>
                <FieldPair>
                  {text('fees_paid_upto', 'Fees Paid Upto', { half: true, placeholder: 'e.g. March 2026' })}
                  {text('fee_concession', 'Fee Concession', { half: true, placeholder: 'e.g. None' })}
                </FieldPair>
              </View>
            </View>

            {/* Activities & Conduct */}
            <FormHeading title="Activities & Conduct" />
            <View ref={spot('is_ncc_scout')} collapsable={false}>
              <View ref={spot('general_conduct')} collapsable={false}>
                <FieldPair>
                  <View style={s.half}>
                    <Select
                      notched
                      label="NCC / Scout / Guide"
                      value={f.is_ncc_scout}
                      options={choices(NCC)}
                      onChange={v => set('is_ncc_scout')(String(v))}
                      error={errorOf('is_ncc_scout')}
                    />
                  </View>
                  <View style={s.half}>
                    <Select
                      notched
                      required
                      label="General Conduct"
                      value={f.general_conduct}
                      options={choices(CONDUCT)}
                      onChange={v => set('general_conduct')(String(v))}
                      error={errorOf('general_conduct')}
                    />
                  </View>
                </FieldPair>
              </View>
            </View>
            <View ref={spot('extra_activities')} collapsable={false}>
              {text('extra_activities', 'Games / Extra-Curricular Activities', { placeholder: 'e.g. Cricket, Debate' })}
            </View>

            {/* Issue Details */}
            <FormHeading title="Issue Details" />
            <View ref={spot('application_date')} collapsable={false}>
              <View ref={spot('issue_date')} collapsable={false}>
                <FieldPair>
                  <OutlinedPicker
                    half
                    required
                    label="Date of Application"
                    value={longDate(f.application_date)}
                    placeholder="Pick a date"
                    icon="calendar-outline"
                    error={errorOf('application_date')}
                    onPress={() => setDateSheet('application')}
                  />
                  <OutlinedPicker
                    half
                    required
                    label="Date of Issue"
                    value={longDate(f.issue_date)}
                    placeholder="Pick a date"
                    icon="calendar-outline"
                    error={errorOf('issue_date')}
                    onPress={() => setDateSheet('issue')}
                  />
                </FieldPair>
              </View>
            </View>
            <View ref={spot('reason_for_leaving')} collapsable={false}>
              {text('reason_for_leaving', 'Reason for Leaving', { placeholder: 'e.g. No Further Classes' })}
            </View>
            <View ref={spot('remarks')} collapsable={false}>
              {text('remarks', 'Any Other Remark', { placeholder: 'e.g. No', multiline: true })}
            </View>
          </View>

          <View style={s.tail} />
        </ScrollView>

        {/* Issue / Update stays in reach at the foot */}
        <View style={s.footer}>
          <SaveButton
            state={saveState}
            icon={isEdit ? 'checkmark' : 'document-text-outline'}
            label={isEdit ? 'Update TC' : 'Issue TC'}
            busyLabel={isEdit ? 'Updating TC' : 'Issuing TC'}
            doneLabel={isEdit ? 'TC updated' : 'TC issued'}
            onPress={save}
          />
        </View>
      </Animated.View>

      <DateSheet
        visible={dateSheet !== null}
        title={dateSheet === 'issue' ? 'Date of issue' : 'Date of application'}
        value={dateSheet === 'issue' ? f.issue_date : f.application_date}
        onPick={d => (dateSheet === 'issue' ? set('issue_date')(d) : set('application_date')(d))}
        onClose={() => setDateSheet(null)}
      />
    </View>
  );
};

export default AdminTransferCertificateFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 24 },
  half: { flex: 1 },

  // Save, at the foot (the app's root keeps clear of the phone's own bar below)
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

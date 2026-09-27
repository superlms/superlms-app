import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import { TcClass, TcItem, TcPayload, createTc, getTcLookups, updateTc } from '../../api/adminTcCertificateApi';
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
import { CONDUCT, FAILED, NCC, PickedStudent, StudentPicker, longDate, today } from './adminTcUi';

/**
 * A Transfer Certificate issued, or edited, as the panel's form has it: the
 * student — class, section, then a search — who stays fixed once it is
 * issued, then the panel's four parts: Student & Academic, Attendance & Fees,
 * Activities & Conduct, and Issue Details, with the panel's defaults (Indian,
 * not failed, qualified for promotion, conduct Good, both dates today).
 *
 * Route params: item — the TC to edit; classes — the picker's classes.
 */

type Sheet = 'ncc' | 'conduct' | 'application' | 'issue' | null;

const num = (v: string) => {
  const n = parseInt(v.replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
};

const Heading = ({ children }: { children: string }) => <Text style={s.heading}>{children}</Text>;

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
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (classes.length === 0) getTcLookups().then(l => setClasses(l.classes ?? [])).catch(() => {});
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => {
    setF(prev => ({ ...prev, [k]: v }));
    setError('');
  };

  const save = async () => {
    if (!student) return setError('Please select a student.');
    if (!f.application_date) return setError('Select the date of application.');
    if (!f.issue_date) return setError('Select the date of issue.');
    if (!f.general_conduct) return setError('Select the general conduct.');

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

    setError('');
    setSaving(true);
    try {
      if (isEdit) {
        const done = await updateTc(editing!.id, payload);
        navigation.popTo('AdminTcDetail', { kind: 'tc', item: done ?? editing, classes });
      } else {
        await createTc(payload);
        navigation.goBack();
      }
    } catch (e) {
      setError(apiErr(e, 'Could not save the TC.'));
    } finally {
      setSaving(false);
    }
  };

  const optionSheet =
    sheet === 'ncc'
      ? { title: 'NCC / Scout / Guide', options: NCC, value: f.is_ncc_scout, pick: set('is_ncc_scout') }
      : sheet === 'conduct'
      ? { title: 'General Conduct', options: CONDUCT, value: f.general_conduct, pick: set('general_conduct') }
      : null;

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Transfer Certificate' : 'Issue Transfer Certificate'} onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <StudentPicker
            classes={classes}
            selected={student}
            locked={isEdit}
            onSelect={st => {
              setStudent(st);
              setError('');
            }}
            onClear={() => setStudent(null)}
          />

          {/* Student & Academic */}
          <Heading>Student & Academic</Heading>
          <View style={s.pair}>
            <FormCard style={s.half} label="Nationality" value={f.nationality} onChangeText={set('nationality')} autoCapitalize="words" />
            <FormCard style={s.half} label="Book No." value={f.book_no} onChangeText={set('book_no')} placeholder="e.g. 096" />
          </View>
          <SwitchRow label="Belongs to Scheduled Caste / Scheduled Tribe" value={f.is_sc_st} onValueChange={set('is_sc_st')} />
          <View style={s.pair}>
            <FormCard style={s.half} label="Class Last Studied" value={f.last_class_studied} onChangeText={set('last_class_studied')} placeholder="e.g. 12th" />
            <FormCard style={s.half} label="Exam Last Taken with Result" value={f.exam_last_taken} onChangeText={set('exam_last_taken')} placeholder="e.g. 12th Passed" />
          </View>
          <View>
            <FieldLabel>Whether Failed</FieldLabel>
            <Segment options={FAILED.map(o => ({ key: o, label: o }))} value={f.whether_failed} onChange={set('whether_failed')} />
          </View>
          <View>
            <FieldLabel>Qualified for Promotion</FieldLabel>
            <Segment
              options={[
                { key: 'Yes', label: 'Yes' },
                { key: 'No', label: 'No' },
              ]}
              value={f.qualified_for_promotion}
              onChange={set('qualified_for_promotion')}
            />
          </View>
          <FormCard
            label="Subjects Studied"
            value={f.subjects_studied}
            onChangeText={set('subjects_studied')}
            placeholder="e.g. Hindi, English, Mathematics, Science"
          />

          {/* Attendance & Fees */}
          <Heading>Attendance & Fees</Heading>
          <View style={s.pair}>
            <FormCard
              style={s.half}
              label="Total Working Days"
              value={f.total_working_days}
              onChangeText={v => set('total_working_days')(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={4}
            />
            <FormCard
              style={s.half}
              label="Days Present"
              value={f.days_present}
              onChangeText={v => set('days_present')(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
          <View style={s.pair}>
            <FormCard style={s.half} label="Fees Paid Upto" value={f.fees_paid_upto} onChangeText={set('fees_paid_upto')} placeholder="e.g. March 2026" />
            <FormCard style={s.half} label="Fee Concession (if any)" value={f.fee_concession} onChangeText={set('fee_concession')} placeholder="e.g. None" />
          </View>

          {/* Activities & Conduct */}
          <Heading>Activities & Conduct</Heading>
          <View style={s.pair}>
            <PickerCard style={s.half} label="NCC / Scout / Guide" value={f.is_ncc_scout} onPress={() => setSheet('ncc')} />
            <PickerCard style={s.half} label="General Conduct *" value={f.general_conduct} onPress={() => setSheet('conduct')} />
          </View>
          <FormCard
            label="Games / Extra-Curricular Activities"
            value={f.extra_activities}
            onChangeText={set('extra_activities')}
            placeholder="e.g. Cricket, Debate"
          />

          {/* Issue Details */}
          <Heading>Issue Details</Heading>
          <View style={s.pair}>
            <PickerCard
              style={s.half}
              label="Date of Application *"
              value={longDate(f.application_date)}
              icon="calendar-outline"
              onPress={() => setSheet('application')}
            />
            <PickerCard
              style={s.half}
              label="Date of Issue *"
              value={longDate(f.issue_date)}
              icon="calendar-outline"
              onPress={() => setSheet('issue')}
            />
          </View>
          <FormCard
            label="Reason for Leaving"
            value={f.reason_for_leaving}
            onChangeText={set('reason_for_leaving')}
            placeholder="e.g. No Further Classes"
          />
          <FormCard
            label="Any Other Remark"
            value={f.remarks}
            onChangeText={set('remarks')}
            placeholder="e.g. No"
            multiline
            minHeight={64}
          />

          <FormError>{error}</FormError>

          <SubmitButton label={isEdit ? 'Update TC' : 'Issue TC'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={!!optionSheet}
        title={optionSheet?.title ?? ''}
        options={(optionSheet?.options ?? []).map(o => ({ key: o, label: o }))}
        selected={optionSheet ? [optionSheet.value] : []}
        onPick={k => optionSheet?.pick(k)}
        onClose={() => setSheet(null)}
      />

      <DateSheet
        visible={sheet === 'application' || sheet === 'issue'}
        title={sheet === 'issue' ? 'Date of issue' : 'Date of application'}
        value={sheet === 'issue' ? f.issue_date : f.application_date}
        onPick={d => (sheet === 'issue' ? set('issue_date')(d) : set('application_date')(d))}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminTransferCertificateFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  heading: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { Field, ToggleRow, ChipPicker } from './AdminStandardScreen';
import { AdminExam, ExamOptions, ExamPayload, createExam, deleteExam, updateExam } from '../../api/adminExamApi';

const empty: ExamPayload = {
  exam_name: '', term: 'Term-1', academic_year: '', start_date: '', end_date: '',
  exam_type: '', description: '', is_published: false, uses_grading_system: false, total_marks: '', passing_marks: '',
};

const AdminExamFormScreen = ({ navigation, route }: any) => {
  const editing: AdminExam | undefined = route.params?.exam;
  const options: ExamOptions | undefined = route.params?.options;
  const isEdit = !!editing;

  const [form, setForm] = useState<ExamPayload>(
    isEdit
      ? {
          exam_name: editing!.exam_name, term: editing!.term ?? 'Term-1', academic_year: editing!.academic_year,
          start_date: editing!.start_date ?? '', end_date: editing!.end_date ?? '', exam_type: editing!.exam_type,
          description: editing!.description ?? '', is_published: editing!.is_published,
          uses_grading_system: editing!.uses_grading_system,
          total_marks: editing!.total_marks ?? '', passing_marks: editing!.passing_marks ?? '',
        }
      : { ...empty, academic_year: options?.academic_years?.[0] ?? '' },
  );
  const [saving, setSaving] = useState(false);
  const setF = (k: keyof ExamPayload, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.exam_name.trim() || !form.academic_year || !form.start_date || !form.end_date || !form.exam_type) {
      return Alert.alert('Required', 'Name, academic year, dates and exam type are required.');
    }
    if (!form.uses_grading_system && (!form.total_marks || !form.passing_marks)) {
      return Alert.alert('Required', 'Total and passing marks are required unless using grading system.');
    }
    setSaving(true);
    try {
      if (isEdit) await updateExam(editing!.id, form);
      else await createExam(form);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save exam.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete Exam', `Delete "${editing!.exam_name}"? Its syllabus will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteExam(editing!.id); navigation.goBack(); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  return (
    <View style={s.root}>
      <Header title={isEdit ? 'Edit Exam' : 'New Exam'} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Field label="Exam Name" value={form.exam_name} onChangeText={(v: string) => setF('exam_name', v)} placeholder="e.g. Half Yearly 2026" />
          <Text style={s.label}>Term</Text>
          <ChipPicker items={(options?.terms ?? ['Term-1', 'Term-2']).map(t => ({ id: t, label: t }))} selected={[form.term]} onToggle={(id: any) => setF('term', id)} />
          <Text style={s.label}>Academic Year</Text>
          <ChipPicker items={(options?.academic_years ?? []).map(y => ({ id: y, label: y }))} selected={form.academic_year ? [form.academic_year] : []} onToggle={(id: any) => setF('academic_year', id)} />
          <Text style={s.label}>Exam Type</Text>
          <ChipPicker items={Object.entries(options?.exam_types ?? {}).map(([k, v]) => ({ id: k, label: v }))} selected={form.exam_type ? [form.exam_type] : []} onToggle={(id: any) => setF('exam_type', id)} />
          <Field label="Start Date" value={form.start_date} onChangeText={(v: string) => setF('start_date', v)} placeholder="YYYY-MM-DD" />
          <Field label="End Date" value={form.end_date} onChangeText={(v: string) => setF('end_date', v)} placeholder="YYYY-MM-DD" />
          <ToggleRow label="Uses Grading System" value={form.uses_grading_system} onValueChange={(v: boolean) => setF('uses_grading_system', v)} />
          {!form.uses_grading_system && (
            <>
              <Field label="Total Marks" value={String(form.total_marks ?? '')} onChangeText={(v: string) => setF('total_marks', v)} placeholder="e.g. 100" keyboardType="number-pad" />
              <Field label="Passing Marks" value={String(form.passing_marks ?? '')} onChangeText={(v: string) => setF('passing_marks', v)} placeholder="e.g. 33" keyboardType="number-pad" />
            </>
          )}
          <Field label="Description" value={form.description} onChangeText={(v: string) => setF('description', v)} placeholder="Optional" multiline />
          <ToggleRow label="Published" value={form.is_published} onValueChange={(v: boolean) => setF('is_published', v)} />

          {isEdit && (
            <TouchableOpacity style={s.deleteBtn} onPress={remove} activeOpacity={0.85}>
              <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} />
              <Text style={s.deleteText}>Delete Exam</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        <View style={s.footer}>
          <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.9} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{isEdit ? 'Update Exam' : 'Create Exam'}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminExamFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, height: 48, borderRadius: 12, backgroundColor: theme.colors.danger + '14' },
  deleteText: { fontSize: 15, fontWeight: '800', color: theme.colors.danger },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  saveBtn: { height: 52, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

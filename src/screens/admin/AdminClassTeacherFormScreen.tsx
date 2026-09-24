import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { AppAlert } from '../../components/AppDialog';
import { HeaderIconButton } from '../../components/Header';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AttClass,
  AttTeacher,
  ClassTeacherAssignment,
  deleteClassTeacher,
  getAttendanceLookups,
  getClassTeachers,
  saveClassTeacher,
} from '../../api/adminAttendanceApi';
import { DocHeader } from '../more/docUi';
import { FormError, Hint, OptionSheet, PickerCard, SubmitButton, confirmDestructive } from './adminFormUi';

/**
 * Assign a class teacher, or change or remove an assignment — the panel's
 * Assign Class Teacher: a teacher, a class, and a section of it or the whole
 * class. Only teachers who are not a class teacher yet are offered (and the
 * one being edited). The server keeps the panel's rules: a teacher is class
 * teacher of one class only, and the same class and section is not assigned
 * to them twice.
 */

const AdminClassTeacherFormScreen = ({ navigation, route }: any) => {
  const item: ClassTeacherAssignment | undefined = route?.params?.item;
  const isEdit = !!item;

  const [classes, setClasses] = useState<AttClass[]>([]);
  const [teachers, setTeachers] = useState<AttTeacher[]>([]);
  const [taken, setTaken] = useState<Set<number> | null>(null);
  const [teacherId, setTeacherId] = useState<number | null>(item?.teacher_id ?? null);
  const [classId, setClassId] = useState<number | null>(item?.standard_id ?? null);
  const [sectionId, setSectionId] = useState<number | null>(item?.section_id ?? null);
  const [sheet, setSheet] = useState<null | 'teacher' | 'class' | 'section'>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    getAttendanceLookups()
      .then(r => {
        setClasses(r.classes ?? []);
        setTeachers(r.teachers ?? []);
      })
      .catch(() => {});
    getClassTeachers({ mode: 'by_class' })
      .then(r => setTaken(new Set(r.taken.filter(t => t.id !== item?.id).map(t => t.teacher_id))))
      .catch(() => setTaken(new Set()));
  }, [item?.id]);

  // Teachers who are not a class teacher yet, and the one being edited.
  const free = teachers.filter(t => t.id === item?.teacher_id || !taken?.has(t.id));
  const teacher = teachers.find(t => t.id === teacherId) ?? null;
  const cls = classes.find(c => c.id === classId) ?? null;
  const sec = cls?.sections.find(x => x.id === sectionId) ?? null;

  const save = async () => {
    if (!teacherId) return setError('Please select a teacher.');
    if (!classId) return setError('Please select a class.');
    setError('');
    setSaving(true);
    try {
      const msg = await saveClassTeacher({ id: item?.id ?? null, teacher_detail_id: teacherId, standard_id: classId, section_id: sectionId });
      navigation.goBack();
      AppAlert.alert('Saved', msg);
    } catch (e) {
      setError(apiErr(e, 'Could not save the assignment.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    item &&
    confirmDestructive(
      'Remove assignment?',
      `${item.teacher_name} will no longer be class teacher of ${item.section ? `${item.standard} · ${item.section}` : item.standard}.`,
      'Remove',
      async () => {
        setRemoving(true);
        try {
          await deleteClassTeacher(item.id);
          navigation.goBack();
          AppAlert.alert('Removed', 'Assignment removed.');
        } catch (e) {
          AppAlert.alert('Not removed', apiErr(e, 'Could not remove the assignment.'));
        } finally {
          setRemoving(false);
        }
      },
    );

  return (
    <View style={s.root}>
      <DocHeader
        title={isEdit ? 'Edit Assignment' : 'Assign Class Teacher'}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          isEdit ? (
            removing ? (
              <ActivityIndicator style={s.headBusy} color={theme.colors.primary} />
            ) : (
              <HeaderIconButton icon="trash-outline" onPress={remove} />
            )
          ) : undefined
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Hint>Map a teacher to a class and section.</Hint>
        <View style={s.group}>
          <PickerCard label="Teacher" value={teacher?.name ?? null} placeholder="Select teacher" onPress={() => setSheet('teacher')} />
          {taken && free.length === 0 && <Hint>Every teacher is already a class teacher.</Hint>}
        </View>
        <PickerCard label="Class" value={cls?.name ?? null} placeholder="Select class" onPress={() => setSheet('class')} />
        <PickerCard
          label="Section"
          value={sec ? `Section ${sec.name}` : cls ? 'Whole class' : null}
          placeholder="Select a class first"
          disabled={!cls}
          onPress={() => setSheet('section')}
        />

        <FormError>{error}</FormError>
        <SubmitButton label={isEdit ? 'Update assignment' : 'Assign'} busy={saving} onPress={save} />
      </ScrollView>

      <OptionSheet
        visible={sheet === 'teacher'}
        title="Teacher"
        options={free.map(t => ({ key: String(t.id), label: t.name, sub: t.email }))}
        selected={teacher ? [String(teacher.id)] : []}
        onPick={k => { setSheet(null); setTeacherId(Number(k)); setError(''); }}
        onClose={() => setSheet(null)}
        emptyText="Every teacher is already a class teacher."
      />
      <OptionSheet
        visible={sheet === 'class'}
        title="Class"
        options={classes.map(c => ({ key: String(c.id), label: c.name }))}
        selected={cls ? [String(cls.id)] : []}
        onPick={k => { setSheet(null); setClassId(Number(k)); setSectionId(null); setError(''); }}
        onClose={() => setSheet(null)}
        emptyText="No classes yet."
      />
      <OptionSheet
        visible={sheet === 'section'}
        title="Section"
        options={[{ key: '', label: 'Whole class' }, ...(cls?.sections ?? []).map(x => ({ key: String(x.id), label: `Section ${x.name}` }))]}
        selected={[sec ? String(sec.id) : '']}
        onPick={k => { setSheet(null); setSectionId(k ? Number(k) : null); setError(''); }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminClassTeacherFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 14 },
  group: { gap: 6 },
  headBusy: { width: 40 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

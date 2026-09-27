import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import { CertItem, TcClass, createCert, getTcLookups, updateCert } from '../../api/adminTcCertificateApi';
import { DateSheet, FieldLabel, FormCard, FormError, PickerCard, Segment, SubmitButton } from './adminFormUi';
import { PickedStudent, StudentPicker, longDate, today } from './adminTcUi';

/**
 * A certificate issued, or edited, as the panel's form has it: Achievement or
 * Participation; the student — class, section, then a search — who stays fixed
 * once it is issued; the event or activity; an optional description; who
 * issued it, with an optional designation; and the date.
 *
 * Route params: type — the tab it was opened from; item — the certificate to
 * edit; classes — the picker's classes.
 */

type CertType = 'achievement' | 'participation';

const AdminCertificateFormScreen = ({ navigation, route }: any) => {
  const editing: CertItem | undefined = route?.params?.item;
  const isEdit = !!editing;

  const [classes, setClasses] = useState<TcClass[]>(route?.params?.classes ?? []);
  const [type, setType] = useState<CertType>(
    editing?.type ?? (route?.params?.type === 'participation' ? 'participation' : 'achievement'),
  );
  const [student, setStudent] = useState<PickedStudent | null>(
    editing ? { id: editing.student_id, full_name: editing.student_name ?? '—', admission_no: editing.admission_no } : null,
  );
  const [event, setEvent] = useState(editing?.event_name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [issuedBy, setIssuedBy] = useState(editing?.issued_by ?? '');
  const [designation, setDesignation] = useState(editing?.issued_by_designation ?? '');
  const [date, setDate] = useState(editing?.issued_date ?? today());
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (classes.length === 0) getTcLookups().then(l => setClasses(l.classes ?? [])).catch(() => {});
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError('');
  };

  const save = async () => {
    if (!student) return setError('Please select a student.');
    if (!event.trim()) return setError('Enter the event / activity name.');
    if (!issuedBy.trim()) return setError('Enter who issued it.');
    if (!date) return setError('Select the issued date.');

    const payload = {
      type,
      student_detail_id: student.id,
      event_name: event.trim(),
      issued_by: issuedBy.trim(),
      issued_by_designation: designation.trim(),
      description: description.trim(),
      issued_date: date,
    };

    setError('');
    setSaving(true);
    try {
      if (isEdit) {
        const done = await updateCert(editing!.id, payload);
        navigation.popTo('AdminTcDetail', { kind: 'cert', item: done ?? editing, classes });
      } else {
        await createCert(payload);
        navigation.goBack();
      }
    } catch (e) {
      setError(apiErr(e, 'Could not save the certificate.'));
    } finally {
      setSaving(false);
    }
  };

  const achievement = type === 'achievement';

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Certificate' : 'Issue Certificate'} onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View>
            <FieldLabel>Type *</FieldLabel>
            <Segment
              options={[
                { key: 'achievement', label: 'Achievement' },
                { key: 'participation', label: 'Participation' },
              ]}
              value={type}
              onChange={edit(setType)}
            />
          </View>

          <StudentPicker
            classes={classes}
            selected={student}
            locked={isEdit}
            onSelect={edit(setStudent)}
            onClear={() => setStudent(null)}
          />

          <FormCard
            label="Event / Activity Name *"
            value={event}
            onChangeText={edit(setEvent)}
            placeholder={achievement ? 'e.g. Annual Science Olympiad 2025' : 'e.g. Annual Sports Day 2025'}
            maxLength={255}
          />

          <FormCard
            label="Description (optional)"
            value={description}
            onChangeText={edit(setDescription)}
            placeholder={achievement ? 'For securing First Position in…' : 'For actively participating in…'}
            multiline
            minHeight={80}
            maxLength={1000}
          />

          <FormCard
            label="Issued By *"
            value={issuedBy}
            onChangeText={edit(setIssuedBy)}
            placeholder="e.g. Rajesh Kumar"
            maxLength={255}
            autoCapitalize="words"
          />

          <FormCard
            label="Designation (optional)"
            value={designation}
            onChangeText={edit(setDesignation)}
            placeholder="e.g. Principal"
            maxLength={100}
            autoCapitalize="words"
          />

          <PickerCard
            label="Issued Date *"
            value={longDate(date)}
            icon="calendar-outline"
            onPress={() => setDateOpen(true)}
          />

          <FormError>{error}</FormError>

          <SubmitButton label={isEdit ? 'Update Certificate' : 'Issue Certificate'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <DateSheet
        visible={dateOpen}
        title="Issued date"
        value={date}
        onPick={edit(setDate)}
        onClose={() => setDateOpen(false)}
      />
    </View>
  );
};

export default AdminCertificateFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

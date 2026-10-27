import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Select from '../../components/Select';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { CertItem, TcClass, createCert, getTcLookups, updateCert } from '../../api/adminTcCertificateApi';
import { DateSheet } from './adminFormUi';
import { useRevealFocused } from './adminProfileUi';
import {
  FieldPair,
  FormHeading,
  OutlinedField,
  OutlinedPicker,
  SaveButton,
  SaveState,
} from '../teacherStudents/outlinedFormUi';
import { FieldWrong, PickedStudent, StudentPicker, longDate, serverWrong, today, useFieldSpots } from './adminTcUi';

/**
 * A certificate issued, or edited, as the panel's form has it, drawn as Change
 * Password is: blocks under a quiet heading, each field a thin outline with its
 * name in the top border and a red star on the ones it will not save without.
 * Achievement or Participation; the student — class, section, then a search —
 * who stays fixed once it is issued; the event or activity; an optional
 * description; who issued it, with an optional designation; and the date.
 *
 * Save checks the fields in the order they stand and stops at the first one
 * that is missing: it turns red with what is wrong under it, and the form
 * scrolls to it (the keyboard up on a typed one), until it is filled in again.
 * The server's own refusal lands on its field the same way. Issue Certificate
 * (Update) stays at the foot, above the keyboard, with the saving sweep and
 * the green tick before the form closes.
 *
 * Route params: type — the tab it was opened from; item — the certificate to
 * edit; classes — the picker's classes.
 */

type CertType = 'achievement' | 'participation';
type Field = 'type' | 'student' | 'event' | 'description' | 'issued_by' | 'designation' | 'date';

// The server's name for each field.
const SERVER_FIELDS: Record<string, Field> = {
  type: 'type',
  student_detail_id: 'student',
  event_name: 'event',
  description: 'description',
  issued_by: 'issued_by',
  issued_by_designation: 'designation',
  issued_date: 'date',
};

const TYPES = [
  { label: 'Achievement', value: 'achievement' },
  { label: 'Participation', value: 'participation' },
];

// How long the green tick stays on the button before the form closes.
const DONE_HOLD = 750;

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
  const edit = <T,>(field: Field, set: (v: T) => void) => (v: T) => {
    set(v);
    setWrong(w => (w && (w.field === field || w.field === null) ? null : w));
  };
  const errorOf = (field: Field) => (wrong?.field === field ? wrong.message : null);

  const stop = (w: FieldWrong<Field>) => {
    setWrong(w.field ? w : null);
    if (w.field) goTo(w.field);
    else AppAlert.alert('Not saved', w.message);
  };

  const save = async () => {
    if (busy.current) return;
    if (!student) return stop({ field: 'student', message: 'Pick the student it is issued to.' });
    if (!event.trim()) return stop({ field: 'event', message: 'Write the event or activity it is for.' });
    if (!issuedBy.trim()) return stop({ field: 'issued_by', message: 'Write who issued it.' });
    if (!date) return stop({ field: 'date', message: 'Pick the date it was issued.' });

    const payload = {
      type,
      student_detail_id: student.id,
      event_name: event.trim(),
      issued_by: issuedBy.trim(),
      issued_by_designation: designation.trim(),
      description: description.trim(),
      issued_date: date,
    };

    setWrong(null);
    busy.current = true;
    setSaveState('saving');
    try {
      const done = isEdit ? await updateCert(editing!.id, payload) : await createCert(payload);
      setSaveState('done');
      // The green tick has a moment on the button, then the form closes — an
      // edit back to the certificate's page, which shows what was saved.
      closing.current = setTimeout(() => {
        closing.current = null;
        if (isEdit) navigation.popTo('AdminTcDetail', { kind: 'cert', item: done ?? editing, classes });
        else navigation.goBack();
      }, DONE_HOLD);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      stop(serverWrong(e, SERVER_FIELDS, 'Could not save the certificate.'));
    }
  };

  const achievement = type === 'achievement';

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Certificate' : 'Issue Certificate'} onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <View ref={contentRef} collapsable={false}>
            <FormHeading title="Certificate" first />
            <View ref={spot('type')} collapsable={false}>
              <Select
                notched
                required
                label="Type"
                value={type}
                options={TYPES}
                onChange={v => edit<CertType>('type', setType)(v as CertType)}
                error={errorOf('type')}
              />
            </View>

            <FormHeading title="Student" />
            <View ref={spot('student')} collapsable={false}>
              <StudentPicker
                classes={classes}
                selected={student}
                locked={isEdit}
                error={errorOf('student')}
                onSelect={edit<PickedStudent | null>('student', setStudent)}
                onClear={() => setStudent(null)}
              />
            </View>

            <FormHeading title="Event" />
            <View ref={spot('event')} collapsable={false}>
              <OutlinedField
                ref={input('event')}
                required
                label="Event / Activity Name"
                value={event}
                onChangeText={edit<string>('event', setEvent)}
                placeholder={achievement ? 'e.g. Annual Science Olympiad 2026' : 'e.g. Annual Sports Day 2026'}
                maxLength={255}
                error={errorOf('event')}
                returnKeyType="next"
              />
            </View>
            <View ref={spot('description')} collapsable={false}>
              <OutlinedField
                ref={input('description')}
                label="Description"
                hint="Optional"
                value={description}
                onChangeText={edit<string>('description', setDescription)}
                placeholder={achievement ? 'For securing First Position in…' : 'For actively participating in…'}
                multiline
                maxLength={1000}
                error={errorOf('description')}
              />
            </View>

            <FormHeading title="Issued" />
            <View ref={spot('issued_by')} collapsable={false}>
              <View ref={spot('designation')} collapsable={false}>
                <FieldPair>
                  <OutlinedField
                    ref={input('issued_by')}
                    half
                    required
                    label="Issued By"
                    value={issuedBy}
                    onChangeText={edit<string>('issued_by', setIssuedBy)}
                    placeholder="e.g. Rajesh Kumar"
                    maxLength={255}
                    autoCapitalize="words"
                    error={errorOf('issued_by')}
                  />
                  <OutlinedField
                    ref={input('designation')}
                    half
                    label="Designation"
                    value={designation}
                    onChangeText={edit<string>('designation', setDesignation)}
                    placeholder="e.g. Principal"
                    maxLength={100}
                    autoCapitalize="words"
                    error={errorOf('designation')}
                  />
                </FieldPair>
              </View>
            </View>
            <View ref={spot('date')} collapsable={false}>
              <OutlinedPicker
                required
                label="Issued Date"
                value={longDate(date)}
                placeholder="Pick a date"
                icon="calendar-outline"
                error={errorOf('date')}
                onPress={() => setDateOpen(true)}
              />
            </View>
          </View>

          <View style={s.tail} />
        </ScrollView>

        {/* Issue / Update stays in reach at the foot */}
        <View style={s.footer}>
          <SaveButton
            state={saveState}
            icon={isEdit ? 'checkmark' : 'ribbon-outline'}
            label={isEdit ? 'Update Certificate' : 'Issue Certificate'}
            busyLabel={isEdit ? 'Updating certificate' : 'Issuing certificate'}
            doneLabel={isEdit ? 'Certificate updated' : 'Certificate issued'}
            onPress={save}
          />
        </View>
      </Animated.View>

      <DateSheet
        visible={dateOpen}
        title="Issued date"
        value={date}
        onPick={edit<string>('date', setDate)}
        onClose={() => setDateOpen(false)}
      />
    </View>
  );
};

export default AdminCertificateFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 24 },

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

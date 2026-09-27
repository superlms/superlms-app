import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import moment from 'moment';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import { FormField, FormSection } from '../teacherStudents/studentFormUi';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { toApiDate, typeDate } from '../../utils/dayMonthYear';
import { RcResult, issueReportCards } from '../../api/adminReportCardApi';
import { Segment } from './adminFormUi';

/**
 * What goes on the cards — the panel's Issue Report Cards slide-in, drawn as
 * Add Student is: the batch's Issue Date (today to start with, typed
 * DD/MM/YYYY), then for each ticked student their Regd. No (started from
 * their registration number), a remark (up to 500 characters) and the result
 * — Auto, PASSED or FAILED. A blank remark and Auto leave the card to work
 * them out from the marks, as on the panel. Issued, the page goes back to the
 * students, who now show their cards.
 *
 * Route params: classId, className, sectionId, sectionName, and students —
 * [{ id, full_name, admission_no, registration_number }].
 */

// Every box here wears the accent's outline once it holds something.
const Field = (props: any) => <FormField markFilled {...props} />;

type Result = '' | RcResult;
const RESULTS: { key: 'AUTO' | RcResult; label: string }[] = [
  { key: 'AUTO', label: 'Auto' },
  { key: 'PASSED', label: 'PASSED' },
  { key: 'FAILED', label: 'FAILED' },
];

interface Picked {
  id: number;
  full_name: string;
  admission_no?: string | null;
  registration_number?: string | null;
}

interface Row {
  regd_no: string;
  remark: string;
  result: Result;
}

const AdminReportCardIssueScreen = ({ navigation, route }: any) => {
  const classId: number = route?.params?.classId;
  const sectionId: number = route?.params?.sectionId;
  const students: Picked[] = route?.params?.students ?? [];
  const where = [route?.params?.className, route?.params?.sectionName].filter(Boolean).join(' · ');

  const [issueDate, setIssueDate] = useState(moment().format('DD/MM/YYYY'));
  const [rows, setRows] = useState<Record<number, Row>>(() =>
    Object.fromEntries(students.map(st => [st.id, { regd_no: String(st.registration_number ?? ''), remark: '', result: '' as Result }])),
  );
  const [saving, setSaving] = useState(false);

  const setRow = (id: number, k: keyof Row, v: string) => setRows(prev => ({ ...prev, [id]: { ...prev[id], [k]: v } }));

  // The page rides above the keyboard, and the box being typed in is scrolled
  // up to sit clear of it — when the keyboard opens, and when another box is
  // tapped while it is open.
  const lift = useKeyboardLiftStyle();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const reveal = () => {
    const top = keyboardTop.current;
    const input: any = TextInput.State.currentlyFocusedInput?.();
    if (top == null || !input?.measureInWindow) return;
    input.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      const overlap = y + h + 24 - top;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
    });
  };
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      keyboardTop.current = e.endCoordinates.screenY;
      setTimeout(reveal, 120);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const issue = async () => {
    if (students.length === 0) return AppAlert.alert('Warning', 'Please select at least one student.');
    const date = toApiDate(issueDate);
    if (!date) return AppAlert.alert('Please check', 'Please pick an issue date — DD/MM/YYYY, a real date.');

    setSaving(true);
    try {
      const res = await issueReportCards({
        standard_id: classId,
        section_id: sectionId,
        student_ids: students.map(st => st.id),
        issue_date: date,
        details: students.map(st => ({
          student_id: st.id,
          regd_no: rows[st.id]?.regd_no.trim() ?? '',
          remark: rows[st.id]?.remark.trim() ?? '',
          result: rows[st.id]?.result ?? '',
        })),
      });
      AppAlert.alert(
        'Success!',
        res.message ??
          `Successfully issued ${res.issued} report card(s).` + (res.skipped > 0 ? ` ${res.skipped} skipped (already issued).` : ''),
      );
      navigation.goBack();
    } catch (e) {
      AppAlert.alert('Error!', apiErr(e, 'Failed to issue report cards.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title="Issue Report Cards" onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }}
          onTouchEnd={() => setTimeout(reveal, 250)}
        >
          <Text style={s.intro}>
            {[where, `${students.length} student${students.length === 1 ? '' : 's'} — these details print on the card`]
              .filter(Boolean)
              .join(' · ')}
          </Text>

          <FormSection title="Issue" first />
          <Field
            label="Issue Date"
            value={issueDate}
            onChangeText={(t: string) => setIssueDate(typeDate(t, issueDate))}
            placeholder="DD/MM/YYYY"
            keyboardType="number-pad"
            maxLength={10}
            hint="Prints as “Issue Date” on every card in this batch."
          />

          {students.map((st, i) => {
            const row = rows[st.id];
            return (
              <View key={st.id}>
                <FormSection title={`Student ${i + 1} of ${students.length}`} />
                <Text style={s.student} numberOfLines={1}>{st.full_name || '—'}</Text>
                {!!st.admission_no && <Text style={s.studentSub} numberOfLines={1}>{st.admission_no}</Text>}
                <Field
                  label="Regd. No"
                  value={row?.regd_no ?? ''}
                  onChangeText={(t: string) => setRow(st.id, 'regd_no', t)}
                  placeholder="—"
                  maxLength={50}
                  autoCapitalize="characters"
                />
                <Field
                  label="Remark"
                  value={row?.remark ?? ''}
                  onChangeText={(t: string) => setRow(st.id, 'remark', t)}
                  placeholder="Leave blank to use the marks-based remark"
                  maxLength={500}
                  multiline
                />
                <Text style={s.label}>Result</Text>
                <Segment
                  options={RESULTS}
                  value={row?.result ? row.result : 'AUTO'}
                  onChange={k => setRow(st.id, 'result', k === 'AUTO' ? '' : k)}
                />
              </View>
            );
          })}

          <Text style={s.note}>
            Regd. No is prefilled from the student’s registration number. Leave a remark blank and the card writes one from the
            percentage; leave Result on Auto and it passes anyone above 33% in every subject.
          </Text>

          <TouchableOpacity style={[s.saveBtn, saving && s.idle]} onPress={issue} disabled={saving} activeOpacity={0.9}>
            {saving ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={s.saveText}>{`Issue ${students.length} Report Card${students.length === 1 ? '' : 's'}`}</Text>
            )}
          </TouchableOpacity>

          <View style={s.tail} />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

export default AdminReportCardIssueScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 48 },

  intro: { fontSize: 13, color: theme.colors.textSecondary, paddingTop: 12, lineHeight: 19 },
  student: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary, marginTop: 4 },
  studentSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  note: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18, marginTop: 24 },

  saveBtn: {
    marginTop: 20,
    height: 50,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { opacity: 0.7 },
  saveText: { fontSize: 15, fontWeight: '700', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

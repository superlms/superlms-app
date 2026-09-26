import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import {
  FieldLabel,
  FormCard,
  FormError,
  Hint,
  OptionSheet,
  PickerCard,
  SubmitButton,
} from './adminFormUi';
import { AdmitCardLookups, generateAdmitCards, getAdmitLookups } from '../../api/adminAdmitCardApi';

/**
 * Issue Admit Cards — the web's Issue panel as the app's forms are drawn: the
 * exam and class (and a section, or all of them), then who gets a card —
 * everyone, or those at or above an attendance or fee-paid percentage. Only
 * students without this exam's card are given one, so the rest can be issued
 * later without anyone getting two. Subjects, dates and times come from the
 * exam's datesheet; seat and room from the seating plan.
 *
 * Route params (all optional, from where it was opened): examId, classId, sectionId.
 */

type Criteria = 'none' | 'attendance' | 'fee';

const CRITERIA: { key: Criteria; label: string; sub: string }[] = [
  { key: 'none', label: 'All students', sub: 'Everyone in the class' },
  { key: 'attendance', label: 'By attendance', sub: 'Attendance % at or above the threshold' },
  { key: 'fee', label: 'By fee', sub: 'Fee paid % at or above the threshold' },
];

const AdminAdmitCardIssueScreen = ({ navigation, route }: any) => {
  const [lookups, setLookups] = useState<AdmitCardLookups | null>(null);
  const [examId, setExamId] = useState<number | null>(route?.params?.examId ?? null);
  const [classId, setClassId] = useState<number | null>(route?.params?.classId ?? null);
  const [sectionId, setSectionId] = useState<number | null>(route?.params?.sectionId ?? null);
  const [criteria, setCriteria] = useState<Criteria>('none');
  const [percentage, setPercentage] = useState('75');

  const [sheet, setSheet] = useState<'exam' | 'class' | 'section' | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');

  useEffect(() => {
    getAdmitLookups()
      .then(setLookups)
      .catch(e => setError(apiErr(e, 'Could not load the exams and classes.')));
  }, []);

  const exams = lookups?.exams ?? [];
  const classes = lookups?.classes ?? [];
  const exam = exams.find(e => e.id === examId);
  const cls = classes.find(c => c.id === classId);
  const sections = cls?.sections ?? [];
  const section = sections.find(x => x.id === sectionId);

  const run = async () => {
    // The panel's rules: an exam and a class, and a whole-number percentage
    // from 1 to 100 unless everyone gets a card.
    if (!examId) return setError('Select the exam.');
    if (!classId) return setError('Select the class.');
    const pct = Number(percentage);
    if (criteria !== 'none' && (!/^\d+$/.test(percentage.trim()) || pct < 1 || pct > 100)) {
      return setError('The percentage must be a whole number from 1 to 100.');
    }

    setError('');
    setSaving(true);
    try {
      const res = await generateAdmitCards({
        exam_id: examId,
        standard_id: classId,
        section_id: sectionId,
        criteria,
        percentage: criteria === 'none' ? undefined : pct,
      });
      setDoneMsg(
        `Issued ${res.generated} admit card(s).` +
          (res.skipped > 0 ? ` ${res.skipped} did not meet the criteria.` : ''),
      );
    } catch (e) {
      setError(apiErr(e, 'Could not issue the admit cards.'));
    } finally {
      setSaving(false);
    }
  };

  const closeDone = () => {
    setDoneMsg('');
    navigation.goBack();
  };

  return (
    <View style={s.root}>
      <DocHeader title="Issue Admit Cards" onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.intro}>Pick the exam and class, then who qualifies.</Text>

          <PickerCard
            label="Exam"
            value={exam ? [exam.name, exam.academic_year].filter(Boolean).join(' · ') : null}
            placeholder="Select exam"
            onPress={() => setSheet('exam')}
          />

          <View style={s.pair}>
            <PickerCard
              label="Class"
              value={cls?.name}
              placeholder="Select class"
              onPress={() => setSheet('class')}
              style={s.half}
            />
            <PickerCard
              label="Section"
              value={section ? section.name : cls ? 'All sections' : null}
              placeholder="All sections"
              onPress={() => setSheet('section')}
              disabled={sections.length === 0}
              style={s.half}
            />
          </View>

          {/* Who gets a card */}
          <View>
            <FieldLabel>Who gets a card</FieldLabel>
            <View style={s.choices}>
              {CRITERIA.map((c, i) => {
                const on = criteria === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[s.choice, i < CRITERIA.length - 1 && s.choiceDivider]}
                    activeOpacity={0.6}
                    onPress={() => setCriteria(c.key)}
                  >
                    <View style={s.choiceBody}>
                      <Text style={s.choiceLabel}>{c.label}</Text>
                      <Text style={s.choiceSub}>{c.sub}</Text>
                    </View>
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName={on ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={on ? theme.colors.primary : theme.colors.border}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {criteria !== 'none' && (
            <FormCard
              label={criteria === 'attendance' ? 'Minimum attendance %' : 'Minimum fee paid %'}
              value={percentage}
              onChangeText={t => {
                setPercentage(t.replace(/[^\d]/g, ''));
                setError('');
              }}
              placeholder="75"
              keyboardType="number-pad"
              maxLength={3}
            />
          )}

          <Hint>
            Subjects, dates and times come from the exam datesheet, seat and room from the seating plan.
            Students who already hold a card for this exam are skipped, so you can issue the rest later
            without duplicating anyone.
          </Hint>

          <FormError>{error}</FormError>

          <SubmitButton label="Issue" busy={saving} onPress={run} />
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={sheet === 'exam'}
        title="Exam"
        options={exams.map(e => ({ key: String(e.id), label: e.name, sub: e.academic_year ?? undefined }))}
        selected={examId ? [String(examId)] : []}
        onPick={k => {
          setExamId(Number(k));
          setError('');
        }}
        onClose={() => setSheet(null)}
        emptyText="No exams yet — add one under Exams."
      />
      <OptionSheet
        visible={sheet === 'class'}
        title="Class"
        options={classes.map(c => ({ key: String(c.id), label: c.name }))}
        selected={classId ? [String(classId)] : []}
        onPick={k => {
          if (Number(k) !== classId) setSectionId(null);
          setClassId(Number(k));
          setError('');
        }}
        onClose={() => setSheet(null)}
        emptyText="No classes yet."
      />
      <OptionSheet
        visible={sheet === 'section'}
        title="Section"
        options={[
          { key: '0', label: 'All sections' },
          ...sections.map(x => ({ key: String(x.id), label: x.name })),
        ]}
        selected={[String(sectionId ?? 0)]}
        onPick={k => setSectionId(Number(k) || null)}
        onClose={() => setSheet(null)}
      />

      <AppDialog
        visible={!!doneMsg}
        title="Done"
        message={doneMsg}
        actions={[{ text: 'Done', onPress: closeDone }]}
        onRequestClose={closeDone}
      />
    </View>
  );
};

export default AdminAdmitCardIssueScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },

  intro: { fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary },

  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  // Who gets a card
  choices: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
  },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  choiceDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  choiceBody: { flex: 1, gap: 2 },
  choiceLabel: { fontSize: 15, color: theme.colors.textPrimary },
  choiceSub: { fontSize: 12, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  getMarksSheet,
  saveMarksSheet,
  marksErrorMessage,
  type MarksClass,
  type MarksSheet,
  type SheetStudent,
} from '../../api/marksApi';
import type { Exam } from '../exam/examData';
import { Words } from '../exam/examUi';
import { marksClassLabel } from './MarksClassesScreen';

/**
 * Upload Marks, step three: one class's students for one exam and subject.
 *
 * Until marks are saved the screen is the entry sheet — roll number, name and
 * admission number, a box for the marks and the exam's total. Once saved it
 * opens as the list of what was added, with Edit in the header; Edit opens this
 * same sheet again (pushed with `edit`), filled in.
 *
 * As on the web panel, saving marks every student left blank absent.
 *
 * A load — the first, a pull to refresh on the saved list, Try again — draws
 * the page as a skeleton from the sheet it shows: the one on screen, the one
 * this class had last time, or, before that, one as long as the class with
 * as many marks and absences as the class list said.
 */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// 45 → "45", 45.5 → "45.5", 45.25 → "45.25"
const fmt = (n: number) => String(Number(n.toFixed(2)));

// Digits and one decimal point (two places), never above the total.
const cleanMark = (raw: string, max: number): string => {
  let t = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const dot = t.indexOf('.');
  if (dot !== -1) t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  if (t.startsWith('.')) t = `0${t}`;
  const n = parseFloat(t);
  return !isNaN(n) && n > max ? String(max) : t;
};

const parseMark = (v?: string): number | null => {
  const n = parseFloat(v ?? '');
  return isNaN(n) ? null : n;
};

// The boxes as a saved sheet fills them: marks, and blank for the absent.
const typedOf = (sheet: MarksSheet) => {
  const typed: Record<number, string> = {};
  sheet.students.forEach(st => {
    if (st.saved && !st.is_absent && st.marks_obtained != null) {
      typed[st.student_detail_id] = fmt(st.marks_obtained);
    }
  });
  return typed;
};

// ── A sheet to draw before the class has ever loaded here ────────────────────
const SAMPLE_NAMES = [
  'Aarav Sharma',
  'Ananya Verma',
  'Arjun Singh',
  'Diya Patel',
  'Ishaan Gupta',
  'Kavya Reddy',
  'Krishna Yadav',
  'Meera Joshi',
  'Mohit Kumar',
  'Neha Mishra',
  'Pranav Nair',
  'Riya Chauhan',
  'Rohan Mehta',
  'Saanvi Iyer',
  'Shreya Pandey',
  'Vihaan Rao',
];

const sampleSheet = (exam: Exam, cls: MarksClass): MarksSheet => {
  const total = exam.totalMarks > 0 ? exam.totalMarks : 100;
  const uploaded = cls.saved > 0;
  return {
    exam: { id: Number(exam.id), name: exam.name, total_marks: total, passing_marks: null },
    uploaded,
    students: Array.from({ length: cls.students }, (_, i): SheetStudent => {
      const saved = uploaded && i < cls.saved;
      const absent = saved && i >= cls.saved - cls.absent;
      return {
        student_detail_id: -(i + 1),
        name: SAMPLE_NAMES[i % SAMPLE_NAMES.length],
        roll_no: String(i + 1),
        admission_no: `ADM${1001 + i}`,
        mark_id: null,
        saved,
        is_absent: absent,
        marks_obtained: saved && !absent ? Math.round(total * (0.45 + ((i * 37) % 50) / 100)) : null,
        max_marks: saved ? total : null,
        percentage: null,
        grade: saved ? (absent ? 'AB' : 'A') : null,
      };
    }),
  };
};

// ── A saved student ──────────────────────────────────────────────────────────
//   001  Aarav Sharma                               45 / 50
//        26TST510001                               Grade O
const SavedRow = ({
  st,
  total,
  isLast,
  skeleton,
}: {
  st: SheetStudent;
  total: number;
  isLast: boolean;
  skeleton: boolean;
}) => (
  <View style={[s.row, !isLast && s.rowDivider]}>
    <View style={s.roll}>
      <Words skeleton={skeleton} style={s.rollText} numberOfLines={1}>
        {st.roll_no || '—'}
      </Words>
    </View>
    <View style={s.body}>
      <Words skeleton={skeleton} style={s.name} numberOfLines={1}>
        {st.name}
      </Words>
      <Words skeleton={skeleton} style={s.meta} numberOfLines={1}>
        {st.admission_no || '—'}
      </Words>
    </View>
    <View style={s.result}>
      {!st.saved ? (
        <Words skeleton={skeleton} style={s.notAdded}>
          Not added
        </Words>
      ) : st.is_absent ? (
        <Words skeleton={skeleton} style={s.absent}>
          Absent
        </Words>
      ) : (
        <>
          <Words skeleton={skeleton} style={s.score}>
            {fmt(st.marks_obtained ?? 0)}
            <Text style={s.outOf}> / {fmt(st.max_marks ?? total)}</Text>
          </Words>
          {!!st.grade && (
            <Words skeleton={skeleton} style={s.grade}>
              Grade {st.grade}
            </Words>
          )}
        </>
      )}
    </View>
  </View>
);

const MarksSheetScreen = ({ navigation, route }: any) => {
  const { exam, cls, edit } = route.params as { exam: Exam; cls: MarksClass; edit?: boolean };
  const key = useMemo(
    () => ({
      exam_id: Number(exam.id),
      standard_id: cls.standard_id,
      section_id: cls.section_id,
      subject_id: cls.subject_id,
    }),
    [exam.id, cls.standard_id, cls.section_id, cls.subject_id],
  );

  const [sheet, setSheet] = useState<MarksSheet | null>(null);
  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back from Edit updates the list in place.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [last, rememberLast] = useLastLoaded<MarksSheet>(
    `marks-sheet:${key.exam_id}:${key.standard_id}:${key.section_id}:${key.subject_id}`,
  );
  // Typed marks survive a return to the screen; only a clean sheet reloads.
  const dirty = useRef(false);
  const inputs = useRef<Record<number, TextInput | null>>({});

  const fill = (next: MarksSheet) => {
    dirty.current = false;
    setMarks(typedOf(next));
    setSheet(next);
  };

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const next = await getMarksSheet(key);
        fill(next);
        rememberLast(next);
      } catch (e: any) {
        console.log('[getMarksSheet] Error:', e?.response?.status, e?.message);
        setError(marksErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [key, rememberLast],
  );

  const reload = useCallback(() => load(true), [load]);

  // The saved list reloads when Edit comes back to it.
  useFocusLoad(() => {
    if (!dirty.current) load();
  });

  // The sheet the page is drawn from: while loading, what it last showed.
  const view: MarksSheet | null = loading
    ? sheet ?? (last && Array.isArray(last.students) ? last : null) ?? sampleSheet(exam, cls)
    : sheet;

  const editing = !!edit || (!!view && !view.uploaded);
  const students = useMemo(() => view?.students ?? [], [view]);
  const total = view?.exam.total_marks ?? (exam.totalMarks || 100);
  const typed = view && view !== sheet ? typedOf(view) : marks;

  const entered = students.filter(st => parseMark(typed[st.student_detail_id]) !== null).length;
  const blank = students.length - entered;

  const summary = useMemo(() => {
    const scored = students.filter(st => st.saved && !st.is_absent && st.marks_obtained != null);
    const sum = scored.reduce((acc, st) => acc + (st.marks_obtained ?? 0), 0);
    return {
      added: students.filter(st => st.saved).length,
      absent: students.filter(st => st.saved && st.is_absent).length,
      average: scored.length ? fmt(sum / scored.length) : null,
    };
  }, [students]);

  const setMark = (id: number, raw: string) => {
    dirty.current = true;
    const v = cleanMark(raw, total);
    setMarks(prev => {
      const next = { ...prev };
      if (v === '') delete next[id];
      else next[id] = v;
      return next;
    });
  };

  const focusNext = (index: number) => {
    const next = students[index + 1];
    if (next) inputs.current[next.student_detail_id]?.focus();
    else Keyboard.dismiss();
  };

  const submit = async () => {
    if (!sheet) return;
    Keyboard.dismiss();
    setSaving(true);
    try {
      const { sheet: next, message } = await saveMarksSheet(
        key,
        sheet.students.map(st => ({
          student_detail_id: st.student_detail_id,
          marks_obtained: parseMark(marks[st.student_detail_id]),
        })),
      );
      dirty.current = false;
      rememberLast(next);
      if (edit) {
        // Back to the saved list, which reloads on focus.
        navigation.goBack();
      } else {
        fill(next);
      }
      AppAlert.alert('Marks saved', message);
    } catch (e: any) {
      console.log('[saveMarksSheet] Error:', e?.response?.status, e?.message);
      AppAlert.alert('Couldn’t save marks', marksErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (entered === 0) {
      AppAlert.alert('Nothing to save', 'Enter marks for at least one student — the rest will be marked absent.');
      return;
    }
    if (blank > 0) {
      AppAlert.alert(
        'Mark absent?',
        `${plural(blank, 'student has', 'students have')} no marks and will be marked absent.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: submit },
        ],
      );
      return;
    }
    submit();
  };

  // Exam, class and subject, then the totals.
  const renderIntro = (v: MarksSheet, skeleton: boolean) => (
    <View style={s.intro}>
      <Words skeleton={skeleton} style={s.introTitle} numberOfLines={1}>
        {cls.subject_name} · {marksClassLabel(cls)}
      </Words>
      <Words skeleton={skeleton} style={s.meta} numberOfLines={1}>
        {v.exam.name}
      </Words>
      <View style={s.totals}>
        <Words skeleton={skeleton} style={s.total}>
          Total marks <Text style={s.totalNum}>{fmt(total)}</Text>
        </Words>
        {editing ? (
          <Words skeleton={skeleton} style={s.total}>
            Entered{' '}
            <Text style={[s.totalNum, s.accent]}>
              {entered} of {students.length}
            </Text>
          </Words>
        ) : (
          <>
            <Words skeleton={skeleton} style={s.total}>
              Added <Text style={[s.totalNum, s.accent]}>{summary.added}</Text>
            </Words>
            {summary.absent > 0 && (
              <Words skeleton={skeleton} style={s.total}>
                Absent <Text style={[s.totalNum, s.danger]}>{summary.absent}</Text>
              </Words>
            )}
            {summary.average !== null && (
              <Words skeleton={skeleton} style={s.total}>
                Average <Text style={s.totalNum}>{summary.average}</Text>
              </Words>
            )}
          </>
        )}
      </View>
      {editing && (
        <Words skeleton={skeleton} style={s.hint}>
          Students left blank will be marked absent.
        </Words>
      )}
    </View>
  );

  const renderColumns = (skeleton: boolean) => (
    <View style={s.columns}>
      <View style={s.roll}>
        <Words skeleton={skeleton} style={s.column}>
          Roll
        </Words>
      </View>
      <View style={s.body}>
        <Words skeleton={skeleton} style={s.column}>
          Student
        </Words>
      </View>
      <View style={editing ? s.markHead : s.result}>
        <Words skeleton={skeleton} style={s.column}>
          Marks
        </Words>
      </View>
    </View>
  );

  const renderEntryRow = (st: SheetStudent, i: number, skeleton: boolean) => {
    const value = typed[st.student_detail_id] ?? '';
    return (
      <View key={st.student_detail_id} style={[s.row, i < students.length - 1 && s.rowDivider]}>
        <View style={s.roll}>
          <Words skeleton={skeleton} style={s.rollText} numberOfLines={1}>
            {st.roll_no || '—'}
          </Words>
        </View>
        <View style={s.body}>
          <Words skeleton={skeleton} style={s.name} numberOfLines={1}>
            {st.name}
          </Words>
          <Words skeleton={skeleton} style={s.meta} numberOfLines={1}>
            {st.admission_no || '—'}
          </Words>
        </View>
        <View style={s.markCol}>
          {skeleton ? (
            <Skeleton width={60} height={38} radius={theme.radius.sm} />
          ) : (
            <TextInput
              ref={r => {
                inputs.current[st.student_detail_id] = r;
              }}
              style={[s.input, value !== '' && s.inputFilled]}
              value={value}
              onChangeText={t => setMark(st.student_detail_id, t)}
              placeholder="—"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="decimal-pad"
              maxLength={6}
              returnKeyType={i < students.length - 1 ? 'next' : 'done'}
              blurOnSubmit={false}
              onSubmitEditing={() => focusNext(i)}
              editable={!saving}
            />
          )}
          <View style={s.outOfBox}>
            <Words skeleton={skeleton} style={s.outOfInput}>
              / {fmt(total)}
            </Words>
          </View>
        </View>
      </View>
    );
  };

  const renderPage = (v: MarksSheet, skeleton: boolean) => {
    if (students.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={s.fillGrow}
          refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
        >
          <DocNoData
            icon="people-outline"
            title="No students"
            subtitle="There are no students in this class yet."
            skeleton={skeleton}
          />
        </ScrollView>
      );
    }

    if (!editing) {
      return (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          // The skeleton stands in for the spinner.
          refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
        >
          {renderIntro(v, skeleton)}
          {renderColumns(skeleton)}
          {students.map((st, i) => (
            <SavedRow
              key={st.student_detail_id}
              st={st}
              total={total}
              isLast={i === students.length - 1}
              skeleton={skeleton}
            />
          ))}
        </ScrollView>
      );
    }

    // Typed marks are not thrown away by a pull to refresh.
    return (
      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!skeleton}
      >
        {renderIntro(v, skeleton)}
        {renderColumns(skeleton)}
        {students.map((st, i) => renderEntryRow(st, i, skeleton))}

        <View style={s.footer}>
          <Words skeleton={skeleton} style={s.footerHint}>
            {blank > 0
              ? `${plural(blank, 'student', 'students')} left blank will be marked absent`
              : 'Every student has marks'}
          </Words>
          {skeleton ? (
            <Skeleton width="100%" height={48} radius={theme.radius.md} />
          ) : (
            <TouchableOpacity
              style={[s.saveBtn, (saving || entered === 0) && s.saveOff]}
              activeOpacity={0.85}
              disabled={saving}
              onPress={save}
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={s.saveText}>Save Marks</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderBody = () => {
    if (loading && view) return renderPage(view, true);

    if (!sheet) {
      return (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error ?? 'Something went wrong. Please try again.'}</Text>
          <TouchableOpacity onPress={reload} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return renderPage(sheet, false);
  };

  const canEdit = !editing && !!sheet && !loading && students.length > 0;

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DocHeader
        title={editing || !view ? 'Upload Marks' : 'Marks'}
        onBackPress={() => navigation.goBack()}
        rightIcon={canEdit ? 'create-outline' : undefined}
        onRightPress={canEdit ? () => navigation.push('MarksSheet', { exam, cls, edit: true }) : undefined}
      />
      <View style={s.fill}>{renderBody()}</View>
    </KeyboardAvoidingView>
  );
};

export default MarksSheetScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  fillGrow: { flexGrow: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },

  // Exam, class, totals
  intro: { paddingTop: 16, paddingBottom: 14, gap: 3 },
  introTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 },
  total: { fontSize: 13, color: theme.colors.textSecondary },
  totalNum: { fontWeight: '600', color: theme.colors.textPrimary },
  accent: { color: theme.colors.primary },
  danger: { color: theme.colors.danger },
  hint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6 },

  // Column headings
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  column: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  roll: { width: 32 },
  rollText: { fontSize: 13, color: theme.colors.textMuted },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },

  // Entry
  markCol: { width: 106, flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Over the box: the column less the "/ 50" beside it
  markHead: { width: 106, paddingRight: 46, alignItems: 'center' },
  input: {
    width: 60,
    height: 38,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
  inputFilled: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  outOfBox: { width: 40 },
  outOfInput: { fontSize: 13, color: theme.colors.textMuted },

  // Saved
  result: { width: 96, alignItems: 'flex-end', gap: 2 },
  score: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  outOf: { fontSize: 13, fontWeight: '400', color: theme.colors.textMuted },
  grade: { fontSize: 12, color: theme.colors.textSecondary },
  absent: { fontSize: 13, fontWeight: '600', color: theme.colors.danger },
  notAdded: { fontSize: 13, color: theme.colors.textMuted },

  // Save, after the last student
  footer: { marginTop: 24, gap: 10 },
  footerHint: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  saveBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveOff: { opacity: 0.45 },
  saveText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

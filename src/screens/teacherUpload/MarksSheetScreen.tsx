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
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
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

// ── Loading ──────────────────────────────────────────────────────────────────
const SheetSkeleton = ({ rows }: { rows: number }) => {
  const n = rows > 0 ? Math.min(rows, 12) : 8;
  return (
    <View style={s.list}>
      <View style={s.intro}>
        <Skeleton width="50%" height={15} />
        <Skeleton width="30%" height={13} />
        <View style={s.totals}>
          <Skeleton width={90} height={13} />
          <Skeleton width={80} height={13} />
        </View>
      </View>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={[s.row, i < n - 1 && s.rowDivider]}>
          <View style={s.roll}>
            <Skeleton width={18} height={12} />
          </View>
          <View style={s.skBody}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="30%" height={12} />
          </View>
          <Skeleton width={70} height={30} radius={8} />
        </View>
      ))}
    </View>
  );
};

// ── A saved student ──────────────────────────────────────────────────────────
//   001  Aarav Sharma                               45 / 50
//        26TST510001                               Grade O
const SavedRow = ({ st, total, isLast }: { st: SheetStudent; total: number; isLast: boolean }) => (
  <View style={[s.row, !isLast && s.rowDivider]}>
    <Text style={s.roll} numberOfLines={1}>
      {st.roll_no || '—'}
    </Text>
    <View style={s.body}>
      <Text style={s.name} numberOfLines={1}>
        {st.name}
      </Text>
      <Text style={s.meta} numberOfLines={1}>
        {st.admission_no || '—'}
      </Text>
    </View>
    <View style={s.result}>
      {!st.saved ? (
        <Text style={s.notAdded}>Not added</Text>
      ) : st.is_absent ? (
        <Text style={s.absent}>Absent</Text>
      ) : (
        <>
          <Text style={s.score}>
            {fmt(st.marks_obtained ?? 0)}
            <Text style={s.outOf}> / {fmt(st.max_marks ?? total)}</Text>
          </Text>
          {!!st.grade && <Text style={s.grade}>Grade {st.grade}</Text>}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  // Typed marks survive a return to the screen; only a clean sheet reloads.
  const dirty = useRef(false);
  const inputs = useRef<Record<number, TextInput | null>>({});

  const fill = (next: MarksSheet) => {
    const typed: Record<number, string> = {};
    next.students.forEach(st => {
      if (st.saved && !st.is_absent && st.marks_obtained != null) {
        typed[st.student_detail_id] = fmt(st.marks_obtained);
      }
    });
    dirty.current = false;
    setMarks(typed);
    setSheet(next);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      fill(await getMarksSheet(key));
    } catch (e: any) {
      console.log('[getMarksSheet] Error:', e?.response?.status, e?.message);
      setError(marksErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [key]);

  const { refreshing, onRefresh } = useRefresh(load);

  // The saved list reloads when Edit comes back to it.
  useFocusLoad(() => {
    if (!dirty.current) load();
  });

  const editing = !!edit || (!!sheet && !sheet.uploaded);
  const students = useMemo(() => sheet?.students ?? [], [sheet]);
  const total = sheet?.exam.total_marks ?? exam.totalMarks ?? 100;

  const entered = students.filter(st => parseMark(marks[st.student_detail_id]) !== null).length;
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
  const renderIntro = () => (
    <View style={s.intro}>
      <Text style={s.introTitle} numberOfLines={1}>
        {cls.subject_name} · {marksClassLabel(cls)}
      </Text>
      <Text style={s.meta} numberOfLines={1}>
        {sheet?.exam.name ?? exam.name}
      </Text>
      <View style={s.totals}>
        <Text style={s.total}>
          Total marks <Text style={s.totalNum}>{fmt(total)}</Text>
        </Text>
        {editing ? (
          <Text style={s.total}>
            Entered{' '}
            <Text style={[s.totalNum, s.accent]}>
              {entered} of {students.length}
            </Text>
          </Text>
        ) : (
          <>
            <Text style={s.total}>
              Added <Text style={[s.totalNum, s.accent]}>{summary.added}</Text>
            </Text>
            {summary.absent > 0 && (
              <Text style={s.total}>
                Absent <Text style={[s.totalNum, s.danger]}>{summary.absent}</Text>
              </Text>
            )}
            {summary.average !== null && (
              <Text style={s.total}>
                Average <Text style={s.totalNum}>{summary.average}</Text>
              </Text>
            )}
          </>
        )}
      </View>
      {editing && <Text style={s.hint}>Students left blank will be marked absent.</Text>}
    </View>
  );

  const renderColumns = () => (
    <View style={s.columns}>
      <Text style={[s.column, s.roll]}>Roll</Text>
      <Text style={[s.column, s.body]}>Student</Text>
      <Text style={[s.column, editing ? s.markHead : s.resultCol]}>Marks</Text>
    </View>
  );

  const renderBody = () => {
    if (!sheet && (loading || refreshing)) return <SheetSkeleton rows={cls.students} />;
    if (refreshing) return <SheetSkeleton rows={students.length} />;

    if (!sheet) {
      return (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error ?? 'Something went wrong. Please try again.'}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (students.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={s.fillGrow}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <DocNoData icon="people-outline" title="No students" subtitle="There are no students in this class yet." />
        </ScrollView>
      );
    }

    if (!editing) {
      return (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {renderIntro()}
          {renderColumns()}
          {students.map((st, i) => (
            <SavedRow key={st.student_detail_id} st={st} total={total} isLast={i === students.length - 1} />
          ))}
        </ScrollView>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderIntro()}
        {renderColumns()}
        {students.map((st, i) => {
          const value = marks[st.student_detail_id] ?? '';
          return (
            <View key={st.student_detail_id} style={[s.row, i < students.length - 1 && s.rowDivider]}>
              <Text style={s.roll} numberOfLines={1}>
                {st.roll_no || '—'}
              </Text>
              <View style={s.body}>
                <Text style={s.name} numberOfLines={1}>
                  {st.name}
                </Text>
                <Text style={s.meta} numberOfLines={1}>
                  {st.admission_no || '—'}
                </Text>
              </View>
              <View style={s.markCol}>
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
                <Text style={s.outOfInput}>/ {fmt(total)}</Text>
              </View>
            </View>
          );
        })}

        <View style={s.footer}>
          <Text style={s.footerHint}>
            {blank > 0
              ? `${plural(blank, 'student', 'students')} left blank will be marked absent`
              : 'Every student has marks'}
          </Text>
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
        </View>
      </ScrollView>
    );
  };

  const canEdit = !editing && !!sheet && students.length > 0 && !refreshing;

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DocHeader
        title={editing || !sheet ? 'Upload Marks' : 'Marks'}
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
  roll: { width: 32, fontSize: 13, color: theme.colors.textMuted },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },

  // Entry
  markCol: { width: 106, flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Over the box: the column less the "/ 50" beside it
  markHead: { width: 106, paddingRight: 46, textAlign: 'center' },
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
  outOfInput: { width: 40, fontSize: 13, color: theme.colors.textMuted },

  // Saved
  resultCol: { width: 96, textAlign: 'right' },
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

  // Loading
  skBody: { flex: 1, gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

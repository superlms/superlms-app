import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  HomeworkLookups,
  HomeworkRegister,
  StatusRow,
  StatusStudentRow,
  getHomeworkLookups,
  getHomeworkRegister,
} from '../../api/adminHomeworkApi';
import { dayTitle } from '../homework/homeworkUi';
import { ErrorState, FilterBar, FilterChip } from './adminExamUi';
import { OptionSheet } from './adminFormUi';
import { STATUS_DAYS, StatusChip, StatusLegend, StatusLine, shortDay, windowDays } from './adminHomeworkUi';

/**
 * Homework Status — the panel's completion register. A class and a section
 * set its scope; a student, a subject and a day (within the last 30 — older
 * homework is purged) narrow it, each as a pill. A new class clears the
 * section, student and subject, a new section the student and subject.
 *
 *  • With a student: day by day — the last 14 days, or the one day picked —
 *    each day's homework ticked green when they marked it done in the app,
 *    crossed red when not, or "No homework".
 *  • Without one: student by student across the scope — how many they have
 *    done of how many, and each homework as a green or red chip. Tapping a
 *    student picks them.
 */

type Sheet = 'class' | 'section' | 'student' | 'subject' | 'date' | null;

const AdminHomeworkStatusScreen = ({ navigation }: any) => {
  const [lookups, setLookups] = useState<HomeworkLookups | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [register, setRegister] = useState<HomeworkRegister | null>(null);
  // The section's students and subjects, kept while a student or subject narrows it.
  const [pickers, setPickers] = useState<Pick<HomeworkRegister, 'students' | 'subjects'>>({ students: [], subjects: [] });
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  const loadLookups = useCallback(() => {
    setLookupError(null);
    getHomeworkLookups()
      .then(setLookups)
      .catch(e => setLookupError(apiErr(e, 'Could not load the classes.')));
  }, []);
  useEffect(loadLookups, [loadLookups]);

  const classes = lookups?.classes ?? [];
  const cls = classes.find(c => c.id === classId) ?? null;
  const sections = cls?.sections ?? [];
  const sec = sections.find(x => x.id === sectionId) ?? null;
  const ready = !!cls && !!sec;
  const student = pickers.students.find(x => x.id === studentId) ?? null;
  const subject = pickers.subjects.find(x => x.id === subjectId) ?? null;

  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!classId || !sectionId) return;
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getHomeworkRegister({
        standard_id: classId,
        section_id: sectionId,
        student_id: studentId,
        subject_id: subjectId,
        date,
        days: STATUS_DAYS,
      });
      if (mine !== seq.current) return;
      setRegister(r);
      setPickers({ students: r.students ?? [], subjects: r.subjects ?? [] });
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the register.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [classId, sectionId, studentId, subjectId, date]);

  useEffect(() => {
    setRegister(null);
    if (ready) load();
  }, [load, ready]);

  const narrowed = !!(classId || sectionId || studentId || subjectId || date);
  const clearAll = () => {
    setClassId(null);
    setSectionId(null);
    setStudentId(null);
    setSubjectId(null);
    setDate(null);
    setPickers({ students: [], subjects: [] });
  };

  const sheetProps =
    sheet === 'class'
      ? {
          title: 'Class',
          options: classes.map(c => ({ key: String(c.id), label: c.name })),
          selected: [String(classId ?? '')],
          onPick: (k: string) => {
            if (Number(k) === classId) return;
            setClassId(Number(k));
            setSectionId(null);
            setStudentId(null);
            setSubjectId(null);
            setPickers({ students: [], subjects: [] });
          },
        }
      : sheet === 'section'
      ? {
          title: 'Section',
          options: sections.map(x => ({ key: String(x.id), label: x.name })),
          selected: [String(sectionId ?? '')],
          onPick: (k: string) => {
            if (Number(k) === sectionId) return;
            setSectionId(Number(k));
            setStudentId(null);
            setSubjectId(null);
            setPickers({ students: [], subjects: [] });
          },
        }
      : sheet === 'student'
      ? {
          title: 'Student',
          options: [
            { key: '', label: 'All students' },
            ...pickers.students.map(x => ({ key: String(x.id), label: x.name, sub: x.roll_no ? `Roll ${x.roll_no}` : undefined })),
          ],
          selected: [String(studentId ?? '')],
          onPick: (k: string) => setStudentId(k ? Number(k) : null),
        }
      : sheet === 'subject'
      ? {
          title: 'Subject',
          options: [{ key: '', label: 'All subjects' }, ...pickers.subjects.map(x => ({ key: String(x.id), label: x.name }))],
          selected: [String(subjectId ?? '')],
          onPick: (k: string) => setSubjectId(k ? Number(k) : null),
        }
      : {
          title: 'Assigned on',
          options: [
            { key: '', label: `Last ${STATUS_DAYS} days`, sub: 'The recent days, today first' },
            ...windowDays().map(d => ({ key: d, label: shortDay(d) })),
          ],
          selected: [date ?? ''],
          onPick: (k: string) => setDate(k || null),
        };

  // ── The register ──
  const byDay = register?.mode === 'by_day' || (!!register && !register.mode && !!register.student);
  const rows = register?.rows ?? [];

  const dayRows = () =>
    (rows as StatusRow[]).map((r, i) => {
      const key = moment(r.date, 'DD MMM YYYY').format('YYYY-MM-DD');
      return (
        <View key={`${r.date}-${i}`} style={[s.block, i < rows.length - 1 && s.divider]}>
          <Text style={s.blockTitle}>{moment(key, 'YYYY-MM-DD', true).isValid() ? dayTitle(key) : `${r.day}, ${r.date}`}</Text>
          {r.items.length === 0 ? (
            <Text style={s.none}>No homework</Text>
          ) : (
            r.items.map((it, j) => <StatusLine key={j} complete={it.complete} text={`${it.subject} · ${it.title}`} />)
          )}
        </View>
      );
    });

  const studentRows = () =>
    (rows as StatusStudentRow[]).length === 0 ? (
      <Text style={s.none}>No students in this section.</Text>
    ) : (
      (rows as StatusStudentRow[]).map((r, i) => (
        <TouchableOpacity
          key={r.student_id ?? i}
          style={[s.block, i < rows.length - 1 && s.divider]}
          activeOpacity={0.6}
          onPress={() => r.student_id && setStudentId(r.student_id)}
        >
          <View style={s.studentHead}>
            <View style={s.studentText}>
              <Text style={s.blockTitle} numberOfLines={1}>{r.name}</Text>
              {!!r.roll_no && <Text style={s.roll}>Roll {r.roll_no}</Text>}
            </View>
            <Text style={[s.done, r.total > 0 && r.completed === r.total && s.doneAll]}>
              {r.completed}/{r.total} done
            </Text>
          </View>
          {r.items.length === 0 ? (
            <Text style={s.none}>No homework</Text>
          ) : (
            <View style={s.chips}>
              {r.items.map((it, j) => (
                <StatusChip key={j} complete={it.complete} text={`${it.subject} · ${it.date}`} />
              ))}
            </View>
          )}
        </TouchableOpacity>
      ))
    );

  let body: React.ReactNode;
  if (!lookups && lookupError) {
    body = <ErrorState message={lookupError} onRetry={loadLookups} />;
  } else if (!ready) {
    body = (
      <DocNoData
        icon="checkmark-done-outline"
        title="Track homework completion"
        subtitle="Pick a class and section. Add a date, a student or a subject to narrow it further."
      />
    );
  } else if (!register && error) {
    body = <ErrorState message={error} onRetry={load} />;
  } else if (!register) {
    body = (
      <View style={s.list}>
        <View style={s.headSk}>
          <Skeleton width="46%" height={15} />
          <Skeleton width="30%" height={11} />
        </View>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[s.block, s.divider, s.skBlock]}>
            <Skeleton width={['40%', '52%', '36%', '48%'][i] as any} height={14} />
            <Skeleton width="72%" height={12} />
            <Skeleton width="58%" height={12} />
          </View>
        ))}
      </View>
    );
  } else {
    body = (
      <ScrollView
        style={s.fill}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={s.head}>
          <Text style={s.headTitle}>
            {byDay && register.student
              ? `${register.student.name}${register.student.roll_no ? ` · Roll ${register.student.roll_no}` : ''}`
              : `${cls?.name ?? ''} – ${sec?.name ?? ''} · All students`}
          </Text>
          {!!register.scope && <Text style={s.headLine}>{register.scope}</Text>}
          <StatusLegend />
        </View>
        {byDay ? dayRows() : studentRows()}
      </ScrollView>
    );
  }

  return (
    <View style={s.root}>
      <DocHeader title="Homework Status" onBackPress={() => navigation.goBack()} />

      <FilterBar onClear={narrowed ? clearAll : undefined}>
        <FilterChip label={cls?.name ?? 'Select class…'} active={!!cls} disabled={classes.length === 0} onPress={() => setSheet('class')} />
        <FilterChip
          label={sec ? `Section ${sec.name}` : 'Select section…'}
          active={!!sec}
          disabled={!cls || sections.length === 0}
          onPress={() => setSheet('section')}
        />
        <FilterChip label={student?.name ?? 'All students'} active={!!student} disabled={!ready} onPress={() => setSheet('student')} />
        <FilterChip label={subject?.name ?? 'All subjects'} active={!!subject} disabled={!ready} onPress={() => setSheet('subject')} />
        <FilterChip label={date ? shortDay(date) : `Last ${STATUS_DAYS} days`} active={!!date} onPress={() => setSheet('date')} />
      </FilterBar>
      <View style={s.fullDivider} />

      {body}

      <OptionSheet
        visible={sheet !== null}
        title={sheetProps.title}
        options={sheetProps.options}
        selected={sheetProps.selected}
        onPick={sheetProps.onPick}
        onClose={() => setSheet(null)}
        emptyText={sheet === 'student' ? 'No students in this section.' : undefined}
      />
    </View>
  );
};

export default AdminHomeworkStatusScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  fullDivider: { height: 1, backgroundColor: theme.colors.border, marginTop: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },

  // The register's head: whose it is, its scope, the legend
  head: { paddingTop: 14, paddingBottom: 6 },
  headTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  headLine: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  // A day, or a student
  block: { paddingVertical: 12, gap: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  blockTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 2 },
  none: { fontSize: 13, color: theme.colors.textMuted, paddingVertical: 2 },
  studentHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  studentText: { flex: 1 },
  roll: { fontSize: 12, color: theme.colors.textMuted },
  done: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  doneAll: { color: '#16A34A' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },

  // Loading
  headSk: { paddingTop: 16, paddingBottom: 8, gap: 8 },
  skBlock: { gap: 10 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

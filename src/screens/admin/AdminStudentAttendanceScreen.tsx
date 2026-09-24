import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AttClass,
  AttStudent,
  DayRecords,
  PersonCards,
  getAttendanceLookups,
  getPersonCards,
  getSectionStudents,
  getStudentRecords,
} from '../../api/adminAttendanceApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { Tabs } from '../analytics/analyticsUi';
import { DateSheet, OptionSheet, SubmitButton } from './adminFormUi';
import { Avatar, DropPill, ErrorBox, ListSkeleton } from './adminTransportUi';
import {
  DaySummary,
  DaySummarySkeleton,
  PersonMonths,
  PersonMonthsSkeleton,
  StatusTag,
  dayLabel,
  monthOptions,
  schoolYears,
} from './adminAttendanceUi';

/**
 * Student Attendance — the panel's Student tab, laid out as the student's
 * Attendance. A class and a section are picked first. By Date is that
 * section's register for a day: each student's status and remark, with the
 * day's present-% and counts. By Student is one student's month, or the whole
 * school year (April → March), as month calendars. Mark attendance opens a
 * fresh day on today, where the class and section are picked again; saved, it
 * comes back to that section's register for the day it saved.
 */

type View2 = 'by_date' | 'by_student';
type Range = 'monthly' | 'yearly';

const VIEWS: { key: View2; label: string }[] = [
  { key: 'by_date', label: 'By Date' },
  { key: 'by_student', label: 'By Student' },
];

const RANGES: { key: Range; label: string }[] = [
  { key: 'monthly', label: 'By month' },
  { key: 'yearly', label: 'Complete year' },
];

const today = () => moment().format('YYYY-MM-DD');

const AdminStudentAttendanceScreen = ({ navigation, route }: any) => {
  const [view, setView] = useState<View2>('by_date');
  const [classes, setClasses] = useState<AttClass[]>([]);

  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [students, setStudents] = useState<AttStudent[]>([]);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [range, setRange] = useState<Range>('monthly');
  const [month, setMonth] = useState(moment().format('YYYY-MM'));
  const [year, setYear] = useState(schoolYears()[0].key);

  const [records, setRecords] = useState<DayRecords | null>(null);
  const [cards, setCards] = useState<PersonCards | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<null | 'class' | 'section' | 'date' | 'student' | 'range' | 'month' | 'year'>(null);

  useEffect(() => {
    getAttendanceLookups()
      .then(r => setClasses(r.classes ?? []))
      .catch(() => {});
  }, []);

  // The section's students, for By Student's picker.
  useEffect(() => {
    setStudents([]);
    if (!classId || !sectionId) return;
    getSectionStudents(classId, sectionId)
      .then(setStudents)
      .catch(() => {});
  }, [classId, sectionId]);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      if (view === 'by_date' && classId && sectionId) {
        const r = await getStudentRecords(classId, sectionId, date);
        if (mine === seq.current) setRecords(r);
      } else if (view === 'by_student' && studentId) {
        const r = await getPersonCards('student', studentId, range === 'yearly' ? { year } : { month });
        if (mine === seq.current) setCards(r);
      }
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load attendance.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [view, classId, sectionId, date, studentId, range, month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const loaded = useRef(false);
  useFocusLoad(() => {
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    load();
  });

  // Saved, the mark page brings the section's register of the day it saved.
  const shown = route?.params?.show as { classId: number; sectionId: number; date: string } | undefined;
  const showAt: number | undefined = route?.params?.showAt;
  useEffect(() => {
    if (!shown || !showAt) return;
    setView('by_date');
    setRecords(null);
    setClassId(shown.classId);
    setSectionId(shown.sectionId);
    setStudentId(null);
    setDate(shown.date);
  }, [shown, showAt]);

  const cls = classes.find(c => c.id === classId) ?? null;
  const sec = cls?.sections.find(x => x.id === sectionId) ?? null;
  const student = students.find(x => x.id === studentId) ?? null;

  const byDate = () =>
    !classId || !sectionId ? (
      <DocNoData icon="people-outline" title="Select class & section" subtitle="Pick a class and a section above to see its attendance." />
    ) : error && !records ? (
      <ErrorBox message={error} onRetry={load} />
    ) : !records ? (
      <>
        <DaySummarySkeleton />
        <ListSkeleton photo />
      </>
    ) : (
      <>
        <DaySummary date={records.date} stats={records.stats} />
        {records.rows.length === 0 ? (
          <DocNoData icon="people-outline" title="No students found" subtitle="This section has no students yet." />
        ) : (
          records.rows.map((r, i) => (
            <TouchableOpacity
              key={`${r.id}-${i}`}
              style={[s.row, i < records.rows.length - 1 && s.divider]}
              activeOpacity={0.6}
              // A student opens their own month.
              onPress={() => {
                setStudentId(r.id);
                setCards(null);
                setRange('monthly');
                setMonth(moment(records.date).format('YYYY-MM'));
                setView('by_student');
              }}
            >
              <Avatar uri={r.image} name={r.name} />
              <View style={s.body}>
                <Text style={s.name} numberOfLines={1}>{r.name}</Text>
                <Text style={s.sub} numberOfLines={1}>
                  {[r.roll_no ? `Roll no. ${r.roll_no}` : null, r.remark || null].filter(Boolean).join(' · ') || r.email || ''}
                </Text>
              </View>
              <StatusTag status={r.status} />
            </TouchableOpacity>
          ))
        )}
      </>
    );

  const byStudent = () =>
    !studentId ? (
      <DocNoData icon="person-outline" title="Select a student" subtitle="Pick a class, a section and a student above to see their attendance." />
    ) : error && !cards ? (
      <ErrorBox message={error} onRetry={load} />
    ) : !cards ? (
      <PersonMonthsSkeleton />
    ) : (
      <PersonMonths data={cards} />
    );

  return (
    <View style={s.root}>
      <DocHeader title="Student Attendance" onBackPress={() => navigation.goBack()} />
      <Tabs tabs={VIEWS} active={view} onChange={v => { setError(null); setView(v); }} />

      <View style={s.filters}>
        <DropPill label={cls?.name ?? 'Select class'} active={!!cls} onPress={() => setSheet('class')} />
        <DropPill label={sec ? `Section ${sec.name}` : 'Select section'} active={!!sec} onPress={() => (cls ? setSheet('section') : setSheet('class'))} />
        {view === 'by_date' ? (
          <DropPill label={dayLabel(date)} active onPress={() => setSheet('date')} />
        ) : (
          <>
            <DropPill label={student?.name ?? 'Select student'} active={!!student} onPress={() => (sec ? setSheet('student') : setSheet(cls ? 'section' : 'class'))} />
            <DropPill label={RANGES.find(x => x.key === range)!.label} active onPress={() => setSheet('range')} />
            {range === 'yearly' ? (
              <DropPill label={schoolYears().find(y => y.key === year)?.label ?? year} active onPress={() => setSheet('year')} />
            ) : (
              <DropPill label={moment(month, 'YYYY-MM').format('MMMM YYYY')} active onPress={() => setSheet('month')} />
            )}
          </>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {view === 'by_date' ? byDate() : byStudent()}
      </ScrollView>

      <View style={s.foot}>
        <SubmitButton label="Mark attendance" onPress={() => navigation.navigate('AdminAttendanceMark', { who: 'student' })} />
      </View>

      <OptionSheet
        visible={sheet === 'class'}
        title="Class"
        options={classes.map(c => ({ key: String(c.id), label: c.name }))}
        selected={cls ? [String(cls.id)] : []}
        onPick={k => {
          setSheet(null);
          // A new class clears its section and student, as the panel does.
          setClassId(Number(k));
          setSectionId(null);
          setStudentId(null);
          setRecords(null);
          setCards(null);
        }}
        onClose={() => setSheet(null)}
        emptyText="No classes yet."
      />
      <OptionSheet
        visible={sheet === 'section'}
        title="Section"
        options={(cls?.sections ?? []).map(x => ({ key: String(x.id), label: `Section ${x.name}` }))}
        selected={sec ? [String(sec.id)] : []}
        onPick={k => {
          setSheet(null);
          setSectionId(Number(k));
          setStudentId(null);
          setRecords(null);
          setCards(null);
        }}
        onClose={() => setSheet(null)}
        emptyText="No sections in this class."
      />
      <DateSheet
        visible={sheet === 'date'}
        value={date}
        title="Date"
        onPick={d => { setSheet(null); setRecords(null); setDate(d); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'student'}
        title="Student"
        options={students.map(x => ({ key: String(x.id), label: x.name, sub: x.roll_no ? `Roll no. ${x.roll_no}` : undefined }))}
        selected={student ? [String(student.id)] : []}
        onPick={k => { setSheet(null); setCards(null); setStudentId(Number(k)); }}
        onClose={() => setSheet(null)}
        emptyText="No students in this section."
      />
      <OptionSheet
        visible={sheet === 'range'}
        title="Show"
        options={RANGES}
        selected={[range]}
        onPick={k => { setSheet(null); setCards(null); setRange(k as Range); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'month'}
        title="Month"
        options={monthOptions()}
        selected={[month]}
        onPick={k => { setSheet(null); setCards(null); setMonth(k); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'year'}
        title="School year"
        options={schoolYears()}
        selected={[year]}
        onPick={k => { setSheet(null); setCards(null); setYear(k); }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminStudentAttendanceScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  scroll: { paddingBottom: 110 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textMuted },
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: theme.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

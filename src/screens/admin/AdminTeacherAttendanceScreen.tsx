import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AttTeacher,
  DayRecords,
  MonthGrid,
  PersonCards,
  RecordStatus,
  getAttendanceLookups,
  getPersonCards,
  getTeacherMonthGrid,
  getTeacherRecords,
} from '../../api/adminAttendanceApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { Tabs } from '../analytics/analyticsUi';
import { DateSheet, OptionSheet } from './adminFormUi';
import { Avatar, DropPill, ErrorBox, ListSkeleton } from './adminTransportUi';
import {
  Legend,
  PersonMonths,
  PersonMonthsSkeleton,
  STATUS,
  StatusTag,
  dayLabel,
  monthOptions,
  schoolYears,
} from './adminAttendanceUi';

/**
 * Teacher Attendance — the panel's Teacher tab, laid out as the student's
 * Attendance. By Date is the day's teachers alone — photo, name and username,
 * with their status — narrowed by status. By Month is the month's dates down
 * the side and a column per teacher (or the one picked), with each teacher's
 * totals. By Teacher is one teacher's month, or the whole school year (April →
 * March), as month calendars. Mark in the header opens Mark Attendance on
 * today; saved, it comes back to that day's teachers.
 */

type View3 = 'by_date' | 'by_month' | 'by_teacher';
type Range = 'monthly' | 'yearly';

const VIEWS: { key: View3; label: string }[] = [
  { key: 'by_date', label: 'By Date' },
  { key: 'by_month', label: 'By Month' },
  { key: 'by_teacher', label: 'By Teacher' },
];

const STATUS_FILTER: { key: string; label: string }[] = [
  { key: '', label: 'All status' },
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
  { key: 'half_day', label: 'Half day' },
  { key: 'holiday', label: 'Holiday' },
  { key: 'not_marked', label: 'Not marked' },
];

const RANGES: { key: Range; label: string }[] = [
  { key: 'monthly', label: 'By month' },
  { key: 'yearly', label: 'Complete year' },
];

const today = () => moment().format('YYYY-MM-DD');

const AdminTeacherAttendanceScreen = ({ navigation, route }: any) => {
  const [view, setView] = useState<View3>('by_date');
  const [teachers, setTeachers] = useState<AttTeacher[]>([]);

  // Shared across the views, as the panel's selectors are.
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState('');
  const [month, setMonth] = useState(moment().format('YYYY-MM'));
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [range, setRange] = useState<Range>('monthly');
  const [year, setYear] = useState(schoolYears()[0].key);

  const [records, setRecords] = useState<DayRecords | null>(null);
  const [grid, setGrid] = useState<MonthGrid | null>(null);
  const [cards, setCards] = useState<PersonCards | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<null | 'date' | 'status' | 'month' | 'teacher' | 'range' | 'year'>(null);

  useEffect(() => {
    getAttendanceLookups()
      .then(r => setTeachers(r.teachers ?? []))
      .catch(() => {});
  }, []);

  // Only the latest request lands.
  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      if (view === 'by_date') {
        const r = await getTeacherRecords(date, status);
        if (mine === seq.current) setRecords(r);
      } else if (view === 'by_month') {
        const r = await getTeacherMonthGrid(month, teacherId);
        if (mine === seq.current) setGrid(r);
      } else if (teacherId) {
        const r = await getPersonCards('teacher', teacherId, range === 'yearly' ? { year } : { month });
        if (mine === seq.current) setCards(r);
      }
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load attendance.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [view, date, status, month, teacherId, range, year]);

  useEffect(() => {
    load();
  }, [load]);

  // Back from marking, the day shows what was saved.
  const loaded = useRef(false);
  useFocusLoad(() => {
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    load();
  });

  // Saved, the mark page brings the register of the day it saved.
  const showDate: string | undefined = route?.params?.showDate;
  const showAt: number | undefined = route?.params?.showAt;
  useEffect(() => {
    if (!showDate || !showAt) return;
    setView('by_date');
    setRecords(null);
    setDate(showDate);
  }, [showDate, showAt]);

  const switchView = (v: View3) => {
    setError(null);
    setView(v);
  };

  const pickTeacher = (id: number | null) => {
    setTeacherId(id);
    setGrid(null);
    setCards(null);
  };

  const teacherName = teachers.find(t => t.id === teacherId)?.name;

  // ── By Date ──
  const byDate = () =>
    error && !records ? (
      <ErrorBox message={error} onRetry={load} />
    ) : !records ? (
      <ListSkeleton photo />
    ) : (
      <>
        {records.rows.length === 0 ? (
          <DocNoData
            icon="people-outline"
            title="No teachers found"
            subtitle={status ? `No one is ${STATUS[status as RecordStatus]?.label.toLowerCase()} on this day.` : 'Add teachers under Teachers.'}
          />
        ) : (
          records.rows.map((r, i) => (
            <TouchableOpacity
              key={`${r.id}-${i}`}
              style={[s.row, i < records.rows.length - 1 && s.divider]}
              activeOpacity={0.6}
              // A teacher opens their own month.
              onPress={() => {
                pickTeacher(r.id);
                setRange('monthly');
                setMonth(moment(records.date).format('YYYY-MM'));
                switchView('by_teacher');
              }}
            >
              <Avatar uri={r.image} name={r.name} />
              <View style={s.body}>
                <Text style={s.name} numberOfLines={1}>{r.name}</Text>
                {!!r.username && <Text style={s.sub} numberOfLines={1}>{r.username}</Text>}
              </View>
              <StatusTag status={r.status} />
            </TouchableOpacity>
          ))
        )}
      </>
    );

  // ── By Month: the dates down the side, a column per teacher ──
  const byMonth = () =>
    error && !grid ? (
      <ErrorBox message={error} onRetry={load} />
    ) : !grid ? (
      <ListSkeleton rows={8} />
    ) : grid.teachers.length === 0 ? (
      <DocNoData icon="people-outline" title="No teachers found" subtitle="Add teachers under Teachers." />
    ) : (
      <View>
        <Text style={s.gridTitle}>Teacher Attendance · {grid.title}</Text>
        <Legend />
        <View style={s.gridWrap}>
          {/* The dates stay put while the teachers scroll across */}
          <View style={s.dateCol}>
            <View style={[s.gridHead, s.dateHead]}>
              <Text style={s.gridHeadText}>Date</Text>
            </View>
            {grid.rows.map(r => (
              <View key={r.date} style={[s.gridRow, s.dateCell, r.sunday && s.sundayRow]}>
                <Text style={[s.dateText, r.today && s.todayText]}>{r.label}</Text>
                <Text style={s.dowText}>{r.dow}</Text>
              </View>
            ))}
            <View style={[s.totalRow, s.dateCell]}>
              <Text style={s.gridHeadText}>Total</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={s.gridHeadRow}>
                {grid.teachers.map(t => (
                  <View key={t.id} style={[s.gridHead, s.teacherHead]}>
                    <Text style={s.teacherName} numberOfLines={2}>{t.name}</Text>
                  </View>
                ))}
              </View>
              {grid.rows.map(r => (
                <View key={r.date} style={[s.gridRowLine, r.sunday && s.sundayRow]}>
                  {grid.teachers.map(t => {
                    const st = r.cells[String(t.id)];
                    const m = st ? STATUS[st] : null;
                    return (
                      <View key={t.id} style={[s.gridRow, s.gridCell]}>
                        {m ? (
                          <View style={[s.code, { backgroundColor: m.fill ?? 'transparent' }]}>
                            <Text style={[s.codeText, { color: m.ink }]}>{m.short}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))}
              <View style={s.gridRowLine}>
                {grid.teachers.map(t => (
                  <View key={t.id} style={[s.totalRow, s.gridCell]}>
                    <Text style={[s.totalText, { color: STATUS.present.ink }]}>P {t.totals.present}</Text>
                    <Text style={[s.totalText, { color: STATUS.absent.ink }]}>A {t.totals.absent}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    );

  // ── By Teacher: one teacher's month or school year ──
  const byTeacher = () =>
    !teacherId ? (
      <DocNoData icon="person-outline" title="Select a teacher" subtitle="Pick a teacher above to see their attendance." />
    ) : error && !cards ? (
      <ErrorBox message={error} onRetry={load} />
    ) : !cards ? (
      <PersonMonthsSkeleton />
    ) : (
      <PersonMonths data={cards} />
    );

  return (
    <View style={s.root}>
      <DocHeader
        title="Teacher Attendance"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <TouchableOpacity
            style={s.markBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('AdminAttendanceMark', { who: 'teacher' })}
            accessibilityLabel="Mark attendance"
          >
            <Text style={s.markText}>Mark</Text>
          </TouchableOpacity>
        }
      />
      <Tabs tabs={VIEWS} active={view} onChange={switchView} />

      <View style={s.filters}>
        {view === 'by_date' && (
          <>
            <DropPill label={dayLabel(date)} active onPress={() => setSheet('date')} />
            <DropPill label={STATUS_FILTER.find(x => x.key === status)?.label ?? 'All status'} active={!!status} onPress={() => setSheet('status')} />
          </>
        )}
        {view === 'by_month' && (
          <>
            <DropPill label={moment(month, 'YYYY-MM').format('MMMM YYYY')} active onPress={() => setSheet('month')} />
            <DropPill label={teacherName ?? 'All teachers'} active={!!teacherId} onPress={() => setSheet('teacher')} />
          </>
        )}
        {view === 'by_teacher' && (
          <>
            <DropPill label={teacherName ?? 'Select teacher'} active={!!teacherId} onPress={() => setSheet('teacher')} />
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
        {view === 'by_date' ? byDate() : view === 'by_month' ? byMonth() : byTeacher()}
      </ScrollView>

      <DateSheet
        visible={sheet === 'date'}
        value={date}
        title="Date"
        onPick={d => { setSheet(null); setRecords(null); setDate(d); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'status'}
        title="Status"
        options={STATUS_FILTER}
        selected={[status]}
        onPick={k => { setSheet(null); setRecords(null); setStatus(k); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'month'}
        title="Month"
        options={monthOptions()}
        selected={[month]}
        onPick={k => { setSheet(null); setGrid(null); setCards(null); setMonth(k); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'teacher'}
        title="Teacher"
        options={[
          ...(view === 'by_month' ? [{ key: '', label: 'All teachers' }] : []),
          ...teachers.map(t => ({ key: String(t.id), label: t.name, sub: t.email })),
        ]}
        selected={[teacherId ? String(teacherId) : '']}
        onPick={k => { setSheet(null); pickTeacher(k ? Number(k) : null); }}
        onClose={() => setSheet(null)}
        emptyText="No teachers yet."
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

export default AdminTeacherAttendanceScreen;

const ROW = 36;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  scroll: { paddingBottom: 40 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textMuted },

  // By Month
  gridTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  gridWrap: { flexDirection: 'row', marginTop: 6, marginLeft: 20 },
  dateCol: { width: 70, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: theme.colors.border },
  gridHeadRow: { flexDirection: 'row' },
  gridHead: { height: 44, justifyContent: 'flex-end', paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  dateHead: { paddingLeft: 2 },
  gridHeadText: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted },
  teacherHead: { width: 58, paddingHorizontal: 4 },
  teacherName: { fontSize: 10, fontWeight: '600', color: theme.colors.textSecondary, textAlign: 'center' },
  gridRowLine: { flexDirection: 'row' },
  gridRow: { height: ROW, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.divider },
  dateCell: { justifyContent: 'center', paddingLeft: 2 },
  sundayRow: { backgroundColor: theme.colors.background },
  dateText: { fontSize: 12, color: theme.colors.textPrimary },
  todayText: { fontWeight: '700', color: theme.colors.primary },
  dowText: { fontSize: 10, color: theme.colors.textMuted },
  gridCell: { width: 58, alignItems: 'center', justifyContent: 'center' },
  code: { minWidth: 30, paddingHorizontal: 4, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  codeText: { fontSize: 11, fontWeight: '700' },
  totalRow: { height: 44, justifyContent: 'center' },
  totalText: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Mark attendance, in the header
  markBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.primaryLight },
  markText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

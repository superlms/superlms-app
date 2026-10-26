import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DayAttendance, Employee, getDayAttendance, getEmployees, typeLabel } from '../../api/adminPayrollApi';
import { DateSheet } from './adminFormUi';
import { DropPill, ErrorBox, ListSkeleton } from './adminTransportUi';
import { Band, ClearPill, NumLine, PickPill, Prompt } from './feeSetupUi';
import PayrollCalendarView from './PayrollCalendarView';

/**
 * Payroll → Attendance, as the panel's tab: two ways in, and nothing else — a
 * type and then one of its people (that person's months, as calendars), or a
 * date (everyone that day, a plain list: each person's status and remark, and
 * the day's counts). Mark Attendance in the header marks a day for everyone.
 */

export const STATUS_TEXT: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half day',
  holiday: 'Holiday',
  leave: 'Leave',
};

const TYPES = [
  { key: 'management', label: 'Management' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'driver', label: 'Driver' },
  { key: 'employee', label: 'Employee' },
];

const PayrollAttendanceTab = ({ reloadKey, jump }: { reloadKey: number; jump?: { date: string; at: number } | null }) => {
  const [type, setType] = useState('');
  const [people, setPeople] = useState<Employee[]>([]);
  const [empId, setEmpId] = useState<number | null>(null);
  const [date, setDate] = useState(jump?.date ?? '');
  const [dateOpen, setDateOpen] = useState(false);

  const [day, setDay] = useState<DayAttendance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [calKey, setCalKey] = useState(0);
  const seq = useRef(0);

  // Saved from Mark Attendance: straight to that date.
  useEffect(() => {
    if (jump?.date) {
      setDate(jump.date);
      setType('');
      setEmpId(null);
    }
  }, [jump?.date, jump?.at]);

  useEffect(() => {
    let live = true;
    setPeople([]);
    if (!type) return;
    getEmployees({ type })
      .then(d => live && setPeople(d.employees))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [type]);

  const loadDay = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    if (!date) {
      setDay(null);
      return;
    }
    try {
      const d = await getDayAttendance(date);
      if (mine === seq.current) setDay(d);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the attendance.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    setDay(null);
    loadDay();
  }, [loadDay, reloadKey]);

  useEffect(() => {
    setCalKey(k => k + 1);
  }, [reloadKey]);

  const person = people.find(p => p.id === empId) ?? null;

  const body = () => {
    if (empId) return <PayrollCalendarView employeeId={empId} name={person?.name} refreshKey={calKey} />;
    if (!date) {
      return <Prompt icon="calendar-outline" title="Pick a type and a person, or a date" sub="A person shows their months since April; a date shows everyone that day." />;
    }
    if (error && !day) return <ErrorBox message={error} onRetry={loadDay} />;
    if (!day) {
      return (
        <View style={s.pad}>
          <ListSkeleton rows={8} />
        </View>
      );
    }
    const c = day.counts;
    return (
      <View style={s.pad}>
        <Text style={s.dayTitle}>{day.label}</Text>
        <Text style={s.dayCounts}>
          {`Present ${c.present} · Absent ${c.absent} · Half day ${c.half_day} · Holiday ${c.holiday} · Not marked ${c.not_marked}`}
        </Text>
        {day.employees.length === 0 ? (
          <Prompt icon="people-outline" title="No employees found." />
        ) : (
          day.employees.map((e, i) => (
            <NumLine
              key={e.id}
              n={i + 1}
              label={e.name}
              sub={[e.types.map(typeLabel).join(', '), e.remark || null].filter(Boolean).join(' · ')}
              value={e.status ? STATUS_TEXT[e.status] ?? e.status.replace('_', ' ') : 'Not marked'}
              tone={e.status === 'present' ? 'good' : e.status === 'absent' ? 'bad' : e.status === 'half_day' ? 'warn' : undefined}
              muted={!e.status}
              isLast={i === day.employees.length - 1}
            />
          ))
        )}
      </View>
    );
  };

  return (
    <View style={s.flex}>
      <Band>
        <PickPill
          title="Type"
          label={type ? TYPES.find(t => t.key === type)?.label ?? type : 'Select type'}
          active={!!type}
          options={TYPES}
          value={type || null}
          onPick={k => {
            setType(k);
            setEmpId(null);
            setDate('');
          }}
        />
        <PickPill
          title={type ? `Select ${type}` : 'Person'}
          label={person ? person.name : type ? `Select ${type}` : 'Select a type first'}
          active={!!person}
          disabled={!type}
          options={people.map(p => ({ key: String(p.id), label: p.types.length > 1 ? `${p.name} (${p.types.map(typeLabel).join(', ')})` : p.name }))}
          value={empId ? String(empId) : null}
          onPick={k => {
            setEmpId(Number(k));
            setDate('');
          }}
        />
        <Text style={s.or}>or</Text>
        <DropPill label={date ? moment(date).format('DD MMM YYYY') : 'Date'} active={!!date} onPress={() => setDateOpen(true)} />
        {(!!date || !!type || !!empId) && (
          <ClearPill
            onPress={() => {
              setType('');
              setEmpId(null);
              setDate('');
            }}
          />
        )}
      </Band>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); if (empId) { setCalKey(k => k + 1); setRefreshing(false); } else loadDay(); }} />}
      >
        {body()}
      </ScrollView>
      <DateSheet
        visible={dateOpen}
        title="Date"
        value={date || moment().format('YYYY-MM-DD')}
        maxDate={moment().format('YYYY-MM-DD')}
        onPick={d => {
          setDate(d);
          setType('');
          setEmpId(null);
        }}
        onClose={() => setDateOpen(false)}
      />
    </View>
  );
};

export default PayrollAttendanceTab;

const __mk_s = () => StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: 20 },
  scroll: { paddingBottom: 40 },
  or: { fontSize: 12, color: theme.colors.textMuted },
  dayTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, paddingTop: 14 },
  dayCounts: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 4, paddingBottom: 4, lineHeight: 18 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

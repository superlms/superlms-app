import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { EmpStats, getEmployees } from '../../api/adminPayrollApi';
import { DocHeader } from '../more/docUi';
import { UnderlineTabs } from './adminExamUi';
import { OptionSheet } from './adminFormUi';
import { HeadActions, HeadBtn, HeadLink, Strip } from './feeSetupUi';
import { TITLE } from './payrollUi';
import PayrollEmployeesTab from './PayrollEmployeesTab';
import PayrollAttendanceTab from './PayrollAttendanceTab';
import PayrollSalaryTab, { SalaryHeadAction } from './PayrollSalaryTab';
import PayrollPaymentsTab from './PayrollPaymentsTab';

/**
 * Payroll — the panel's page, as it lays it out: the staff counts across the
 * top (total, management, drivers, employees, teachers), then its four tabs —
 *
 *   Employees    everyone on payroll, searched, narrowed and sorted; + adds
 *                someone (management, an employee, a driver — made a
 *                Transport driver too — or a teacher, on the Teachers form)
 *   Attendance   a person's months, or a date's statuses; Mark Attendance
 *                marks a day for everyone, teachers too
 *   Mark Salary  one person's salary month by month, and Add Payment against
 *                a month
 *   Payments     every salary paid, by type, person and month
 *
 * Each tab keeps its filters while another is open, as the panel does.
 */

type Tab = 'employees' | 'attendance' | 'salary' | 'payments';

const TABS: { key: Tab; label: string }[] = [
  { key: 'employees', label: 'Employees' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'salary', label: 'Mark Salary' },
  { key: 'payments', label: 'Payments' },
];

const ADD_CHOICES = [
  { key: 'management', label: 'Management', sub: 'On payroll here' },
  { key: 'teacher', label: 'Teacher', sub: 'Added on the Teachers form — given a payroll row' },
  { key: 'driver', label: 'Driver', sub: 'Also listed under Transport → Drivers' },
  { key: 'employee', label: 'Employee', sub: 'On payroll here' },
];

const AdminPayrollScreen = ({ navigation, route }: any) => {
  const [tab, setTab] = useState<Tab>((route.params?.tab as Tab) ?? 'employees');
  const [seen, setSeen] = useState<Record<Tab, boolean>>({ employees: false, attendance: false, salary: false, payments: false, [tab]: true } as Record<Tab, boolean>);
  const [stats, setStats] = useState<EmpStats | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [salaryAction, setSalaryAction] = useState<SalaryHeadAction | null>(null);
  const [adding, setAdding] = useState(false);

  // Opened for one person (their Employee page's Salary), or back from marking a day.
  const [salaryFor, setSalaryFor] = useState<{ type?: string; empId?: number } | null>(null);
  const [marked, setMarked] = useState<{ date: string; at: number } | null>(null);
  useEffect(() => {
    const p = route.params ?? {};
    if (p.tab) {
      setTab(p.tab);
      setSeen(prev => ({ ...prev, [p.tab]: true }));
    }
    if (p.empId) setSalaryFor({ type: p.type, empId: p.empId });
    if (p.markedDate) setMarked({ date: p.markedDate, at: p.markedAt ?? Date.now() });
  }, [route.params]);

  const loadStats = useCallback(async () => {
    try {
      setStats((await getEmployees()).stats);
    } catch {
      // The tabs still open; the counts stay as they were.
    }
  }, []);

  // Back from a form, every tab reads afresh.
  const first = useRef(true);
  useFocusLoad(() => {
    loadStats();
    if (first.current) {
      first.current = false;
      return;
    }
    setReloadKey(k => k + 1);
  });

  const choose = (t: Tab) => {
    setTab(t);
    setSeen(prev => ({ ...prev, [t]: true }));
  };

  const onSalaryAction = useCallback((a: SalaryHeadAction | null) => setSalaryAction(a), []);

  const addAs = (kind: string) => {
    setAdding(false);
    if (kind === 'teacher') navigation.navigate('AdminPayrollTeacherForm');
    else navigation.navigate('AdminPayrollEmployeeForm', { type: kind });
  };

  const right = () => {
    if (tab === 'employees') return <HeadBtn icon="add" onPress={() => setAdding(true)} />;
    if (tab === 'attendance') return <HeadLink label="Mark Attendance" onPress={() => navigation.navigate('AdminPayrollMark')} />;
    if (tab === 'salary' && salaryAction) return <HeadLink label={salaryAction.label} onPress={salaryAction.onPress} />;
    return null;
  };

  const st = stats ?? { total: 0, management: 0, driver: 0, employee: 0, teacher: 0 };
  const pane = (t: Tab) => [s.pane, tab !== t && s.hidden];

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={<HeadActions>{right()}</HeadActions>}
      />
      <View style={s.stats}>
        <Strip
          items={[
            { label: 'Total', value: stats ? st.total : '…' },
            { label: 'Management', value: stats ? st.management : '…', color: '#7C3AED' },
            { label: 'Drivers', value: stats ? st.driver : '…', color: '#D97706' },
            { label: 'Employees', value: stats ? st.employee : '…', color: '#059669' },
            { label: 'Teachers', value: stats ? st.teacher : '…', color: '#2563EB' },
          ]}
        />
      </View>
      <UnderlineTabs tabs={TABS} active={tab} onChange={choose} />

      {seen.employees && (
        <View style={pane('employees')}>
          <PayrollEmployeesTab navigation={navigation} reloadKey={reloadKey} />
        </View>
      )}
      {seen.attendance && (
        <View style={pane('attendance')}>
          <PayrollAttendanceTab reloadKey={reloadKey} jump={marked} />
        </View>
      )}
      {seen.salary && (
        <View style={pane('salary')}>
          <PayrollSalaryTab navigation={navigation} reloadKey={reloadKey} onAction={onSalaryAction} initial={salaryFor} />
        </View>
      )}
      {seen.payments && (
        <View style={pane('payments')}>
          <PayrollPaymentsTab reloadKey={reloadKey} />
        </View>
      )}

      <OptionSheet
        visible={adding}
        title="Who are you adding?"
        options={ADD_CHOICES}
        selected={[]}
        onPick={addAs}
        onClose={() => setAdding(false)}
      />
    </View>
  );
};

export default AdminPayrollScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  stats: { paddingHorizontal: 20, paddingBottom: 6 },
  pane: { flex: 1 },
  hidden: { display: 'none' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

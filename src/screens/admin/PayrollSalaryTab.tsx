import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AccountMonth, Employee, SalaryAccount, getEmployees, getSalaryAccount, typeLabel } from '../../api/adminPayrollApi';
import { Avatar, ErrorBox } from './adminTransportUi';
import { StatCells } from './panelUi';
import { Band, ClearPill, GroupHead, GroupsSkeleton, NumLine, PickPill, Prompt, Quiet, Strip, TotalLine, dmy, rupees0 } from './feeSetupUi';
import { personLine } from './PayrollEmployeesTab';

/**
 * Payroll → Mark Salary, as the panel's tab: a type, then one of its people,
 * and the tab is that person's salary account.
 *
 *   The person: who they are, their monthly salary, joining date and bank.
 *   Salary by month: each month from 1 April (or the month they joined) to
 *   this one — the attendance marked, the monthly salary, the salary the
 *   attendance works out to (the month's first absent a paid leave; each
 *   absent after it a day cut, a half day half of one) and what was paid
 *   against it — with the totals. The running month is worked out so far.
 *   A month's own screen (its row, or the band's month): the salary, the
 *   attendance and the salary so far, then every payment kept against the
 *   month; Add Payment in the header records one for that month.
 */

const TYPES = [
  { key: 'management', label: 'Management' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'driver', label: 'Driver' },
  { key: 'employee', label: 'Employee' },
];

const days = (n: number) => String(Math.round(n * 10) / 10);
const attendanceLine = (m: AccountMonth) =>
  m.present + m.absent + m.half + m.leave > 0
    ? [`Present ${m.present}`, `Absent ${m.absent}`, `Half ${m.half}`, m.leave > 0 ? `Leave ${m.leave}` : null].filter(Boolean).join(' · ')
    : 'Not marked';

export interface SalaryHeadAction {
  label: string;
  onPress: () => void;
}

const PayrollSalaryTab = ({
  navigation,
  reloadKey,
  onAction,
  initial,
}: {
  navigation: any;
  reloadKey: number;
  onAction: (a: SalaryHeadAction | null) => void;
  initial?: { type?: string; empId?: number } | null;
}) => {
  const [type, setType] = useState(initial?.type ?? '');
  const [people, setPeople] = useState<Employee[]>([]);
  const [empId, setEmpId] = useState<number | null>(initial?.empId ?? null);
  const [monthView, setMonthView] = useState('');
  const [account, setAccount] = useState<SalaryAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (initial?.empId) {
      setType(initial.type ?? '');
      setEmpId(initial.empId);
      setMonthView('');
    }
  }, [initial?.empId, initial?.type]);

  useEffect(() => {
    let live = true;
    setPeople([]);
    if (!type) return;
    getEmployees({ type, sort: 'name_asc' })
      .then(d => live && setPeople(d.employees))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [type]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    if (!empId) {
      setAccount(null);
      return;
    }
    try {
      const d = await getSalaryAccount(empId);
      if (mine === seq.current) setAccount(d);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the salary.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [empId]);

  useEffect(() => {
    setAccount(null);
    load();
  }, [load, reloadKey]);

  const open = account?.months.find(m => m.ym === monthView) ?? null;

  // Add Payment sits in the header on a month's own screen.
  useEffect(() => {
    if (open && account) {
      onAction({
        label: 'Add Payment',
        onPress: () =>
          navigation.navigate('AdminPayrollAddPayment', {
            id: account.employee.id,
            name: account.employee.name,
            month: open.ym,
            monthLabel: open.label,
          }),
      });
    } else {
      onAction(null);
    }
  }, [open, account, navigation, onAction]);

  const person = account?.employee ?? null;

  // ── A month's own screen ───────────────────────────────────────────────────
  const monthScreen = (m: AccountMonth) => {
    const marked = m.present + m.absent + m.half + m.leave > 0;
    const over = m.paid - m.payable;
    return (
      <View style={s.pad}>
        <GroupHead first icon="calendar-outline" title={m.label} sub={`${person?.name ?? ''}${m.running ? ' · Running month — so far' : ''}`} />
        <StatCells
          columns={3}
          items={[
            { label: 'Monthly salary', value: rupees0(m.base), sub: `${rupees0(m.per_day)} a day` },
            {
              label: 'Attendance',
              value: marked ? `P ${m.present} · A ${m.absent}` : 'Not marked',
              sub: m.paid_leave > 0 ? `${m.paid_leave} absent counted as a paid leave` : 'Paid leave not used (1 absent a month is paid)',
            },
            {
              label: m.running ? 'Salary so far' : 'Salary for the month',
              value: rupees0(m.payable),
              sub: m.cut_days > 0 ? `${days(m.cut_days)} day${m.cut_days === 1 ? '' : 's'} cut · ${rupees0(m.deduction)}` : 'Nothing cut',
            },
          ]}
        />
        {marked && <Quiet>{attendanceLine(m)}</Quiet>}

        <GroupHead icon="cash-outline" title={`Payments · ${m.label}`} sub={null} />
        <Strip
          items={[
            { label: 'Salary', value: rupees0(m.payable) },
            { label: 'Paid', value: rupees0(m.paid), color: '#059669' },
            over > 0 ? { label: 'Paid extra', value: rupees0(over), color: '#D97706' } : { label: 'Balance', value: rupees0(-over), color: -over > 0 ? theme.colors.danger : undefined },
          ]}
        />
        {over > 0 && <Quiet tone="warn">{`${rupees0(over)} has been paid over this month's salary — ${rupees0(m.paid)} paid against ${rupees0(m.payable)}.`}</Quiet>}
        {m.payments.length === 0 ? (
          <Prompt icon="cash-outline" title={`No payment in ${m.label} yet.`} sub="Use Add Payment above to record one." />
        ) : (
          <>
            {m.payments.map((p, i) => (
              <NumLine
                key={p.id ?? i}
                n={i + 1}
                label={p.date}
                sub={[p.from ? `From ${p.from}` : null, p.remark || null].filter(Boolean).join(' · ') || '—'}
                value={rupees0(p.amount)}
                isLast={i === m.payments.length - 1}
              />
            ))}
            <TotalLine label={`Total · ${m.payments.length} payment${m.payments.length === 1 ? '' : 's'}`} value={rupees0(m.paid)} />
          </>
        )}
      </View>
    );
  };

  // ── The person and their months ────────────────────────────────────────────
  const accountScreen = (a: SalaryAccount) => {
    const e = a.employee;
    const facts: [string, string][] = [
      ['Mobile', e.mobile || '—'],
      ['Email', e.email || '—'],
      ['Monthly salary', rupees0(e.salary)],
      ['Joining date', e.joining_date ? dmy(e.joining_date) : '—'],
      ['Bank', e.bank_name || '—'],
      ['Account no.', e.bank_account_no || '—'],
      ['IFSC', e.bank_ifsc || '—'],
      ['Account holder', e.bank_holder_name || '—'],
    ];
    return (
      <View style={s.pad}>
        <View style={s.who}>
          <Avatar uri={e.photo} name={e.name} size={48} />
          <View style={s.whoBody}>
            <Text style={s.whoName}>{e.name}</Text>
            <Text style={s.whoSub}>{personLine(e.types?.length ? e.types : [e.type], e.designation)}</Text>
          </View>
        </View>
        {facts.map(([label, value], i) => (
          <NumLine key={label} label={label} value={value} muted={value === '—'} isLast={i === facts.length - 1} />
        ))}

        <GroupHead icon="wallet-outline" title="Salary by month" sub={null} />
        <Strip
          items={[
            { label: 'Salary', value: rupees0(a.payable) },
            { label: 'Paid', value: rupees0(a.paid), color: '#059669' },
            { label: 'Balance', value: rupees0(a.balance), color: a.balance > 0 ? theme.colors.danger : undefined },
          ]}
        />
        {a.months.map((m, i) => (
          <NumLine
            key={m.ym}
            label={m.label}
            tag={m.running ? 'so far' : null}
            sub={`${attendanceLine(m)} · Monthly ${rupees0(m.base)}`}
            value={rupees0(m.payable)}
            valueSub={`Paid ${rupees0(m.paid)}${m.paid > m.payable ? ` · ${rupees0(m.paid - m.payable)} extra` : ''}`}
            tone={m.paid >= m.payable && m.payable > 0 ? 'good' : undefined}
            onPress={() => setMonthView(m.ym)}
            isLast={i === a.months.length - 1}
          />
        ))}
        <TotalLine label={`Total · ${a.months.length} month${a.months.length === 1 ? '' : 's'}`} value={`${rupees0(a.payable)} · paid ${rupees0(a.paid)}`} />
      </View>
    );
  };

  const body = () => {
    if (!empId) {
      return (
        <Prompt
          icon="wallet-outline"
          title="Use the filter above to open someone's salary."
          sub="Pick a type, then a person — their months since April and an Add Payment button follow."
        />
      );
    }
    if (error && !account) return <ErrorBox message={error} onRetry={load} />;
    if (!account) return <GroupsSkeleton groups={2} lines={5} />;
    return open ? monthScreen(open) : accountScreen(account);
  };

  const pickedPerson = people.find(p => p.id === empId) ?? person;

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
            setMonthView('');
          }}
        />
        <PickPill
          title={type ? `Select ${type}` : 'Person'}
          label={pickedPerson ? pickedPerson.name : type ? `Select ${type}` : 'Select a type first'}
          active={!!empId}
          disabled={!type}
          options={people.map(p => ({ key: String(p.id), label: p.types.length > 1 ? `${p.name} (${p.types.map(typeLabel).join(', ')})` : p.name }))}
          value={empId ? String(empId) : null}
          onPick={k => {
            setEmpId(Number(k));
            setMonthView('');
          }}
        />
        {!!account && (
          <PickPill
            title="Month"
            label={open ? open.label : 'All months'}
            active={!!open}
            options={[{ key: '', label: 'All months' }, ...account.months.map(m => ({ key: m.ym, label: m.label }))]}
            value={monthView}
            onPick={setMonthView}
          />
        )}
        {(!!type || !!empId) && (
          <ClearPill
            onPress={() => {
              setType('');
              setEmpId(null);
              setMonthView('');
            }}
          />
        )}
      </Band>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {body()}
      </ScrollView>
    </View>
  );
};

export default PayrollSalaryTab;

const __mk_s = () => StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: 20 },
  scroll: { paddingBottom: 40 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 6 },
  whoBody: { flex: 1, gap: 2 },
  whoName: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  whoSub: { fontSize: 12, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

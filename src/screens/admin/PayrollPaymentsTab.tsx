import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { Employee, PaymentRow, getEmployees, getSalaryPaymentsByType, modeLabel, typeLabel } from '../../api/adminPayrollApi';
import { DocNoData } from '../more/docUi';
import { ErrorBox, ListRow, ListSkeleton } from './adminTransportUi';
import { Band, ClearPill, PickPill, Strip, dmy, plural, rupees0 } from './feeSetupUi';
import { monthOptions } from './payrollUi';

/**
 * Payroll → Payments, as the panel's tab: every salary paid, newest first —
 * narrowed by a type, then one of its people, then a month. Each row says who
 * (and their types), the month it is for, the amount, the mode, who paid it,
 * its status and the day.
 */

const TYPES = [
  { key: '', label: 'All types' },
  { key: 'management', label: 'Management' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'driver', label: 'Driver' },
  { key: 'employee', label: 'Employee' },
];

const PayrollPaymentsTab = ({ reloadKey, initial }: { reloadKey: number; initial?: { empId?: number; type?: string } | null }) => {
  const [type, setType] = useState(initial?.type ?? '');
  const [people, setPeople] = useState<Employee[]>([]);
  const [empId, setEmpId] = useState<number | null>(initial?.empId ?? null);
  const [month, setMonth] = useState('');
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (initial?.empId) {
      setType(initial.type ?? '');
      setEmpId(initial.empId);
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
    try {
      const d = await getSalaryPaymentsByType({ type: type || undefined, employee_id: empId ?? undefined, month: month || undefined });
      if (mine !== seq.current) return;
      setRows(d.payments);
      setTotal(d.total);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load payments.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [type, empId, month]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const person = people.find(p => p.id === empId) ?? null;
  const months = monthOptions();

  return (
    <View style={s.flex}>
      <Band>
        <PickPill
          title="Type"
          label={TYPES.find(t => t.key === type)?.label ?? 'All types'}
          active={!!type}
          options={TYPES}
          value={type}
          onPick={k => {
            setType(k);
            setEmpId(null);
          }}
        />
        <PickPill
          title={type ? `All ${type}s` : 'Person'}
          label={person ? person.name : type ? `All ${type}s` : 'Select a type first'}
          active={!!empId}
          disabled={!type}
          options={[{ key: '', label: type ? `All ${type}s` : 'Everyone' }, ...people.map(p => ({ key: String(p.id), label: p.types.length > 1 ? `${p.name} (${p.types.map(typeLabel).join(', ')})` : p.name }))]}
          value={empId ? String(empId) : ''}
          onPick={k => setEmpId(k ? Number(k) : null)}
        />
        <PickPill
          title="Month"
          label={month ? moment(`${month}-01`).format('MMM YYYY') : 'Month'}
          active={!!month}
          options={[{ key: '', label: 'Every month' }, ...months]}
          value={month}
          onPick={setMonth}
        />
        {(!!type || !!empId || !!month) && (
          <ClearPill
            onPress={() => {
              setType('');
              setEmpId(null);
              setMonth('');
            }}
          />
        )}
      </Band>

      {error && !rows ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !rows ? (
        <View style={s.pad}>
          <ListSkeleton rows={7} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={[s.list, rows.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={rows.length > 0 ? <Strip items={[{ label: 'Payments', value: plural(rows.length, 'payment') }, { label: 'Paid', value: rupees0(total), color: '#059669' }]} /> : null}
          ListEmptyComponent={<DocNoData icon="receipt-outline" title="No payments found." subtitle="Salary paid from Mark Salary shows here." />}
          renderItem={({ item, index }) => (
            <ListRow
              icon="cash-outline"
              title={item.employee?.name ?? '—'}
              sub={[
                item.employee ? item.employee.types.map(typeLabel).join(', ') : null,
                `For ${moment(`${item.month}-01`).format('MMM YYYY')}`,
                item.mode ? modeLabel(item.mode) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              meta={[
                item.paid_by ? `Paid by ${item.paid_by}` : null,
                item.date ? dmy(item.date) : null,
                item.status === 'paid' ? 'Paid' : item.status ? item.status : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              right={rupees0(item.amount)}
              tone={item.status === 'paid' ? 'paid' : 'due'}
              isLast={index === rows.length - 1}
            />
          )}
        />
      )}
    </View>
  );
};

export default PayrollPaymentsTab;

const __mk_s = () => StyleSheet.create({
  flex: { flex: 1 },
  pad: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

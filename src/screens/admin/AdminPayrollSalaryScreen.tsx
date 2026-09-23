import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { EMP_TYPES, SalaryMonth, SalaryRow, getSalary, typeLabel } from '../../api/adminPayrollApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { OptionSheet } from './adminFormUi';
import { DropPill, ErrorBox, InfoRow, ListRow, ListSkeleton, SearchBar, formatINR } from './adminTransportUi';
import { lastMonth, monthOptions } from './payrollUi';

/**
 * Payroll's Salary for a month — last month by default, the payable one — as
 * the panel works it out: each person's base salary cut by the month's
 * absences (a full day each) and half days (half a day each), leave and
 * unmarked days paid in full. The month's payable and paid sit on top; a row
 * opens the pay panel, once the month is over.
 */

const AdminPayrollSalaryScreen = ({ navigation }: any) => {
  const [month, setMonth] = useState(lastMonth());
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<SalaryMonth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<null | 'month' | 'type'>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const d = await getSalary(month, { type: type || undefined, search: search.trim() || undefined });
      if (mine === seq.current) setData(d);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load salary.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [month, type, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);
  useFocusLoad(() => {
    if (data) load();
  });

  const open = (r: SalaryRow) => {
    if (!data?.can_pay) {
      AppAlert.alert('Not payable yet', `Salary for ${data?.month_label} can be paid only after the month ends.`);
      return;
    }
    navigation.navigate('AdminPayrollPay', { id: r.id, month, name: r.name });
  };

  const rows = data?.employees ?? [];

  return (
    <View style={s.root}>
      <DocHeader title="Salary" onBackPress={() => navigation.goBack()} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name…" />
      <View style={s.filters}>
        <DropPill label={monthOptions().find(m => m.key === month)?.label ?? month} active onPress={() => setSheet('month')} />
        <DropPill label={type ? typeLabel(type) : 'All types'} active={!!type} onPress={() => setSheet('type')} />
      </View>

      {error && !data ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !data ? (
        <ListSkeleton photo />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => String(r.id)}
          ListHeaderComponent={
            <View style={s.top}>
              <InfoRow label="Payable" value={formatINR(data.totals.payable)} />
              <InfoRow label="Paid" value={formatINR(data.totals.paid)} tone="paid" />
              <InfoRow
                label="Left to pay"
                value={formatINR(Math.max(0, data.totals.payable - data.totals.paid))}
                tone={data.totals.payable - data.totals.paid > 0 ? 'due' : undefined}
                last
              />
              {!data.can_pay && <Text style={s.note}>{`${data.month_label} is not over yet — it can be paid once the month ends.`}</Text>}
            </View>
          }
          renderItem={({ item, index }) => {
            const b = item.breakdown;
            const paid = item.payment?.status === 'paid';
            return (
              <ListRow
                photo={{ uri: item.photo, name: item.name }}
                title={item.name}
                sub={`${formatINR(b.base)} base · P ${b.present} · A ${b.absent} · H ${b.half_day} · L ${b.leave}`}
                meta={paid ? `Paid ${formatINR(item.payment!.amount)}` : `Payable ${formatINR(b.payable)}`}
                right={paid ? 'Paid' : data.can_pay ? 'Pay' : 'Unpaid'}
                tone={paid ? 'paid' : data.can_pay ? 'due' : 'muted'}
                onPress={() => open(item)}
                isLast={index === rows.length - 1}
              />
            );
          }}
          ListEmptyComponent={<DocNoData icon="cash-outline" title="No one to pay" subtitle="Add staff under Employees." />}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={s.list}
        />
      )}

      <OptionSheet
        visible={sheet === 'month'}
        title="Month"
        options={monthOptions()}
        selected={[month]}
        onPick={k => { setSheet(null); setMonth(k); setData(null); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'type'}
        title="Type"
        options={[{ key: '', label: 'All types' }, ...EMP_TYPES]}
        selected={[type]}
        onPick={k => { setSheet(null); setType(k); }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminPayrollSalaryScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  top: { paddingHorizontal: 20, paddingBottom: 8 },
  note: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 8 },
  list: { paddingBottom: 40 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

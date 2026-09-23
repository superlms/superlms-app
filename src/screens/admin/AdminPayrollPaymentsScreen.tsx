import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { PaymentRow, getSalaryPayments, modeLabel } from '../../api/adminPayrollApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { OptionSheet } from './adminFormUi';
import { DropPill, ErrorBox, ListRow, ListSkeleton, SearchBar, formatINR } from './adminTransportUi';
import { monthOptions } from './payrollUi';

/**
 * Payroll's Payments — every salary paid, newest first, as the panel lists
 * them: who, for which month, how much, how and when, and who paid it; by
 * month, by name, or one person's (opened from their page).
 */

const AdminPayrollPaymentsScreen = ({ navigation, route }: any) => {
  const employeeId: number | undefined = route?.params?.employeeId;
  const [month, setMonth] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const d = await getSalaryPayments({ month: month || undefined, search: search.trim() || undefined, employee_id: employeeId });
      if (mine !== seq.current) return;
      setRows(d.payments);
      setTotal(d.total);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load payments.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [month, search, employeeId]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);
  useFocusLoad(() => {
    if (rows) load();
  });

  return (
    <View style={s.root}>
      <DocHeader title={employeeId ? route?.params?.name ?? 'Payments' : 'Payments'} onBackPress={() => navigation.goBack()} />
      {!employeeId && <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name…" />}
      <View style={s.filters}>
        <DropPill label={month ? monthOptions().find(m => m.key === month)?.label ?? month : 'All months'} active={!!month} onPress={() => setSheet(true)} />
      </View>

      {error && !rows ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !rows ? (
        <ListSkeleton photo />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={p => String(p.id)}
          ListHeaderComponent={<Text style={s.count}>{`${rows.length} ${rows.length === 1 ? 'payment' : 'payments'} · ${formatINR(total)} paid`}</Text>}
          renderItem={({ item, index }) => (
            <ListRow
              photo={{ uri: item.employee?.photo, name: item.employee?.name }}
              title={item.employee?.name ?? 'Former employee'}
              sub={`${moment(item.month, 'YYYY-MM').format('MMMM YYYY')} · ${modeLabel(item.mode)}${item.transaction_id ? ` · ${item.transaction_id}` : ''}`}
              meta={[item.date ? moment(item.date).format('DD MMM YYYY') : null, item.paid_by ? `by ${item.paid_by}` : null, item.remark].filter(Boolean).join(' · ')}
              right={formatINR(item.amount)}
              tone={item.status === 'paid' ? 'paid' : 'muted'}
              isLast={index === rows.length - 1}
            />
          )}
          ListEmptyComponent={<DocNoData icon="receipt-outline" title="No payments" subtitle="Salaries paid from Salary show here." />}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={s.list}
        />
      )}

      <OptionSheet
        visible={sheet}
        title="Month"
        options={[{ key: '', label: 'All months' }, ...monthOptions()]}
        selected={[month]}
        onPick={k => { setSheet(false); setMonth(k); }}
        onClose={() => setSheet(false)}
      />
    </View>
  );
};

export default AdminPayrollPaymentsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, paddingVertical: 6 },
  list: { paddingBottom: 40 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

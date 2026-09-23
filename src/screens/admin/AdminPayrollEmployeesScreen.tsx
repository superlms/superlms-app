import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { EMP_TYPES, EmpSort, EmpStats, Employee, getEmployees, typeLabel } from '../../api/adminPayrollApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { OptionSheet } from './adminFormUi';
import { DropPill, ErrorBox, ListRow, ListSkeleton, SearchBar, formatINR } from './adminTransportUi';

/**
 * Payroll's Employees, as the panel lists them: management first, then
 * drivers, employees and teachers (a teacher or driver is added here on their
 * own), searched by name, designation or mobile, narrowed by type and sorted
 * by type, name or salary. A row opens the person; + adds one.
 */

const SORTS: { key: EmpSort; label: string }[] = [
  { key: 'type_order', label: 'By type' },
  { key: 'name_asc', label: 'Name A–Z' },
  { key: 'name_desc', label: 'Name Z–A' },
  { key: 'salary_desc', label: 'Salary high–low' },
  { key: 'salary_asc', label: 'Salary low–high' },
];

const AdminPayrollEmployeesScreen = ({ navigation }: any) => {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState<EmpSort>('type_order');
  const [rows, setRows] = useState<Employee[] | null>(null);
  const [stats, setStats] = useState<EmpStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<null | 'type' | 'sort'>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const d = await getEmployees({ search: search.trim() || undefined, type: type || undefined, sort });
      if (mine !== seq.current) return;
      setRows(d.employees);
      setStats(d.stats);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load employees.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [search, type, sort]);

  // Typing waits a moment before it asks.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);
  useFocusLoad(() => {
    if (rows) load();
  });

  return (
    <View style={s.root}>
      <DocHeader title="Employees" onBackPress={() => navigation.goBack()} rightIcon="add" onRightPress={() => navigation.navigate('AdminPayrollEmployeeForm')} />

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, designation or mobile…" />
      <View style={s.filters}>
        <DropPill label={type ? typeLabel(type) : 'All types'} active={!!type} onPress={() => setSheet('type')} />
        <DropPill label={SORTS.find(x => x.key === sort)?.label ?? 'By type'} active={sort !== 'type_order'} onPress={() => setSheet('sort')} />
      </View>

      {error && !rows ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !rows ? (
        <ListSkeleton photo />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={e => String(e.id)}
          ListHeaderComponent={
            stats ? (
              <Text style={s.count}>
                {`${rows.length} of ${stats.total} · ${stats.management} management · ${stats.driver} drivers · ${stats.employee} employees · ${stats.teacher} teachers`}
              </Text>
            ) : null
          }
          renderItem={({ item, index }) => (
            <ListRow
              photo={{ uri: item.photo, name: item.name }}
              title={item.name}
              sub={[item.designation, item.types.map(typeLabel).join(', ')].filter(Boolean).join(' · ')}
              meta={item.mobile || null}
              right={formatINR(item.salary)}
              onPress={() => navigation.navigate('AdminPayrollEmployee', { id: item.id, name: item.name })}
              isLast={index === rows.length - 1}
            />
          )}
          ListEmptyComponent={
            <DocNoData icon="people-outline" title={search || type ? 'No one matches' : 'No employees yet'} subtitle={search || type ? 'Try another name or type.' : 'Teachers and drivers are added on their own; add the rest with +.'} />
          }
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={s.list}
        />
      )}

      <OptionSheet
        visible={sheet === 'type'}
        title="Type"
        options={[{ key: '', label: 'All types' }, ...EMP_TYPES]}
        selected={[type]}
        onPick={k => { setType(k); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'sort'}
        title="Sort"
        options={SORTS}
        selected={[sort]}
        onPick={k => { setSort(k as EmpSort); setSheet(null); }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminPayrollEmployeesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, paddingVertical: 6 },
  list: { paddingBottom: 40 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

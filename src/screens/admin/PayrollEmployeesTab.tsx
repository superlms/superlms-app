import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { EmpSort, EmployeeWithMonth, getEmployeesWithMonth, typeLabel } from '../../api/adminPayrollApi';
import { DocNoData } from '../more/docUi';
import { ErrorBox, ListRow, ListSkeleton, SearchBar } from './adminTransportUi';
import { Band, ClearPill, PickPill, rupees0 } from './feeSetupUi';

/**
 * Payroll → Employees, as the panel's tab: searched by name, designation or
 * mobile, narrowed by type, and sorted — by default management, then
 * teachers, drivers and employees. Under each name, the person's types (both,
 * for a teacher or manager who also drives) and designation; then the mobile
 * and this month's attendance so far — present days out of working days; the
 * salary on the right. A row opens the person.
 */

export const TYPE_FILTER = [
  { key: '', label: 'All Types' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'management', label: 'Management' },
  { key: 'employee', label: 'Employee' },
  { key: 'driver', label: 'Driver' },
];

const SORTS: { key: EmpSort; label: string }[] = [
  { key: 'type_order', label: 'Type (Mgmt → Teacher → Driver → Employee)' },
  { key: 'name_asc', label: 'Name (A–Z)' },
  { key: 'name_desc', label: 'Name (Z–A)' },
  { key: 'salary_asc', label: 'Salary (Low–High)' },
  { key: 'salary_desc', label: 'Salary (High–Low)' },
];

/** "Teacher, Driver · Accountant" — the designation only when it says more than the types. */
export const personLine = (types: string[], designation?: string | null) => {
  const labels = types.map(typeLabel);
  const says = (designation ?? '').trim();
  return says && !labels.map(l => l.toLowerCase()).includes(says.toLowerCase()) ? `${labels.join(', ')} · ${says}` : labels.join(', ');
};

const days = (n: number) => String(Math.round(n * 10) / 10);

const PayrollEmployeesTab = ({ navigation, reloadKey }: { navigation: any; reloadKey: number }) => {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState<EmpSort>('type_order');
  const [rows, setRows] = useState<EmployeeWithMonth[] | null>(null);
  const [month, setMonth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const d = await getEmployeesWithMonth({ search: search.trim() || undefined, type: type || undefined, sort });
      if (mine !== seq.current) return;
      setRows(d.employees);
      setMonth(d.month ?? '');
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load employees.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [search, type, sort]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search, reloadKey]);

  const filtered = !!search || !!type || sort !== 'type_order';

  return (
    <View style={s.flex}>
      <View style={s.search}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, designation, mobile…" />
      </View>
      <Band>
        <PickPill
          title="Type"
          label={TYPE_FILTER.find(t => t.key === type)?.label ?? 'All Types'}
          active={!!type}
          options={TYPE_FILTER}
          value={type}
          onPick={setType}
        />
        <PickPill
          title="Sort"
          label={sort === 'type_order' ? 'Sort: Type' : `Sort: ${SORTS.find(x => x.key === sort)?.label}`}
          active={sort !== 'type_order'}
          options={SORTS}
          value={sort}
          onPick={k => setSort(k)}
        />
        {filtered && (
          <ClearPill
            onPress={() => {
              setSearch('');
              setType('');
              setSort('type_order');
            }}
          />
        )}
      </Band>

      {error && !rows ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !rows ? (
        <View style={s.pad}>
          <ListSkeleton photo rows={7} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={e => String(e.id)}
          contentContainerStyle={[s.list, rows.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<DocNoData icon="people-outline" title="No employees found." subtitle={filtered ? 'Try another search or type.' : 'Tap + to add someone to payroll.'} />}
          renderItem={({ item, index }) => {
            const att = item.month_attendance;
            const attLine = att && att.working > 0 ? `Attendance · ${month}: ${days(att.present)} / ${att.working}` : `Attendance · ${month}: —`;
            return (
              <ListRow
                photo={{ uri: item.photo, name: item.name }}
                title={item.name}
                sub={personLine(item.types?.length ? item.types : [item.type], item.designation)}
                meta={[item.mobile || '—', attLine].join(' · ')}
                right={rupees0(item.salary)}
                onPress={() => navigation.navigate('AdminPayrollEmployee', { id: item.id, name: item.name })}
                isLast={index === rows.length - 1}
              />
            );
          }}
        />
      )}
    </View>
  );
};

export default PayrollEmployeesTab;

const __mk_s = () => StyleSheet.create({
  flex: { flex: 1 },
  search: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 2 },
  pad: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

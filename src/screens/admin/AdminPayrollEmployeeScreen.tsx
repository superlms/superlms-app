import React, { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import moment from 'moment';
import { Skeleton } from '../../components/Skeleton';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AppAlert } from '../../components/AppDialog';
import { EmployeeDetail, deleteEmployee, getEmployee, typeLabel } from '../../api/adminPayrollApi';
import { DocHeader } from '../more/docUi';
import { Words } from '../exam/examUi';
import { QuietAction, confirmDestructive } from './adminFormUi';
import { Avatar, ErrorBox, InfoRow, Section, formatINR } from './adminTransportUi';

/**
 * One person on payroll, as the panel's detail panel shows them: who they are
 * and every type they hold, salary, contact and joining, the teacher or driver
 * record they are linked to, and their bank. From here, their attendance, their
 * salary payments, Edit and Delete.
 */

const AdminPayrollEmployeeScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const [d, setD] = useState<EmployeeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setD(await getEmployee(id));
    } catch (e) {
      setError(apiErr(e, 'Could not load this employee.'));
    }
  }, [id]);
  useFocusLoad(() => load());

  const remove = () =>
    d &&
    confirmDestructive('Delete employee?', `${d.name} will be removed from payroll, with their attendance here.`, 'Delete', async () => {
      try {
        await deleteEmployee(d.id);
        navigation.goBack();
      } catch (e) {
        AppAlert.alert('Not deleted', apiErr(e, 'Could not delete this employee.'));
      }
    });

  if (!d) {
    return (
      <View style={s.root}>
        <DocHeader title="Employee" onBackPress={() => navigation.goBack()} />
        {error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : (
          <View style={s.skWrap}>
            <Skeleton width={56} height={56} radius={28} />
            <Skeleton width="60%" height={18} />
            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} width="100%" height={14} />)}
          </View>
        )}
      </View>
    );
  }

  const rows: [string, string | null | undefined, (() => void)?][] = [
    ['Type', d.types.map(typeLabel).join(', ')],
    ['Salary', `${formatINR(d.salary)} a month`],
    ['Mobile', d.mobile, d.mobile ? () => Linking.openURL(`tel:${d.mobile}`) : undefined],
    ['Email', d.email, d.email ? () => Linking.openURL(`mailto:${d.email}`) : undefined],
    ['Joining date', d.joining_date ? moment(d.joining_date).format('DD MMM YYYY') : null],
    ['Address', d.address],
    ['Linked teacher', d.linked_teacher],
    ['Linked driver', d.linked_driver],
  ];
  const shown = rows.filter(([, v]) => !!v);
  const bank: [string, string | null | undefined][] = [
    ['Bank', d.bank_name],
    ['Holder', d.bank_holder_name],
    ['Account', d.bank_account_no],
    ['IFSC', d.bank_ifsc],
    ['Branch', d.bank_branch],
  ];
  const bankShown = d.bank_name ? bank.filter(([, v]) => !!v) : [];

  return (
    <View style={s.root}>
      <DocHeader title="Employee" onBackPress={() => navigation.goBack()} rightIcon="create-outline" onRightPress={() => navigation.navigate('AdminPayrollEmployeeForm', { id: d.id })} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.head}>
          <Avatar uri={d.photo} name={d.name} size={56} />
          <View style={s.headBody}>
            <Words style={s.name}>{d.name}</Words>
            <Words style={s.sub}>{d.designation || typeLabel(d.type)}</Words>
          </View>
        </View>

        <View style={s.rows}>
          {shown.map(([label, value, onPress], i) => (
            <InfoRow key={label} label={label} value={String(value)} onPress={onPress} last={i === shown.length - 1} />
          ))}
        </View>

        {bankShown.length > 0 && (
          <Section title="Bank">
            {bankShown.map(([label, value], i) => (
              <InfoRow key={label} label={label} value={String(value)} last={i === bankShown.length - 1} />
            ))}
          </Section>
        )}

        <Section title="Payroll">
          <InfoRow label="Attendance" value={d.is_teacher ? 'From the Teacher module' : 'Month by month'} onPress={() => navigation.navigate('AdminPayrollCalendar', { id: d.id, name: d.name })} />
          <InfoRow label="Salary payments" value="History" onPress={() => navigation.navigate('AdminPayrollPayments', { employeeId: d.id, name: d.name })} last />
        </Section>

        <View style={s.quiet}>
          <QuietAction icon="trash-2" label="Delete employee" danger onPress={remove} />
        </View>
      </ScrollView>
    </View>
  );
};

export default AdminPayrollEmployeeScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headBody: { flex: 1, gap: 3 },
  name: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 13, color: theme.colors.textSecondary },
  rows: { paddingHorizontal: 20, paddingBottom: 6 },
  quiet: { paddingHorizontal: 20, paddingTop: 20 },
  skWrap: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

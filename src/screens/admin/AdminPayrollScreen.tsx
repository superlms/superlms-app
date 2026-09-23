import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { SkeletonIcon } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { EmpStats, getEmployees, getSalary } from '../../api/adminPayrollApi';
import { DocHeader } from '../more/docUi';
import { Words } from '../exam/examUi';
import { formatINR } from './adminTransportUi';
import { TITLE, lastMonth } from './payrollUi';

/**
 * Payroll, laid out as a student's hub is: one plain row for each of the
 * admin panel's tabs — Employees, Attendance, Salary and Payments — each
 * saying where things stand (staff by type, today's marking, last month's
 * payable and what is paid of it).
 */

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

const AdminPayrollScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState<EmpStats | null>(null);
  const [salary, setSalary] = useState<{ payable: number; paid: number; label: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [emp, sal] = await Promise.all([getEmployees(), getSalary(lastMonth())]);
      setStats(emp.stats);
      setSalary({ ...sal.totals, label: sal.month_label });
    } catch {
      // The rows still open their pages; the figures just stay as they were.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusLoad(() => load());

  const skeleton = loading && !stats;
  const st = stats ?? { total: 12, management: 2, driver: 3, employee: 4, teacher: 3 };
  const sal = salary ?? { payable: 250000, paid: 0, label: moment().subtract(1, 'month').format('MMMM YYYY') };

  const entries = [
    {
      title: 'Employees',
      sub: `${plural(st.total, 'person')} · ${st.management} management · ${st.driver} drivers · ${st.teacher} teachers`,
      icon: 'people-outline',
      route: 'AdminPayrollEmployees',
    },
    {
      title: 'Attendance',
      sub: 'Staff by date, or one person month by month',
      icon: 'calendar-outline',
      route: 'AdminPayrollAttendance',
    },
    {
      title: 'Salary',
      sub: `${sal.label} · ${formatINR(sal.payable)} payable · ${formatINR(sal.paid)} paid`,
      icon: 'cash-outline',
      route: 'AdminPayrollSalary',
    },
    {
      title: 'Payments',
      sub: 'Every salary paid, by month or person',
      icon: 'receipt-outline',
      route: 'AdminPayrollPayments',
    },
  ];

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={() => { setLoading(true); load(); }} />}
      >
        {entries.map((item, i) => (
          <TouchableOpacity key={item.title} style={s.row} activeOpacity={0.6} onPress={() => navigation.navigate(item.route)}>
            <View style={s.rowIcon}>
              {skeleton ? (
                <SkeletonIcon iconName={item.icon} size={20} />
              ) : (
                <VectorIcon iconSet="Ionicons" iconName={item.icon} size={20} color={theme.colors.textSecondary} />
              )}
            </View>
            <View style={[s.rowMain, i < entries.length - 1 && s.rowDivider]}>
              <View style={s.rowText}>
                <Words skeleton={skeleton} style={s.rowTitle}>{item.title}</Words>
                <Words skeleton={skeleton} style={s.rowSub} numberOfLines={1}>{item.sub}</Words>
              </View>
              <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default AdminPayrollScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingTop: 4, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 20 },
  rowIcon: { width: 22, alignItems: 'center' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15, paddingRight: 20 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

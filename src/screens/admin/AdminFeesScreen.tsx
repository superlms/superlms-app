import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import VectorIcon from '../../components/VectorIcon';
import { useFocusLoad, useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { FeeAnalytics, getFeeAnalytics, getQrRequests } from '../../api/adminFeeApi';
import { DocHeader } from '../more/docUi';
import { Card, CardHead, Chevron, DashError, DashSkeleton, KpiGrid, LineRow, PageLine, PctRow, Pill, type Kpi } from '../home/dashboardUi';
import { TITLE, inr } from './adminFeeUi';

/**
 * The school's Fees, drawn as a student's Fees is — white cards on the page's
 * grey. Four figures to open on (collected, still due, today and this month,
 * all by the panel's Analytics), what has come in of each fee, and the
 * panel's sections: Fee Submission (a student's ledger, and collecting from
 * them), Payments, Analytics and QR Payments, with how many of those wait to
 * be checked.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const Lead = ({ icon }: { icon: string }) => (
  <View style={s.lead}>
    <VectorIcon iconSet="Ionicons" iconName={icon} size={18} color={theme.colors.primary} />
  </View>
);

const AdminFeesScreen = ({ navigation }: any) => {
  const [data, setData] = useState<FeeAnalytics | null>(null);
  const [qrPending, setQrPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Coming back refetches quietly — the skeleton only shows the first time.
  const load = useCallback(async () => {
    setError(null);
    try {
      const [a, q] = await Promise.all([
        getFeeAnalytics(),
        getQrRequests({ status: 'pending' }).catch(() => null),
      ]);
      setData(a);
      setQrPending(q?.stats.pending ?? 0);
    } catch (e) {
      setError(apiErr(e, 'Could not load fees.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusLoad(load);
  const { refreshing, onRefresh } = useRefresh(load);

  const go = (route: string, params?: object) => () => navigation.navigate(route, params);

  const body = () => {
    if (!data) return null;
    const sm = data.summary;
    const today = data.periods?.Today ?? { amount: 0, count: 0 };
    const month = data.periods?.['This Month'] ?? { amount: 0, count: 0 };

    const kpis: Kpi[] = [
      {
        icon: 'checkmark-done-outline',
        label: 'Collected',
        value: inr(sm.total_collected),
        note: `${sm.rate}% of ${inr(sm.total_billable)}`,
        onPress: go('AdminFeeAnalytics'),
      },
      {
        icon: 'wallet-outline',
        label: 'Still due',
        value: inr(sm.total_due),
        note: sm.defaulters > 0 ? `${plural(sm.defaulters, 'student')} owe` : 'Nothing owed',
        low: sm.total_due > 0,
        onPress: go('AdminFeeAnalytics'),
      },
      {
        icon: 'today-outline',
        label: 'Today',
        value: inr(today.amount),
        note: plural(today.count, 'payment'),
        onPress: go('AdminFeePayments', { preset: 'today' }),
      },
      {
        icon: 'calendar-outline',
        label: 'This month',
        value: inr(month.amount),
        note: plural(month.count, 'payment'),
        onPress: go('AdminFeePayments', { preset: 'this_month' }),
      },
    ];

    const parts = [
      { label: 'Academic', paid: sm.academic_collected, due: sm.academic_billable },
      { label: 'Transport', paid: sm.transport_collected, due: sm.transport_billable },
    ].filter(p => p.due > 0 || p.paid > 0);

    const sections = [
      {
        icon: 'person-add-outline',
        title: 'Fee Submission',
        meta: 'Find a student, see their fees and collect',
        route: 'AdminFeeStudents',
      },
      {
        icon: 'receipt-outline',
        title: 'Payments',
        meta: 'Every payment recorded, each with its receipt',
        route: 'AdminFeePayments',
      },
      {
        icon: 'bar-chart-outline',
        title: 'Analytics',
        meta: 'Collections and dues, by class and student',
        route: 'AdminFeeAnalytics',
      },
      {
        icon: 'qr-code-outline',
        title: 'QR Payments',
        meta: qrPending > 0 ? 'Paid on the school QR — check the UTR, then approve' : 'Paid on the school QR, from the app',
        route: 'AdminFeeQr',
        pending: qrPending,
      },
    ];

    return (
      <>
        <PageLine text={`${plural(sm.students, 'student')} · ${plural(sm.riders, 'on transport', 'on transport')}`} />
        <KpiGrid items={kpis} />

        {parts.length > 0 && (
          <Card>
            <CardHead icon="pie-chart-outline" title="Collected, by fee" sub={`${inr(sm.total_collected)} of ${inr(sm.total_billable)}`} />
            {parts.map((p, i) => {
              const left = Math.max(0, p.due - p.paid);
              return (
                <PctRow
                  key={p.label}
                  label={p.label}
                  pct={p.due > 0 ? Math.min(100, Math.round((p.paid / p.due) * 100)) : 100}
                  value={`${inr(p.paid)} / ${inr(p.due)}`}
                  meta={left > 0 ? `${inr(left)} due` : 'Collected in full'}
                  isLast={i === parts.length - 1 && sm.penalty_collected <= 0}
                />
              );
            })}
            {sm.penalty_collected > 0 && (
              <LineRow title="Penalties collected" trailing={<Pill text={inr(sm.penalty_collected)} />} isLast />
            )}
          </Card>
        )}

        <Card>
          <CardHead icon="grid-outline" title="Manage fees" />
          {sections.map((it, i) => (
            <LineRow
              key={it.title}
              lead={<Lead icon={it.icon} />}
              title={it.title}
              meta={it.meta}
              trailing={
                <View style={s.trailing}>
                  {!!it.pending && <Pill text={`${it.pending} to check`} tone="accent" />}
                  <Chevron />
                </View>
              }
              onPress={go(it.route)}
              isLast={i === sections.length - 1}
            />
          ))}
        </Card>
      </>
    );
  };

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />
      {loading && !data ? (
        <DashSkeleton />
      ) : error && !data ? (
        <DashError message={error} onRetry={() => { setLoading(true); load(); }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {body()}
        </ScrollView>
      )}
    </View>
  );
};

export default AdminFeesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  lead: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary + '12',
  },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

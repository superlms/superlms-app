import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { DashSection } from '../home/dashboardUi';
import {
  AcademicFees,
  FeeDashboard,
  FeePenalties,
  Installment,
  TransportFees,
  getFeeDashboard,
  getFeePenalties,
} from '../../api/feeApi';
import {
  AmountRows,
  FeeHead,
  FeeSkeleton,
  FeeTabs,
  InstallmentRow,
  MonthLine,
  Note,
  PayButton,
  ReceiptRow,
  inr,
} from './feesUi';

const TITLE = 'Fees';

type Tab = 'Overview' | 'Academic' | 'Transport' | 'Penalties';

// ── Overview ─────────────────────────────────────────────────────────────────
const Overview = ({
  data,
  onTab,
  onPayInstallment,
}: {
  data: FeeDashboard;
  onTab: (t: Tab) => void;
  onPayInstallment: (i: Installment) => void;
}) => {
  const sm = data.summary;
  const a = data.academic;
  const tr = data.transport;
  const next = a?.upcoming?.find(i => i.status !== 'paid' && i.payable > 0);
  const payments = data.overall_payments ?? [];

  return (
    <>
      <FeeHead
        kicker={`Fees${a?.academic_year ? ` · ${a.academic_year}` : ''}`}
        amount={inr(sm.remaining)}
        suffix={sm.remaining > 0 ? 'due' : undefined}
        line={
          sm.remaining > 0
            ? `${inr(sm.total_paid)} paid of ${inr(sm.total_due)} · ${sm.cleared_percent}% cleared`
            : `Everything is paid — ${inr(sm.total_paid)} this year`
        }
        pct={sm.cleared_percent}
      />

      {!!next && (
        <DashSection title="Next installment" action="All" onAction={() => onTab('Academic')}>
          <InstallmentRow item={next} onPay={onPayInstallment} isLast />
        </DashSection>
      )}

      {!!a && (
        <DashSection title="Academic" action="Details" onAction={() => onTab('Academic')}>
          <AmountRows
            rows={[
              { label: 'Payable this year', value: inr(a.totals.net_due) },
              { label: 'Paid', value: inr(a.totals.paid) },
              { label: 'Remaining', value: inr(a.totals.remaining), danger: a.totals.remaining > 0, total: true },
            ]}
          />
        </DashSection>
      )}

      {!!tr && (
        <DashSection title={`Transport · ${tr.route.route_name}`} action="Details" onAction={() => onTab('Transport')}>
          <AmountRows
            rows={[
              { label: 'For the year', value: inr(tr.totals.annual_fee) },
              { label: 'Paid', value: inr(tr.totals.paid) },
              { label: 'Remaining', value: inr(tr.totals.remaining), danger: tr.totals.remaining > 0, total: true },
            ]}
          />
        </DashSection>
      )}

      <DashSection title="Recent payments">
        {payments.length === 0 ? (
          <Note>No payments recorded yet.</Note>
        ) : (
          payments
            .slice(0, 5)
            .map((p, i, list) => (
              <ReceiptRow key={`${p.fee_type}-${p.id}`} p={p} showType isLast={i === list.length - 1} />
            ))
        )}
      </DashSection>
    </>
  );
};

// ── Academic ─────────────────────────────────────────────────────────────────
const Academic = ({ a, onPay }: { a: AcademicFees; onPay: (i?: Installment) => void }) => {
  const t = a.totals;
  const pct = t.net_due > 0 ? Math.round((t.paid / t.net_due) * 100) : 100;

  return (
    <>
      <FeeHead
        kicker={`Academic${a.academic_year ? ` · ${a.academic_year}` : ''}`}
        amount={inr(t.remaining)}
        suffix={t.remaining > 0 ? 'due' : undefined}
        line={`${inr(t.paid)} paid of ${inr(t.net_due)}`}
        pct={pct}
      >
        {t.remaining > 0 && (
          <View style={s.headAction}>
            <PayButton label={`Pay ${inr(t.remaining)}`} onPress={() => onPay()} />
          </View>
        )}
      </FeeHead>

      <DashSection title="Installments">
        {a.upcoming.length === 0 ? (
          <Note>No installment schedule has been set.</Note>
        ) : (
          a.upcoming.map((it, i) => (
            <InstallmentRow key={it.serial} item={it} onPay={onPay} isLast={i === a.upcoming.length - 1} />
          ))
        )}
      </DashSection>

      <DashSection title="Fee structure">
        {a.structures.length === 0 ? (
          <Note>No fee items have been set.</Note>
        ) : (
          <AmountRows
            rows={[
              ...a.structures.map(it => ({ label: it.fee_name, value: inr(it.amount) })),
              ...(t.concession > 0 ? [{ label: 'Concession', value: `− ${inr(t.concession)}` }] : []),
              { label: 'Payable', value: inr(t.net_due), total: true },
            ]}
          />
        )}
      </DashSection>

      <DashSection title="Payments">
        {a.paid.length === 0 ? (
          <Note>No academic payments yet.</Note>
        ) : (
          a.paid.map((p, i) => <ReceiptRow key={p.id} p={p} isLast={i === a.paid.length - 1} />)
        )}
      </DashSection>
    </>
  );
};

// ── Transport ────────────────────────────────────────────────────────────────
const Transport = ({ tr, onPay }: { tr: TransportFees; onPay: () => void }) => {
  const t = tr.totals;
  const pct = t.annual_fee > 0 ? Math.round((t.paid / t.annual_fee) * 100) : 100;

  return (
    <>
      <FeeHead
        kicker={`Transport · ${tr.route.route_name}`}
        amount={inr(t.remaining)}
        suffix={t.remaining > 0 ? 'due' : undefined}
        line={`${inr(t.paid)} paid of ${inr(t.annual_fee)} · ${inr(t.monthly_fee)} a month`}
        pct={pct}
      >
        {t.remaining > 0 && (
          <View style={s.headAction}>
            <PayButton label="Pay transport fee" onPress={onPay} />
          </View>
        )}
      </FeeHead>

      <DashSection title="Month by month">
        {tr.schedule.length === 0 ? (
          <Note>No months have been set.</Note>
        ) : (
          tr.schedule.map((m, i) => <MonthLine key={m.key} m={m} isLast={i === tr.schedule.length - 1} />)
        )}
      </DashSection>

      <DashSection title="Payments">
        {tr.paid.length === 0 ? (
          <Note>No transport payments yet.</Note>
        ) : (
          tr.paid.map((p, i) => <ReceiptRow key={p.id} p={p} isLast={i === tr.paid.length - 1} />)
        )}
      </DashSection>
    </>
  );
};

// ── Penalties ────────────────────────────────────────────────────────────────
const Penalties = ({ p }: { p: FeePenalties | null }) => {
  if (!p || p.count === 0) {
    return (
      <DocNoData
        icon="checkmark-circle-outline"
        title="No penalties"
        subtitle="Nothing has been charged for paying late."
      />
    );
  }

  return (
    <>
      <FeeHead
        kicker="Late payment penalties"
        amount={inr(p.total_penalty)}
        danger
        line={`On ${p.count} ${p.count === 1 ? 'payment' : 'payments'} · ${inr(p.penalty_per_day)} for each day late`}
      />
      <DashSection title="Charged on">
        <AmountRows
          rows={p.items.map(it => ({
            label: [
              it.receipt_number,
              it.fee_type === 'transport' ? 'Transport' : 'Academic',
              it.payment_date,
              `on ${inr(it.base_amount)}`,
            ]
              .filter(Boolean)
              .join(' · '),
            value: inr(it.penalty_amount),
            danger: true,
          }))}
        />
      </DashSection>
    </>
  );
};

// ── Screen ───────────────────────────────────────────────────────────────────
const FeesScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<Tab>('Overview');
  const [dashboard, setDashboard] = useState<FeeDashboard | null>(null);
  const [penalties, setPenalties] = useState<FeePenalties | null>(null);
  const [loading, setLoading] = useState(true);

  // Coming back refetches quietly — the skeleton only shows the first time.
  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        getFeeDashboard().catch(() => null),
        getFeePenalties().catch(() => null),
      ]);
      setDashboard(d);
      setPenalties(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusLoad(load);
  const { refreshing, onRefresh } = useRefresh(load);

  const goAcademic = useCallback(
    (inst?: Installment) => {
      const a = dashboard?.academic;
      const suggested = inst ? inst.payable : a?.totals.remaining ?? 0;
      navigation.navigate('PayAmount', {
        title: 'Pay Academic Fee',
        feeType: 'academic',
        suggestedAmount: suggested,
        note: inst ? inst.label : undefined,
      });
    },
    [dashboard, navigation],
  );

  const goTransport = useCallback(() => navigation.navigate('TransportPay'), [navigation]);

  // Transport only once there is a route to show.
  const tabs: Tab[] = ['Overview', 'Academic', ...(dashboard?.transport ? (['Transport'] as Tab[]) : []), 'Penalties'];
  const current: Tab = tabs.includes(tab) ? tab : 'Overview';

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <FeeTabs tabs={tabs} active={current} onSelect={setTab} />

      {loading && !refreshing ? (
        <FeeSkeleton />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {current === 'Penalties' ? (
            <Penalties p={penalties} />
          ) : !dashboard ? (
            <DocNoData
              icon="cash-outline"
              title="No fee details yet"
              subtitle="Your fees will appear here once the school has set them up."
            />
          ) : current === 'Overview' ? (
            <Overview data={dashboard} onTab={setTab} onPayInstallment={goAcademic} />
          ) : current === 'Academic' ? (
            dashboard.academic ? (
              <Academic a={dashboard.academic} onPay={goAcademic} />
            ) : (
              <DocNoData icon="school-outline" title="No academic fees" subtitle="No academic fees have been set for you." />
            )
          ) : dashboard.transport ? (
            <Transport tr={dashboard.transport} onPay={goTransport} />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
};

export default FeesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  headAction: { marginTop: 18 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

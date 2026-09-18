import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  Card,
  CardHead,
  DashSkeleton,
  KpiGrid,
  MiniStats,
  Note,
  PageLine,
  PctRow,
  type Kpi,
} from '../home/dashboardUi';
import { Tabs } from '../analytics/analyticsUi';
import {
  AcademicFees,
  FeeDashboard,
  FeePenalties,
  FeeQr,
  Installment,
  TransportFees,
  getFeeDashboard,
  getFeePenalties,
  getFeeQr,
} from '../../api/feeApi';
import type { TransportPayment } from '../../api/transportApi';
import { AmountRows, InstallmentRow, MonthLine, ReceiptRow, inr } from './feesUi';
import { TransportPayments } from './TransportPayments';
import { PayOptions, QrRequestRow } from './qrUi';

/**
 * A student's fees, in the dashboards' way: white cards on the page's grey,
 * each with a small accent icon, and four headline figures to open on.
 *
 *   Overview   what is left, what is paid, the next installment, and what
 *              is with the school to check; how to pay; paid by fee; the
 *              installments ahead; payments sent on the school's QR; and the
 *              latest receipts.
 *   Academic / Transport / Penalties — each fee in full.
 *
 * Paying: on the school's own UPI QR when it takes fees there (the student
 * then sends the UTR or a screenshot, and the school approves it), and online
 * (PhonePe) when the school has its own gateway — or has no QR, as before.
 */

const TITLE = 'Fees';

type Tab = 'overview' | 'academic' | 'transport' | 'penalties';

const day = (iso?: string | null) => (iso ? moment(iso).format('D MMM') : '');

interface Pay {
  qr: FeeQr | null;
  academic: (inst?: Installment) => void;
  transport: () => void;
  academicOnline: (inst?: Installment) => void;
  transportOnline: () => void;
}

// ── Overview ─────────────────────────────────────────────────────────────────
const Overview = ({
  data,
  pay,
  penalties,
  go,
  onOpenShot,
}: {
  data: FeeDashboard;
  pay: Pay;
  penalties: FeePenalties | null;
  go: (t: Tab) => () => void;
  onOpenShot: (uri: string) => void;
}) => {
  const [allSent, setAllSent] = useState(false);
  const sm = data.summary;
  const a = data.academic;
  const tr = data.transport;
  const unpaid = (a?.upcoming ?? []).filter(i => i.status !== 'paid' && i.payable > 0);
  const next = unpaid[0];
  const overdue = unpaid.some(i => i.status === 'overdue');
  const payments = data.overall_payments ?? [];
  const qr = pay.qr?.qr ?? null;
  const sent = pay.qr?.requests ?? [];
  const pending = pay.qr?.pending_count ?? 0;

  const kpis: Kpi[] = [
    {
      icon: 'wallet-outline',
      label: 'To pay',
      value: inr(sm.remaining),
      note: sm.remaining > 0 ? `of ${inr(sm.total_due)} this year` : 'Nothing left this year',
      low: overdue,
      onPress: a ? go('academic') : undefined,
    },
    {
      icon: 'checkmark-done-outline',
      label: 'Paid',
      value: inr(sm.total_paid),
      note: `${Math.round(sm.cleared_percent ?? 0)}% cleared`,
    },
    {
      icon: 'calendar-outline',
      label: 'Next due',
      value: next ? inr(next.payable) : '—',
      note: next
        ? `${next.label}${next.due_date ? ` · ${moment(next.due_date).format('D MMM')}` : ''}`
        : 'No installment due',
      low: next?.status === 'overdue',
      onPress: next ? () => pay.academic(next) : undefined,
    },
    qr || sent.length > 0
      ? {
          icon: 'time-outline',
          label: 'With the school',
          value: inr(pay.qr?.pending_amount ?? 0),
          note: pending > 0 ? `${pending} ${pending === 1 ? 'payment' : 'payments'} to be checked` : 'Nothing waiting',
        }
      : {
          icon: 'alert-circle-outline',
          label: 'Late fee',
          value: inr(penalties?.total_penalty ?? sm.total_penalties ?? 0),
          note: penalties?.count ? `On ${penalties.count} ${penalties.count === 1 ? 'payment' : 'payments'}` : 'None charged',
          onPress: go('penalties'),
        },
  ];

  const parts = [
    { key: 'academic' as Tab, label: 'Academic', paid: sm.academic_paid, due: sm.academic_due },
    ...(tr ? [{ key: 'transport' as Tab, label: 'Transport', paid: sm.transport_paid, due: sm.transport_due }] : []),
  ].filter(p => p.due > 0 || p.paid > 0);

  const shownSent = allSent ? sent : sent.slice(0, 3);

  return (
    <>
      {!!a?.academic_year && <PageLine text={`Academic year ${a.academic_year}`} />}
      <KpiGrid items={kpis} />

      {/* How to pay */}
      {sm.remaining > 0 && (
        <Card flush>
          <CardHead
            icon={qr ? 'qr-code-outline' : 'card-outline'}
            title="Pay fees"
            sub={qr ? 'On the school’s UPI QR — straight to the school' : 'UPI, card or net banking'}
          />
          {!!qr && (
            <View style={s.qrLine}>
              {!!qr.image_url && <Image source={{ uri: qr.image_url }} style={s.qrThumb} resizeMode="contain" />}
              <Text style={s.qrText}>
                Pay on the QR, then send the UTR or a screenshot. The school checks it and your receipt shows here.
              </Text>
            </View>
          )}
          <PayOptions
            qr={qr}
            gatewayReady={!!pay.qr?.gateway_ready}
            onQr={() => pay.academic(next)}
            onOnline={() => pay.academicOnline(next)}
          />
        </Card>
      )}

      {/* Paid, by fee */}
      {parts.length > 0 && (
        <Card>
          <CardHead icon="pie-chart-outline" title="Paid, by fee" sub={`${inr(sm.total_paid)} of ${inr(sm.total_due)}`} />
          {parts.map((p, i) => {
            const left = Math.max(0, p.due - p.paid);
            return (
              <TouchableOpacity key={p.label} activeOpacity={0.7} onPress={go(p.key)}>
                <PctRow
                  label={p.label}
                  pct={p.due > 0 ? Math.round((p.paid / p.due) * 100) : 100}
                  value={`${inr(p.paid)} / ${inr(p.due)}`}
                  meta={left > 0 ? `${inr(left)} left` : 'Paid in full'}
                  isLast={i === parts.length - 1}
                />
              </TouchableOpacity>
            );
          })}
        </Card>
      )}

      {/* Installments ahead */}
      {unpaid.length > 0 && (
        <Card>
          <CardHead icon="receipt-outline" title="Installments" sub="Academic fee" action="All" onAction={go('academic')} />
          {unpaid.slice(0, 3).map((it, i, list) => (
            <InstallmentRow key={it.serial} item={it} onPay={pay.academic} isLast={i === list.length - 1} />
          ))}
        </Card>
      )}

      {/* Sent on the school's QR */}
      {sent.length > 0 && (
        <Card>
          <CardHead
            icon="paper-plane-outline"
            title="Sent to the school"
            sub={pending > 0 ? `${pending} being checked` : 'Payments on the school QR'}
            action={sent.length > 3 ? (allSent ? 'Less' : 'All') : undefined}
            onAction={() => setAllSent(v => !v)}
          />
          {shownSent.map((r, i) => (
            <QrRequestRow
              key={r.id}
              r={r}
              onPress={r.screenshot_url ? () => onOpenShot(r.screenshot_url!) : undefined}
              isLast={i === shownSent.length - 1}
            />
          ))}
        </Card>
      )}

      {/* Latest receipts */}
      <Card>
        <CardHead icon="document-text-outline" title="Recent payments" sub={payments.length ? `Last on ${day(payments[0]?.payment_date)}` : null} />
        {payments.length === 0 ? (
          <Note>No payments recorded yet.</Note>
        ) : (
          payments
            .slice(0, 5)
            .map((p, i, list) => (
              <ReceiptRow key={`${p.fee_type}-${p.id}`} p={p} showType isLast={i === list.length - 1} />
            ))
        )}
      </Card>
    </>
  );
};

// ── Academic ─────────────────────────────────────────────────────────────────
const Academic = ({ a, pay }: { a: AcademicFees; pay: Pay }) => {
  const t = a.totals;
  const pct = t.net_due > 0 ? Math.round((t.paid / t.net_due) * 100) : 100;
  const next = a.upcoming.find(i => i.status !== 'paid' && i.payable > 0);

  return (
    <>
      <Card flush>
        <CardHead icon="school-outline" title="Academic fee" sub={a.academic_year ? `Year ${a.academic_year}` : null} />
        <PctRow
          label="Cleared"
          pct={pct}
          value={`${pct}%`}
          meta={`${inr(t.paid)} paid of ${inr(t.net_due)}`}
          isLast
        />
        <MiniStats
          items={[
            { label: 'Payable', value: inr(t.net_due) },
            { label: 'Paid', value: inr(t.paid) },
            { label: 'Remaining', value: inr(t.remaining), low: t.remaining > 0 },
          ]}
        />
        {t.remaining > 0 && (
          <PayOptions
            qr={pay.qr?.qr}
            gatewayReady={!!pay.qr?.gateway_ready}
            onQr={() => pay.academic(next)}
            onOnline={() => pay.academicOnline()}
          />
        )}
      </Card>

      <Card>
        <CardHead icon="calendar-outline" title="Installments" sub={a.upcoming.length ? `${a.upcoming.length} this year` : null} />
        {a.upcoming.length === 0 ? (
          <Note>No installment schedule has been set.</Note>
        ) : (
          a.upcoming.map((it, i) => (
            <InstallmentRow key={it.serial} item={it} onPay={pay.academic} isLast={i === a.upcoming.length - 1} />
          ))
        )}
      </Card>

      <Card>
        <CardHead icon="list-outline" title="Fee structure" />
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
      </Card>

      <Card>
        <CardHead icon="document-text-outline" title="Payments" sub={a.paid.length ? `${a.paid.length} this year` : null} />
        {a.paid.length === 0 ? (
          <Note>No academic payments yet.</Note>
        ) : (
          a.paid.map((p, i) => <ReceiptRow key={p.id} p={p} isLast={i === a.paid.length - 1} />)
        )}
      </Card>
    </>
  );
};

// ── Transport ────────────────────────────────────────────────────────────────
const Transport = ({ tr, pay }: { tr: TransportFees; pay: Pay }) => {
  const t = tr.totals;
  const pct = t.annual_fee > 0 ? Math.round((t.paid / t.annual_fee) * 100) : 100;
  // The payments arrive newest first; the serial counts from the first one.
  const payments: TransportPayment[] = tr.paid.map((p, i) => ({
    id: p.id,
    serial: p.serial ?? tr.paid.length - i,
    amount: p.amount,
    date: p.date ?? p.payment_date,
    day: p.day ?? null,
    submitted_by: p.submitted_by ?? '—',
    type: p.type ?? '—',
    mode: p.mode ?? p.payment_mode,
    receipt_number: p.receipt_number,
  }));

  return (
    <>
      <Card flush>
        <CardHead icon="bus-outline" title={tr.route.route_name} sub={`${inr(t.monthly_fee)} a month · ${t.months_count} months`} />
        <PctRow label="Cleared" pct={pct} value={`${pct}%`} meta={`${inr(t.paid)} paid of ${inr(t.annual_fee)}`} isLast />
        <MiniStats
          items={[
            { label: 'For the year', value: inr(t.annual_fee) },
            { label: 'Paid', value: inr(t.paid) },
            { label: 'Remaining', value: inr(t.remaining), low: t.remaining > 0 },
          ]}
        />
        {t.remaining > 0 && (
          <PayOptions
            qr={pay.qr?.qr}
            gatewayReady={!!pay.qr?.gateway_ready}
            qrLabel="Pay transport on QR"
            onlineLabel="Pay transport online"
            onQr={pay.transport}
            onOnline={pay.transportOnline}
          />
        )}
      </Card>

      <Card>
        <CardHead icon="calendar-outline" title="Month by month" />
        {tr.schedule.length === 0 ? (
          <Note>No months have been set.</Note>
        ) : (
          tr.schedule.map((m, i) => <MonthLine key={m.key} m={m} isLast={i === tr.schedule.length - 1} />)
        )}
      </Card>

      <Card>
        <CardHead icon="document-text-outline" title="Payments" />
        <TransportPayments payments={payments} />
      </Card>
    </>
  );
};

// ── Penalties ────────────────────────────────────────────────────────────────
const Penalties = ({ p }: { p: FeePenalties | null }) => {
  if (!p || p.count === 0) {
    return (
      <Card flush>
        <CardHead icon="checkmark-circle-outline" title="No penalties" />
        <Note>Nothing has been charged for paying late.</Note>
      </Card>
    );
  }

  return (
    <>
      <Card flush>
        <CardHead icon="alert-circle-outline" title="Late payment penalties" sub={`${inr(p.penalty_per_day)} for each day late`} />
        <MiniStats
          items={[
            { label: 'Charged', value: inr(p.total_penalty), low: true },
            { label: p.count === 1 ? 'Payment' : 'Payments', value: String(p.count) },
            { label: 'A day late', value: inr(p.penalty_per_day) },
          ]}
        />
      </Card>
      <Card>
        <CardHead icon="list-outline" title="Charged on" />
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
      </Card>
    </>
  );
};

// ── Screen ───────────────────────────────────────────────────────────────────
const FeesScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [dashboard, setDashboard] = useState<FeeDashboard | null>(null);
  const [penalties, setPenalties] = useState<FeePenalties | null>(null);
  const [qr, setQr] = useState<FeeQr | null>(null);
  const [loading, setLoading] = useState(true);

  // Coming back refetches quietly — the skeleton only shows the first time.
  const load = useCallback(async () => {
    try {
      const [d, p, q] = await Promise.all([
        getFeeDashboard().catch(() => null),
        getFeePenalties().catch(() => null),
        getFeeQr().catch(() => null),
      ]);
      setDashboard(prev => d ?? prev);
      setPenalties(p);
      setQr(q);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusLoad(load);
  const { refreshing, onRefresh } = useRefresh(load);

  const a = dashboard?.academic;
  const tr = dashboard?.transport;

  const academicOnline = useCallback(
    (inst?: Installment) => {
      navigation.navigate('PayAmount', {
        title: 'Pay Academic Fee',
        feeType: 'academic',
        suggestedAmount: inst ? inst.payable : a?.totals.remaining ?? 0,
        note: inst ? inst.label : undefined,
      });
    },
    [a, navigation],
  );

  const onQr = useCallback(
    (feeType: 'academic' | 'transport', inst?: Installment) => {
      navigation.navigate('QrPay', {
        qr: qr?.qr ?? null,
        feeType,
        suggestedAmount:
          feeType === 'transport' ? tr?.totals.remaining ?? 0 : inst ? inst.payable : a?.totals.remaining ?? 0,
        note: feeType === 'academic' && inst ? inst.label : undefined,
        hasTransport: !!tr,
        academicLeft: a?.totals.remaining ?? 0,
        transportLeft: tr?.totals.remaining ?? 0,
      });
    },
    [qr, a, tr, navigation],
  );

  // With the school's QR on, a row's Pay goes there; without, to online as before.
  const pay: Pay = {
    qr,
    academic: inst => (qr?.qr ? onQr('academic', inst) : academicOnline(inst)),
    transport: () => (qr?.qr ? onQr('transport') : navigation.navigate('TransportPay')),
    academicOnline,
    transportOnline: () => navigation.navigate('TransportPay'),
  };

  const openShot = (uri: string) => navigation.navigate('FeeImage', { uri, title: 'Screenshot' });

  // Transport only once there is a route to show.
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'academic', label: 'Academic' },
    ...(tr ? [{ key: 'transport' as Tab, label: 'Transport' }] : []),
    { key: 'penalties', label: 'Penalties' },
  ];
  const current: Tab = tabs.some(t => t.key === tab) ? tab : 'overview';
  const go = (t: Tab) => () => setTab(t);

  const body = (() => {
    if (current === 'penalties') return <Penalties p={penalties} />;
    if (!dashboard) return null;
    if (current === 'academic') {
      return a ? (
        <Academic a={a} pay={pay} />
      ) : (
        <Card flush>
          <CardHead icon="school-outline" title="No academic fees" />
          <Note>No academic fees have been set for you.</Note>
        </Card>
      );
    }
    if (current === 'transport' && tr) return <Transport tr={tr} pay={pay} />;
    return <Overview data={dashboard} pay={pay} penalties={penalties} go={go} onOpenShot={openShot} />;
  })();

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <Tabs tabs={tabs} active={current} onChange={setTab} />

      {loading && !refreshing ? (
        <DashSkeleton />
      ) : !dashboard && current !== 'penalties' ? (
        <DocNoData
          icon="cash-outline"
          title="No fee details yet"
          subtitle="Your fees will appear here once the school has set them up."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {body}
        </ScrollView>
      )}
    </View>
  );
};

export default FeesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, paddingBottom: 32 },

  qrLine: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6, paddingBottom: 12 },
  qrThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  qrText: { flex: 1, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

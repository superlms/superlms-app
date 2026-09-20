import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
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
  PaymentRow,
  TransportFees,
  feeReceiptUrl,
  getFeeDashboard,
  getFeePenalties,
  getFeeQr,
} from '../../api/feeApi';
import { transportReceiptUrl } from '../../api/transportApi';
import { AmountRows, InstallmentRow, MonthLine, ReceiptRow, inr } from './feesUi';
import { FeeButton, PayOptions, QrImage, QrRequestRow, openUpiApp } from './qrUi';

/**
 * A student's fees, in the dashboards' way: white cards on the page's grey,
 * each with a small accent icon, and four headline figures to open on.
 *
 *   Overview   what is left, what is paid, the next installment, and the
 *              transport fee (the late fee, without a route); the school's
 *              QR to pay on; paid by fee; the fee structure and the transport
 *              month by month; every installment; payments sent on the
 *              school's QR; and the latest receipts.
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
  /** The UPI apps on the school's QR, then the screen that reports it. */
  onQrApp: (inst?: Installment) => void;
}

// ── Overview ─────────────────────────────────────────────────────────────────
const Overview = ({
  data,
  pay,
  penalties,
  go,
  onOpenImage,
  onOpenReceipt,
}: {
  data: FeeDashboard;
  pay: Pay;
  penalties: FeePenalties | null;
  go: (t: Tab) => () => void;
  onOpenImage: (uri: string, title: string) => void;
  onOpenReceipt: (p: PaymentRow) => void;
}) => {
  const [allSent, setAllSent] = useState(false);
  const sm = data.summary;
  const a = data.academic;
  const tr = data.transport;
  const at = a?.totals;
  const installments = a?.upcoming ?? [];
  const unpaid = installments.filter(i => i.status !== 'paid' && i.payable > 0);
  const next = unpaid[0];
  const overdue = unpaid.some(i => i.status === 'overdue');
  const payments = data.overall_payments ?? [];
  // The months the school bills — the rest of the year isn't on this route.
  const months = (tr?.schedule ?? []).filter(m => m.status !== 'no_transport');
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
    tr
      ? {
          icon: 'bus-outline',
          label: 'Transport',
          value: inr(tr.totals.remaining),
          note:
            tr.totals.remaining > 0
              ? `${inr(tr.totals.paid)} paid of ${inr(tr.totals.annual_fee)}`
              : `Paid in full · ${inr(tr.totals.annual_fee)}`,
          low: tr.totals.remaining > 0,
          onPress: go('transport'),
        }
      : qr || sent.length > 0
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

      {/* How to pay — the school's QR, there to scan */}
      {sm.remaining > 0 && (
        <Card flush>
          <CardHead
            icon={qr ? 'qr-code-outline' : 'card-outline'}
            title="Pay fees"
            sub={qr ? 'On the school’s UPI QR — straight to the school' : 'UPI, card or net banking'}
          />
          {qr ? (
            <>
              {!!qr.image_url && <QrImage url={qr.image_url} onPress={() => onOpenImage(qr.image_url!, 'School QR')} />}
              <View style={s.payBtns}>
                <FeeButton label="Pay on school QR" icon="qr-code-outline" onPress={() => pay.onQrApp(next)} />
                {!!pay.qr?.gateway_ready && (
                  <FeeButton
                    outline
                    label="Pay online"
                    icon="card-outline"
                    onPress={() => pay.academicOnline(next)}
                  />
                )}
              </View>
              <Text style={s.qrText}>
                Your UPI apps open on the school’s QR. After paying, send the UTR or a screenshot — the payment
                isn’t counted until the school has it.
              </Text>
            </>
          ) : (
            <PayOptions
              qr={null}
              gatewayReady
              onQr={() => pay.academic(next)}
              onOnline={() => pay.academicOnline(next)}
            />
          )}
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

      {/* The fee structure, and where it stands */}
      {!!at && a.structures.length > 0 && (
        <Card>
          <CardHead
            icon="list-outline"
            title="Fee structure"
            sub={a.academic_year ? `Academic fee · year ${a.academic_year}` : 'Academic fee'}
            action="Details"
            onAction={go('academic')}
          />
          <AmountRows
            rows={[
              ...a.structures.map(it => ({ label: it.fee_name, value: inr(it.amount) })),
              ...(at.concession > 0 ? [{ label: 'Concession', value: `− ${inr(at.concession)}` }] : []),
              { label: 'Payable', value: inr(at.net_due), total: true },
              { label: 'Paid', value: inr(at.paid) },
              { label: 'Remaining', value: inr(at.remaining), total: true, danger: at.remaining > 0 },
            ]}
          />
        </Card>
      )}

      {/* The transport fee, month by month — only for a student on a route */}
      {!!tr && months.length > 0 && (
        <Card>
          <CardHead
            icon="bus-outline"
            title="Transport, month by month"
            sub={`${inr(tr.totals.monthly_fee)} a month · ${tr.route.route_name}`}
            action="Details"
            onAction={go('transport')}
          />
          {months.map((m, i) => (
            <MonthLine key={m.key} m={m} isLast={i === months.length - 1} />
          ))}
        </Card>
      )}

      {/* Every installment of the year */}
      {installments.length > 0 && (
        <Card>
          <CardHead
            icon="receipt-outline"
            title="Installments"
            sub={`Academic fee · ${installments.length} this year`}
          />
          {installments.map((it, i) => (
            <InstallmentRow key={it.serial} item={it} onPay={pay.academic} isLast={i === installments.length - 1} />
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
              onPress={r.screenshot_url ? () => onOpenImage(r.screenshot_url!, 'Screenshot') : undefined}
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
              <ReceiptRow
                key={`${p.fee_type}-${p.id}`}
                p={p}
                showType
                onOpen={() => onOpenReceipt(p)}
                isLast={i === list.length - 1}
              />
            ))
        )}
      </Card>
    </>
  );
};

// ── Academic ─────────────────────────────────────────────────────────────────
const Academic = ({
  a,
  pay,
  onOpenReceipt,
}: {
  a: AcademicFees;
  pay: Pay;
  onOpenReceipt: (p: PaymentRow) => void;
}) => {
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
          a.paid.map((p, i) => (
            <ReceiptRow key={p.id} p={p} onOpen={() => onOpenReceipt(p)} isLast={i === a.paid.length - 1} />
          ))
        )}
      </Card>
    </>
  );
};

// ── Transport ────────────────────────────────────────────────────────────────
const Transport = ({
  tr,
  pay,
  onOpenReceipt,
}: {
  tr: TransportFees;
  pay: Pay;
  onOpenReceipt: (p: PaymentRow) => void;
}) => {
  const t = tr.totals;
  const pct = t.annual_fee > 0 ? Math.round((t.paid / t.annual_fee) * 100) : 100;

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
        <CardHead
          icon="document-text-outline"
          title="Payments"
          sub={tr.paid.length ? `Last on ${day(tr.paid[0]?.payment_date)}` : null}
        />
        {tr.paid.length === 0 ? (
          <Note>No transport payments yet.</Note>
        ) : (
          tr.paid.map((p, i) => (
            <ReceiptRow key={p.id} p={p} onOpen={() => onOpenReceipt(p)} isLast={i === tr.paid.length - 1} />
          ))
        )}
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

  /**
   * Pay on the school QR: the phone's UPI apps open on the school's UPI ID
   * with the amount filled in, and the screen that reports the payment comes
   * up behind them — nothing is sent, and nothing counts as paid, until the
   * UTR or a screenshot goes with it.
   */
  const payOnQrApp = useCallback(
    async (inst?: Installment) => {
      const school = qr?.qr;
      if (!school) return academicOnline(inst);

      const amount = inst ? inst.payable : a?.totals.remaining ?? 0;
      const opened = await openUpiApp(school, amount > 0 ? amount : undefined, `School fee${inst ? ` ${inst.label}` : ''}`);
      // Nothing to open when the school gave only a QR and no UPI ID — the
      // next screen carries the QR itself, so say nothing then.
      if (!opened && school.upi_id) {
        AppAlert.alert(
          'No UPI app found',
          'Save the QR from this screen and scan it from your gallery in any UPI app, or pay from another phone. Then send the UTR or a screenshot here.',
        );
      }
      onQr('academic', inst);
    },
    [qr, a, academicOnline, onQr],
  );

  // With the school's QR on, a row's Pay goes there; without, to online as before.
  const pay: Pay = {
    qr,
    academic: inst => (qr?.qr ? onQr('academic', inst) : academicOnline(inst)),
    transport: () => (qr?.qr ? onQr('transport') : navigation.navigate('TransportPay')),
    academicOnline,
    transportOnline: () => navigation.navigate('TransportPay'),
    onQrApp: payOnQrApp,
  };

  const openImage = (uri: string, title: string) => navigation.navigate('FeeImage', { uri, title });

  // The receipt the school issues for a payment — academic or transport —
  // in the PDF viewer.
  const openReceipt = (p: PaymentRow) => {
    const transport = p.fee_type === 'transport';
    navigation.navigate('TransportReceipt', {
      payment: { id: p.id, receipt_number: p.receipt_number },
      url: transport ? transportReceiptUrl(p.id) : feeReceiptUrl(p.id),
      namePrefix: transport ? 'Transport-Receipt' : 'Fee-Receipt',
    });
  };

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
        <Academic a={a} pay={pay} onOpenReceipt={openReceipt} />
      ) : (
        <Card flush>
          <CardHead icon="school-outline" title="No academic fees" />
          <Note>No academic fees have been set for you.</Note>
        </Card>
      );
    }
    if (current === 'transport' && tr) return <Transport tr={tr} pay={pay} onOpenReceipt={openReceipt} />;
    return (
      <Overview
        data={dashboard}
        pay={pay}
        penalties={penalties}
        go={go}
        onOpenImage={openImage}
        onOpenReceipt={openReceipt}
      />
    );
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

  payBtns: { gap: 10, paddingTop: 12 },
  qrText: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18, marginTop: 10 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

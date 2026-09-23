import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad, useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { CycleInstallment, FeeSide, StudentLedger, getStudentLedger, modeLabel, typeLabel } from '../../api/adminFeeApi';
import { DocHeader } from '../more/docUi';
import { Card, CardHead, DashError, DashSkeleton, KpiGrid, Note, PctRow, type Kpi } from '../home/dashboardUi';
import { AmountRows } from '../fees/feesUi';
import { FeeButton } from '../fees/qrUi';
import { Avatar } from './adminTransportUi';
import { PaymentLine, inr, openFeeReceipt } from './adminFeeUi';

/**
 * One student's fees — the panel's View Fee ledger, drawn as the student's
 * own Fees is: who they are, four figures (left to pay, paid, penalty due,
 * concession), what has come in of each fee, the academic and transport fee
 * net of concession, the school's fee cycle and which installments are
 * cleared, the penalties on late ones, and every payment with its receipt.
 * Collect fee opens the panel's Collect Fee.
 */

const STATUS: Record<CycleInstallment['status'], string> = {
  paid: 'PAID',
  partial: 'PARTLY PAID',
  pending: 'DUE',
  na: '—',
};

const pctText = (p: number) => `${Number(p || 0).toFixed(2).replace(/\.?0+$/, '')}%`;

//   Apr–Jun (26) · 25%                                  ₹ 2,250
//   Due 15 Apr 2026 · overdue · ₹ 1,000 paid · ₹ 40 penalty    DUE
const InstallmentLine = ({ it, isLast }: { it: CycleInstallment; isLast: boolean }) => {
  const paid = it.status === 'paid';
  const meta = [
    it.due_date ? `Due ${it.due_date}` : null,
    it.overdue ? 'overdue' : null,
    !paid && it.paid > 0 ? `${inr(it.paid)} paid` : null,
    it.penalty_net > 0 ? `${inr(it.penalty_net)} penalty` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={[s.line, !isLast && s.divider]}>
      <View style={s.lineBody}>
        <Text style={[s.lineTitle, paid && s.muted]}>
          {it.label}
          {it.percent > 0 ? <Text style={s.muted}>{`  ${pctText(it.percent)}`}</Text> : null}
        </Text>
        {!!meta && <Text style={[s.lineMeta, it.overdue && s.danger]}>{meta}</Text>}
      </View>
      <View style={s.lineRight}>
        <Text style={[s.lineAmount, paid && s.muted]}>{inr(paid ? it.amount : it.balance)}</Text>
        <Text style={[s.status, it.overdue && s.danger, it.status === 'pending' && !it.overdue && s.accent]}>{STATUS[it.status]}</Text>
      </View>
    </View>
  );
};

const SideCard = ({ label, side, icon }: { label: string; side: FeeSide; icon: string }) => (
  <Card>
    <CardHead
      icon={icon}
      title={`${label} fee`}
      sub={`${side.rows.length} ${side.rows.length === 1 ? 'head' : 'heads'}`}
    />
    {side.rows.length === 0 ? (
      <Note>{`No ${label.toLowerCase()} fee set for this class.`}</Note>
    ) : (
      <AmountRows
        rows={[
          ...side.rows.map(r => ({ label: r.fee_name, value: inr(r.amount) })),
          ...(side.concession > 0
            ? [
                { label: 'Fee', value: inr(side.gross), total: true },
                { label: 'Concession', value: `− ${inr(side.concession)}` },
              ]
            : []),
          { label: 'Payable', value: inr(side.net), total: true },
        ]}
      />
    )}
    {!!side.route && (
      <Note>
        {`${side.route.name} · ${inr(side.route.monthly)}/month × ${side.route.months} months · Driver ${side.route.driver}`}
      </Note>
    )}
    {side.applied.length > 0 && (
      <Note>{side.applied.map(a => `${a.reason} — ${a.label} (${inr(a.amount)})`).join(' · ')}</Note>
    )}
  </Card>
);

const AdminFeeStudentScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const [d, setD] = useState<StudentLedger | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Back from collecting, the ledger shows the payment.
  const load = useCallback(async () => {
    setError(null);
    try {
      setD(await getStudentLedger(id));
    } catch (e) {
      setError(apiErr(e, 'Could not load this student’s fees.'));
    }
  }, [id]);
  useFocusLoad(load);
  const { refreshing, onRefresh } = useRefresh(load);

  const header = <DocHeader title="View Fee" onBackPress={() => navigation.goBack()} />;

  if (!d) {
    return (
      <View style={s.root}>
        {header}
        {error ? <DashError message={error} onRetry={load} /> : <DashSkeleton />}
      </View>
    );
  }

  const t = d.totals;
  const stu = d.student;
  const penaltyNet = d.cycles.reduce((sum, c) => sum + (c.penalty_net ?? 0), 0);
  const canCollect = d.caps.academic > 0 || d.caps.transport > 0 || d.caps.penalty > 0;

  const kpis: Kpi[] = [
    {
      icon: 'wallet-outline',
      label: 'Left to pay',
      value: inr(t.remaining),
      note: t.remaining > 0 ? `of ${inr(t.net)} this year` : 'Nothing left this year',
      low: t.remaining > 0,
    },
    { icon: 'checkmark-done-outline', label: 'Paid', value: inr(t.paid), note: `${Math.round(t.pct)}% cleared` },
    {
      icon: 'alert-circle-outline',
      label: 'Penalty due',
      value: inr(penaltyNet),
      note: penaltyNet > 0 ? 'On late installments' : 'None due',
      low: penaltyNet > 0,
    },
    {
      icon: 'pricetag-outline',
      label: 'Concession',
      value: inr(t.concession),
      note: t.concession > 0 ? `off ${inr(t.gross)}` : 'None given',
    },
  ];

  const lines = [
    { label: 'Overall', line: t },
    { label: 'Academic', line: d.academic },
    ...(d.hasTransport ? [{ label: 'Transport', line: d.transport }] : []),
  ];

  const late = d.cycles.flatMap(c => c.installments.filter(i => (i.penalty ?? 0) > 0).map(i => ({ ...i, fee_type: c.fee_type })));
  const waived = d.cycles.reduce((sum, c) => sum + (c.penalty_waived ?? 0), 0);
  const penaltyPaid = d.cycles.reduce((sum, c) => sum + (c.penalty_paid ?? 0), 0);

  const details = [
    ['Father', stu.father_name],
    ['Mother', stu.mother_name],
    ['Phone', stu.phone],
    ['Roll no.', stu.roll_no],
  ].filter(([, v]) => v && v !== '—');

  return (
    <View style={s.root}>
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Who they are */}
        <Card flush>
          <View style={s.who}>
            <Avatar uri={d.photo} name={stu.name} size={48} />
            <View style={s.whoBody}>
              <Text style={s.name} numberOfLines={1}>{stu.name}</Text>
              <Text style={s.sub} numberOfLines={1}>{`${stu.class_section} · Adm ${stu.admission_no}`}</Text>
            </View>
          </View>
          {details.length > 0 && (
            <Text style={s.details}>{details.map(([k, v]) => `${k} ${v}`).join('  ·  ')}</Text>
          )}
          <View style={s.collect}>
            <FeeButton
              label={canCollect ? 'Collect fee' : 'Nothing due to collect'}
              icon="cash-outline"
              disabled={!canCollect}
              onPress={() => navigation.navigate('AdminFeeCollect', { id: d.student.id })}
            />
          </View>
        </Card>

        <KpiGrid items={kpis} />

        {/* What has come in, overall and of each fee */}
        <Card>
          <CardHead icon="pie-chart-outline" title="Paid, by fee" sub={`${inr(t.paid)} of ${inr(t.net)}`} />
          {lines.map((l, i) => (
            <PctRow
              key={l.label}
              label={l.label}
              pct={Math.round(l.line.pct)}
              value={`${inr(l.line.paid)} / ${inr(l.line.net)}`}
              meta={l.line.remaining > 0 ? `${inr(l.line.remaining)} remaining` : 'Paid in full'}
              isLast={i === lines.length - 1}
            />
          ))}
        </Card>

        <SideCard label="Academic" side={d.academic} icon="school-outline" />
        {d.hasTransport && <SideCard label="Transport" side={d.transport} icon="bus-outline" />}

        {/* The school's fee cycle, and where it stands */}
        {d.cycles.map(c => {
          const due = Math.max(0, c.total - c.paid);
          return (
            <Card key={c.fee_type}>
              <CardHead
                icon="calendar-outline"
                title={`${typeLabel(c.fee_type)} fee cycle · ${c.label}`}
                sub={`${c.year} · ${c.paid_count} of ${c.installments.length} cleared · ${inr(due)} due`}
              />
              {c.installments.map((it, i) => (
                <InstallmentLine key={`${c.fee_type}-${it.cycle_id}-${i}`} it={it} isLast={i === c.installments.length - 1} />
              ))}
            </Card>
          );
        })}

        {/* Late installments, and the penalty on them */}
        <Card>
          <CardHead
            icon="alert-circle-outline"
            title="Penalties"
            sub={late.length ? `${late.length} ${late.length === 1 ? 'installment' : 'installments'} late · ${inr(penaltyNet)} still due` : null}
          />
          {late.length === 0 ? (
            <Note>No penalties currently due — every installment is either paid or within its due date.</Note>
          ) : (
            <AmountRows
              rows={[
                ...late.map(i => ({
                  label: `${typeLabel(i.fee_type)} · ${i.label} · ${i.days_late} ${i.days_late === 1 ? 'day' : 'days'} × ${inr(i.penalty_per_day)}`,
                  value: inr(i.penalty),
                })),
                ...(waived > 0 ? [{ label: 'Waived', value: `− ${inr(waived)}` }] : []),
                ...(penaltyPaid > 0 ? [{ label: 'Paid', value: `− ${inr(penaltyPaid)}` }] : []),
                { label: 'Total penalty still due', value: inr(penaltyNet), total: true, danger: penaltyNet > 0 },
              ]}
            />
          )}
        </Card>

        {/* Every payment, with its slip */}
        <Card>
          <CardHead
            icon="document-text-outline"
            title="Payments"
            sub={`${d.payments.length} ${d.payments.length === 1 ? 'entry' : 'entries'} · ${inr(t.paid)} collected`}
          />
          {d.payments.length === 0 ? (
            <Note>No payments recorded yet.</Note>
          ) : (
            d.payments.map((p, i) => (
              <PaymentLine
                key={`${p.kind}-${p.id}`}
                title={p.receipt_number || typeLabel(p.fee_type)}
                meta={[
                  typeLabel(p.fee_type),
                  modeLabel(p.payment_mode),
                  p.payment_date,
                  p.collected_by && p.collected_by !== '—' ? `by ${p.collected_by}` : null,
                  p.penalty_amount > 0 ? `incl. ${inr(p.penalty_amount)} penalty` : null,
                  p.waiver_amount > 0 ? `${inr(p.waiver_amount)} waived` : null,
                  p.remark,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                amount={inr(p.amount)}
                onReceipt={p.is_concession ? undefined : () => openFeeReceipt(navigation, p)}
                isLast={i === d.payments.length - 1}
              />
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
};

export default AdminFeeStudentScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  danger: { color: theme.colors.danger },
  accent: { color: theme.colors.primary },
  muted: { color: theme.colors.textMuted },

  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  whoBody: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 13, color: theme.colors.textSecondary },
  details: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18, marginTop: 10 },
  collect: { marginTop: 14 },

  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  lineBody: { flex: 1, gap: 3 },
  lineTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  lineMeta: { fontSize: 12, color: theme.colors.textMuted },
  lineRight: { alignItems: 'flex-end', gap: 3 },
  lineAmount: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  status: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

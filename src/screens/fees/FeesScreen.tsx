import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import {
  AcademicFees,
  FeeDashboard,
  FeePenalties,
  Installment,
  InstallmentStatus,
  MonthRow,
  PaymentRow,
  TransportFees,
  getFeeDashboard,
  getFeePenalties,
} from '../../api/feeApi';

const PURPLE = '#7C3AED';
const ACADEMIC = '#6366F1';
const TRANSPORT = '#0EA5E9';

const TABS = ['Dashboard', 'Academic', 'Transport', 'Penalties'] as const;
type Tab = (typeof TABS)[number];

const TAB_META: Record<Tab, { icon: string; color: string }> = {
  Dashboard: { icon: 'grid-outline', color: PURPLE },
  Academic: { icon: 'school-outline', color: ACADEMIC },
  Transport: { icon: 'bus-outline', color: TRANSPORT },
  Penalties: { icon: 'alert-circle-outline', color: '#EF4444' },
};

const inr = (n: number) => `₹ ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const INST_COLOR: Record<InstallmentStatus, string> = {
  paid: theme.colors.success,
  partial: '#F59E0B',
  due: theme.colors.primary,
  overdue: theme.colors.danger,
};
const MONTH_COLOR: Record<string, string> = {
  paid: theme.colors.success,
  partial: '#F59E0B',
  pending: theme.colors.danger,
  no_transport: theme.colors.textMuted,
};

// ─── Shared bits ──────────────────────────────────────────────────────────────
const SectionTitle = ({ children }: { children: React.ReactNode }) => <Text style={s.sectionTitle}>{children}</Text>;

const Bar = ({ pct, color }: { pct: number; color: string }) => (
  <View style={s.track}>
    <View style={[s.fill, { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }]} />
  </View>
);

const KV = ({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) => (
  <View style={s.kv}>
    <Text style={s.kvLabel}>{label}</Text>
    <Text style={[s.kvValue, bold && s.kvValueBold, !!color && { color }]}>{value}</Text>
  </View>
);

const Empty = ({ icon, text }: { icon: string; text: string }) => (
  <View style={s.empty}>
    <VectorIcon iconSet="Ionicons" iconName={icon} size={40} color={theme.colors.textMuted} />
    <Text style={s.emptyText}>{text}</Text>
  </View>
);

const PayButton = ({ color, label, onPress }: { color: string; label: string; onPress: () => void }) => (
  <TouchableOpacity style={[s.payBtn, { backgroundColor: color }]} activeOpacity={0.85} onPress={onPress}>
    <VectorIcon iconSet="Ionicons" iconName="flash" size={16} color="#fff" />
    <Text style={s.payText}>{label}</Text>
  </TouchableOpacity>
);

const FeeLine = ({ name, amount }: { name: string; amount: number }) => (
  <View style={s.feeLine}>
    <Text style={s.feeLineName}>{name}</Text>
    <Text style={s.feeLineAmt}>{inr(amount)}</Text>
  </View>
);

const Slip = ({ p }: { p: PaymentRow }) => (
  <View style={s.slip}>
    <View style={[s.slipIcon, { backgroundColor: theme.colors.success + '18' }]}>
      <VectorIcon iconSet="Ionicons" iconName="receipt-outline" size={18} color={theme.colors.success} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.slipTitle} numberOfLines={1}>{p.receipt_number}</Text>
      <Text style={s.slipSub}>{p.payment_mode} · {p.payment_date ?? '-'}{p.penalty_amount > 0 ? ` · penalty ${inr(p.penalty_amount)}` : ''}</Text>
    </View>
    <Text style={s.slipAmt}>{inr(p.amount)}</Text>
  </View>
);

const InstallmentCard = ({ item, onPay }: { item: Installment; onPay: (i: Installment) => void }) => {
  const color = INST_COLOR[item.status];
  const isPaid = item.status === 'paid';
  return (
    <View style={[s.card, { borderTopColor: color, borderTopWidth: 4 }]}>
      <View style={s.cardHeadRow}>
        <Text style={s.cardTitle}>{item.label}</Text>
        <View style={[s.badge, { backgroundColor: color + '1A' }]}>
          <Text style={[s.badgeText, { color }]}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={[s.amountBox, { backgroundColor: color + '12' }]}>
        <Text style={s.amountLabel}>{isPaid ? 'Amount' : 'Payable now'}</Text>
        <Text style={[s.amountValue, { color }]}>{inr(isPaid ? item.amount : item.payable)}</Text>
      </View>
      <KV label="Installment" value={inr(item.amount)} />
      {item.paid > 0 && !isPaid && <KV label="Already paid" value={inr(item.paid)} color={theme.colors.success} />}
      {item.penalty > 0 && <KV label={`Penalty (${item.days_overdue}d)`} value={inr(item.penalty)} color={theme.colors.danger} />}
      {item.due_date && <KV label="Due date" value={item.due_date} color={item.status === 'overdue' ? theme.colors.danger : undefined} />}
      {!isPaid && item.payable > 0 && <PayButton color={color} label={`Pay ${inr(item.payable)}`} onPress={() => onPay(item)} />}
    </View>
  );
};

const MonthGrid = ({ schedule }: { schedule: MonthRow[] }) => (
  <View style={s.monthGrid}>
    {schedule.map(m => {
      const c = MONTH_COLOR[m.status] ?? theme.colors.textMuted;
      return (
        <View key={m.key} style={[s.monthCell, { borderColor: c + '40', backgroundColor: c + '0F' }]}>
          <Text style={s.monthName}>{m.month.slice(0, 3)}</Text>
          <View style={[s.monthDot, { backgroundColor: c }]} />
          <Text style={[s.monthStatus, { color: c }]}>{m.status === 'no_transport' ? '—' : m.status}</Text>
        </View>
      );
    })}
  </View>
);

// ─── Academic block (used in Academic tab + Dashboard) ────────────────────────
const AcademicBlock = ({ a, onPay, compact }: { a: AcademicFees; onPay: (i?: Installment) => void; compact?: boolean }) => {
  const t = a.totals;
  const pct = t.net_due > 0 ? Math.round((t.paid / t.net_due) * 100) : 0;
  return (
    <>
      <View style={[s.card, { borderTopColor: ACADEMIC, borderTopWidth: 4 }]}>
        <Text style={s.cardTitle}>Academic{a.academic_year ? ` · ${a.academic_year}` : ''}</Text>
        <View style={s.bigAmtRow}>
          <Text style={[s.bigAmt, { color: theme.colors.textPrimary }]}>{inr(t.paid)}</Text>
          <Text style={s.bigAmtSlash}> / {inr(t.net_due)}</Text>
        </View>
        <Bar pct={pct} color={ACADEMIC} />
        <View style={s.divider} />
        <KV label="Structure total" value={inr(t.structure_total)} />
        {t.concession > 0 && <KV label="Concession" value={`- ${inr(t.concession)}`} color={theme.colors.success} />}
        <KV label="Remaining" value={inr(t.remaining)} color={theme.colors.danger} bold />
        {t.remaining > 0 && <PayButton color={ACADEMIC} label={`Pay Academic ${inr(t.remaining)}`} onPress={() => onPay()} />}
      </View>

      <SectionTitle>Fee Structure</SectionTitle>
      <View style={s.listCard}>
        {a.structures.length === 0 ? <Text style={s.muted}>No fee items configured.</Text> : a.structures.map(it => <FeeLine key={it.id} name={it.fee_name} amount={it.amount} />)}
      </View>

      <SectionTitle>Upcoming Installments</SectionTitle>
      {a.upcoming.length === 0 ? (
        <Text style={s.muted}>No installment schedule configured.</Text>
      ) : (
        (compact ? a.upcoming.filter(i => i.status !== 'paid').slice(0, 2) : a.upcoming).map(it => <InstallmentCard key={it.serial} item={it} onPay={onPay} />)
      )}

      <SectionTitle>Academic Payments</SectionTitle>
      {a.paid.length === 0 ? (
        <Text style={s.muted}>No academic payments yet.</Text>
      ) : (
        <View style={s.listCard}>{(compact ? a.paid.slice(0, 3) : a.paid).map(p => <Slip key={p.id} p={p} />)}</View>
      )}
    </>
  );
};

// ─── Transport block ──────────────────────────────────────────────────────────
const TransportBlock = ({ tr, onPay, compact }: { tr: TransportFees; onPay: () => void; compact?: boolean }) => {
  const t = tr.totals;
  const pct = t.annual_fee > 0 ? (t.paid / t.annual_fee) * 100 : 0;
  return (
    <>
      <View style={[s.card, { borderTopColor: TRANSPORT, borderTopWidth: 4 }]}>
        <Text style={s.cardTitle}>{tr.route.route_name}</Text>
        <Text style={s.routeSub}>{tr.route.pickup_location ?? '-'} → {tr.route.drop_location ?? '-'}</Text>
        <View style={s.bigAmtRow}>
          <Text style={[s.bigAmt, { color: theme.colors.textPrimary }]}>{inr(t.paid)}</Text>
          <Text style={s.bigAmtSlash}> / {inr(t.annual_fee)}</Text>
        </View>
        <Bar pct={pct} color={TRANSPORT} />
        <View style={s.divider} />
        <KV label="Monthly fee" value={inr(t.monthly_fee)} />
        <KV label="Remaining" value={inr(t.remaining)} color={theme.colors.danger} bold />
        {t.remaining > 0 && <PayButton color={TRANSPORT} label="Pay Transport" onPress={onPay} />}
      </View>

      <SectionTitle>12-Month Status</SectionTitle>
      <MonthGrid schedule={tr.schedule} />

      <SectionTitle>Transport Payments</SectionTitle>
      {tr.paid.length === 0 ? (
        <Text style={s.muted}>No transport payments yet.</Text>
      ) : (
        <View style={s.listCard}>{(compact ? tr.paid.slice(0, 3) : tr.paid).map(p => <Slip key={p.id} p={p} />)}</View>
      )}
    </>
  );
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const DashboardTab = ({ data, goAcademic, goTransport }: { data: FeeDashboard | null; goAcademic: (i?: Installment) => void; goTransport: () => void }) => {
  if (!data) return <Empty icon="document-text-outline" text="No fee data available yet." />;
  const sm = data.summary;
  return (
    <>
      <View style={s.hero}>
        <Text style={s.heroEyebrow}>Total Fees</Text>
        <Text style={s.heroAmount}>{inr(sm.total_due)}</Text>
        <View style={s.heroStatsRow}>
          <View style={s.heroStat}><Text style={[s.heroStatVal, { color: '#4ADE80' }]}>{inr(sm.total_paid)}</Text><Text style={s.heroStatLbl}>Paid</Text></View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}><Text style={[s.heroStatVal, { color: '#FCA5A5' }]}>{inr(sm.remaining)}</Text><Text style={s.heroStatLbl}>Remaining</Text></View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}><Text style={[s.heroStatVal, { color: '#A5B4FC' }]}>{sm.cleared_percent}%</Text><Text style={s.heroStatLbl}>Cleared</Text></View>
        </View>
        <View style={s.heroTrack}><View style={[s.heroFill, { width: `${sm.cleared_percent}%` }]} /></View>
      </View>

      {data.academic && <AcademicBlock a={data.academic} onPay={goAcademic} compact />}
      {data.transport && <TransportBlock tr={data.transport} onPay={goTransport} compact />}

      <SectionTitle>All Payments</SectionTitle>
      {data.overall_payments.length === 0 ? (
        <Text style={s.muted}>No payments recorded yet.</Text>
      ) : (
        <View style={s.listCard}>
          {data.overall_payments.map(p => (
            <View key={`${p.fee_type}-${p.id}`} style={s.slip}>
              <View style={[s.slipIcon, { backgroundColor: (p.fee_type === 'transport' ? TRANSPORT : ACADEMIC) + '18' }]}>
                <VectorIcon iconSet="Ionicons" iconName={p.fee_type === 'transport' ? 'bus-outline' : 'school-outline'} size={18} color={p.fee_type === 'transport' ? TRANSPORT : ACADEMIC} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.slipTitle} numberOfLines={1}>{p.receipt_number}</Text>
                <Text style={s.slipSub}>{p.fee_type === 'transport' ? 'Transport' : 'Academic'} · {p.payment_mode} · {p.payment_date ?? '-'}</Text>
              </View>
              <Text style={s.slipAmt}>{inr(p.amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
};

// ─── Main Screen ────────────────────────────────────────────────────────────
const FeesScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [dashboard, setDashboard] = useState<FeeDashboard | null>(null);
  const [penalties, setPenalties] = useState<FeePenalties | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
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

  return (
    <View style={s.root}>
      <Header title="Fees" onBackPress={() => navigation.goBack()} />

      <View style={s.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBar}>
          {TABS.map(t => {
            const active = tab === t;
            const color = TAB_META[t].color;
            return (
              <TouchableOpacity
                key={t}
                activeOpacity={0.8}
                onPress={() => setTab(t)}
                style={[s.tabPill, active ? { backgroundColor: color } : { backgroundColor: color + '14', borderColor: color + '30', borderWidth: 1 }]}
              >
                <VectorIcon iconSet="Ionicons" iconName={TAB_META[t].icon} size={13} color={active ? '#fff' : color} />
                <Text style={[s.tabPillText, { color: active ? '#fff' : color }]}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {tab === 'Dashboard' && <DashboardTab data={dashboard} goAcademic={goAcademic} goTransport={goTransport} />}

          {tab === 'Academic' && (dashboard?.academic ? <AcademicBlock a={dashboard.academic} onPay={goAcademic} /> : <Empty icon="school-outline" text="No academic fee data." />)}

          {tab === 'Transport' && (dashboard?.transport ? <TransportBlock tr={dashboard.transport} onPay={goTransport} /> : <Empty icon="bus-outline" text="No transport route assigned to you." />)}

          {tab === 'Penalties' && (!penalties || penalties.count === 0 ? (
            <Empty icon="happy-outline" text="No penalties charged. Great job staying on time!" />
          ) : (
            <>
              <View style={[s.card, { borderTopColor: theme.colors.danger, borderTopWidth: 4 }]}>
                <Text style={s.cardTitle}>Total Penalties</Text>
                <Text style={[s.bigAmt, { color: theme.colors.danger }]}>{inr(penalties.total_penalty)}</Text>
                <Text style={s.subLabel}>Across {penalties.count} payment(s) · {inr(penalties.penalty_per_day)}/day</Text>
              </View>
              <SectionTitle>Penalty Details</SectionTitle>
              {penalties.items.map(it => (
                <View key={it.payment_id} style={[s.card, { borderLeftColor: theme.colors.danger, borderLeftWidth: 4 }]}>
                  <View style={s.cardHeadRow}>
                    <Text style={s.cardTitle}>{inr(it.penalty_amount)} penalty</Text>
                    <View style={[s.badge, { backgroundColor: theme.colors.danger + '1A' }]}>
                      <Text style={[s.badgeText, { color: theme.colors.danger }]}>{it.fee_type === 'transport' ? 'TRANSPORT' : 'ACADEMIC'}</Text>
                    </View>
                  </View>
                  <Text style={s.penaltyOn}>On payment {it.receipt_number}</Text>
                  <View style={s.divider} />
                  <KV label="Base amount" value={inr(it.base_amount)} />
                  <KV label="Penalty" value={inr(it.penalty_amount)} color={theme.colors.danger} bold />
                  {!!it.payment_date && <KV label="Date" value={it.payment_date} />}
                </View>
              ))}
            </>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export default FeesScreen;

// ─── Styles ─────────────────────────────────────────────────────────────────
const __mk_s = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { paddingBottom: 40, paddingTop: 8 },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    tabBarWrap: { backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    tabBar: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
    tabPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
    tabPillText: { fontSize: 12, fontWeight: '700' },

    sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, marginHorizontal: 16, marginTop: 10, marginBottom: 10 },
    muted: { fontSize: 13, color: theme.colors.textMuted, marginHorizontal: 18, marginBottom: 12 },

    hero: { marginHorizontal: 16, marginTop: 12, marginBottom: 16, backgroundColor: '#1E1B4B', borderRadius: 24, padding: 22, shadowColor: PURPLE, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    heroEyebrow: { fontSize: 12, color: '#A5B4FC', fontWeight: '600', marginBottom: 4 },
    heroAmount: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1, marginBottom: 16 },
    heroStatsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatVal: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
    heroStatLbl: { fontSize: 10, color: '#C7D2FE', fontWeight: '600' },
    heroDivider: { width: 1, height: 30, backgroundColor: '#ffffff18' },
    heroTrack: { height: 6, borderRadius: 4, backgroundColor: '#ffffff18', overflow: 'hidden' },
    heroFill: { height: '100%', borderRadius: 4, backgroundColor: '#818CF8' },

    card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.colors.card, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    cardTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    badgeText: { fontSize: 10, fontWeight: '800' },

    bigAmtRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 6 },
    bigAmt: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
    bigAmtSlash: { fontSize: 15, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 3 },
    subLabel: { fontSize: 11, fontWeight: '700', marginTop: 4, color: theme.colors.textMuted },

    track: { height: 8, borderRadius: 5, backgroundColor: theme.colors.border, overflow: 'hidden', marginTop: 8 },
    fill: { height: '100%', borderRadius: 5 },
    divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 10 },

    kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    kvLabel: { fontSize: 13, color: theme.colors.textMuted, fontWeight: '500' },
    kvValue: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
    kvValueBold: { fontSize: 15, fontWeight: '900' },

    amountBox: { borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    amountLabel: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' },
    amountValue: { fontSize: 20, fontWeight: '900' },

    payBtn: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 14 },
    payText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },

    listCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: theme.colors.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    feeLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    feeLineName: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
    feeLineAmt: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },

    slip: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    slipIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    slipTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary },
    slipSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
    slipAmt: { fontSize: 14, fontWeight: '900', color: theme.colors.textPrimary },

    routeSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
    monthGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 12, gap: 8 },
    monthCell: { width: '22%', borderRadius: 14, borderWidth: 1, paddingVertical: 10, alignItems: 'center', gap: 5, marginBottom: 2 },
    monthName: { fontSize: 12, fontWeight: '800', color: theme.colors.textPrimary },
    monthDot: { width: 8, height: 8, borderRadius: 4 },
    monthStatus: { fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },

    penaltyOn: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },

    empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', marginHorizontal: 40 },
  });

let s = __mk_s();
onThemeChange(() => {
  s = __mk_s();
});

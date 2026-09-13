import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { DashSection } from '../home/dashboardUi';
import { MonthRow, PaymentStatusResponse, TransportFees, getTransportFees } from '../../api/feeApi';
import { usePhonePePayment } from '../../hooks/usePhonePePayment';
import { AmountField, FeeSkeleton, Note, PayAction, inr } from './feesUi';
import { AppAlert } from '../../components/AppDialog';

const TITLE = 'Pay Transport Fee';

/**
 * Transport payment: multi-select the months to clear, adjust the amount, pay.
 * Excess paid automatically carries forward to the next months.
 */
const TransportPayScreen = ({ navigation }: any) => {
  const [data, setData] = useState<TransportFees | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [amount, setAmount] = useState<string>('');
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    getTransportFees()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const payableMonths = useMemo(
    () => (data?.schedule ?? []).filter(m => m.status !== 'paid' && m.status !== 'no_transport'),
    [data],
  );

  const selectedOutstanding = useMemo(() => {
    return payableMonths
      .filter(m => selected[m.key])
      .reduce((sum, m) => sum + m.outstanding, 0);
  }, [payableMonths, selected]);

  // Keep the amount in sync with the selection until the user edits it.
  useEffect(() => {
    if (!edited) {
      setAmount(selectedOutstanding > 0 ? String(Math.round(selectedOutstanding)) : '');
    }
  }, [selectedOutstanding, edited]);

  const value = useMemo(() => parseFloat(amount) || 0, [amount]);

  const toggle = (m: MonthRow) => {
    setSelected(prev => ({ ...prev, [m.key]: !prev[m.key] }));
  };

  const allSelected = payableMonths.length > 0 && payableMonths.every(m => selected[m.key]);

  const toggleAll = () => {
    setEdited(false);
    setSelected(allSelected ? {} : Object.fromEntries(payableMonths.map(m => [m.key, true])));
  };

  const onSettled = useCallback(
    (res: PaymentStatusResponse) => {
      if (res.state === 'COMPLETED') {
        AppAlert.alert(
          'Payment successful',
          res.receipt_number ? `Receipt: ${res.receipt_number}` : 'Your transport fee was received.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } else if (res.state === 'FAILED') {
        AppAlert.alert('Payment failed', 'Your payment did not go through. Please try again.');
      }
    },
    [navigation],
  );

  const { phase, payFees, checkStatus, error } = usePhonePePayment(onSettled);

  React.useEffect(() => {
    if (phase === 'error' && error) AppAlert.alert('Payment error', error);
  }, [phase, error]);

  const onPay = () => {
    if (value <= 0) {
      AppAlert.alert('Enter amount', 'Select months or enter an amount to pay.');
      return;
    }
    const months = payableMonths.filter(m => selected[m.key]).map(m => m.key);
    payFees(value, 'transport', { months, transportationId: data?.route?.id });
  };

  if (loading) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <FeeSkeleton />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <DocNoData icon="bus-outline" title="No transport route" subtitle="No transport route is assigned to you." />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* The route, and what it costs */}
        <View style={s.head}>
          <Text style={s.kicker}>TRANSPORT</Text>
          <Text style={s.title}>{data.route.route_name}</Text>
          <Text style={s.line}>{inr(data.totals.monthly_fee)} a month</Text>
        </View>

        {/* Which months this payment clears */}
        <DashSection
          title="Months to pay"
          action={payableMonths.length > 1 ? (allSelected ? 'Clear' : 'Select all') : undefined}
          onAction={toggleAll}
        >
          {payableMonths.length === 0 ? (
            <Note>Every month is paid.</Note>
          ) : (
            payableMonths.map((m, i) => {
              const on = !!selected[m.key];
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[s.monthRow, i < payableMonths.length - 1 && s.rowDivider]}
                  onPress={() => toggle(m)}
                  activeOpacity={0.6}
                >
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName={on ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={on ? theme.colors.primary : theme.colors.textMuted}
                  />
                  <View style={s.monthBody}>
                    <Text style={s.monthName}>{m.month}</Text>
                    {m.status === 'partial' && (
                      <Text style={s.monthMeta}>Partly paid · {inr(m.paid)} of {inr(m.amount)}</Text>
                    )}
                  </View>
                  <Text style={s.monthAmount}>{inr(m.outstanding)}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </DashSection>

        {/* How much, and pay */}
        <DashSection title="Amount to pay">
          <View style={s.amount}>
            <AmountField
              value={amount}
              onChange={v => {
                setEdited(true);
                setAmount(v);
              }}
            />
            <Text style={s.hint}>
              Pay more than the months you picked and the extra carries forward to the next months
              automatically.
            </Text>
            <PayAction phase={phase} value={value} onPay={onPay} onCheck={checkStatus} />
          </View>
        </DashSection>
      </ScrollView>
    </View>
  );
};

export default TransportPayScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },

  // Head
  head: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 29, color: theme.colors.textPrimary, marginTop: 6 },
  line: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },

  // Months
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  monthBody: { flex: 1, gap: 2 },
  monthName: { fontSize: 15, color: theme.colors.textPrimary },
  monthMeta: { fontSize: 12, color: theme.colors.textMuted },
  monthAmount: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },

  // Amount
  amount: { paddingTop: 10, paddingBottom: 6 },
  hint: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 19, marginTop: 14 },
});

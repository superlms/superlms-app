import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme } from '../../utils/theme';
import { MonthRow, PaymentStatusResponse, TransportFees, getTransportFees } from '../../api/feeApi';
import { usePhonePePayment } from '../../hooks/usePhonePePayment';

const inr = (n: number) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

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

  const onSettled = useCallback(
    (res: PaymentStatusResponse) => {
      if (res.state === 'COMPLETED') {
        Alert.alert(
          'Payment successful',
          res.receipt_number ? `Receipt: ${res.receipt_number}` : 'Your transport fee was received.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } else if (res.state === 'FAILED') {
        Alert.alert('Payment failed', 'Your payment did not go through. Please try again.');
      }
    },
    [navigation],
  );

  const { phase, payFees, checkStatus, error } = usePhonePePayment(onSettled);
  const busy = phase === 'initiating' || phase === 'checking';

  React.useEffect(() => {
    if (phase === 'error' && error) Alert.alert('Payment error', error);
  }, [phase, error]);

  const onPay = () => {
    if (value <= 0) {
      Alert.alert('Enter amount', 'Select months or enter an amount to pay.');
      return;
    }
    const months = payableMonths.filter(m => selected[m.key]).map(m => m.key);
    payFees(value, 'transport', { months, transportationId: data?.route?.id });
  };

  if (loading) {
    return (
      <View style={s.root}>
        <Header title="Pay Transport Fee" onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.root}>
        <Header title="Pay Transport Fee" onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <Text style={s.muted}>No transport route assigned to you.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Header title="Pay Transport Fee" onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.routeName}>{data.route.route_name}</Text>
        <Text style={s.monthly}>Monthly fee: {inr(data.totals.monthly_fee)}</Text>

        <Text style={s.section}>Select months to pay</Text>
        <View style={s.monthList}>
          {payableMonths.length === 0 ? (
            <Text style={s.muted}>All months are cleared. 🎉</Text>
          ) : (
            payableMonths.map(m => {
              const on = !!selected[m.key];
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[s.monthRow, on && s.monthRowOn]}
                  onPress={() => toggle(m)}
                  activeOpacity={0.8}
                >
                  <View style={[s.check, on && s.checkOn]}>
                    {on && <VectorIcon iconSet="Ionicons" iconName="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={s.monthName}>{m.month}</Text>
                  <View style={{ flex: 1 }} />
                  {m.status === 'partial' && <Text style={s.partialTag}>partial</Text>}
                  <Text style={s.monthAmt}>{inr(m.outstanding)}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={s.card}>
          <Text style={s.label}>Amount to pay</Text>
          <View style={s.amountBox}>
            <Text style={s.currency}>₹</Text>
            <TextInput
              style={s.input}
              value={amount}
              onChangeText={t => {
                setEdited(true);
                setAmount(t.replace(/[^0-9.]/g, ''));
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
          <Text style={s.hint}>
            Pay more than selected and the extra carries forward to your next months automatically.
          </Text>
        </View>

        {phase === 'awaiting' ? (
          <TouchableOpacity style={[s.payBtn, { backgroundColor: theme.colors.primary }]} onPress={checkStatus} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="refresh" size={18} color="#fff" />
            <Text style={s.payText}>I have paid — Check status</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.payBtn, { backgroundColor: value > 0 ? '#0EA5E9' : theme.colors.border }]}
            onPress={onPay}
            disabled={busy || value <= 0}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <VectorIcon iconSet="Ionicons" iconName="flash" size={18} color="#fff" />
            )}
            <Text style={s.payText}>{busy ? 'Please wait…' : `Pay ${inr(value)}`}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

export default TransportPayScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 14, color: theme.colors.textMuted },
  routeName: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary },
  monthly: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, marginBottom: 6 },
  section: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 12, marginBottom: 8 },
  monthList: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  monthRowOn: {},
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  monthName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  monthAmt: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  partialTag: { fontSize: 10, fontWeight: '700', color: '#F59E0B', marginRight: 8, textTransform: 'uppercase' },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 12, textAlign: 'center' },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#0EA5E9',
    alignSelf: 'center',
    paddingHorizontal: 8,
  },
  currency: { fontSize: 24, fontWeight: '800', color: theme.colors.textPrimary, marginRight: 4 },
  input: { fontSize: 34, fontWeight: '900', color: theme.colors.textPrimary, minWidth: 90, textAlign: 'center', padding: 0 },
  hint: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 16 },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 16,
  },
  payText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});

import React, { useCallback, useMemo, useState } from 'react';
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
import { FeeType, PaymentStatusResponse } from '../../api/feeApi';
import { usePhonePePayment } from '../../hooks/usePhonePePayment';

const inr = (n: number) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

/**
 * Generic "enter / adjust amount → pay" screen (academic fees).
 * Route params: { title?, feeType?, suggestedAmount?, note?, label? }
 */
const PayAmountScreen = ({ route, navigation }: any) => {
  const {
    title = 'Pay Fee',
    feeType = 'academic' as FeeType,
    suggestedAmount = 0,
    note,
    label = 'Amount to pay',
  } = route.params ?? {};

  const [amount, setAmount] = useState<string>(
    suggestedAmount > 0 ? String(Math.round(suggestedAmount)) : '',
  );

  const value = useMemo(() => parseFloat(amount) || 0, [amount]);

  const onSettled = useCallback(
    (res: PaymentStatusResponse) => {
      if (res.state === 'COMPLETED') {
        Alert.alert(
          'Payment successful',
          res.receipt_number ? `Receipt: ${res.receipt_number}` : 'Your payment was received.',
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

  const bump = (delta: number) => {
    const next = Math.max(0, Math.round(value + delta));
    setAmount(next ? String(next) : '');
  };

  const onPay = () => {
    if (value <= 0) {
      Alert.alert('Enter amount', 'Please enter a valid amount to pay.');
      return;
    }
    payFees(value, feeType);
  };

  return (
    <View style={s.root}>
      <Header title={title} onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.label}>{label}</Text>

          <View style={s.amountRow}>
            <TouchableOpacity style={s.stepBtn} onPress={() => bump(-100)} activeOpacity={0.8}>
              <VectorIcon iconSet="Ionicons" iconName="remove" size={22} color={theme.colors.primary} />
            </TouchableOpacity>

            <View style={s.amountBox}>
              <Text style={s.currency}>₹</Text>
              <TextInput
                style={s.input}
                value={amount}
                onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            <TouchableOpacity style={s.stepBtn} onPress={() => bump(100)} activeOpacity={0.8}>
              <VectorIcon iconSet="Ionicons" iconName="add" size={22} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {suggestedAmount > 0 && (
            <TouchableOpacity onPress={() => setAmount(String(Math.round(suggestedAmount)))}>
              <Text style={s.suggest}>Suggested: {inr(suggestedAmount)} — tap to use</Text>
            </TouchableOpacity>
          )}

          {!!note && <Text style={s.note}>{note}</Text>}
          <Text style={s.hint}>You can pay more or less than the suggested amount. Extra paid adjusts toward your next dues.</Text>
        </View>

        {phase === 'awaiting' ? (
          <TouchableOpacity style={[s.payBtn, { backgroundColor: theme.colors.primary }]} onPress={checkStatus} activeOpacity={0.85}>
            <VectorIcon iconSet="Ionicons" iconName="refresh" size={18} color="#fff" />
            <Text style={s.payText}>I have paid — Check status</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.payBtn, { backgroundColor: value > 0 ? '#7C3AED' : theme.colors.border }]}
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

export default PayAmountScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 16, textAlign: 'center' },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: theme.colors.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
    paddingHorizontal: 8,
    minWidth: 140,
    justifyContent: 'center',
  },
  currency: { fontSize: 24, fontWeight: '800', color: theme.colors.textPrimary, marginRight: 4 },
  input: { fontSize: 34, fontWeight: '900', color: theme.colors.textPrimary, minWidth: 80, textAlign: 'center', padding: 0 },
  suggest: { fontSize: 12, fontWeight: '700', color: theme.colors.primary, textAlign: 'center', marginTop: 14 },
  note: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 12 },
  hint: { fontSize: 11, color: theme.colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 16 },
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

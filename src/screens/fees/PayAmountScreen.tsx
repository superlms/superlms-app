import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { FeeType, PaymentStatusResponse } from '../../api/feeApi';
import { usePhonePePayment } from '../../hooks/usePhonePePayment';
import { AmountField, PayAction, inr } from './feesUi';

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

  const suggested = Math.round(suggestedAmount);

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {!!note && <Text style={s.kicker}>{String(note).toUpperCase()}</Text>}
        <Text style={s.label}>{label}</Text>

        <AmountField value={amount} onChange={setAmount} />

        {/* Nudge the amount, or go back to what is owed */}
        <View style={s.adjust}>
          <TouchableOpacity style={s.step} onPress={() => bump(-100)} activeOpacity={0.6}>
            <Text style={s.stepText}>− ₹100</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.step} onPress={() => bump(100)} activeOpacity={0.6}>
            <Text style={s.stepText}>+ ₹100</Text>
          </TouchableOpacity>
          {suggested > 0 && Math.round(value) !== suggested && (
            <TouchableOpacity onPress={() => setAmount(String(suggested))} hitSlop={8} activeOpacity={0.6}>
              <Text style={s.link}>Use {inr(suggested)}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.hint}>
          You can pay more or less than what is suggested. Anything extra goes toward your next dues.
        </Text>

        <PayAction phase={phase} value={value} onPay={onPay} onCheck={checkStatus} />
      </ScrollView>
    </View>
  );
};

export default PayAmountScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 10 },
  adjust: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  step: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary, marginLeft: 6 },
  hint: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 19, marginTop: 18 },
});

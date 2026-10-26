import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import moment from 'moment';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { useAdminProfile } from './useAdminProfile';
import { theme, onThemeChange } from '../../utils/theme';
import { addSalaryAccountPayment } from '../../api/adminPayrollApi';
import { fieldErrorOf } from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import { FieldPair, FormHeading, OutlinedField, SaveButton, SaveState } from '../teacherStudents/outlinedFormUi';
import { useRevealFocused } from './adminProfileUi';
import { DateBox, FormFoot, Quiet } from './feeSetupUi';

/**
 * Add Payment — the Mark Salary tab's panel: a payment to the person, kept
 * against the month whose screen it was added from, whatever day it is paid
 * on — an amount, the day (not after today), who it came from (the person
 * signed in, to begin with) and a remark. It reaches Payments and the Ledger
 * like every salary payment.
 */

const AdminPayrollAddPaymentScreen = ({ navigation, route }: any) => {
  const { id, name, month, monthLabel } = route.params as { id: number; name: string; month?: string; monthLabel?: string };
  const profile = useAdminProfile();
  const today = moment().format('YYYY-MM-DD');

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState<string | null>(null);
  const [remark, setRemark] = useState('');
  const [wrong, setWrong] = useState<{ field: string; message: string } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const busy = useRef(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();
  const errorOf = (f: string) => (wrong?.field === f ? wrong.message : null);
  const fromValue = from ?? (profile?.name ?? '');

  const stop = (field: string, message: string) => {
    setWrong({ field, message });
    AppAlert.alert('Check the form', message);
  };

  const save = async () => {
    if (busy.current) return;
    if (!(Number(amount) >= 1)) return stop('amount', 'Enter the amount.');
    if (!date) return stop('date', 'Pick the date.');
    if (date > today) return stop('date', 'The date cannot be after today.');
    if (!fromValue.trim()) return stop('from', 'Enter who it came from.');
    setWrong(null);
    busy.current = true;
    setSaveState('saving');
    try {
      const msg = await addSalaryAccountPayment(id, { amount, date, from: fromValue.trim(), remark: remark.trim(), month });
      setSaveState('done');
      AppAlert.alert('Payment added', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      const w = fieldErrorOf(e);
      if (w?.field) stop(w.field, w.message);
      else AppAlert.alert('Not saved', w?.message ?? 'Could not add the payment.');
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title="Add Payment" onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <Text style={s.intro}>{name}</Text>
          {!!monthLabel && <Quiet>{`Kept against ${monthLabel}, whatever day it is paid on.`}</Quiet>}

          <FormHeading title="Payment" first />
          <FieldPair>
            <OutlinedField
              half
              required
              label="Amount (₹)"
              placeholder="0"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(v: string) => {
                setAmount(v.replace(/[^0-9.]/g, ''));
                setWrong(null);
              }}
              error={errorOf('amount')}
            />
            <DateBox half required label="Date" value={date} maxDate={today} onChange={v => { setDate(v); setWrong(null); }} error={errorOf('date')} />
          </FieldPair>
          <OutlinedField
            required
            label="From"
            placeholder="Who paid it"
            value={fromValue}
            onChangeText={(v: string) => {
              setFrom(v);
              setWrong(null);
            }}
            error={errorOf('from')}
            maxLength={255}
          />
          <OutlinedField multiline label="Remark" placeholder="Optional" value={remark} onChangeText={setRemark} error={errorOf('remark')} maxLength={500} />
          <View style={s.tail} />
        </ScrollView>
        <FormFoot>
          <SaveButton state={saveState} icon="cash-outline" label="Add Payment" busyLabel="Adding payment" doneLabel="Payment added" onPress={save} />
        </FormFoot>
      </Animated.View>
    </View>
  );
};

export default AdminPayrollAddPaymentScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  intro: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  tail: { height: 24 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

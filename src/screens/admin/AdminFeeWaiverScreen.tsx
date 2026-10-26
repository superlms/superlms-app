import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Select from '../../components/Select';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { FeeCycle } from '../../api/adminFeeApi';
import { fieldErrorOf, waivePenalty } from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import { FieldPair, FormHeading, OutlinedField, SaveButton, SaveState } from '../teacherStudents/outlinedFormUi';
import { useRevealFocused } from './adminProfileUi';
import { FormFoot, Quiet, rupees } from './feeSetupUi';

/**
 * Waive Penalty — the panel's Waiver panel. Which side (academic or
 * transport), the one installment whose penalty is written off, how much, the
 * mode and who collected it. The installments offered are that side's that
 * carry a penalty, each with what is still due on it.
 */

const MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const AdminFeeWaiverScreen = ({ navigation, route }: any) => {
  const { studentId, name, cycles = [], collectedBy = '' } = route.params as {
    studentId: number;
    name: string;
    cycles: FeeCycle[];
    collectedBy?: string;
  };

  const [feeType, setFeeType] = useState<'academic' | 'transport'>('academic');
  const [cycleId, setCycleId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [by, setBy] = useState(collectedBy);
  const [wrong, setWrong] = useState<{ field: string; message: string } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const busy = useRef(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();
  const errorOf = (f: string) => (wrong?.field === f ? wrong.message : null);

  // That side's installments carrying a penalty.
  const options = useMemo(() => {
    const cycle = cycles.find(c => c.fee_type === feeType);
    return (cycle?.installments ?? [])
      .filter(i => (i.penalty ?? 0) > 0 && !!i.cycle_id)
      .map(i => ({ value: i.cycle_id, label: `${i.label} — ${rupees(i.penalty_net ?? 0)} due`, net: i.penalty_net ?? 0 }));
  }, [cycles, feeType]);

  const picked = options.find(o => o.value === cycleId) ?? null;

  const stop = (field: string, message: string) => {
    setWrong({ field, message });
    AppAlert.alert('Check the form', message);
  };

  const save = async () => {
    if (busy.current) return;
    if (!cycleId) return stop('cycle_id', options.length ? 'Pick the installment.' : 'No penalty on this side.');
    if (!amount.trim() || !(Number(amount) > 0)) return stop('amount', 'Enter the amount to waive.');
    if (!by.trim()) return stop('collected_by', 'Enter who collected it.');
    setWrong(null);
    busy.current = true;
    setSaveState('saving');
    try {
      const msg = await waivePenalty(studentId, { fee_type: feeType, cycle_id: cycleId, amount: amount.trim(), mode, collected_by: by.trim() });
      setSaveState('done');
      AppAlert.alert('Done', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      const w = fieldErrorOf(e);
      if (w?.field) stop(w.field, w.message);
      else AppAlert.alert('Not saved', w?.message ?? 'Could not waive the penalty.');
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title="Waive Penalty" onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <Text style={s.intro}>{name}</Text>

          <FormHeading title="Penalty" first />
          <Select
            notched
            required
            label="Type"
            value={feeType}
            options={[
              { value: 'academic', label: 'Academic' },
              { value: 'transport', label: 'Transport' },
            ]}
            onChange={v => {
              setFeeType(v as 'academic' | 'transport');
              setCycleId(null);
              setWrong(null);
            }}
          />
          <Select
            notched
            required
            label="Fee Cycle"
            placeholder={options.length ? 'Select installment…' : 'No penalty on this side'}
            value={cycleId}
            disabled={options.length === 0}
            options={options.map(o => ({ value: o.value, label: o.label }))}
            onChange={v => {
              setCycleId(Number(v));
              setWrong(null);
            }}
            error={errorOf('cycle_id')}
          />
          {!!picked && <Quiet>{`${rupees(picked.net)} of penalty is still due on this installment.`}</Quiet>}

          <FormHeading title="Waiver" />
          <FieldPair>
            <OutlinedField
              half
              required
              label="Amount (₹)"
              placeholder="e.g. 200"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={(v: string) => {
                setAmount(v.replace(/[^0-9.]/g, ''));
                setWrong(null);
              }}
              error={errorOf('amount')}
            />
            <View style={s.half}>
              <Select notched label="Mode" value={mode} options={MODES} onChange={v => setMode(String(v))} />
            </View>
          </FieldPair>
          <OutlinedField
            required
            label="Collected By"
            placeholder="Staff name"
            value={by}
            onChangeText={(v: string) => {
              setBy(v);
              setWrong(null);
            }}
            error={errorOf('collected_by')}
            maxLength={255}
          />
          <View style={s.tail} />
        </ScrollView>
        <FormFoot>
          <SaveButton state={saveState} icon="checkmark-circle-outline" label="Waive Penalty" busyLabel="Waiving penalty" doneLabel="Penalty waived" onPress={save} />
        </FormFoot>
      </Animated.View>
    </View>
  );
};

export default AdminFeeWaiverScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  half: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  intro: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  tail: { height: 24 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

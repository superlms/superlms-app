import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import { useFocusEffect } from '@react-navigation/native';
import { AppDialog } from '../../components/AppDialog';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { CollectForm, CollectType, PAY_MODES, PayMode, StudentLedger, collectFee, getStudentLedger } from '../../api/adminFeeApi';
import { DocHeader } from '../more/docUi';
import { DateSheet, FieldLabel, FormCard, FormError, Hint, PickerCard, SubmitButton } from './adminFormUi';
import { Avatar } from './adminTransportUi';
import { inr, openFeeReceipt } from './adminFeeUi';

/**
 * The panel's Collect Fee for one student: the fee type (a type with nothing
 * due can't be picked — "fully paid", or "none due" for penalties), the
 * amount, never more than is due for that type, the mode, the date, who
 * collected it and a remark. A transport fee goes with the student's other
 * bus payments, as on the panel. Once saved, its receipt is a tap away.
 */

const TYPES: { key: CollectType; label: string; none: string; word: string }[] = [
  { key: 'academic', label: 'Academic', none: 'fully paid', word: 'academic' },
  { key: 'transport', label: 'Transport', none: 'fully paid', word: 'transport' },
  { key: 'penalty', label: 'Penalties', none: 'none due', word: 'penalties' },
];

const today = () => moment().format('YYYY-MM-DD');

const AdminFeeCollectScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const [d, setD] = useState<StudentLedger | null>(null);
  const [form, setForm] = useState<CollectForm | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ message: string; id: number; kind: 'academic' | 'transport'; receipt_number: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const l = await getStudentLedger(id);
        setD(l);
        // Opens on whichever type actually has something due, as the panel does.
        const c = l.caps;
        setForm({
          amount: '',
          fee_type: c.academic > 0 ? 'academic' : c.transport > 0 ? 'transport' : c.penalty > 0 ? 'penalty' : 'academic',
          payment_mode: 'cash',
          date: today(),
          submitted_by: l.submitted_by ?? '',
          remark: '',
        });
      } catch (e) {
        setError(apiErr(e, 'Could not load this student’s fees.'));
      }
    })();
  }, [id]);

  const set = <K extends keyof CollectForm>(k: K, v: CollectForm[K]) => {
    setForm(prev => (prev ? { ...prev, [k]: v } : prev));
    setError('');
  };

  const cap = d && form ? d.caps[form.fee_type] ?? 0 : 0;

  const save = async () => {
    if (!form || !d) return;
    const amount = Number(form.amount);
    if (form.amount.trim() === '' || !Number.isFinite(amount)) return setError('Enter the amount.');
    if (amount < 1) return setError('The amount must be at least ₹1.');
    if (cap <= 0) {
      return setError(
        form.fee_type === 'penalty'
          ? 'This student has no penalty currently due — there is nothing to submit.'
          : `${form.fee_type === 'transport' ? 'Transport' : 'Academic'} fee for this student is already fully paid for the year.`,
      );
    }
    if (amount > cap + 0.01) {
      return setError(`Only up to ${inr(cap)} can be submitted — that is what is currently due for ${form.fee_type}.`);
    }
    if (!form.submitted_by.trim()) return setError('Enter who collected it.');
    setSaving(true);
    try {
      setSaved(await collectFee(id, form));
    } catch (e) {
      setError(apiErr(e, 'Could not submit this fee.'));
    } finally {
      setSaving(false);
    }
  };

  const done = () => {
    setSaved(null);
    navigation.goBack();
  };

  // The receipt opens over this page; coming back from it goes on to the ledger.
  const leaving = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (leaving.current) navigation.goBack();
    }, [navigation]),
  );

  const receipt = () => {
    const p = saved;
    setSaved(null);
    if (!p) return navigation.goBack();
    leaving.current = true;
    openFeeReceipt(navigation, p);
  };

  return (
    <View style={s.root}>
      <DocHeader title="Collect Fee" onBackPress={() => navigation.goBack()} />
      {!d || !form ? (
        <View style={s.scroll}>
          {error ? <FormError>{error}</FormError> : [0, 1, 2, 3, 4].map(i => <Skeleton key={i} width="100%" height={52} radius={12} />)}
        </View>
      ) : (
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.head}>
              <Avatar uri={d.photo} name={d.student.name} size={48} />
              <View style={s.headBody}>
                <Text style={s.name} numberOfLines={1}>{d.student.name}</Text>
                <Text style={s.sub} numberOfLines={1}>{`${d.student.class_section} · Net ${inr(d.net_payable)}`}</Text>
              </View>
            </View>

            <View style={s.group}>
              <FieldLabel>Fee type</FieldLabel>
              <View style={s.chips}>
                {TYPES.map(t => {
                  const on = form.fee_type === t.key;
                  const none = (d.caps[t.key] ?? 0) <= 0;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[s.chip, on && s.chipOn, none && s.chipOff]}
                      disabled={none}
                      onPress={() => set('fee_type', t.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.chipText, on && s.chipTextOn]}>{none ? `${t.label} (${t.none})` : t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <FormCard
                label="Amount (₹)"
                value={form.amount}
                onChangeText={v => set('amount', v.replace(/[^0-9.]/g, ''))}
                placeholder="Enter amount"
                keyboardType="decimal-pad"
                maxLength={10}
              />
              <Hint>{`Up to ${inr(cap)} due for ${TYPES.find(t => t.key === form.fee_type)?.word}.`}</Hint>
            </View>

            <View style={s.group}>
              <FieldLabel>Payment mode</FieldLabel>
              <View style={s.chips}>
                {PAY_MODES.map(m => {
                  const on = form.payment_mode === m.key;
                  return (
                    <TouchableOpacity key={m.key} style={[s.chip, on && s.chipOn]} onPress={() => set('payment_mode', m.key as PayMode)} activeOpacity={0.7}>
                      <Text style={[s.chipText, on && s.chipTextOn]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <PickerCard label="Date" value={moment(form.date).format('DD MMM YYYY')} icon="calendar-outline" onPress={() => setDateOpen(true)} />
            <FormCard label="Collected by" value={form.submitted_by} onChangeText={v => set('submitted_by', v)} placeholder="Staff name" maxLength={255} autoCapitalize="words" />
            <FormCard label="Remark" value={form.remark} onChangeText={v => set('remark', v)} placeholder="Optional" maxLength={1000} />

            <FormError>{error}</FormError>
            <SubmitButton label="Submit payment" busy={saving} onPress={save} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <DateSheet visible={dateOpen} value={form?.date} title="Date" onPick={v => { set('date', v); setDateOpen(false); }} onClose={() => setDateOpen(false)} />
      <AppDialog
        visible={!!saved}
        title="Fee submitted"
        message={saved ? `${saved.message}${saved.receipt_number ? `\nReceipt ${saved.receipt_number}` : ''}` : ''}
        actions={[
          { text: 'Receipt', onPress: receipt },
          { text: 'Done', onPress: done },
        ]}
        onRequestClose={done}
      />
    </View>
  );
};

export default AdminFeeCollectScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headBody: { flex: 1, gap: 2 },
  name: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 13, color: theme.colors.textSecondary },
  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  chipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipOff: { opacity: 0.45 },
  chipText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  chipTextOn: { color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

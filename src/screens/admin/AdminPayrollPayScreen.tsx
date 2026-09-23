import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import { AppDialog } from '../../components/AppDialog';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { Breakdown, Employee, PAY_MODES, PayForm, PayMode, getSalaryFor, paySalary } from '../../api/adminPayrollApi';
import { DocHeader } from '../more/docUi';
import { DateSheet, FieldLabel, FormCard, FormError, PickerCard, SubmitButton } from './adminFormUi';
import { Avatar, InfoRow, formatINR } from './adminTransportUi';

/**
 * Paying one person's salary for a month — the panel's pay panel. The month's
 * breakdown (base, present, absent, half days, leave, payable), then the
 * amount (the payable, or what was already paid), mode, paid by, date,
 * transaction id and remark. Saving a month already paid corrects it.
 */

const AdminPayrollPayScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const month: string = route?.params?.month;
  const [emp, setEmp] = useState<Employee | null>(null);
  const [b, setB] = useState<Breakdown | null>(null);
  const [form, setForm] = useState<PayForm | null>(null);
  const [already, setAlready] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await getSalaryFor(id, month);
        setEmp(d.employee);
        setB(d.breakdown);
        setAlready(!!d.existing);
        setForm({ ...d.form, amount: String(d.form.amount ?? 0), transaction_id: d.form.transaction_id ?? '', remark: d.form.remark ?? '' });
        if (!d.can_pay) setError(`Salary for ${moment(month, 'YYYY-MM').format('MMM YYYY')} can be paid only after the month ends.`);
      } catch (e) {
        setError(apiErr(e, 'Could not load this salary.'));
      }
    })();
  }, [id, month]);

  const set = <K extends keyof PayForm>(k: K, v: PayForm[K]) => {
    setForm(prev => (prev ? { ...prev, [k]: v } : prev));
    setError('');
  };

  const save = async () => {
    if (!form) return;
    const amount = Number(form.amount);
    if (form.amount.trim() === '' || !Number.isFinite(amount) || amount < 0) return setError('Enter the amount as a number.');
    if (!form.paid_by.trim()) return setError('Enter who paid it.');
    setSaving(true);
    try {
      setSavedMsg(await paySalary(id, month, form));
    } catch (e) {
      setError(apiErr(e, 'Could not save this payment.'));
    } finally {
      setSaving(false);
    }
  };

  const closeSaved = () => {
    setSavedMsg('');
    navigation.goBack();
  };

  const monthLabel = moment(month, 'YYYY-MM').format('MMMM YYYY');

  return (
    <View style={s.root}>
      <DocHeader title="Pay Salary" onBackPress={() => navigation.goBack()} />
      {!form || !b ? (
        <View style={s.scroll}>
          {error ? <FormError>{error}</FormError> : [0, 1, 2, 3, 4].map(i => <Skeleton key={i} width="100%" height={48} radius={12} />)}
        </View>
      ) : (
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.head}>
              <Avatar uri={emp?.photo} name={emp?.name} size={48} />
              <View style={s.headBody}>
                <Text style={s.name}>{emp?.name}</Text>
                <Text style={s.sub}>{`${monthLabel}${already ? ' · already paid — saving corrects it' : ''}`}</Text>
              </View>
            </View>

            <View>
              <InfoRow label="Base salary" value={formatINR(b.base)} />
              <InfoRow label="Present · Leave" value={`${b.present} · ${b.leave}`} />
              <InfoRow label="Absent · Half day" value={`${b.absent} · ${b.half_day}`} tone={b.absent + b.half_day > 0 ? 'due' : undefined} />
              <InfoRow label="Payable" value={formatINR(b.payable)} tone="paid" last />
            </View>

            <View style={s.pair}>
              <FormCard label="Amount (₹)" value={form.amount} onChangeText={t => set('amount', t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" maxLength={10} style={s.flex} />
              <PickerCard label="Date" value={moment(form.date).format('DD MMM YYYY')} icon="calendar-outline" onPress={() => setDateOpen(true)} style={s.flex} />
            </View>

            <View style={s.group}>
              <FieldLabel>Mode</FieldLabel>
              <View style={s.chips}>
                {PAY_MODES.map(m => {
                  const on = form.mode === m.key;
                  return (
                    <TouchableOpacity key={m.key} style={[s.chip, on && s.chipOn]} onPress={() => set('mode', m.key as PayMode)} activeOpacity={0.7}>
                      <Text style={[s.chipText, on && s.chipTextOn]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <FormCard label="Paid by" value={form.paid_by} onChangeText={t => set('paid_by', t)} maxLength={255} />
            <FormCard label="Transaction ID" value={form.transaction_id} onChangeText={t => set('transaction_id', t)} placeholder="Optional" maxLength={100} autoCapitalize="characters" />
            <FormCard label="Remark" value={form.remark} onChangeText={t => set('remark', t)} placeholder="Optional" multiline minHeight={70} maxLength={500} />

            <FormError>{error}</FormError>
            <SubmitButton label={already ? 'Save payment' : `Pay ${formatINR(Number(form.amount) || 0)}`} busy={saving} onPress={save} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <DateSheet visible={dateOpen} value={form?.date} title="Payment date" onPick={d => { set('date', d); setDateOpen(false); }} onClose={() => setDateOpen(false)} />
      <AppDialog visible={!!savedMsg} title="Salary paid" message={savedMsg} actions={[{ text: 'Done', onPress: closeSaved }]} onRequestClose={closeSaved} />
    </View>
  );
};

export default AdminPayrollPayScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headBody: { flex: 1, gap: 2 },
  name: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 13, color: theme.colors.textSecondary },
  pair: { flexDirection: 'row', gap: 12 },
  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  chipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  chipTextOn: { color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

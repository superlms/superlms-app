import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import { AppDialog } from '../../components/AppDialog';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { LedgerEntryForm, LedgerType, getLedgerEntry, saveLedgerEntry } from '../../api/adminLedgerApi';
import { DocHeader } from '../more/docUi';
import { DateSheet, FieldLabel, FormCard, FormError, Hint, PickerCard, Segment, SubmitButton } from './adminFormUi';

/**
 * A credit or an expense entered by hand — the panel's Add Credit / Add
 * Expense panel. The date, the amount (0 is allowed: a waived or nil line),
 * who it came from, who it went to (an expense) or who took the money (a
 * credit), the mode and a remark, which is required. An entry opened again is
 * corrected in place, as long as it is within 7 days of being made.
 */

const MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'];

const blank = (type: LedgerType): LedgerEntryForm => ({
  type,
  date: moment().format('YYYY-MM-DD'),
  amount: '',
  party: '',
  party_to: '',
  collected_by: '',
  mode: 'Cash',
  reason: '',
});

// A saved amount comes back as "150", not "150.00", and a 0 as "0".
const amountText = (n: number) => {
  const t = Number(n || 0).toFixed(2).replace(/\.?0+$/, '');
  return t === '' ? '0' : t;
};

const AdminLedgerFormScreen = ({ navigation, route }: any) => {
  const editId: number | undefined = route?.params?.id;
  const [form, setForm] = useState<LedgerEntryForm>(blank(route?.params?.type === 'expense' ? 'expense' : 'credit'));
  const [loading, setLoading] = useState(!!editId);
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const set = <K extends keyof LedgerEntryForm>(k: K, v: LedgerEntryForm[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setError('');
  };

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const d = await getLedgerEntry(editId);
        if (!d.editable) {
          setError('This entry is older than 7 days and can no longer be edited.');
        }
        setForm({ ...d, amount: amountText(d.amount), mode: d.mode || 'Cash' });
      } catch (e) {
        setError(apiErr(e, 'Could not load this entry.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  const isExpense = form.type === 'expense';
  const title = `${editId ? 'Edit' : 'Add'} ${isExpense ? 'Expense' : 'Credit'}`;

  const save = async () => {
    const amount = Number(form.amount);
    if (form.amount.trim() === '' || !Number.isFinite(amount) || amount < 0) {
      setError('Enter the amount as a number (0 or more).');
      return;
    }
    if (!form.reason.trim()) {
      setError('Add a remark — what this entry is for.');
      return;
    }
    setSaving(true);
    try {
      setSavedMsg(await saveLedgerEntry({ ...form, reason: form.reason.trim() }, editId));
    } catch (e) {
      setError(apiErr(e, 'Could not save this entry.'));
    } finally {
      setSaving(false);
    }
  };

  const closeSaved = () => {
    setSavedMsg('');
    navigation.goBack();
  };

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />

      {loading ? (
        <View style={s.scroll}>
          {[0, 1, 2, 3, 4].map(i => (
            <Skeleton key={i} width="100%" height={54} radius={12} />
          ))}
        </View>
      ) : (
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {!editId && (
              <Segment
                options={[
                  { key: 'credit', label: 'Credit' },
                  { key: 'expense', label: 'Expense' },
                ]}
                value={form.type}
                onChange={k => set('type', k as LedgerType)}
              />
            )}

            <View style={s.pair}>
              <PickerCard
                label="Date"
                value={moment(form.date).format('DD MMM YYYY')}
                icon="calendar-outline"
                onPress={() => setDateOpen(true)}
                style={s.flex}
              />
              <FormCard
                label="Amount (₹)"
                value={form.amount}
                onChangeText={t => set('amount', t.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                keyboardType="decimal-pad"
                maxLength={12}
                style={s.flex}
              />
            </View>

            <FormCard
              label={isExpense ? 'By / From' : 'Received from'}
              value={form.party}
              onChangeText={t => set('party', t)}
              placeholder={isExpense ? 'Who paid it (defaults to the school)' : 'Who paid in'}
              maxLength={255}
            />
            {isExpense ? (
              <FormCard label="To" value={form.party_to} onChangeText={t => set('party_to', t)} placeholder="Who it was paid to" maxLength={255} />
            ) : (
              <FormCard label="Collected by" value={form.collected_by} onChangeText={t => set('collected_by', t)} placeholder="The staff member who took it" maxLength={255} />
            )}

            <View style={s.group}>
              <FieldLabel>Mode</FieldLabel>
              <View style={s.modes}>
                {MODES.map(m => {
                  const on = form.mode === m;
                  return (
                    <TouchableOpacity key={m} style={[s.mode, on && s.modeOn]} onPress={() => set('mode', m)} activeOpacity={0.7}>
                      <Text style={[s.modeText, on && s.modeTextOn]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <FormCard
              label="Remark"
              value={form.reason}
              onChangeText={t => set('reason', t)}
              placeholder={isExpense ? 'e.g. Chalk and registers' : 'e.g. Donation for sports day'}
              multiline
              minHeight={90}
              maxLength={1000}
            />
            <Hint>An entry can be corrected for 7 days after it is added; after that it is closed for good.</Hint>

            <FormError>{error}</FormError>

            <SubmitButton label={editId ? 'Save changes' : title} busy={saving} onPress={save} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <DateSheet
        visible={dateOpen}
        value={form.date}
        title="Date"
        onPick={d => {
          set('date', d);
          setDateOpen(false);
        }}
        onClose={() => setDateOpen(false)}
      />

      <AppDialog
        visible={!!savedMsg}
        title={editId ? 'Entry updated' : isExpense ? 'Expense added' : 'Credit added'}
        message={savedMsg}
        actions={[{ text: 'Done', onPress: closeSaved }]}
        onRequestClose={closeSaved}
      />
    </View>
  );
};

export default AdminLedgerFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  pair: { flexDirection: 'row', gap: 12 },
  group: { gap: 8 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mode: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
  modeOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  modeText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  modeTextOn: { color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

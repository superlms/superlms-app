import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { Card, CardHead } from '../home/dashboardUi';
import { AutopaySummary, cancelAutopay, getAutopay, setupAutopay } from '../../api/autopayApi';
import { FeeButton } from './qrUi';
import { inr } from './feesUi';

/**
 * Fees → Overview: Autopay (PhonePe UPI AutoPay). Only where the school has it.
 *
 *   Off      what it is, the installments it would pay, and "Set up Autopay" —
 *            PhonePe's page, where the parent approves it once in a UPI app
 *   Waiting  set up but not approved yet — check again, or set it up again
 *   On       up to how much, the next installment it will pay and when, the
 *            last debits, and "Stop Autopay"
 *
 * Coming back from PhonePe, it asks the backend again.
 */
const AutopayCard = () => {
  const [data, setData] = useState<AutopaySummary | null>(null);
  const [busy, setBusy] = useState<'setup' | 'cancel' | 'check' | null>(null);
  const awaiting = useRef(false);

  const load = useCallback(async (refresh = false) => {
    try {
      setData(await getAutopay(refresh));
    } catch {
      // No Autopay on this backend yet, or offline — the card stays away.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Back from PhonePe's page: read it afresh (asking PhonePe about the setup).
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active' && awaiting.current) {
        awaiting.current = false;
        void load(true);
      }
    });
    return () => sub.remove();
  }, [load]);

  const setup = useCallback(async () => {
    setBusy('setup');
    try {
      const res = await setupAutopay();
      setData(res.autopay);
      if (!res.redirect_url) throw new Error('PhonePe gave no page to approve on.');
      awaiting.current = true;
      await Linking.openURL(res.redirect_url);
    } catch (e: any) {
      AppAlert.alert('Autopay', e?.response?.data?.message ?? e?.message ?? 'Could not start Autopay. Please try again.');
    } finally {
      setBusy(null);
    }
  }, []);

  const check = useCallback(async () => {
    setBusy('check');
    await load(true);
    setBusy(null);
  }, [load]);

  const stop = useCallback(() => {
    AppAlert.alert(
      'Stop Autopay?',
      'Your fee will no longer be paid on its own. You can set it up again any time.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            setBusy('cancel');
            try {
              setData(await cancelAutopay());
            } catch (e: any) {
              AppAlert.alert('Autopay', e?.response?.data?.message ?? 'Could not stop Autopay. Please try again.');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }, []);

  if (!data || (!data.available && !data.mandate)) return null;

  const m = data.mandate;
  const date = (d: string | null) => (d ? moment(d).format('D MMM YYYY') : '');
  const nextUp = data.upcoming[0];
  const told = data.debits.find(d => d.status === 'notifying' || d.status === 'notified' || d.status === 'debiting');
  const lastDebits = data.debits.filter(d => d.status === 'completed' || d.status === 'failed').slice(0, 3);

  // ── On ──
  if (m && (m.status === 'active' || m.status === 'paused' || m.status === 'cancelling')) {
    return (
      <Card>
        <CardHead
          icon="repeat-outline"
          title={m.status === 'active' ? 'Autopay is on' : `Autopay · ${m.status_label}`}
          sub={`Each installment up to ${inr(m.max_amount)} is paid from your bank on its own`}
        />
        {told ? (
          <View style={s.line}>
            <Text style={s.lineLabel}>{told.label}</Text>
            <Text style={s.lineValue}>
              {inr(told.amount)} {told.debit_on ? `on ${date(told.debit_on)}` : ''}
            </Text>
          </View>
        ) : nextUp ? (
          <View style={s.line}>
            <Text style={s.lineLabel}>Next: {nextUp.label}</Text>
            <Text style={s.lineValue}>
              {inr(nextUp.autopay)} · due {date(nextUp.due_date)}
            </Text>
          </View>
        ) : (
          <Text style={s.text}>Nothing left to pay this year.</Text>
        )}
        {!!nextUp && nextUp.outstanding > nextUp.autopay && (
          <Text style={s.text}>
            {inr(nextUp.outstanding - nextUp.autopay)} of it is above your Autopay limit — please pay that part yourself.
          </Text>
        )}
        {lastDebits.map((d, i) => (
          <View key={i} style={s.line}>
            <Text style={s.lineLabel}>{d.label}</Text>
            <Text style={[s.lineValue, d.status === 'failed' ? s.bad : s.good]}>
              {d.status === 'completed' ? `${inr(d.amount)} paid ${date(d.paid_on)}` : `${inr(d.amount)} · failed`}
            </Text>
          </View>
        ))}
        <Text style={s.text}>You get a message a day before each payment. Keep the money in your account.</Text>
        {m.status !== 'cancelling' && (
          <View style={s.btns}>
            <FeeButton outline label="Stop Autopay" icon="close-circle-outline" onPress={stop} busy={busy === 'cancel'} busyLabel="Stopping" />
          </View>
        )}
      </Card>
    );
  }

  // ── Waiting for approval ──
  if (m && m.status === 'pending') {
    return (
      <Card>
        <CardHead icon="repeat-outline" title="Autopay · waiting for approval" sub="Approve it in your UPI app to turn it on" />
        <View style={s.btns}>
          <FeeButton label="I’ve approved it — check" icon="refresh-outline" onPress={check} busy={busy === 'check'} busyLabel="Checking" />
          <FeeButton outline label="Set up again" icon="repeat-outline" onPress={setup} busy={busy === 'setup'} busyLabel="Opening" />
        </View>
      </Card>
    );
  }

  // ── Off ──
  if (!data.available) return null;
  return (
    <Card>
      <CardHead icon="repeat-outline" title="Autopay" sub="Pay each installment on its own via UPI AutoPay" />
      <Text style={s.text}>
        Approve once in your UPI app. Each installment is then paid from your bank on its due date — you get a message a
        day before. Up to {inr(data.suggested_max ?? data.max_allowed)} a time. Stop it whenever you like.
      </Text>
      {data.upcoming.slice(0, 3).map((u, i) => (
        <View key={i} style={s.line}>
          <Text style={s.lineLabel}>{u.label}</Text>
          <Text style={s.lineValue}>
            {inr(u.autopay)} · {date(u.due_date)}
          </Text>
        </View>
      ))}
      <View style={s.btns}>
        <FeeButton label="Set up Autopay" icon="repeat-outline" onPress={setup} busy={busy === 'setup'} busyLabel="Opening" />
      </View>
    </Card>
  );
};

export default AutopayCard;

const __mk_s = () => StyleSheet.create({
  text: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18, marginTop: 8 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  lineLabel: { flex: 1, fontSize: 13, color: theme.colors.textPrimary },
  lineValue: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  good: { color: theme.colors.success },
  bad: { color: theme.colors.danger },
  btns: { gap: 10, paddingTop: 12 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import Clipboard from '@react-native-clipboard/clipboard';
import VectorIcon from '../../components/VectorIcon';
import { AppDialog } from '../../components/AppDialog';
import { Skeleton } from '../../components/Skeleton';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { QrReview, approveQr, getQrRequest, qrForLine, rejectQr } from '../../api/adminFeeApi';
import { DocHeader } from '../more/docUi';
import { MiniStats, Pill } from '../home/dashboardUi';
import { FeeButton } from '../fees/qrUi';
import { FormCard, FormError, Hint } from './adminFormUi';
import { Avatar, ErrorBox, InfoRow } from './adminTransportUi';
import { QR_STATUS, inr, openFeeReceipt } from './adminFeeUi';

/**
 * One payment made on the school's QR — the panel's review panel. What the
 * student says they paid, the UTR, the day, their note and the screenshot,
 * and where they stand on that fee this year. Checked against the bank:
 * Approve books what actually reached the account as an ordinary payment
 * with its own receipt, Reject closes it with a reason the student sees —
 * either way the student is told. A decided one says who decided it and when.
 */

const AdminFeeQrReviewScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const [r, setR] = useState<QrReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ title: string; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await getQrRequest(id);
      setR(d);
      setAmount(String(Number(d.amount)));
    } catch (e) {
      setError(apiErr(e, 'Could not load this payment.'));
    }
  }, [id]);
  useFocusLoad(() => {
    if (!r) load();
  });

  const approve = async () => {
    const n = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(n)) return setFormError('Enter the amount that reached your account.');
    if (n < 1) return setFormError('The amount must be at least ₹1.');
    setBusy(true);
    setFormError('');
    try {
      const msg = await approveQr(id, amount, note);
      setDone({ title: 'Payment approved', message: msg });
    } catch (e) {
      setFormError(apiErr(e, 'The payment could not be booked. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (reason.trim().length < 3) return setFormError('Tell the student why — they will see this in the app.');
    setBusy(true);
    setFormError('');
    try {
      await rejectQr(id, reason);
      setDone({ title: 'Payment rejected', message: 'The student has been told why.' });
    } catch (e) {
      setFormError(apiErr(e, 'Could not reject. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const closeDone = () => {
    setDone(null);
    navigation.goBack();
  };

  const copyUtr = () => {
    if (!r?.utr) return;
    Clipboard.setString(r.utr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const header = <DocHeader title={r && r.status !== 'pending' ? 'QR Payment' : 'Check Payment'} onBackPress={() => navigation.goBack()} />;

  if (!r) {
    return (
      <View style={s.root}>
        {header}
        {error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : (
          <View style={s.scroll}>
            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} width="100%" height={i === 0 ? 56 : 18} radius={i === 0 ? 12 : 6} />)}
          </View>
        )}
      </View>
    );
  }

  const pending = r.status === 'pending';
  const pill = QR_STATUS[r.status] ?? QR_STATUS.pending;
  const who = r.student;
  const forWhat = qrForLine(r);
  const kind = r.fee_type === 'transport' ? 'Transport' : 'Academic';
  const over = pending && !!r.side && r.side.remaining > 0 && r.amount > r.side.remaining + 0.01;
  const receiptId = r.fee_payment_id ?? r.transport_fee_payment_id;

  return (
    <View style={s.root}>
      {header}
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Who sent it */}
          <View style={s.head}>
            <Avatar uri={who?.photo} name={who?.name} size={48} />
            <View style={s.headBody}>
              <Text style={s.name} numberOfLines={1}>{who?.name || 'Student removed'}</Text>
              <Text style={s.sub} numberOfLines={1}>
                {[[who?.class, who?.section].filter(Boolean).join(' · '), who?.admission_no ? `Adm ${who.admission_no}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Pill text={pill.text} tone={pill.tone} />
          </View>
          {!!r.submitted_at && <Text style={s.sent}>{`Sent ${moment(r.submitted_at).format('DD MMM YYYY, h:mm A')} from the app`}</Text>}

          {/* What they paid */}
          <View>
            <Text style={s.kicker}>PAID ON THE SCHOOL QR</Text>
            <Text style={s.big}>{inr(r.amount)}</Text>
            <InfoRow label="Fee" value={`${kind}${forWhat ? ` · ${forWhat}` : ''}`} />
            {r.utr ? (
              <TouchableOpacity style={s.utrRow} activeOpacity={0.6} onPress={copyUtr}>
                <Text style={s.utrLabel}>UTR</Text>
                <Text style={s.utr} selectable>{r.utr}</Text>
                <VectorIcon iconSet="Ionicons" iconName={copied ? 'checkmark' : 'copy-outline'} size={15} color={theme.colors.primary} />
              </TouchableOpacity>
            ) : (
              <InfoRow label="UTR" value="Not given — see the screenshot" />
            )}
            <InfoRow label="Paid on" value={r.paid_on ? moment(r.paid_on).format('dddd, DD MMM YYYY') : '—'} last={!r.note} />
            {!!r.note && <InfoRow label="Note" value={r.note} last />}
          </View>

          {/* The screenshot */}
          {!!r.screenshot_url && (
            <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('FeeImage', { uri: r.screenshot_url, title: 'Screenshot' })}>
              <Image source={{ uri: r.screenshot_url }} style={s.shot} resizeMode="cover" />
              <Text style={s.shotHint}>Tap to open the screenshot</Text>
            </TouchableOpacity>
          )}

          {/* Where the student stands */}
          {!!r.side && (
            <View style={s.box}>
              <Text style={s.kicker}>{`${kind.toUpperCase()} FEE THIS YEAR`}</Text>
              <MiniStats
                items={[
                  { label: 'Payable', value: inr(r.side.net) },
                  { label: 'Paid', value: inr(r.side.paid) },
                  { label: 'Remaining', value: inr(r.side.remaining), low: r.side.remaining > 0 },
                ]}
              />
              {over && <Text style={s.warn}>This is more than what is left to pay. Approve it only if that much reached your account.</Text>}
            </View>
          )}

          {/* The decision */}
          {pending ? (
            rejecting ? (
              <View style={s.group}>
                <Text style={s.section}>Reject</Text>
                <FormCard
                  label="Reason — the student sees this"
                  value={reason}
                  onChangeText={t => { setReason(t); setFormError(''); }}
                  placeholder="e.g. No payment with this UTR reached our account."
                  multiline
                  minHeight={80}
                  maxLength={300}
                />
                <FormError>{formError}</FormError>
                <FeeButton label="Reject payment" icon="close-circle-outline" busy={busy} onPress={reject} />
                <FeeButton label="Back" outline onPress={() => { setRejecting(false); setFormError(''); }} />
              </View>
            ) : (
              <View style={s.group}>
                <Text style={s.section}>Approve</Text>
                <Hint>Check that it reached your account, then approve. The receipt is made now and the student is told.</Hint>
                <FormCard
                  label="Amount received (₹)"
                  value={amount}
                  onChangeText={t => { setAmount(t.replace(/[^0-9.]/g, '')); setFormError(''); }}
                  keyboardType="decimal-pad"
                  maxLength={10}
                />
                <FormCard label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Matched in bank statement" maxLength={300} />
                <FormError>{formError}</FormError>
                <FeeButton label="Approve & make receipt" icon="checkmark-circle-outline" busy={busy} onPress={approve} />
                <FeeButton label="Reject" outline onPress={() => { setRejecting(true); setFormError(''); }} />
              </View>
            )
          ) : (
            <View style={[s.box, r.status === 'approved' ? s.boxGood : s.boxBad]}>
              <Text style={s.decided}>
                {`${r.status === 'approved' ? 'Approved' : 'Rejected'}${r.reviewer ? ` by ${r.reviewer}` : ''}`}
                {r.reviewed_at ? <Text style={s.muted}>{` · ${moment(r.reviewed_at).format('DD MMM YYYY, h:mm A')}`}</Text> : null}
              </Text>
              {r.status === 'approved' && (
                <Text style={s.decidedLine}>
                  {`${inr(r.approved_amount ?? r.amount)} booked${r.receipt_number ? ` — receipt ${r.receipt_number}` : ''}.`}
                </Text>
              )}
              {!!r.review_note && <Text style={s.decidedLine}>{`${r.status === 'approved' ? 'Note' : 'Reason'}: ${r.review_note}`}</Text>}
              {r.status === 'approved' && !!receiptId && (
                <TouchableOpacity
                  style={s.link}
                  hitSlop={8}
                  onPress={() =>
                    openFeeReceipt(navigation, {
                      id: receiptId,
                      kind: r.fee_payment_id ? 'academic' : 'transport',
                      receipt_number: r.receipt_number,
                    })
                  }
                >
                  <VectorIcon iconSet="Ionicons" iconName="download-outline" size={16} color={theme.colors.primary} />
                  <Text style={s.linkText}>Open receipt</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <AppDialog
        visible={!!done}
        title={done?.title ?? ''}
        message={done?.message ?? ''}
        actions={[{ text: 'Done', onPress: closeDone }]}
        onRequestClose={closeDone}
      />
    </View>
  );
};

export default AdminFeeQrReviewScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 16 },
  muted: { color: theme.colors.textMuted, fontWeight: '400' },

  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headBody: { flex: 1, gap: 2 },
  name: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 13, color: theme.colors.textSecondary },
  sent: { fontSize: 12, color: theme.colors.textMuted, marginTop: -8 },

  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },
  big: { fontSize: 30, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 4, marginBottom: 4 },

  utrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  utrLabel: { flex: 1, fontSize: 14, color: theme.colors.textSecondary },
  utr: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  shot: { width: '100%', height: 220, borderRadius: 12, backgroundColor: theme.colors.background },
  shotHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6, textAlign: 'center' },

  box: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: 14,
  },
  boxGood: { borderColor: theme.colors.success + '55', backgroundColor: theme.colors.success + '0D' },
  boxBad: { borderColor: theme.colors.danger + '55', backgroundColor: theme.colors.danger + '0D' },
  warn: { fontSize: 12, color: theme.colors.danger, marginTop: 8, lineHeight: 17 },

  group: { gap: 12 },
  section: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },

  decided: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  decidedLine: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 18 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { AppAlert, AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { pickImage } from '../../utils/filePickers';
import type { PickedFile } from '../../api/adminProfileApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { Card, CardHead, Note } from '../home/dashboardUi';
import {
  FeeType,
  MonthRow,
  SchoolQr,
  TransportFees,
  getFeeQr,
  getTransportFees,
  submitQrPayment,
} from '../../api/feeApi';
import { AmountField, inr } from './feesUi';
import { FeeButton, QrImage, openUpiApp, saveQrToPhone } from './qrUi';

const TITLE = 'Pay on School QR';

/**
 * Paying a fee on the school's own UPI QR, then telling the school.
 *
 *   Pay the school  — the QR (tap to see it full screen), the UPI ID to copy,
 *      a button that opens a UPI app with the amount filled in, and one that
 *      saves the QR for a UPI app's "scan from gallery".
 *   Tell the school — which fee, how much, the day it was paid, and the UTR
 *      or a screenshot. The school checks it against its bank account; the
 *      receipt comes once they approve it.
 *
 * Route params (all optional):
 *   qr              – the school's QR, as the Fees screen loaded it
 *   feeType         – 'academic' | 'transport' to start on
 *   suggestedAmount – what to fill the amount with
 *   note            – what it is for ("Term 2")
 *   hasTransport    – the student is on a route (offers Transport)
 *   academicLeft / transportLeft – what is left to pay on each, for the hints
 */

const UTR_RE = /^[A-Z0-9]{6,35}$/;

// The last ten days, today first — a payment is reported soon after it's made.
const recentDays = () => Array.from({ length: 10 }, (_, i) => moment().subtract(i, 'days'));

const dayLabel = (d: moment.Moment, i: number) => (i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.format('ddd'));

const QrPayScreen = ({ navigation, route }: any) => {
  const p = route?.params ?? {};
  const [qr, setQr] = useState<SchoolQr | null | undefined>(p.qr);
  const hasTransport: boolean = !!p.hasTransport;

  const [feeType, setFeeType] = useState<FeeType>(p.feeType === 'transport' && hasTransport ? 'transport' : 'academic');
  const [amount, setAmount] = useState<string>(p.suggestedAmount > 0 ? String(Math.round(p.suggestedAmount)) : '');
  const [paidOn, setPaidOn] = useState(moment().format('YYYY-MM-DD'));
  const [utr, setUtr] = useState('');
  const [note, setNote] = useState('');
  const [shot, setShot] = useState<PickedFile | null>(null);
  const [months, setMonths] = useState<Record<string, boolean>>({});
  const [transport, setTransport] = useState<TransportFees | null | undefined>(undefined);
  const [focused, setFocused] = useState<'utr' | 'note' | null>(null);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const utrRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);

  // The QR comes from the Fees screen; opened any other way, fetch it.
  useEffect(() => {
    if (p.qr !== undefined) return;
    getFeeQr()
      .then(d => setQr(d.qr))
      .catch(() => setQr(null));
  }, [p.qr]);

  // Transport months, once Transport is picked.
  useEffect(() => {
    if (feeType !== 'transport' || transport !== undefined) return;
    getTransportFees()
      .then(setTransport)
      .catch(() => setTransport(null));
  }, [feeType, transport]);

  const payableMonths = useMemo(
    () => (transport?.schedule ?? []).filter((m: MonthRow) => m.status !== 'paid' && m.status !== 'no_transport'),
    [transport],
  );

  const toggleMonth = (m: MonthRow) => {
    const next = { ...months, [m.key]: !months[m.key] };
    setMonths(next);
    const sum = payableMonths.filter(x => next[x.key]).reduce((n, x) => n + x.outstanding, 0);
    if (sum > 0) setAmount(String(Math.round(sum)));
  };

  const pickFee = (t: FeeType) => {
    if (t === feeType) return;
    setFeeType(t);
    setMonths({});
    const left = t === 'transport' ? p.transportLeft : p.academicLeft;
    setAmount(left > 0 ? String(Math.round(left)) : '');
  };

  const value = parseFloat(amount) || 0;
  const cleanUtr = utr.replace(/\s+/g, '').toUpperCase();
  const left: number | undefined = feeType === 'transport' ? p.transportLeft : p.academicLeft;

  const upiNote = `${feeType === 'transport' ? 'Transport' : 'School'} fee${p.note ? ` ${p.note}` : ''}`;

  const onOpenUpi = async () => {
    if (!qr) return;
    const ok = await openUpiApp(qr, value > 0 ? value : undefined, upiNote);
    if (!ok) {
      AppAlert.alert('No UPI app found', 'Save the QR and scan it from your gallery in any UPI app, or pay from another phone.');
    }
  };

  const onSaveQr = async () => {
    if (!qr?.image_url) return;
    setSaving(true);
    try {
      await saveQrToPhone(qr.image_url);
      AppAlert.alert('QR saved', 'Open your UPI app, choose scan, and pick this QR from your gallery.');
    } catch {
      AppAlert.alert('Could not save', 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const onCopyUpi = () => {
    if (!qr?.upi_id) return;
    Clipboard.setString(qr.upi_id);
    AppAlert.alert('Copied', `${qr.upi_id} is copied. Paste it in your UPI app to pay.`);
  };

  const onAttach = async () => {
    const f = await pickImage();
    if (!f) return;
    if (f.size && f.size > 5 * 1024 * 1024) {
      AppAlert.alert('Too large', 'The screenshot must be 5 MB or smaller.');
      return;
    }
    setShot(f);
  };

  const onSend = async () => {
    if (value <= 0) {
      AppAlert.alert('Enter the amount', 'Enter how much you paid.');
      return;
    }
    if (!cleanUtr && !shot) {
      AppAlert.alert('Add the UTR or a screenshot', 'The school needs one of them to find your payment.');
      return;
    }
    if (cleanUtr && !UTR_RE.test(cleanUtr)) {
      AppAlert.alert('Check the UTR', 'Enter the UTR as your UPI app shows it — letters and numbers only.');
      return;
    }
    setSending(true);
    try {
      await submitQrPayment({
        feeType,
        amount: value,
        utr: cleanUtr || undefined,
        paidOn,
        note: note.trim() || undefined,
        months: feeType === 'transport' ? payableMonths.filter(m => months[m.key]).map(m => m.key) : undefined,
        transportationId: feeType === 'transport' ? transport?.route?.id : undefined,
        installment: feeType === 'academic' && p.note ? String(p.note) : undefined,
        screenshot: shot,
      });
      setSent(true);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        (e?.code === 'ECONNABORTED' ? 'This is taking too long. Check your connection and try again.' : null) ||
        'Could not send it. Please try again.';
      AppAlert.alert('Not sent', msg);
    } finally {
      setSending(false);
    }
  };

  const done = useCallback(() => {
    setSent(false);
    navigation.goBack();
  }, [navigation]);

  // ── Loading / not available ────────────────────────────────────────────────
  if (qr === undefined) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.skWrap}>
          <Skeleton width="100%" height={320} radius={16} />
          <Skeleton width="100%" height={260} radius={16} />
        </View>
      </View>
    );
  }

  if (!qr) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <DocNoData
          icon="qr-code-outline"
          title="Not taking fees on QR"
          subtitle="Your school isn't taking fees on its QR right now. Pay at the school office, or online if it is offered."
        />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* ── Pay ─────────────────────────────────────────────────────── */}
          <Card flush>
            <CardHead icon="qr-code-outline" title="Pay the school" sub={qr.payee_name || 'On its UPI QR'} />
            {!!qr.image_url && (
              <QrImage
                url={qr.image_url}
                onPress={() => navigation.navigate('FeeImage', { uri: qr.image_url, title: 'School QR' })}
              />
            )}

            {!!qr.upi_id && (
              <View style={s.upiRow}>
                <Text style={s.upiId} selectable numberOfLines={1}>
                  {qr.upi_id}
                </Text>
                <TouchableOpacity style={s.copy} onPress={onCopyUpi} hitSlop={8} activeOpacity={0.6}>
                  <VectorIcon iconSet="Ionicons" iconName="copy-outline" size={15} color={theme.colors.primary} />
                  <Text style={s.copyText}>Copy</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={s.payRow}>
              {!!qr.upi_id && (
                <View style={s.flex}>
                  <FeeButton compact label="Open UPI app" icon="open-outline" onPress={onOpenUpi} />
                </View>
              )}
              {!!qr.image_url && (
                <View style={s.flex}>
                  <FeeButton compact outline label="Save QR" icon="download-outline" busy={saving} onPress={onSaveQr} />
                </View>
              )}
            </View>
            {!!qr.instructions && <Text style={s.tip}>{qr.instructions}</Text>}
          </Card>

          {/* ── Tell the school ─────────────────────────────────────────── */}
          <Card flush>
            <CardHead icon="paper-plane-outline" title="Tell the school" sub="The UTR, or a screenshot" />

            {hasTransport && (
              <View style={s.segment}>
                {(['academic', 'transport'] as FeeType[]).map(t => {
                  const on = t === feeType;
                  return (
                    <TouchableOpacity key={t} style={[s.segmentItem, on && s.segmentOn]} onPress={() => pickFee(t)} activeOpacity={0.7}>
                      <Text style={[s.segmentText, on && s.segmentTextOn]}>{t === 'transport' ? 'Transport fee' : 'Academic fee'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {feeType === 'transport' &&
              (transport === undefined ? (
                <View style={s.monthsLoading}>
                  <Skeleton width="100%" height={34} radius={17} />
                </View>
              ) : payableMonths.length > 0 ? (
                <>
                  <Text style={s.label}>Months this pays for</Text>
                  <View style={s.chips}>
                    {payableMonths.map(m => {
                      const on = !!months[m.key];
                      return (
                        <TouchableOpacity key={m.key} style={[s.chip, on && s.chipOn]} onPress={() => toggleMonth(m)} activeOpacity={0.7}>
                          <Text style={[s.chipText, on && s.chipTextOn]}>
                            {m.month.slice(0, 3)} · {inr(m.outstanding)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null)}

            <Text style={s.label}>Amount paid</Text>
            <AmountField value={amount} onChange={setAmount} />
            {left != null && (
              <Text style={s.hint}>
                {left > 0 ? `${inr(left)} is left to pay${p.note && feeType === 'academic' ? ` · ${p.note}` : ''}` : 'Nothing is left to pay on this fee.'}
              </Text>
            )}

            <Text style={s.label}>Paid on</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.days}>
              {recentDays().map((d, i) => {
                const iso = d.format('YYYY-MM-DD');
                const on = iso === paidOn;
                return (
                  <TouchableOpacity key={iso} style={[s.day, on && s.dayOn]} onPress={() => setPaidOn(iso)} activeOpacity={0.7}>
                    <Text style={[s.dayTop, on && s.dayTextOn]}>{dayLabel(d, i)}</Text>
                    <Text style={[s.dayNum, on && s.dayTextOn]}>{d.format('D MMM')}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Pressable style={[s.field, focused === 'utr' && s.fieldFocused]} onPress={() => utrRef.current?.focus()}>
              <Text style={s.fieldLabel}>UTR / UPI reference number</Text>
              <TextInput
                ref={utrRef}
                style={[s.fieldInput, s.mono]}
                value={utr}
                onChangeText={t => setUtr(t.replace(/[^0-9A-Za-z ]/g, ''))}
                placeholder="e.g. 412345678901"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={40}
                onFocus={() => setFocused('utr')}
                onBlur={() => setFocused(null)}
              />
            </Pressable>
            <Text style={s.hint}>The 12-digit UPI Ref No. on the payment in your UPI app.</Text>

            {shot ? (
              <View style={s.shot}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('FeeImage', { uri: shot.uri, title: 'Screenshot' })}>
                  <Image source={{ uri: shot.uri }} style={s.shotImg} />
                </TouchableOpacity>
                <View style={s.flex}>
                  <Text style={s.shotTitle}>Screenshot attached</Text>
                  <TouchableOpacity onPress={onAttach} hitSlop={6} activeOpacity={0.6}>
                    <Text style={s.link}>Change</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setShot(null)} hitSlop={10} activeOpacity={0.6}>
                  <VectorIcon iconSet="Ionicons" iconName="close" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.attach} onPress={onAttach} activeOpacity={0.7}>
                <VectorIcon iconSet="Ionicons" iconName="image-outline" size={20} color={theme.colors.primary} />
                <View style={s.flex}>
                  <Text style={s.attachTitle}>Attach a screenshot</Text>
                  <Text style={s.attachSub}>Not needed with a UTR</Text>
                </View>
              </TouchableOpacity>
            )}

            <Pressable style={[s.field, focused === 'note' && s.fieldFocused]} onPress={() => noteRef.current?.focus()}>
              <Text style={s.fieldLabel}>Note (optional)</Text>
              <TextInput
                ref={noteRef}
                style={s.fieldInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Paid from my father's account"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={300}
                multiline
                onFocus={() => setFocused('note')}
                onBlur={() => setFocused(null)}
              />
            </Pressable>

            <View style={s.send}>
              <FeeButton label={sending ? 'Sending…' : 'Send to school'} icon="paper-plane" busy={sending} onPress={onSend} />
            </View>
            <Note>The school checks it; your receipt then shows in Fees.</Note>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <AppDialog
        visible={sent}
        title="Sent to the school"
        message="The school will check your payment and approve it. You'll get a notification, and the receipt will show in Fees."
        actions={[{ text: 'Done', onPress: done }]}
        onRequestClose={done}
      />
    </View>
  );
};

export default QrPayScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  scroll: { paddingBottom: 40 },
  skWrap: { padding: 16, gap: 12 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 0.5 },

  // The QR itself is qrUi's; here only the UPI ID and the two ways out
  upiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
  },
  upiId: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  payRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  tip: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 17, marginTop: 10 },

  // Form
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    marginTop: 6,
    marginBottom: 2,
  },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segmentOn: {
    backgroundColor: theme.colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  segmentText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  segmentTextOn: { color: theme.colors.primary, fontWeight: '600' },

  label: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 16, marginBottom: 8 },
  hint: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 17, marginTop: 6 },
  link: { fontSize: 13, fontWeight: '600', color: theme.colors.primary, marginTop: 2 },

  monthsLoading: { marginTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  chipOn: { backgroundColor: theme.colors.primary + '14', borderColor: theme.colors.primary + '55' },
  chipText: { fontSize: 13, color: theme.colors.textSecondary },
  chipTextOn: { color: theme.colors.primary, fontWeight: '600' },

  days: { gap: 8, paddingRight: 4 },
  day: {
    minWidth: 76,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
  },
  dayOn: { backgroundColor: theme.colors.primary + '14', borderColor: theme.colors.primary + '55' },
  dayTop: { fontSize: 11, fontWeight: '500', color: theme.colors.textMuted },
  dayNum: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 2 },
  dayTextOn: { color: theme.colors.primary },

  // Inputs — label inside, borderless input underneath (Contact School's)
  field: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
  },
  fieldFocused: { borderColor: theme.colors.primary },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },
  fieldInput: { fontSize: 15, color: theme.colors.textPrimary, paddingHorizontal: 0, paddingVertical: 4, marginTop: 2 },

  // Screenshot
  attach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary + '55',
    backgroundColor: theme.colors.primary + '08',
  },
  attachTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  attachSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  shot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  shotImg: { width: 48, height: 64, borderRadius: 8, backgroundColor: theme.colors.background },
  shotTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },

  send: { marginTop: 20 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

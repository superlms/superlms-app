import React from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import ReactNativeBlobUtil from 'react-native-blob-util';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { DateBlock, LineRow, Pill } from '../home/dashboardUi';
import type { QrPaymentRequest, SchoolQr } from '../../api/feeApi';
import { inr } from './feesUi';

/**
 * Paying on the school's own UPI QR: the buttons that start it, the row for a
 * payment sent to the school, and the two ways out of the app to pay — the
 * UPI app with the amount filled in, or the QR saved to the phone to scan from
 * the gallery (a QR can't be scanned by the phone that shows it).
 */

// ── Buttons ──────────────────────────────────────────────────────────────────
export const FeeButton = ({
  label,
  icon,
  onPress,
  outline,
  busy,
  disabled,
  compact,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  outline?: boolean;
  busy?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) => (
  <TouchableOpacity
    style={[s.btn, outline && s.btnOutline, compact && s.btnCompact, (disabled || busy) && s.btnIdle]}
    onPress={onPress}
    disabled={disabled || busy}
    activeOpacity={0.85}
  >
    {busy ? (
      <ActivityIndicator size="small" color={outline ? theme.colors.primary : theme.colors.white} />
    ) : (
      <>
        {!!icon && (
          <VectorIcon
            iconSet="Ionicons"
            iconName={icon}
            size={compact ? 16 : 18}
            color={outline ? theme.colors.primary : theme.colors.white}
          />
        )}
        <Text style={[s.btnText, outline && s.btnTextOutline, compact && s.btnTextCompact]}>{label}</Text>
      </>
    )}
  </TouchableOpacity>
);

/**
 * How this student can pay: on the school's QR when it takes fees there, and
 * online when the school has its own gateway — or when it has no QR, as before.
 */
export const PayOptions = ({
  qr,
  gatewayReady,
  onQr,
  onOnline,
  qrLabel = 'Pay on school QR',
  onlineLabel = 'Pay online',
}: {
  qr: SchoolQr | null | undefined;
  gatewayReady: boolean;
  onQr: () => void;
  onOnline: () => void;
  qrLabel?: string;
  onlineLabel?: string;
}) => {
  const online = !qr || gatewayReady;
  return (
    <View style={s.payOptions}>
      {!!qr && <FeeButton label={qrLabel} icon="qr-code-outline" onPress={onQr} />}
      {online && <FeeButton label={onlineLabel} icon="card-outline" onPress={onOnline} outline={!!qr} />}
    </View>
  );
};

// ── A payment sent to the school ─────────────────────────────────────────────
const STATUS: Record<string, { text: string; tone: 'accent' | 'good' | 'bad' }> = {
  pending: { text: 'Checking', tone: 'accent' },
  approved: { text: 'Approved', tone: 'good' },
  rejected: { text: 'Not accepted', tone: 'bad' },
};

const day = (iso?: string | null) => (iso ? moment(iso).format('D MMM') : '');

//  [18]  ₹ 1,500 · Academic                          CHECKING
//  [SEP] UTR 412345678901 · sent 18 Sep
export const QrRequestRow = ({
  r,
  onPress,
  isLast,
}: {
  r: QrPaymentRequest;
  onPress?: () => void;
  isLast: boolean;
}) => {
  const st = STATUS[r.status] ?? STATUS.pending;
  const kind = r.fee_type === 'transport' ? 'Transport' : 'Academic';
  const amount = r.status === 'approved' && r.approved_amount != null ? r.approved_amount : r.amount;
  const forWhat = r.months?.length ? r.months.map(m => m.toUpperCase()).join(', ') : r.installment;

  const meta =
    r.status === 'rejected'
      ? [r.review_note || 'The school could not match this payment', `sent ${day(r.submitted_at)}`].join(' · ')
      : r.status === 'approved'
      ? [r.receipt_number ? `Receipt ${r.receipt_number}` : null, r.reviewed_at ? `approved ${day(r.reviewed_at)}` : null]
          .filter(Boolean)
          .join(' · ')
      : [r.utr ? `UTR ${r.utr}` : 'Screenshot sent', `sent ${day(r.submitted_at)}`, 'the school is checking'].join(' · ');

  return (
    <LineRow
      lead={<DateBlock iso={r.paid_on} accent={r.status === 'pending'} />}
      title={`${inr(amount)} · ${kind}${forWhat ? ` · ${forWhat}` : ''}`}
      meta={meta}
      metaLines={2}
      trailing={<Pill text={st.text} tone={st.tone} />}
      onPress={onPress}
      isLast={isLast}
    />
  );
};

// ── Leaving the app to pay ───────────────────────────────────────────────────
/** upi://pay link for the school's UPI ID, with the amount and a note filled in. */
export const upiLink = (qr: SchoolQr, amount?: number, note?: string) => {
  const q = [
    `pa=${encodeURIComponent(qr.upi_id ?? '')}`,
    qr.payee_name ? `pn=${encodeURIComponent(qr.payee_name)}` : null,
    amount && amount > 0 ? `am=${encodeURIComponent(amount.toFixed(2))}` : null,
    'cu=INR',
    note ? `tn=${encodeURIComponent(note.slice(0, 50))}` : null,
  ]
    .filter(Boolean)
    .join('&');
  return `upi://pay?${q}`;
};

/** Open a UPI app on the school's UPI ID. Resolves false when no UPI app takes it. */
export const openUpiApp = async (qr: SchoolQr, amount?: number, note?: string): Promise<boolean> => {
  if (!qr.upi_id) return false;
  try {
    await Linking.openURL(upiLink(qr, amount, note));
    return true;
  } catch {
    return false;
  }
};

/**
 * Keep the QR on the phone, where a UPI app's "scan from gallery" finds it:
 * Pictures on Android, the share sheet on iOS.
 */
export const saveQrToPhone = async (url: string): Promise<void> => {
  const { config, fs, ios, MediaCollection } = ReactNativeBlobUtil;
  const ext = (url.split('?')[0].split('.').pop() || 'png').toLowerCase();
  const safeExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'png';
  const name = `school-fee-qr-${moment().format('YYYYMMDD-HHmmss')}.${safeExt}`;
  const mime = safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg';

  const res = await config({ path: `${fs.dirs.CacheDir}/${name}`, fileCache: true }).fetch('GET', url);
  if (res.info().status >= 400) throw new Error('Could not download the QR.');
  const path = res.path();

  if (Platform.OS === 'android') {
    await MediaCollection.copyToMediaStore({ name, parentFolder: '', mimeType: mime }, 'Image', path);
    return;
  }
  await ios.openDocument(path);
};

const __mk_s = () => StyleSheet.create({
  // Buttons
  btn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  btnOutline: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.primary + '55',
  },
  btnCompact: { height: 40, paddingHorizontal: 12 },
  btnIdle: { opacity: 0.5 },
  btnText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
  btnTextOutline: { color: theme.colors.primary },
  btnTextCompact: { fontSize: 14 },

  payOptions: { gap: 10, paddingTop: 6, paddingBottom: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

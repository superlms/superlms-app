import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { AppAlert } from '../../components/AppDialog';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { downloadPdf } from '../../api/pdfDownload';
import { transportReceiptUrl, type TransportPayment } from '../../api/transportApi';
import { inr } from './feesUi';

// The green of a settled payment — its tick, and the "Paid" chip.
const PAID_INK = '#16A34A';
const PAID_BG = '#DCFCE7';

// A detail of the payment: the label on the left, its value on the right.
const DetailRow = ({ label, value }: { label: string; value?: string | null }) => (
  <View style={s.detailRow}>
    <Text style={s.detailLabel}>{label}</Text>
    <Text style={s.detailValue} numberOfLines={1}>
      {value || '—'}
    </Text>
  </View>
);

/**
 * The student's transport fee payments, in the order they were paid, each as
 * a payment card: the tick, the amount with its date and day, then the serial
 * number, mode, type, who submitted it and the receipt number, and the receipt
 * to download. Shared by the Transport screen and the Transport tab of Fees.
 */
export const TransportPayments = ({
  payments,
  emptyText = 'No transport payments yet.',
}: {
  payments: TransportPayment[];
  emptyText?: string;
}) => {
  // The payment whose receipt is downloading — its button shows a spinner.
  const [downloading, setDownloading] = useState<number | null>(null);

  if (payments.length === 0) return <Text style={s.empty}>{emptyText}</Text>;

  const list = [...payments].sort((a, b) => a.serial - b.serial);

  // Saves the receipt PDF to the phone's Downloads (the share sheet on iOS).
  const download = async (p: TransportPayment) => {
    if (downloading !== null) return;
    setDownloading(p.id);
    const fileName = `Transport-Receipt-${p.receipt_number.replace(/[\\/:*?"<>|\s]+/g, '-')}.pdf`;
    try {
      await downloadPdf(transportReceiptUrl(p.id), fileName);
      if (Platform.OS === 'android') AppAlert.alert('Downloaded', `${fileName} is saved in Downloads.`);
    } catch (e: any) {
      console.log('[transportReceipt] ❌', e?.message);
      AppAlert.alert('Could not download', 'Please check your connection and try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <View>
      {list.map((p, i) => {
        const busy = downloading === p.id;
        return (
          <View key={p.id} style={[s.card, i < list.length - 1 && s.cardGap]}>
            <View style={s.top}>
              <View style={s.tick}>
                <VectorIcon iconSet="Ionicons" iconName="checkmark" size={20} color={PAID_INK} />
              </View>
              <View style={s.topBody}>
                <Text style={s.amount}>{inr(p.amount)}</Text>
                <Text style={s.when}>{[p.date, p.day].filter(Boolean).join(' · ') || '—'}</Text>
              </View>
              <View style={s.paidChip}>
                <Text style={s.paidText}>Paid</Text>
              </View>
            </View>

            <View style={s.details}>
              <DetailRow label="Serial No." value={`#${p.serial}`} />
              <DetailRow label="Mode" value={p.mode} />
              <DetailRow label="Type" value={p.type} />
              <DetailRow label="Submitted By" value={p.submitted_by} />
              <DetailRow label="Receipt No." value={p.receipt_number} />
            </View>

            <TouchableOpacity
              style={s.download}
              onPress={() => download(p)}
              disabled={downloading !== null}
              activeOpacity={0.6}
            >
              {busy ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <VectorIcon iconSet="Ionicons" iconName="download-outline" size={17} color={theme.colors.primary} />
              )}
              <Text style={s.downloadText}>{busy ? 'Downloading…' : 'Download Receipt'}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
};

// The detail values' widths in the skeleton: serial, mode, type, name, receipt.
const DETAIL_WIDTHS = [26, 40, 58, 92, 128];

/** Payment cards while the page loads — the same card, in boxes. */
export const TransportPaymentsSkeleton = ({ count = 1 }: { count?: number }) => (
  <View>
    {Array.from({ length: count }, (_, i) => (
      <View key={i} style={[s.card, i < count - 1 && s.cardGap]}>
        <View style={s.top}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={s.topBody}>
            <Skeleton width="42%" height={18} />
            <Skeleton width="58%" height={12} style={s.skWhen} />
          </View>
          <Skeleton width={46} height={22} radius={11} />
        </View>
        <View style={s.details}>
          {DETAIL_WIDTHS.map((w, j) => (
            <View key={j} style={s.detailRow}>
              <Skeleton width={78} height={13} style={s.skLine} />
              <View style={s.skValue}>
                <Skeleton width={w} height={13} style={s.skLine} />
              </View>
            </View>
          ))}
        </View>
        <View style={s.download}>
          <Skeleton width={136} height={14} style={s.skLine} />
        </View>
      </View>
    ))}
  </View>
);

const __mk_s = () => StyleSheet.create({
  empty: { fontSize: 13, color: theme.colors.textMuted, paddingVertical: 12 },

  // One payment
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  cardGap: { marginBottom: 12 },

  // Tick, amount with its date and day, and the Paid chip
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  tick: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PAID_BG,
  },
  topBody: { flex: 1 },
  amount: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  when: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  paidChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: theme.radius.full, backgroundColor: PAID_BG },
  paidText: { fontSize: 12, fontWeight: '600', color: PAID_INK },

  // The details, label left and value right
  details: {
    marginHorizontal: 14,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  detailLabel: { fontSize: 13, color: theme.colors.textSecondary },
  detailValue: {
    flex: 1,
    marginLeft: 16,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },

  // Download Receipt, across the foot of the card
  download: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  downloadText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

  // Skeleton — boxes the height of the text they stand in for
  skWhen: { marginTop: 5 },
  skLine: { marginVertical: 2.5 },
  skValue: { flex: 1, alignItems: 'flex-end', marginLeft: 16 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

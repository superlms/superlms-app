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
import { theme, onThemeChange } from '../../utils/theme';
import { downloadPdf } from '../../api/pdfDownload';
import { transportReceiptUrl, type TransportPayment } from '../../api/transportApi';
import { inr } from './feesUi';

// One detail of a payment — a small label over its value, half the width.
const PayField = ({ label, value }: { label: string; value?: string | null }) => (
  <View style={s.field}>
    <Text style={s.fieldLabel}>{label}</Text>
    <Text style={s.fieldValue}>{value || '—'}</Text>
  </View>
);

/**
 * The student's transport fee payments, in the order they were paid — the
 * serial number, amount, date, day, who submitted it, type, mode and receipt
 * number of each, with its receipt to download. Shared by the Transport screen
 * and the Transport tab of Fees.
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
      {list.map((p, i) => (
        <View key={p.id} style={[s.payment, i < list.length - 1 && s.rowDivider]}>
          <View style={s.head}>
            <View style={s.serial}>
              <Text style={s.serialText}>{p.serial}</Text>
            </View>
            <Text style={s.amount}>{inr(p.amount)}</Text>
            <TouchableOpacity
              style={s.receiptBtn}
              onPress={() => download(p)}
              disabled={downloading !== null}
              activeOpacity={0.7}
            >
              {downloading === p.id ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <VectorIcon iconSet="Ionicons" iconName="download-outline" size={16} color={theme.colors.primary} />
              )}
              <Text style={s.receiptBtnText}>Receipt</Text>
            </TouchableOpacity>
          </View>

          <View style={s.grid}>
            <PayField label="Date" value={p.date} />
            <PayField label="Day" value={p.day} />
            <PayField label="Submitted By" value={p.submitted_by} />
            <PayField label="Type" value={p.type} />
            <PayField label="Mode" value={p.mode} />
            <PayField label="Receipt No" value={p.receipt_number} />
          </View>
        </View>
      ))}
    </View>
  );
};

const __mk_s = () => StyleSheet.create({
  empty: { fontSize: 13, color: theme.colors.textMuted, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },

  payment: { paddingVertical: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  serial: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  serialText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  amount: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryLight,
  },
  receiptBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

  // Details under the amount, two to a line, lined up with it
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, paddingLeft: 34, rowGap: 10 },
  field: { width: '50%', paddingRight: 8 },
  fieldLabel: { fontSize: 11, color: theme.colors.textMuted },
  fieldValue: { fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

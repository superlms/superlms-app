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

// The green of a settled payment — its tick, and the "Paid" chip — and the
// soft red behind money still owed.
const PAID_INK = '#16A34A';
const PAID_BG = '#DCFCE7';
const DUE_BG = '#FEE2E2';

// ── The transport card ───────────────────────────────────────────────────────
// One look for every block on the Transport screen — each payment, the fees
// and the driver: a bordered card with a head (a round lead, a big line, a
// small line under it and an optional chip), label/value details under a
// hairline, and an optional action across its foot.

export const TransportCard = ({ children, gap }: { children: React.ReactNode; gap?: boolean }) => (
  <View style={[s.card, gap && s.cardGap]}>{children}</View>
);

/** The head's round lead: an icon on a soft tint. */
export const CardLeadIcon = ({ icon, tone = 'primary' }: { icon: string; tone?: 'primary' | 'paid' }) => (
  <View style={[s.lead, tone === 'paid' ? s.leadPaid : s.leadPrimary]}>
    <VectorIcon
      iconSet="Ionicons"
      iconName={icon}
      size={20}
      color={tone === 'paid' ? PAID_INK : theme.colors.primary}
    />
  </View>
);

export const CardHead = ({
  lead,
  title,
  sub,
  chip,
}: {
  lead: React.ReactNode;
  title: string;
  sub?: string | null;
  chip?: { label: string; tone: 'paid' | 'due' } | null;
}) => (
  <View style={s.top}>
    {lead}
    <View style={s.topBody}>
      <Text style={s.title} numberOfLines={1}>
        {title}
      </Text>
      {!!sub && (
        <Text style={s.sub} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
    {!!chip && (
      <View style={[s.chip, chip.tone === 'due' ? s.chipDue : s.chipPaid]}>
        <Text style={[s.chipText, chip.tone === 'due' ? s.chipTextDue : s.chipTextPaid]}>{chip.label}</Text>
      </View>
    )}
  </View>
);

export const CardDetails = ({ children }: { children: React.ReactNode }) => (
  <View style={s.details}>{children}</View>
);

/**
 * A detail: the label on the left, its value on the right — in the accent
 * colour when it can be tapped — and anything `aside` in a column after it.
 */
export const CardDetailRow = ({
  label,
  value,
  onPress,
  aside,
}: {
  label: string;
  value?: string | null;
  onPress?: () => void;
  aside?: React.ReactNode;
}) => (
  <TouchableOpacity style={s.detailRow} activeOpacity={onPress ? 0.6 : 1} disabled={!onPress} onPress={onPress}>
    <Text style={s.detailLabel}>{label}</Text>
    <Text style={[s.detailValue, !!onPress && s.detailLink]} numberOfLines={1}>
      {value || '—'}
    </Text>
    {aside !== undefined && <View style={s.aside}>{aside}</View>}
  </TouchableOpacity>
);

/** The card's action, across its foot. */
export const CardFooter = ({
  icon,
  label,
  onPress,
  busy,
  busyLabel,
  disabled,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
}) => (
  <TouchableOpacity style={s.footer} onPress={onPress} disabled={disabled || busy} activeOpacity={0.6}>
    {busy ? (
      <ActivityIndicator size="small" color={theme.colors.primary} />
    ) : (
      <VectorIcon iconSet="Ionicons" iconName={icon} size={17} color={theme.colors.primary} />
    )}
    <Text style={s.footerText}>{busy && busyLabel ? busyLabel : label}</Text>
  </TouchableOpacity>
);

// ── The card in boxes, for the loading skeleton ──────────────────────────────
export const CardHeadSkeleton = ({
  titleWidth = '42%',
  subWidth = '58%',
  chipWidth,
}: {
  titleWidth?: number | string;
  subWidth?: number | string;
  chipWidth?: number;
}) => (
  <View style={s.top}>
    <Skeleton width={40} height={40} radius={20} />
    <View style={s.topBody}>
      <Skeleton width={titleWidth} height={18} />
      <Skeleton width={subWidth} height={12} style={s.skSub} />
    </View>
    {!!chipWidth && <Skeleton width={chipWidth} height={22} radius={11} />}
  </View>
);

/** One row per value width; the labels' widths repeat in turn. */
export const CardDetailsSkeleton = ({
  widths,
  labels = [78],
  aside,
}: {
  widths: (number | string)[];
  labels?: number[];
  /** Width of a box in the aside column, when the rows have one. */
  aside?: number;
}) => (
  <View style={s.details}>
    {widths.map((w, i) => (
      <View key={i} style={s.detailRow}>
        <Skeleton width={labels[i % labels.length]} height={13} style={s.skLine} />
        <View style={s.skValue}>
          <Skeleton width={w} height={13} style={s.skLine} />
        </View>
        {!!aside && (
          <View style={s.aside}>
            <Skeleton width={aside} height={13} style={s.skLine} />
          </View>
        )}
      </View>
    ))}
  </View>
);

export const CardFooterSkeleton = ({ width = 136 }: { width?: number }) => (
  <View style={s.footer}>
    <Skeleton width={width} height={14} style={s.skLine} />
  </View>
);

/**
 * The student's transport fee payments, in the order they were paid, each as
 * a payment card: the tick, the amount with its date and day, then the mode,
 * who submitted it and the receipt number, and the receipt to download.
 * Shared by the Transport screen and the Transport tab of Fees.
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
        <TransportCard key={p.id} gap={i < list.length - 1}>
          <CardHead
            lead={<CardLeadIcon icon="checkmark" tone="paid" />}
            title={inr(p.amount)}
            sub={[p.date, p.day].filter(Boolean).join(' · ') || '—'}
            chip={{ label: 'Paid', tone: 'paid' }}
          />
          <CardDetails>
            <CardDetailRow label="Mode" value={p.mode} />
            <CardDetailRow label="Submitted By" value={p.submitted_by} />
            <CardDetailRow label="Receipt No." value={p.receipt_number} />
          </CardDetails>
          <CardFooter
            icon="download-outline"
            label="Download Receipt"
            busyLabel="Downloading…"
            busy={downloading === p.id}
            disabled={downloading !== null}
            onPress={() => download(p)}
          />
        </TransportCard>
      ))}
    </View>
  );
};

// The detail values' widths in the skeleton: mode, name, receipt.
const DETAIL_WIDTHS = [40, 92, 128];

/** Payment cards while the page loads — the same card, in boxes. */
export const TransportPaymentsSkeleton = ({ count = 1 }: { count?: number }) => (
  <View>
    {Array.from({ length: count }, (_, i) => (
      <TransportCard key={i} gap={i < count - 1}>
        <CardHeadSkeleton chipWidth={46} />
        <CardDetailsSkeleton widths={DETAIL_WIDTHS} />
        <CardFooterSkeleton />
      </TransportCard>
    ))}
  </View>
);

const __mk_s = () => StyleSheet.create({
  empty: { fontSize: 13, color: theme.colors.textMuted, paddingVertical: 12 },

  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  cardGap: { marginBottom: 12 },

  // Head: the round lead, the big line and the small one, the chip
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  lead: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  leadPaid: { backgroundColor: PAID_BG },
  leadPrimary: { backgroundColor: theme.colors.primaryLight },
  topBody: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: theme.radius.full },
  chipPaid: { backgroundColor: PAID_BG },
  chipDue: { backgroundColor: DUE_BG },
  chipText: { fontSize: 12, fontWeight: '600' },
  chipTextPaid: { color: PAID_INK },
  chipTextDue: { color: theme.colors.danger },

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
  detailLink: { color: theme.colors.primary },
  aside: { width: 64, alignItems: 'flex-end', marginLeft: 12 },

  // The action, across the foot of the card
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  footerText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

  // Skeleton — boxes the height of the text they stand in for
  skSub: { marginTop: 5 },
  skLine: { marginVertical: 2.5 },
  skValue: { flex: 1, alignItems: 'flex-end', marginLeft: 16 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import type { Installment, InstallmentStatus, MonthRow, PaymentRow } from '../../api/feeApi';

/**
 * The pieces the fee screens share. Money reads as a document: the figure that
 * matters large, then plain rows. The only colour is what needs paying — an
 * overdue installment, a pending month, a penalty — and the one Pay button.
 */

export const inr = (n: number) =>
  `₹ ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const capitalise = (v?: string | null) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '');

// ── Buttons ──────────────────────────────────────────────────────────────────
export const PayButton = ({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) => (
  <TouchableOpacity
    style={[s.payBtn, (disabled || busy) && s.payBtnIdle]}
    onPress={onPress}
    disabled={disabled || busy}
    activeOpacity={0.85}
  >
    {busy ? (
      <ActivityIndicator size="small" color={theme.colors.white} />
    ) : (
      <Text style={s.payText}>{label}</Text>
    )}
  </TouchableOpacity>
);

// The pay action for the PhonePe flow: Pay, and once PhonePe has been opened, a
// way to come back and check whether it went through.
export const PayAction = ({
  phase,
  value,
  onPay,
  onCheck,
}: {
  phase: string;
  value: number;
  onPay: () => void;
  onCheck: () => void;
}) => {
  const busy = phase === 'initiating' || phase === 'checking';
  return (
    <View style={s.payAction}>
      {phase === 'awaiting' ? (
        <PayButton label="I have paid — check status" onPress={onCheck} />
      ) : (
        <PayButton
          label={busy ? 'Please wait…' : `Pay ${inr(value)}`}
          busy={busy}
          disabled={value <= 0}
          onPress={onPay}
        />
      )}
    </View>
  );
};

// ── Amount entry ─────────────────────────────────────────────────────────────
export const AmountField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <View style={s.amountField}>
    <Text style={s.currency}>₹</Text>
    <TextInput
      style={s.amountInput}
      value={value}
      onChangeText={t => onChange(t.replace(/[^0-9.]/g, ''))}
      keyboardType="numeric"
      placeholder="0"
      placeholderTextColor={theme.colors.textMuted}
    />
  </View>
);

// ── Rows ─────────────────────────────────────────────────────────────────────
// A label and an amount; the last row of a sum is set a little heavier.
export const AmountRows = ({
  rows,
}: {
  rows: { label: string; value: string; danger?: boolean; total?: boolean }[];
}) => (
  <View>
    {rows.map((r, i) => (
      <View key={`${r.label}-${i}`} style={[s.amountRow, i < rows.length - 1 && s.rowDivider]}>
        <Text style={[s.amountLabel, r.total && s.amountLabelTotal]}>{r.label}</Text>
        <Text style={[s.amountValue, r.total && s.amountValueTotal, r.danger && s.danger]}>{r.value}</Text>
      </View>
    ))}
  </View>
);

//   RCPT-2026-0142                                     ₹ 12,000  [↓]
//   Academic · UPI · 12 Sep 2026
// The icon after the amount opens the receipt, where the school issues one.
export const ReceiptRow = ({
  p,
  showType,
  onOpen,
  isLast,
}: {
  p: PaymentRow;
  showType?: boolean;
  onOpen?: () => void;
  isLast: boolean;
}) => (
  <View style={[s.row, !isLast && s.rowDivider]}>
    <View style={s.rowBody}>
      <Text style={s.rowTitle} numberOfLines={1}>
        {p.receipt_number}
      </Text>
      <Text style={s.rowMeta} numberOfLines={1}>
        {[
          showType ? (p.fee_type === 'transport' ? 'Transport' : 'Academic') : null,
          capitalise(p.payment_mode),
          p.payment_date,
          p.penalty_amount > 0 ? `incl. ${inr(p.penalty_amount)} penalty` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </View>
    <Text style={s.rowAmount}>{inr(p.amount)}</Text>
    {!!onOpen && (
      <TouchableOpacity style={s.receipt} onPress={onOpen} hitSlop={10} activeOpacity={0.6}>
        <VectorIcon iconSet="Ionicons" iconName="download-outline" size={18} color={theme.colors.primary} />
      </TouchableOpacity>
    )}
  </View>
);

const INSTALLMENT_LABEL: Record<InstallmentStatus, string> = {
  paid: 'Paid',
  partial: 'Partly paid',
  due: 'Due',
  overdue: 'Overdue',
};

//   Term 2                                              ₹ 12,000
//   Due 15 Oct · 3 days late · ₹ 60 penalty              OVERDUE  ›
export const InstallmentRow = ({
  item,
  onPay,
  isLast,
}: {
  item: Installment;
  onPay: (i: Installment) => void;
  isLast: boolean;
}) => {
  const paid = item.status === 'paid';
  const overdue = item.status === 'overdue';
  const canPay = !paid && item.payable > 0;

  const meta = [
    item.due_date ? `Due ${item.due_date}` : null,
    !paid && item.days_overdue > 0
      ? `${item.days_overdue} ${item.days_overdue === 1 ? 'day' : 'days'} late`
      : null,
    item.penalty > 0 ? `${inr(item.penalty)} penalty` : null,
    !paid && item.paid > 0 ? `${inr(item.paid)} paid` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const body = (
    <>
      <View style={s.rowBody}>
        <Text style={[s.rowTitle, paid && s.muted]}>{item.label}</Text>
        {!!meta && <Text style={[s.rowMeta, overdue && s.danger]}>{meta}</Text>}
      </View>
      <View style={s.rowRight}>
        <Text style={[s.rowAmount, paid && s.muted]}>{inr(paid ? item.amount : item.payable)}</Text>
        <Text style={[s.status, overdue && s.danger, item.status === 'due' && s.accent]}>
          {INSTALLMENT_LABEL[item.status].toUpperCase()}
        </Text>
      </View>
      {canPay && (
        <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
      )}
    </>
  );

  const style = [s.row, !isLast && s.rowDivider];
  return canPay ? (
    <TouchableOpacity style={style} activeOpacity={0.6} onPress={() => onPay(item)}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={style}>{body}</View>
  );
};

const MONTH_LABEL: Record<string, string> = {
  paid: 'Paid',
  partial: 'Partly paid',
  pending: 'Pending',
  no_transport: '—',
};

//   September                         ₹ 1,200            Pending
export const MonthLine = ({ m, isLast }: { m: MonthRow; isLast: boolean }) => (
  <View style={[s.monthRow, !isLast && s.rowDivider]}>
    <Text style={[s.monthName, m.status === 'no_transport' && s.muted]}>{m.month}</Text>
    <Text style={s.monthAmount}>
      {m.status === 'no_transport' ? '—' : inr(m.status === 'paid' ? m.amount : m.outstanding)}
    </Text>
    <Text
      style={[
        s.monthStatus,
        m.status === 'pending' && s.monthStatusDue,
        m.status === 'partial' && s.monthStatusPartial,
      ]}
    >
      {MONTH_LABEL[m.status] ?? '—'}
    </Text>
  </View>
);

export const Note = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.note}>{children}</Text>
);

// ── Loading ──────────────────────────────────────────────────────────────────
export const FeeSkeleton = () => (
  <View style={s.loading}>
    <Skeleton width="35%" height={11} />
    <Skeleton width="55%" height={34} />
    <Skeleton width="65%" height={13} />
    <Skeleton width="100%" height={4} />
    <View style={s.loadingRows}>
      {[0, 1, 2, 3].map(i => (
        <Skeleton key={i} width="100%" height={14} />
      ))}
    </View>
  </View>
);

const __mk_s = () => StyleSheet.create({
  danger: { color: theme.colors.danger },
  accent: { color: theme.colors.primary },
  muted: { color: theme.colors.textMuted },

  // Pay
  payAction: { marginTop: 18 },
  payBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnIdle: { opacity: 0.5 },
  payText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },

  // Amount entry
  amountField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 6,
  },
  currency: { fontSize: 28, fontWeight: '600', color: theme.colors.textSecondary },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },

  // Rows
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowMeta: { fontSize: 12, color: theme.colors.textMuted },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  receipt: { marginLeft: 2, padding: 2 },
  rowAmount: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  status: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },

  amountRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  amountLabel: { flex: 1, fontSize: 14, color: theme.colors.textSecondary },
  amountLabelTotal: { color: theme.colors.textPrimary, fontWeight: '500' },
  amountValue: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  amountValueTotal: { fontWeight: '700' },

  monthRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  monthName: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  monthAmount: { width: 96, textAlign: 'right', fontSize: 14, color: theme.colors.textSecondary },
  monthStatus: { width: 88, textAlign: 'right', fontSize: 13, color: theme.colors.textMuted },
  monthStatusDue: { color: theme.colors.danger, fontWeight: '500' },
  monthStatusPartial: { color: theme.colors.textPrimary, fontWeight: '500' },

  note: { fontSize: 13, color: theme.colors.textMuted, paddingVertical: 12 },

  // Loading
  loading: { paddingHorizontal: 20, paddingTop: 24, gap: 10 },
  loadingRows: { marginTop: 24, gap: 16 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

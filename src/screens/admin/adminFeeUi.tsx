import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { FeeClass, QrStatus, adminFeeReceiptUrl, getFeeLookups } from '../../api/adminFeeApi';
import { adminTransportReceiptUrl } from '../../api/adminTransportApi';
import { OptionSheet } from './adminFormUi';
import { DropPill } from './adminTransportUi';

/**
 * What the admin Fees pages share: the classes to filter by, a payment as a
 * row with its receipt after the amount (as the student's Fees draws one), and
 * how a QR payment's status reads.
 */

export const TITLE = 'Fees';

export { inr } from '../fees/feesUi';

// ── Classes and their sections ──────────────────────────────────────────────
// Loaded by each page rather than kept for the session: another account on
// the phone is another school, with its own classes.
export const useFeeClasses = () => {
  const [classes, setClasses] = useState<FeeClass[]>([]);
  useEffect(() => {
    let live = true;
    getFeeLookups()
      .then(d => {
        if (live) setClasses(d.classes ?? []);
      })
      .catch(() => {
        // The pills stay empty; the lists still load without a class.
      });
    return () => {
      live = false;
    };
  }, []);
  return classes;
};

/**
 * "Class ▾" and "Section ▾", each opening its list. The section waits for a
 * class, and picking another class clears it — as the panel's filter band does.
 */
export const ClassPills = ({
  classes,
  classId,
  sectionId,
  onChange,
  allLabel = 'All classes',
  children,
}: {
  classes: FeeClass[];
  classId: number | null;
  sectionId: number | null;
  onChange: (classId: number | null, sectionId: number | null) => void;
  allLabel?: string;
  children?: React.ReactNode;
}) => {
  const [sheet, setSheet] = useState<null | 'class' | 'section'>(null);
  const cls = classes.find(c => c.id === classId) ?? null;
  const sec = cls?.sections.find(x => x.id === sectionId) ?? null;

  return (
    <>
      <DropPill label={cls ? cls.name : allLabel} active={!!cls} onPress={() => setSheet('class')} />
      {!!cls && cls.sections.length > 0 && (
        <DropPill label={sec ? `Section ${sec.name}` : 'All sections'} active={!!sec} onPress={() => setSheet('section')} />
      )}
      {children}
      <OptionSheet
        visible={sheet === 'class'}
        title="Class"
        options={[{ key: '', label: allLabel }, ...classes.map(c => ({ key: String(c.id), label: c.name }))]}
        selected={[cls ? String(cls.id) : '']}
        onPick={k => {
          setSheet(null);
          onChange(k ? Number(k) : null, null);
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'section'}
        title="Section"
        options={[{ key: '', label: 'All sections' }, ...(cls?.sections ?? []).map(x => ({ key: String(x.id), label: `Section ${x.name}` }))]}
        selected={[sec ? String(sec.id) : '']}
        onPick={k => {
          setSheet(null);
          onChange(classId, k ? Number(k) : null);
        }}
        onClose={() => setSheet(null)}
      />
    </>
  );
};

// ── Receipts ─────────────────────────────────────────────────────────────────
/** The sheet the school issues for a payment — academic or transport — in the receipt viewer. */
export const openFeeReceipt = (
  navigation: any,
  p: { id: number; kind: 'academic' | 'transport'; receipt_number?: string | null },
) => {
  const transport = p.kind === 'transport';
  navigation.navigate('TransportReceipt', {
    payment: { id: p.id, receipt_number: p.receipt_number ?? String(p.id) },
    url: transport ? adminTransportReceiptUrl(p.id) : adminFeeReceiptUrl(p.id),
    namePrefix: transport ? 'Transport-Receipt' : 'Fee-Receipt',
  });
};

//   Aarav Sharma                                       ₹ 4,000  [↓]
//   Academic · Cash · 12 Sep 2026 · by Head
export const PaymentLine = ({
  title,
  meta,
  amount,
  onReceipt,
  onPress,
  muted,
  isLast,
}: {
  title: string;
  meta?: string | null;
  amount: string;
  onReceipt?: () => void;
  onPress?: () => void;
  muted?: boolean;
  isLast: boolean;
}) => {
  const body = (
    <>
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
        {!!meta && (
          <Text style={s.meta} numberOfLines={2}>
            {meta}
          </Text>
        )}
      </View>
      <Text style={[s.amount, muted && s.muted]}>{amount}</Text>
      {!!onReceipt && (
        <TouchableOpacity style={s.receipt} onPress={onReceipt} hitSlop={10} activeOpacity={0.6}>
          <VectorIcon iconSet="Ionicons" iconName="download-outline" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      )}
    </>
  );
  const style = [s.row, !isLast && s.divider];
  return onPress ? (
    <TouchableOpacity style={style} activeOpacity={0.6} onPress={onPress}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={style}>{body}</View>
  );
};

// ── QR payments ──────────────────────────────────────────────────────────────
export const QR_STATUS: Record<QrStatus, { text: string; tone: 'accent' | 'good' | 'bad' }> = {
  pending: { text: 'To check', tone: 'accent' },
  approved: { text: 'Approved', tone: 'good' },
  rejected: { text: 'Rejected', tone: 'bad' },
};

const __mk_s = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 12, color: theme.colors.textMuted },
  amount: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  muted: { color: theme.colors.textMuted },
  receipt: { marginLeft: 2, padding: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

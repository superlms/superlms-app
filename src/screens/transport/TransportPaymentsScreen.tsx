import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { SkeletonIcon } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { Words } from '../exam/examUi';
import { plural } from '../subjects/subjectsUi';
import type { TransportPayment } from '../../api/transportApi';
import { TransportState, feeYear, formatINR, useMyTransport } from './transportUi';

/**
 * Payments: every transport fee payment the school has recorded, newest last,
 * as plain rows — the amount, the day it was paid, how it was paid and its
 * receipt number. A row opens that payment's receipt (TransportReceipt).
 *
 * A load — the first, a pull to refresh, Try again — draws the page as a
 * skeleton from the route this phone kept, or an ordinary one.
 */

const TITLE = 'Payments';

// "12 Mar 2026 · Thursday"
const paidOn = (p: TransportPayment) => [p.date, p.day].filter(Boolean).join(' · ') || '—';

// "UPI · Receipt TR-0012"
const paidHow = (p: TransportPayment) =>
  [p.mode, p.receipt_number ? `Receipt ${p.receipt_number}` : null].filter(Boolean).join(' · ');

const TransportPaymentsScreen = ({ navigation }: any) => {
  const { drawn, loading, notUsing, error, blocked, reload } = useMyTransport();

  if (blocked || !drawn) {
    return (
      <TransportState
        title={TITLE}
        notUsing={notUsing}
        error={error}
        onBack={() => navigation.goBack()}
        onRetry={reload}
      />
    );
  }

  const skeleton = loading;
  const year = feeYear(drawn);
  const payments = [...(drawn.fees?.payments ?? [])].sort((a, b) => a.serial - b.serial);

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, payments.length === 0 && s.grow]}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {payments.length === 0 ? (
          <DocNoData
            icon="receipt-outline"
            title="No payments yet"
            subtitle="Transport fee payments will appear here, each with its receipt."
            skeleton={skeleton}
          />
        ) : (
          <>
            <Words skeleton={skeleton} style={s.count}>
              {plural(payments.length, 'payment')} · {formatINR(year.paid)} paid
            </Words>
            {payments.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                style={[s.row, i < payments.length - 1 && s.rowDivider]}
                activeOpacity={0.6}
                disabled={skeleton}
                onPress={() => navigation.navigate('TransportReceipt', { payment: p })}
              >
                <View style={s.body}>
                  <Words skeleton={skeleton} style={s.amount}>
                    {formatINR(p.amount)}
                  </Words>
                  <Words skeleton={skeleton} style={s.meta} numberOfLines={1}>
                    {paidOn(p)}
                  </Words>
                  <Words skeleton={skeleton} style={s.meta} numberOfLines={1}>
                    {paidHow(p)}
                  </Words>
                </View>
                <Words skeleton={skeleton} style={s.receipt}>
                  Receipt
                </Words>
                {skeleton ? (
                  <SkeletonIcon iconName="chevron-forward" size={13} />
                ) : (
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="chevron-forward"
                    size={13}
                    color={theme.colors.textMuted}
                  />
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default TransportPaymentsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  grow: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 2 },

  // One payment
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 3 },
  amount: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  receipt: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

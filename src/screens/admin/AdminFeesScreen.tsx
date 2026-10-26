import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { Skeleton, SkeletonIcon, SkeletonText } from '../../components/Skeleton';
import { useFocusLoad, useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { FeeAnalytics, getFeeAnalytics, getQrRequests } from '../../api/adminFeeApi';
import { DocHeader } from '../more/docUi';
import { ListCount } from './adminStudentsUi';
import { TITLE } from './adminFeeUi';
import { rupees0 } from './feeSetupUi';

/**
 * Fees — the panel's Fee page, its sections drawn as the Students list draws
 * the classes: a count, then a plain row for each section in the panel's own
 * order — Fee Structure, View & Submit Fee, Analytics, Payments, Penalties,
 * Fee Cycle, Concession, QR Payments and Accounts user — each with a small
 * tile, its name and what it holds, and the QR payments waiting to be checked
 * beside QR Payments. A row opens that section, laid out as the panel lays it
 * out.
 */

interface FeeSection {
  key: string;
  icon: string;
  title: string;
  meta: string;
  route: string;
}

// The panel's $feeTabs, in its order, each with its own line.
const SECTIONS: FeeSection[] = [
  { key: 'fee_structure', icon: 'clipboard-outline', title: 'Fee Structure', meta: 'Class-wise fee heads & amounts', route: 'AdminFeeStructure' },
  { key: 'view_fee', icon: 'document-text-outline', title: 'View & Submit Fee', meta: 'A student’s fee ledger — collect fee from it', route: 'AdminFeeStudents' },
  { key: 'analytics', icon: 'bar-chart-outline', title: 'Analytics', meta: 'Collections & dues overview', route: 'AdminFeeAnalytics' },
  { key: 'payments', icon: 'receipt-outline', title: 'Payments', meta: 'All recorded fee payments', route: 'AdminFeePayments' },
  { key: 'penalties', icon: 'warning-outline', title: 'Penalties', meta: 'Late-fee penalties', route: 'AdminFeePenalties' },
  { key: 'cycle', icon: 'repeat-outline', title: 'Fee Cycle', meta: 'Installments & due dates', route: 'AdminFeeCycle' },
  { key: 'concession', icon: 'pricetag-outline', title: 'Concession', meta: 'Discounts & waivers', route: 'AdminFeeConcessions' },
  { key: 'qr_payments', icon: 'qr-code-outline', title: 'QR Payments', meta: 'Check payments · your QR & UPI ID', route: 'AdminFeeQr' },
  { key: 'account_users', icon: 'people-outline', title: 'Accounts user', meta: 'Cashier / account logins', route: 'AdminFeeAccountUsers' },
];

//   [▣]  QR Payments                                  3 to check  >
//        Check payments · your QR & UPI ID
const SectionRow = ({
  item,
  badge,
  isLast,
  skeleton,
  onPress,
}: {
  item: FeeSection;
  badge?: number;
  isLast: boolean;
  skeleton?: boolean;
  onPress: () => void;
}) =>
  skeleton ? (
    <View style={[s.row, !isLast && s.rowDivider]}>
      <Skeleton width={30} height={30} radius={6} />
      <View style={s.body}>
        <SkeletonText style={s.name} numberOfLines={1}>{item.title}</SkeletonText>
        <SkeletonText style={s.meta} numberOfLines={1}>{item.meta}</SkeletonText>
      </View>
      <SkeletonIcon iconName="chevron-forward" size={13} />
    </View>
  ) : (
    <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onPress}>
      <View style={s.tile}>
        <VectorIcon iconSet="Ionicons" iconName={item.icon} size={17} color={theme.colors.primary} />
      </View>
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{item.title}</Text>
        <Text style={s.meta} numberOfLines={1}>{item.meta}</Text>
      </View>
      {!!badge && badge > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge > 99 ? '99+' : badge} to check</Text>
        </View>
      )}
      <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );

const AdminFeesScreen = ({ navigation }: any) => {
  const [summary, setSummary] = useState<FeeAnalytics['summary'] | null>(null);
  const [qrPending, setQrPending] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // The figures over the list are a help, not the page: a section opens
  // whether or not they came.
  const load = useCallback(async () => {
    const [a, q] = await Promise.all([
      getFeeAnalytics().catch(() => null),
      getQrRequests({ status: 'pending' }).catch(() => null),
    ]);
    if (a) setSummary(a.summary);
    if (q) setQrPending(q.stats.pending ?? 0);
    setLoaded(true);
  }, []);

  useFocusLoad(load);
  const { refreshing, onRefresh } = useRefresh(load);

  const count = summary
    ? `${rupees0(summary.total_collected)} collected · ${rupees0(summary.total_due)} due`
    : `${SECTIONS.length} sections`;

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />
      <FlatList
        data={SECTIONS}
        keyExtractor={it => it.key}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={<ListCount skeleton={!loaded} text={count} />}
        renderItem={({ item, index }) => (
          <SectionRow
            item={item}
            badge={item.key === 'qr_payments' ? qrPending : 0}
            isLast={index === SECTIONS.length - 1}
            onPress={() => navigation.navigate(item.route)}
          />
        )}
      />
    </View>
  );
};

export default AdminFeesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tile: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
  },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#F59E0B' + '22' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#B45309' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { SkeletonIcon } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { Words } from '../exam/examUi';
import { plural } from '../subjects/subjectsUi';
import {
  TITLE,
  TransportState,
  clock,
  feeYear,
  formatINR,
  useMyTransport,
} from './transportUi';

/**
 * The "Transport" hub — the way into the student's bus, one plain row each, as
 * the Exams hub is laid out. Each row says where things stand: the route and
 * who drives it, the fee year so far, and what has been paid.
 *
 * A load — the first, a pull to refresh, Try again — draws the rows as a
 * skeleton from the route this phone kept, or an ordinary one. A student who
 * isn't on a route is told so instead.
 */

const TransportScreen = ({ navigation }: any) => {
  const { drawn, loading, notUsing, error, blocked, reload } = useMyTransport();

  if (blocked) {
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
  const data = drawn;
  const year = data ? feeYear(data) : null;
  const payments = data?.fees?.payments ?? [];
  const pickup = clock(data?.pickup_time);

  const entries = [
    {
      title: 'My Route',
      sub: [data?.route_name, pickup ? `Pickup ${pickup}` : null].filter(Boolean).join(' · ') || 'Your route, stops and driver',
      icon: 'bus-outline',
      route: 'TransportRoute',
    },
    {
      title: 'Transport Fees',
      sub: !year
        ? 'Month by month, and what is left'
        : year.due > 0
        ? `${formatINR(year.due)} due · ${formatINR(year.monthly)} a month`
        : `No dues · ${formatINR(year.monthly)} a month`,
      icon: 'wallet-outline',
      route: 'TransportFees',
    },
    {
      title: 'Payments',
      sub:
        payments.length > 0
          ? `${plural(payments.length, 'payment')} · ${formatINR(year?.paid ?? 0)} paid`
          : 'Your payments, each with its receipt',
      icon: 'receipt-outline',
      route: 'TransportPaymentsList',
    },
  ];

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {entries.map((item, i) => (
          <TouchableOpacity
            key={item.title}
            style={s.row}
            activeOpacity={0.6}
            disabled={skeleton}
            onPress={() => navigation.navigate(item.route)}
          >
            <View style={s.rowIcon}>
              {skeleton ? (
                <SkeletonIcon iconName={item.icon} size={20} />
              ) : (
                <VectorIcon iconSet="Ionicons" iconName={item.icon} size={20} color={theme.colors.textSecondary} />
              )}
            </View>
            <View style={[s.rowMain, i < entries.length - 1 && s.rowDivider]}>
              <View style={s.rowText}>
                <Words skeleton={skeleton} style={s.rowTitle}>
                  {item.title}
                </Words>
                <Words skeleton={skeleton} style={s.rowSub} numberOfLines={1}>
                  {item.sub}
                </Words>
              </View>
              {skeleton ? (
                <SkeletonIcon iconName="chevron-forward" size={16} />
              ) : (
                <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default TransportScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingTop: 4, paddingBottom: 40 },

  // Entries — plain icon, title and line, with an inset hairline
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 20 },
  rowIcon: { width: 22, alignItems: 'center' },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingRight: 20,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

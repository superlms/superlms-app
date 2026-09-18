import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { SkeletonIcon } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { TransportStats, getTransportStats } from '../../api/adminTransportApi';
import { DocHeader } from '../more/docUi';
import { Words } from '../exam/examUi';
import { TITLE, formatINR } from './adminTransportUi';

/**
 * Transportation, laid out as a student's Transport hub is: one plain row for
 * each of the admin panel's tabs — Routes, Drivers, Transport Students and Fee
 * Summary — each saying where things stand with the panel's figures (active
 * routes and drivers, students on the buses, the monthly fees they bring).
 *
 * A load — the first, or a pull to refresh — draws the rows as a skeleton from
 * the figures this phone kept.
 */

const SAMPLE: TransportStats = { drivers: 4, routes: 6, students: 120, monthly_revenue: 144000 };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

const AdminTransportScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState<TransportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [last, rememberLast] = useLastLoaded<TransportStats>('admin:transport-stats');

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      try {
        const next = await getTransportStats();
        setStats(next);
        rememberLast(next);
      } catch {
        // The rows still open their pages; the figures just stay as they were.
      } finally {
        setLoading(false);
      }
    },
    [rememberLast],
  );

  useFocusLoad(() => load());

  const skeleton = loading && !stats;
  const data = stats ?? last ?? SAMPLE;

  const entries = [
    {
      title: 'Routes',
      sub: `${plural(data.routes, 'active route')} · earliest pickup first`,
      icon: 'bus-outline',
      route: 'AdminTransportRoutes',
    },
    {
      title: 'Drivers',
      sub: `${plural(data.drivers, 'active driver')} · their routes and vehicles`,
      icon: 'person-outline',
      route: 'AdminTransportDrivers',
    },
    {
      title: 'Transport Students',
      sub: `${plural(data.students, 'student')} on the routes · months billed`,
      icon: 'people-outline',
      route: 'AdminTransportStudents',
    },
    {
      title: 'Fee Summary',
      sub: `${formatINR(data.monthly_revenue)} a month · receipts`,
      icon: 'wallet-outline',
      route: 'AdminTransportFees',
    },
  ];

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={() => load(true)} />}
      >
        {entries.map((item, i) => (
          <TouchableOpacity
            key={item.title}
            style={s.row}
            activeOpacity={0.6}
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

export default AdminTransportScreen;

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

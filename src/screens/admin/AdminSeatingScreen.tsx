import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { SeatingOverview, getSeatingOverview } from '../../api/adminSeatingApi';
import { plural } from './adminSeatingUi';

/**
 * Seating Plan — the panel's three tabs (Seating Plans, Rooms, Datesheet) as
 * three plain rows, the way the Exams hub lists its pages, each with the count
 * the panel's header shows. A row opens its tab.
 */

const ENTRIES: { key: keyof SeatingOverview; title: string; icon: string; route: string; count: (n: number) => string }[] = [
  { key: 'plans', title: 'Seating Plans', icon: 'grid-outline', route: 'AdminSeatingPlans', count: n => `${plural(n, 'plan')} generated` },
  { key: 'rooms', title: 'Rooms', icon: 'business-outline', route: 'AdminSeatingRooms', count: n => `${plural(n, 'room')} configured` },
  { key: 'datesheets', title: 'Datesheet', icon: 'calendar-outline', route: 'AdminSeatingDatesheet', count: n => plural(n, 'datesheet') },
];

const AdminSeatingScreen = ({ navigation }: any) => {
  const [counts, setCounts] = useState<SeatingOverview | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Back from a tab, the counts are fresh.
  const load = useCallback(async () => {
    try {
      setCounts(await getSeatingOverview());
    } catch {
      // the rows still open without their counts
    }
  }, []);

  useFocusLoad(load);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Seating Plan"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {ENTRIES.map((item, i) => {
          const n = counts?.[item.key];
          return (
            <TouchableOpacity
              key={item.key}
              style={s.row}
              activeOpacity={0.6}
              onPress={() => navigation.navigate(item.route)}
            >
              <View style={s.rowIcon}>
                <VectorIcon iconSet="Ionicons" iconName={item.icon} size={20} color={theme.colors.textSecondary} />
              </View>
              <View style={[s.rowMain, i < ENTRIES.length - 1 && s.rowDivider]}>
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>{item.title}</Text>
                  <Text style={s.rowSub} numberOfLines={1}>
                    {n == null ? ' ' : item.count(n)}
                  </Text>
                </View>
                <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default AdminSeatingScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingTop: 4, paddingBottom: 40 },

  // Entries — plain icon, title and line, with an inset hairline (as the Exams hub)
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

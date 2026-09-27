import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { TcStatistics, TcTab, getTcStats } from '../../api/adminTcCertificateApi';

/**
 * TC & Certificate — the panel's three tabs as three plain rows, the way the
 * Exams hub lists its pages, each saying how many have been issued. A row opens
 * the students it has been issued to.
 */

const ENTRIES: { tab: TcTab; title: string; icon: string; one: string; many: string }[] = [
  { tab: 'achievement', title: 'Achievement', icon: 'trophy-outline', one: 'certificate', many: 'certificates' },
  { tab: 'participation', title: 'Participation', icon: 'ribbon-outline', one: 'certificate', many: 'certificates' },
  { tab: 'tc', title: 'Transfer Certificate', icon: 'document-text-outline', one: 'TC', many: 'TCs' },
];

const AdminTcHubScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState<TcStatistics | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Back from a list (issued, edited or deleted), the counts are fresh.
  const load = useCallback(async () => {
    try {
      const r = await getTcStats({ tab: 'achievement' });
      setStats(r.statistics);
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
        title="TC & Certificate"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {ENTRIES.map((item, i) => {
          const n = stats?.[item.tab];
          const sub = n == null ? ' ' : `${n} ${n === 1 ? item.one : item.many} issued`;
          return (
            <TouchableOpacity
              key={item.tab}
              style={s.row}
              activeOpacity={0.6}
              onPress={() => navigation.navigate('AdminTcList', { tab: item.tab })}
            >
              <View style={s.rowIcon}>
                <VectorIcon iconSet="Ionicons" iconName={item.icon} size={20} color={theme.colors.textSecondary} />
              </View>
              <View style={[s.rowMain, i < ENTRIES.length - 1 && s.rowDivider]}>
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>{item.title}</Text>
                  <Text style={s.rowSub} numberOfLines={1}>{sub}</Text>
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

export default AdminTcHubScreen;

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

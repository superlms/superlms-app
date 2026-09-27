import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { HomeworkStats, getHomeworkStats } from '../../api/adminHomeworkApi';

/**
 * Homework — the panel's two tabs as two plain rows, the way the Exams and TC
 * hubs list their pages: Homework (the school's homework, with the panel's
 * counts — in all, this week, teachers, classes) and Homework Status (who has
 * marked theirs done). A row opens its page.
 */

const AdminHomeworkHubScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState<HomeworkStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Back from the list (added, edited or deleted), the counts are fresh.
  const load = useCallback(async () => {
    try {
      setStats(await getHomeworkStats());
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

  const entries = [
    {
      key: 'list',
      route: 'AdminHomeworkList',
      title: 'Homework',
      icon: 'book-outline',
      // The panel's Total · This Week · Teachers · Classes
      sub: stats
        ? `${stats.total} in all · ${stats.this_week} this week · ${stats.by_teacher} ${stats.by_teacher === 1 ? 'teacher' : 'teachers'} · ${stats.by_class} ${stats.by_class === 1 ? 'class' : 'classes'}`
        : ' ',
    },
    {
      key: 'status',
      route: 'AdminHomeworkStatus',
      title: 'Homework Status',
      icon: 'checkmark-done-outline',
      sub: 'Who has marked their homework done',
    },
  ];

  return (
    <View style={s.root}>
      <DocHeader
        title="Homework"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {entries.map((item, i) => (
          <TouchableOpacity key={item.key} style={s.row} activeOpacity={0.6} onPress={() => navigation.navigate(item.route)}>
            <View style={s.rowIcon}>
              <VectorIcon iconSet="Ionicons" iconName={item.icon} size={20} color={theme.colors.textSecondary} />
            </View>
            <View style={[s.rowMain, i < entries.length - 1 && s.rowDivider]}>
              <View style={s.rowText}>
                <Text style={s.rowTitle}>{item.title}</Text>
                <Text style={s.rowSub} numberOfLines={2}>{item.sub}</Text>
              </View>
              <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default AdminHomeworkHubScreen;

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

import React, { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { BookClass, BookStats, getBookOverview } from '../../api/adminBookApi';
import { GroupRow, ListSkeleton, plural } from './adminStudentsUi';

/**
 * Books — the school's classes, drawn as the admin app's Students list is: the
 * panel's counts (books, active, inactive, with a PDF), then a row per class
 * with its sections and how many books it holds. A class opens onto its
 * sections — or, with none, straight onto its subjects.
 */

const AdminBookClassesScreen = ({ navigation }: any) => {
  const [classes, setClasses] = useState<BookClass[] | null>(null);
  const [stats, setStats] = useState<BookStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getBookOverview();
      if (mine !== seq.current) return;
      setClasses(r.classes);
      setStats(r.stats);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the classes.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, []);

  // Back from adding, editing or deleting a book, the counts are fresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = classes ?? [];

  const open = (c: BookClass) =>
    c.sections.length === 0
      ? navigation.navigate('AdminBookSubjects', { classId: c.id, className: c.name, sectionId: null, sectionName: null })
      : navigation.navigate('AdminBookSections', { classItem: c });

  const metaOf = (c: BookClass) =>
    [
      c.sections.length === 0 ? 'No sections' : c.sections.length === 1 ? `Section ${c.sections[0].name}` : plural(c.sections.length, 'section'),
      c.books > 0 ? plural(c.books, 'book') : 'No books yet',
    ].join(' · ');

  return (
    <View style={s.root}>
      <DocHeader
        title="Books"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

      {!classes && !error ? (
        <ListSkeleton />
      ) : error && !classes ? (
        <View style={s.centered}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={[s.list, list.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            list.length > 0 && stats ? (
              <Text style={s.count}>
                {/* The panel's Total · Active · Inactive · With PDF */}
                {`${plural(stats.total, 'book')} · ${stats.active} active · ${stats.inactive} inactive · ${stats.with_pdf} with PDF`}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <DocNoData icon="school-outline" title="No classes yet" subtitle="Add the school’s classes under Standards first." />
          }
          renderItem={({ item, index }) => (
            <GroupRow
              icon="school-outline"
              title={item.name}
              meta={metaOf(item)}
              isLast={index === list.length - 1}
              onPress={() => open(item)}
            />
          )}
        />
      )}
    </View>
  );
};

export default AdminBookClassesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },
  centered: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

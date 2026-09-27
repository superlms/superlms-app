import React, { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { TtOverview, getTimetableOverview } from '../../api/adminTimetableApi';
import { GroupRow, ListSkeleton, plural } from './adminStudentsUi';

/**
 * One class's sections, drawn as the admin app's Students sections are: a count,
 * then a row per section saying whether it has a timetable and how many periods
 * a week it holds. A section opens onto its week.
 *
 * Route params: classItem — the class, with its sections, from the class list.
 */

type ClassItem = TtOverview['classes'][number];

const AdminTimetableSectionsScreen = ({ navigation, route }: any) => {
  const passed: ClassItem = route?.params?.classItem;

  const [item, setItem] = useState<ClassItem>(passed);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getTimetableOverview();
      const fresh = r.classes.find(c => c.id === passed.id);
      if (mine === seq.current && fresh) setItem(fresh);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the sections.'));
    } finally {
      if (mine === seq.current) {
        setLoaded(true);
        setRefreshing(false);
      }
    }
  }, [passed.id]);

  // Back from a section's week (added, edited or deleted), the rows are fresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = item?.sections ?? [];
  const made = list.filter(x => x.has_timetable).length;

  return (
    <View style={s.root}>
      <DocHeader
        title={item?.name ?? 'Sections'}
        onBackPress={() => navigation.goBack()}
      />

      {!item && !loaded ? (
        <ListSkeleton />
      ) : error && !item ? (
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
          keyExtractor={x => String(x.id)}
          contentContainerStyle={[s.list, list.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            list.length > 0 ? (
              <Text style={s.count}>{`${plural(list.length, 'section')} · ${made} with a timetable`}</Text>
            ) : null
          }
          ListEmptyComponent={
            <DocNoData icon="grid-outline" title="No sections in this class" subtitle="Add its sections under Standards first." />
          }
          renderItem={({ item: sec, index }) => (
            <GroupRow
              letter={sec.name.slice(0, 2).toUpperCase()}
              title={`Section ${sec.name}`}
              meta={sec.has_timetable ? `${plural(sec.entries, 'period')} a week` : 'No timetable yet'}
              isLast={index === list.length - 1}
              onPress={() =>
                navigation.navigate('AdminTimetableView', {
                  classId: item.id,
                  className: item.name,
                  sectionId: sec.id,
                  sectionName: sec.name,
                })
              }
            />
          )}
        />
      )}
    </View>
  );
};

export default AdminTimetableSectionsScreen;

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

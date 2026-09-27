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
import { HeadActions, HeadBtn } from './adminAdmitCardUi';

/**
 * Timetable — the school's classes, drawn as the admin app's Students list is:
 * the panel's counts (classes, sections, timetables made, sections remaining),
 * then a row per class with its sections and how many of them have a timetable.
 * A class of one section opens straight onto its week; a class of more opens
 * onto its sections first. The header's + adds a timetable — class and section
 * first, then the panel's rows — and the person opens the panel's Teacher View.
 */

type ClassItem = TtOverview['classes'][number];

const AdminTimetableClassesScreen = ({ navigation }: any) => {
  const [data, setData] = useState<TtOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getTimetableOverview();
      if (mine === seq.current) setData(r);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the classes.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, []);

  // Back from adding, editing or deleting a timetable, the counts are fresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const classes = data?.classes ?? [];
  const stats = data?.stats;

  // One section: its week at once. More (or none): the sections first.
  const open = (c: ClassItem) => {
    if (c.sections.length === 1) {
      const only = c.sections[0];
      navigation.navigate('AdminTimetableView', {
        classId: c.id,
        className: c.name,
        sectionId: only.id,
        sectionName: only.name,
      });
    } else {
      navigation.navigate('AdminTimetableSections', { classItem: c });
    }
  };

  const metaOf = (c: ClassItem) => {
    const secs = c.sections;
    if (secs.length === 0) return 'No sections';
    if (secs.length === 1) {
      return `Section ${secs[0].name} · ${secs[0].has_timetable ? 'Timetable added' : 'No timetable yet'}`;
    }
    const made = secs.filter(x => x.has_timetable).length;
    return `${plural(secs.length, 'section')} · ${made === 0 ? 'No timetable yet' : made === secs.length ? 'All have a timetable' : `${made} with a timetable`}`;
  };

  const body = () => {
    if (!data && !error) return <ListSkeleton />;

    if (error && !data) {
      return (
        <View style={s.centered}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={classes}
        keyExtractor={c => String(c.id)}
        contentContainerStyle={[s.list, classes.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          classes.length > 0 && stats ? (
            <Text style={s.count}>
              {/* The panel's Total Classes · Total Sections · Timetable Created · Remaining */}
              {`${plural(stats.classes, 'class', 'classes')} · ${plural(stats.sections, 'section')} · ${plural(stats.created, 'timetable')} · ${stats.remaining} remaining`}
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
            isLast={index === classes.length - 1}
            onPress={() => open(item)}
          />
        )}
      />
    );
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Timetable"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={
          <HeadActions>
            <HeadBtn icon="person-outline" onPress={() => navigation.navigate('AdminTimetableTeachers')} />
            <HeadBtn icon="add" onPress={() => navigation.navigate('AdminTimetableForm')} />
          </HeadActions>
        }
      />

      {body()}
    </View>
  );
};

export default AdminTimetableClassesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },

  // Error
  centered: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

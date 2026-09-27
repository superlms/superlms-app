import React, { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { TtOverview, getTimetableOverview } from '../../api/adminTimetableApi';
import { ListSkeleton, plural } from './adminStudentsUi';
import { TeacherAvatar } from './adminTeachersUi';

/**
 * The panel's Teacher View — the school's active teachers, A to Z, each with
 * how many periods a week the timetable gives them. A teacher opens onto their
 * week.
 */

type Teacher = NonNullable<TtOverview['teachers']>[number];

const AdminTimetableTeachersScreen = ({ navigation }: any) => {
  const [list, setList] = useState<Teacher[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getTimetableOverview();
      if (mine === seq.current) setList(r.teachers ?? []);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the teachers.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rows = list ?? [];
  const scheduled = rows.filter(t => t.periods > 0).length;

  return (
    <View style={s.root}>
      <DocHeader title="Teacher View" onBackPress={() => navigation.goBack()} />

      {!list && !error ? (
        <ListSkeleton photo />
      ) : error && !list ? (
        <View style={s.centered}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={t => String(t.id)}
          contentContainerStyle={[s.list, rows.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            rows.length > 0 ? (
              <Text style={s.count}>{`${plural(rows.length, 'teacher')} · ${scheduled} with periods`}</Text>
            ) : null
          }
          ListEmptyComponent={
            <DocNoData icon="person-outline" title="No teachers yet" subtitle="Active teachers show here." />
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[s.row, index < rows.length - 1 && s.rowDivider]}
              activeOpacity={0.6}
              onPress={() => navigation.navigate('AdminTimetableTeacher', { teacherId: item.id, teacherName: item.name })}
            >
              <TeacherAvatar uri={item.image} name={item.name} />
              <View style={s.body}>
                <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                <Text style={s.meta} numberOfLines={1}>
                  {item.periods > 0 ? `${plural(item.periods, 'period')} a week` : 'No periods yet'}
                </Text>
              </View>
              <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

export default AdminTimetableTeachersScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },

  centered: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

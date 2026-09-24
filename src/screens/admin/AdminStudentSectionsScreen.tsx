import React, { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { StudentLookups, getStudentLookups } from '../../api/adminStudentApi';
import { GroupRow, ListSkeleton, plural } from './adminStudentsUi';

/**
 * One class's sections, for a class of more than one — as the student's
 * Subjects list is drawn: a count, then a row per section with how many
 * students it has. A section opens onto its students.
 */

const AdminStudentSectionsScreen = ({ navigation, route }: any) => {
  const classId: number = route?.params?.classId;
  const className: string = route?.params?.className ?? 'Class';

  const [sections, setSections] = useState<StudentLookups['sections'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getStudentLookups(classId);
      if (mine === seq.current) setSections(r.sections.filter(x => x.standard_id === classId));
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the sections.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [classId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = sections ?? [];
  const total = list.reduce((n, x) => n + (x.students ?? 0), 0);

  return (
    <View style={s.root}>
      <DocHeader title={className} onBackPress={() => navigation.goBack()} />

      {!sections && !error ? (
        <ListSkeleton rows={3} />
      ) : error && !sections ? (
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
            list.length > 0 ? <Text style={s.count}>{`${plural(list.length, 'section')} · ${plural(total, 'student')}`}</Text> : null
          }
          ListEmptyComponent={
            <DocNoData icon="grid-outline" title="No sections in this class" subtitle="Add its sections under Standards first." />
          }
          renderItem={({ item, index }) => (
            <GroupRow
              letter={item.name.slice(0, 2).toUpperCase()}
              title={`Section ${item.name}`}
              meta={item.students != null ? plural(item.students, 'student') : null}
              isLast={index === list.length - 1}
              onPress={() =>
                navigation.navigate('AdminStudentsList', { classId, className, sectionId: item.id, sectionName: item.name })
              }
            />
          )}
        />
      )}
    </View>
  );
};

export default AdminStudentSectionsScreen;

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

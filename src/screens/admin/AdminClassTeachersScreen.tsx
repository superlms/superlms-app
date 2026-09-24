import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ClassTeacherAssignment, getClassTeachers } from '../../api/adminAttendanceApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { Avatar, ErrorBox, ListSkeleton } from './adminTransportUi';

/**
 * Class Teachers — every teacher who is a class teacher, in class order: their
 * name, their username, and under it the class and section they have. + assigns
 * one; a row opens it to change or remove.
 */

const AdminClassTeachersScreen = ({ navigation }: any) => {
  const [list, setList] = useState<ClassTeacherAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getClassTeachers({ mode: 'by_class' });
      if (mine === seq.current) setList(r.assignments);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load class teachers.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Back from assigning or removing, the list is fresh.
  const loaded = useRef(false);
  useFocusLoad(() => {
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    load();
  });

  //  (photo)  Meera Sharma
  //           meera@tds
  //           Class 5 · A
  const renderRow = ({ item: a, index }: { item: ClassTeacherAssignment; index: number }) => (
    <TouchableOpacity
      style={[s.row, index < (list?.length ?? 0) - 1 && s.divider]}
      activeOpacity={0.6}
      onPress={() => navigation.navigate('AdminClassTeacherForm', { item: a })}
    >
      <Avatar uri={a.teacher_image} name={a.teacher_name} />
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{a.teacher_name}</Text>
        {!!a.teacher_username && <Text style={s.username} numberOfLines={1}>{a.teacher_username}</Text>}
        <Text style={s.cls} numberOfLines={1}>
          {a.section ? `${a.standard} · ${a.section}` : a.standard}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.root}>
      <DocHeader
        title="Class Teachers"
        onBackPress={() => navigation.goBack()}
        rightIcon="add"
        onRightPress={() => navigation.navigate('AdminClassTeacherForm')}
      />

      {error && !list ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !list ? (
        <ListSkeleton photo />
      ) : (
        <FlatList
          data={list}
          keyExtractor={a => String(a.id)}
          renderItem={renderRow}
          ListEmptyComponent={
            <View>
              <DocNoData icon="school-outline" title="No class teachers assigned" subtitle="Assign one with +." />
              <TouchableOpacity onPress={() => navigation.navigate('AdminClassTeacherForm')} hitSlop={10} style={s.assignLink}>
                <Text style={s.assignText}>Assign a class teacher</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default AdminClassTeachersScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingTop: 4, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 1 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  username: { fontSize: 12, color: theme.colors.textSecondary },
  cls: { fontSize: 12, color: theme.colors.textMuted },
  assignLink: { alignSelf: 'center', marginTop: -8 },
  assignText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

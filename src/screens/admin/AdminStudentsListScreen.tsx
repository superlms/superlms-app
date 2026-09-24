import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { StudentRow, getStudents } from '../../api/adminStudentApi';
import { ListSkeleton, StudentListRow, plural } from './adminStudentsUi';

/**
 * One section's students — a count, then a row per student with their photo,
 * their name, their admission number and their class and section, A to Z; a
 * search narrows them. A row opens Student Detail.
 */

const AdminStudentsListScreen = ({ navigation, route }: any) => {
  const classId: number = route?.params?.classId;
  const sectionId: number = route?.params?.sectionId;
  const title = [route?.params?.className, route?.params?.sectionName].filter(Boolean).join(' · ') || 'Students';

  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getStudents({
        class: classId,
        section: sectionId,
        search: search.trim() || undefined,
        sort: 'name_asc',
        per_page: 500,
      });
      if (mine === seq.current) setRows(r.students);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the students.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [classId, sectionId, search]);

  // Typing waits a moment before it asks.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Back from a student's page (edited, or deleted), the list is fresh.
  const loaded = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!loaded.current) {
        loaded.current = true;
        return;
      }
      load();
    }, [load]),
  );

  const list = rows ?? [];
  const active = list.filter(r => r.is_active).length;
  const countLine = search.trim()
    ? `${plural(list.length, 'student')} found`
    : `${plural(list.length, 'student')} · ${active} active`;

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />

      <View style={s.searchWrap}>
        <View style={s.searchRow}>
          <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search name, admission, roll, phone"
            placeholderTextColor={theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!rows && !error ? (
        <ListSkeleton photo />
      ) : error && !rows ? (
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
          keyExtractor={i => String(i.id)}
          contentContainerStyle={[s.list, list.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={list.length > 0 ? <Text style={s.count}>{countLine}</Text> : null}
          ListEmptyComponent={
            <DocNoData
              icon={search.trim() ? 'search-outline' : 'person-add-outline'}
              title={search.trim() ? 'No students found' : 'No students here yet'}
              subtitle={search.trim() ? 'Nothing in this section matches the search.' : 'Add students with + on the Students page.'}
            />
          }
          renderItem={({ item, index }) => (
            <StudentListRow
              student={item}
              onOpen={() => navigation.navigate('AdminStudentDetail', { id: item.id })}
              isLast={index === list.length - 1}
            />
          )}
        />
      )}
    </View>
  );
};

export default AdminStudentsListScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Search
  searchWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, padding: 0 },

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

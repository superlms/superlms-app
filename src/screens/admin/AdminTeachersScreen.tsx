import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { TeacherRow, TeacherStats, getTeachers } from '../../api/adminTeacherApi';
import { ListSkeleton, plural } from './adminStudentsUi';
import { TeacherListRow } from './adminTeachersUi';
import TeacherExportSheet from './TeacherExportSheet';

/**
 * Teachers — the panel's Teachers page, drawn as the Students lists are: a
 * search (name, email, employee ID, phone) in the Students tab's box, then a
 * count (and, as the panel's "This Year", how many joined this session) over a
 * row per teacher, newest first: the photo, the name, the username, employee
 * ID and mobile, and the class they are class teacher of. A row opens Teacher
 * Detail. The header holds Export — Excel or PDF, as the panel asks it — and
 * the + that adds one.
 */

const HeadBtn = ({ icon, onPress }: { icon: string; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} hitSlop={10} activeOpacity={0.6} style={s.headBtn}>
    <VectorIcon iconSet="Ionicons" iconName={icon} size={19} color={theme.colors.textPrimary} />
  </TouchableOpacity>
);

const AdminTeachersScreen = ({ navigation }: any) => {
  const [rows, setRows] = useState<TeacherRow[] | null>(null);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState('');

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getTeachers({
        search: search.trim() || undefined,
        // Every teacher at once — the list scrolls rather than pages.
        per_page: 1000,
      });
      if (mine === seq.current) {
        setRows(r.teachers);
        setStats(r.stats);
      }
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load teachers.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [search]);

  // Typing waits a moment before it asks, as the panel's search does.
  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Back from a teacher's page (added, edited or deleted), the list is fresh.
  // The latest load is held aside so typing does not count as coming back.
  const loadRef = useRef(load);
  loadRef.current = load;
  const loaded = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!loaded.current) {
        loaded.current = true;
        return;
      }
      loadRef.current();
    }, []),
  );

  const list = rows ?? [];
  const searching = !!search.trim();

  const countLine = searching
    ? `${plural(list.length, 'teacher')} found`
    : [plural(list.length, 'teacher'), stats?.this_year != null ? `${stats.this_year} joined this year` : null]
        .filter(Boolean)
        .join(' · ');

  const body = () => {
    if (!rows && !error) return <ListSkeleton photo />;

    if (error && !rows) {
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
        data={list}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={[s.list, list.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={list.length > 0 ? <Text style={s.count}>{countLine}</Text> : null}
        ListEmptyComponent={
          searching ? (
            <DocNoData icon="search-outline" title="No teachers found" subtitle="No teacher’s name, email, employee ID or phone matches the search." />
          ) : (
            <DocNoData icon="person-add-outline" title="No teachers yet" subtitle="Tap + to add the school’s first teacher." />
          )
        }
        renderItem={({ item, index }) => (
          <TeacherListRow
            teacher={item}
            onOpen={() => navigation.navigate('AdminTeacherDetail', { id: item.id })}
            isLast={index === list.length - 1}
          />
        )}
      />
    );
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Teachers"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={
          <View style={s.headActions}>
            <HeadBtn icon="download-outline" onPress={() => setExportOpen(true)} />
            <HeadBtn icon="add" onPress={() => navigation.navigate('AdminTeacherForm')} />
          </View>
        }
      />

      <View style={s.searchWrap}>
        <View style={s.searchRow}>
          <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search name, email, ID, phone"
            placeholderTextColor={theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {body()}

      <TeacherExportSheet visible={exportOpen} onClose={() => setExportOpen(false)} />
    </View>
  );
};

export default AdminTeachersScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Header actions
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  // Search — as the Students tab has it
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

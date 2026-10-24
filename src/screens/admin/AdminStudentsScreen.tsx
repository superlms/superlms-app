import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { StudentLookups, StudentRow, getStudentLookups, getStudents } from '../../api/adminStudentApi';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import {
  GroupRow,
  KeptClasses,
  ListCount,
  StudentListRow,
  plural,
  sampleClasses,
  sampleStudents,
} from './adminStudentsUi';
import StudentExportSheet from './StudentExportSheet';

/**
 * Students — the school's classes first, drawn as the student's Subjects list
 * is: a count, then a row per class with its sections and how many students it
 * has. A class of one section opens straight onto its students; a class of
 * more opens onto its sections first. The header holds Export — Excel or PDF,
 * every student or one class, as the panel asks it — and the + that adds a
 * student.
 *
 * A search over the classes looks through the whole school — name, mobile,
 * admission number, email — and while it holds text the students it finds
 * stand in for the classes, A to Z, more as the list scrolls; a row opens
 * Student Detail. Clearing it brings the classes back.
 *
 * The first load is drawn as a skeleton of the classes the page held the last
 * time it was opened on this phone — as many rows as the school has, each bar
 * as long as that class's name and counts; a search, as rows of students.
 */

const SEARCH_PAGE = 50;

const HeadBtn = ({ icon, onPress, busy }: { icon: string; onPress: () => void; busy?: boolean }) => (
  <TouchableOpacity onPress={onPress} disabled={busy} hitSlop={10} activeOpacity={0.6} style={s.headBtn}>
    {busy ? (
      <ActivityIndicator size="small" color={theme.colors.primary} />
    ) : (
      <VectorIcon iconSet="Ionicons" iconName={icon} size={19} color={theme.colors.textPrimary} />
    )}
  </TouchableOpacity>
);

const AdminStudentsScreen = ({ navigation }: any) => {
  const [lookups, setLookups] = useState<StudentLookups | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // The classes last loaded on this phone, for the first load's skeleton.
  const [last, rememberLast] = useLastLoaded<KeptClasses>('admin-student-classes');

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getStudentLookups();
      if (mine === seq.current) {
        setLookups(r);
        rememberLast({ classes: r.classes, sections: r.sections });
      }
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the classes.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [rememberLast]);

  // Back from adding or removing a student, the counts are fresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Search: the school's students in place of the classes ──────────────────
  const [search, setSearch] = useState('');
  const query = search.trim();
  const [found, setFound] = useState<StudentRow[] | null>(null);
  const [foundTotal, setFoundTotal] = useState(0);
  const [foundPage, setFoundPage] = useState({ current: 1, last: 1 });
  const [foundError, setFoundError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const moreBusy = useRef(false);
  // The search the rows on screen answer — more pages follow that one.
  const foundFor = useRef('');

  const fseq = useRef(0);
  const find = useCallback(async () => {
    const mine = ++fseq.current;
    if (!query) {
      setFound(null);
      setFoundError(null);
      return;
    }
    setFoundError(null);
    try {
      const r = await getStudents({ search: query, sort: 'name_asc', page: 1, per_page: SEARCH_PAGE });
      if (mine !== fseq.current) return;
      foundFor.current = query;
      setFound(r.students);
      setFoundTotal(r.pagination?.total ?? r.students.length);
      setFoundPage({ current: r.pagination?.current_page ?? 1, last: r.pagination?.last_page ?? 1 });
    } catch (e) {
      if (mine === fseq.current) setFoundError(apiErr(e, 'Could not search the students.'));
    } finally {
      if (mine === fseq.current) setRefreshing(false);
    }
  }, [query]);

  // Typing waits a moment before it asks; an empty box brings the classes back.
  useEffect(() => {
    if (!query) {
      fseq.current++;
      setFound(null);
      setFoundError(null);
      setRefreshing(false);
      return;
    }
    const t = setTimeout(find, 300);
    return () => clearTimeout(t);
  }, [query, find]);

  const findMore = async () => {
    if (moreBusy.current || !found || foundPage.current >= foundPage.last || foundFor.current !== query) return;
    const mine = fseq.current;
    moreBusy.current = true;
    setLoadingMore(true);
    try {
      const r = await getStudents({ search: foundFor.current, sort: 'name_asc', page: foundPage.current + 1, per_page: SEARCH_PAGE });
      if (mine !== fseq.current) return;
      setFound(prev => {
        const have = new Set((prev ?? []).map(x => x.id));
        return [...(prev ?? []), ...r.students.filter(x => !have.has(x.id))];
      });
      setFoundPage({ current: r.pagination?.current_page ?? foundPage.current + 1, last: r.pagination?.last_page ?? foundPage.last });
    } catch {
      // The next scroll asks again.
    } finally {
      moreBusy.current = false;
      setLoadingMore(false);
    }
  };

  // Back from a student's page (edited, or deleted), the results are fresh.
  const findRef = useRef(find);
  findRef.current = find;
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      if (findRef.current) findRef.current();
    }, []),
  );

  const classes = lookups?.classes ?? [];
  const sectionsOf = (id: number, from: KeptClasses | null = lookups) =>
    (from?.sections ?? []).filter(x => x.standard_id === id);

  // One section: its students at once. More: the sections first — each told
  // what is known of it already, for its skeleton.
  const open = (id: number, name: string, students?: number) => {
    const secs = sectionsOf(id);
    if (secs.length === 1) {
      navigation.navigate('AdminStudentsList', {
        classId: id,
        className: name,
        sectionId: secs[0].id,
        sectionName: secs[0].name,
        count: secs[0].students ?? students,
      });
    } else {
      navigation.navigate('AdminStudentSections', { classId: id, className: name, sections: secs });
    }
  };

  // A search being asked: rows of students, as its answer will be.
  const searchSkeleton = () => {
    const rows = sampleStudents(5) as StudentRow[];
    return (
      <FlatList
        data={rows}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={s.list}
        scrollEnabled={false}
        ListHeaderComponent={<ListCount skeleton text={`${plural(rows.length, 'student')} found`} />}
        renderItem={({ item, index }) => (
          <StudentListRow skeleton student={item} onOpen={() => {}} isLast={index === rows.length - 1} />
        )}
      />
    );
  };

  const results = () => {
    if (!found && !foundError) return searchSkeleton();

    if (foundError && !found) {
      return (
        <View style={s.centered}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{foundError}</Text>
          <TouchableOpacity onPress={find} hitSlop={10}>
            <Text style={s.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const list = found ?? [];
    return (
      <FlatList
        data={list}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={[s.list, list.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); find(); }} />}
        onEndReached={findMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={list.length > 0 ? <ListCount text={`${plural(foundTotal, 'student')} found`} /> : null}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={s.more} size="small" color={theme.colors.primary} /> : null}
        ListEmptyComponent={
          <DocNoData icon="search-outline" title="No students found" subtitle="No student’s name, mobile, admission number or email matches the search." />
        }
        renderItem={({ item, index }) => (
          <StudentListRow
            student={item}
            onOpen={() => navigation.navigate('AdminStudentDetail', { id: item.id, row: item })}
            isLast={index === list.length - 1}
          />
        )}
      />
    );
  };

  // The classes, as rows — the real ones, or the last ones kept drawn as a skeleton.
  const classList = (from: KeptClasses, skeleton: boolean) => {
    const rows = from.classes;
    const total = rows.reduce((n, c) => n + (c.students ?? 0), 0);
    return (
      <FlatList
        data={rows}
        keyExtractor={c => String(c.id)}
        contentContainerStyle={[s.list, rows.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!skeleton}
        refreshControl={
          skeleton ? undefined : (
            <AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          )
        }
        ListHeaderComponent={
          rows.length > 0 ? (
            <ListCount skeleton={skeleton} text={`${plural(rows.length, 'class', 'classes')} · ${plural(total, 'student')}`} />
          ) : null
        }
        ListEmptyComponent={
          <DocNoData icon="school-outline" title="No classes yet" subtitle="Add the school’s classes under Standards first." />
        }
        renderItem={({ item, index }) => {
          const secs = sectionsOf(item.id, from);
          const meta = [
            secs.length > 1 ? plural(secs.length, 'section') : secs.length === 1 ? `Section ${secs[0].name}` : 'No sections',
            item.students != null ? plural(item.students, 'student') : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <GroupRow
              icon="school-outline"
              title={item.name}
              meta={meta}
              isLast={index === rows.length - 1}
              skeleton={skeleton}
              onPress={() =>
                secs.length === 0
                  ? navigation.navigate('AdminStudentSections', { classId: item.id, className: item.name, sections: [] })
                  : open(item.id, item.name, item.students)
              }
            />
          );
        }}
      />
    );
  };

  const body = () => {
    if (query) return results();

    // Drawn from the classes last loaded here, row for row.
    if (!lookups && !error) {
      return classList(last && Array.isArray(last.classes) ? last : sampleClasses(), true);
    }

    if (error && !lookups) {
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

    return classList(lookups ?? { classes, sections: [] }, false);
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Students"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={
          <View style={s.headActions}>
            <HeadBtn icon="download-outline" onPress={() => setExportOpen(true)} />
            <HeadBtn icon="add" onPress={() => navigation.navigate('AdminStudentForm')} />
          </View>
        }
      />

      <View style={s.searchWrap}>
        <View style={s.searchRow}>
          <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search name, mobile, admission no, email"
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

      <StudentExportSheet visible={exportOpen} onClose={() => setExportOpen(false)} lookups={lookups} />
    </View>
  );
};

export default AdminStudentsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Header actions
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  // Search — as a section's student list has it
  searchWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, padding: 0 },
  more: { paddingVertical: 16 },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },

  // Error
  centered: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

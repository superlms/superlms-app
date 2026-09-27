import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  RcClass,
  RcStats,
  ReportCardItem,
  getReportCardLookups,
  getReportCardStats,
  getReportCards,
} from '../../api/adminReportCardApi';
import { GroupRow, ListSkeleton, plural } from './adminStudentsUi';
import { issuedLine } from './adminAdmitCardUi';
import { RcCardRow } from './adminReportCardUi';

/**
 * Report Card — the panel's Report Card page, drawn as the admin app's
 * Students list is. The panel's counts (total, active, issued, pending) head
 * the school's classes, each with its sections and how many of its students
 * hold an issued card. A class of one section opens straight onto its
 * students — the panel's Issue screen for that class and section — a class of
 * more onto its sections first.
 *
 * The search is the panel's list: a name or admission number finds the cards
 * issued (and revoked), newest first, more as the list scrolls; an issued card
 * opens as the student sees it.
 */

const SEARCH_PAGE = 30;

const AdminReportCardScreen = ({ navigation }: any) => {
  const [classes, setClasses] = useState<RcClass[] | null>(null);
  const [stats, setStats] = useState<RcStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const [l, st] = await Promise.all([getReportCardLookups(), getReportCardStats({})]);
      if (mine === seq.current) {
        setClasses(l.classes);
        setStats(st);
      }
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the classes.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, []);

  // ── Search: the panel's list of cards in place of the classes ─────────────
  const [search, setSearch] = useState('');
  const query = search.trim();
  const [found, setFound] = useState<ReportCardItem[] | null>(null);
  const [foundError, setFoundError] = useState<string | null>(null);
  const [foundMore, setFoundMore] = useState(false);
  const [foundTotal, setFoundTotal] = useState(0);
  const foundPage = useRef(1);
  const foundLast = useRef(1);
  const foundFor = useRef('');
  const fseq = useRef(0);

  const searchCards = useCallback(async (q: string) => {
    const mine = ++fseq.current;
    setFoundError(null);
    try {
      const r = await getReportCards({ search: q, page: 1, per_page: SEARCH_PAGE });
      if (mine !== fseq.current) return;
      foundFor.current = q;
      foundPage.current = r.pagination?.current_page ?? 1;
      foundLast.current = r.pagination?.last_page ?? 1;
      setFoundTotal(r.pagination?.total ?? r.data.length);
      setFound(r.data);
    } catch (e) {
      if (mine === fseq.current) setFoundError(apiErr(e, 'Could not search the report cards.'));
    } finally {
      if (mine === fseq.current) setRefreshing(false);
    }
  }, []);

  // Typing waits a moment before it asks, as the panel's search does.
  useEffect(() => {
    if (!query) {
      fseq.current++;
      setFound(null);
      setFoundError(null);
      return;
    }
    const t = setTimeout(() => searchCards(query), 300);
    return () => clearTimeout(t);
  }, [query, searchCards]);

  const loadMoreFound = async () => {
    if (foundMore || !found || foundPage.current >= foundLast.current) return;
    setFoundMore(true);
    const mine = fseq.current;
    try {
      const r = await getReportCards({ search: foundFor.current, page: foundPage.current + 1, per_page: SEARCH_PAGE });
      if (mine !== fseq.current) return;
      foundPage.current = r.pagination?.current_page ?? foundPage.current + 1;
      foundLast.current = r.pagination?.last_page ?? foundLast.current;
      setFound(prev => [...(prev ?? []), ...r.data]);
    } catch {
      // The next scroll tries again.
    } finally {
      setFoundMore(false);
    }
  };

  // Back from issuing or revoking, the counts (and a search) are fresh.
  const latest = useRef({ load, searchCards, query });
  latest.current = { load, searchCards, query };
  useFocusEffect(
    useCallback(() => {
      latest.current.load();
      if (latest.current.query) latest.current.searchCards(latest.current.query);
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    if (query) searchCards(query);
    else load();
  };

  // One section: its students at once. None, or more: the sections first.
  const open = (c: RcClass) => {
    if (c.sections.length === 1) {
      const sec = c.sections[0];
      navigation.navigate('AdminReportCardStudents', { classId: c.id, className: c.name, sectionId: sec.id, sectionName: sec.name });
    } else {
      navigation.navigate('AdminReportCardSections', { classItem: c });
    }
  };

  const errorBox = (message: string, retry: () => void) => (
    <View style={s.centered}>
      <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
      <Text style={s.errorText}>{message}</Text>
      <TouchableOpacity onPress={retry} hitSlop={10}>
        <Text style={s.link}>Try again</Text>
      </TouchableOpacity>
    </View>
  );

  const searchBody = () => {
    if (!found && !foundError) return <ListSkeleton />;
    if (foundError && !found) return errorBox(foundError, () => searchCards(query));
    const list = found ?? [];
    return (
      <FlatList
        data={list}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={[s.list, list.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMoreFound}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={list.length > 0 ? <Text style={s.count}>{`${plural(foundTotal, 'report card')} found`}</Text> : null}
        ListFooterComponent={foundMore ? <ActivityIndicator style={s.more} color={theme.colors.primary} /> : null}
        ListEmptyComponent={
          <DocNoData icon="search-outline" title="No report cards found" subtitle="No card’s student name or admission number matches the search." />
        }
        renderItem={({ item, index }) => (
          <RcCardRow
            card={item}
            isLast={index === list.length - 1}
            onPress={() => navigation.navigate('AdminReportCardView', { id: item.id, card: item })}
          />
        )}
      />
    );
  };

  const classesBody = () => {
    if (!classes && !error) return <ListSkeleton />;
    if (error && !classes) return errorBox(error, load);
    const list = classes ?? [];
    return (
      <FlatList
        data={list}
        keyExtractor={c => String(c.id)}
        contentContainerStyle={[s.list, list.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          list.length > 0 && stats ? (
            <Text style={s.count}>
              {/* The panel's Total / Active / Issued / Pending */}
              {`${plural(stats.total_students, 'student')} · ${stats.active_students} active · ${stats.issued} issued · ${stats.pending} pending`}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <DocNoData icon="school-outline" title="No classes yet" subtitle="Add the school’s classes under Standards first." />
        }
        renderItem={({ item, index }) => {
          const secs = item.sections;
          const meta = [
            secs.length > 1 ? plural(secs.length, 'section') : secs.length === 1 ? `Section ${secs[0].name}` : 'No sections',
            item.students != null ? issuedLine(item.issued ?? 0, item.students) : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <GroupRow icon="school-outline" title={item.name} meta={meta} isLast={index === list.length - 1} onPress={() => open(item)} />
          );
        }}
      />
    );
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Report Card"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

      <View style={s.searchWrap}>
        <View style={s.searchRow}>
          <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search name or admission no"
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

      {query ? searchBody() : classesBody()}
    </View>
  );
};

export default AdminReportCardScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Search — as the Students tab has it
  searchWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, padding: 0 },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },
  more: { paddingVertical: 18 },

  // Error
  centered: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import BookCard from './BookCard';
import { resolveFileUrl } from './bookData';
import { DocHeader, DocNoData } from '../more/docUi';
import { getBooks, type ApiBook } from '../../api/booksApi';
import { getStoredRole } from '../../api/authApi';
import { AppAlert } from '../../components/AppDialog';

const TITLE = 'Books';
const ALL = 'All';

const BooksScreen = ({ navigation, route }: any) => {
  // Prefer role from navigation params, fall back to AsyncStorage. The API
  // already auto-scopes from the bearer token — role only drives UI variations
  // (teachers see class · section on each row).
  const paramRole: 'student' | 'teacher' | undefined = route?.params?.userRole;
  const [role, setRole] = useState<'student' | 'teacher'>(paramRole ?? 'student');

  const [books, setBooks] = useState<ApiBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeSubject, setActiveSubject] = useState<string>(ALL);

  // The tabs are built from the books we actually got back — every subject the
  // caller is entitled to see, named as the school saved it, with how many
  // books each holds.
  const subjects = useMemo(() => {
    const counts = new Map<string, number>();
    books.forEach(b => {
      const name = b.subject?.name;
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    return Array.from(counts, ([name, count]) => ({ name, label: name, count })).sort(
      (a, b) => a.label.localeCompare(b.label),
    );
  }, [books]);

  // A teacher's books can be filtered by subject once there is more than one; a
  // student's show as one list, as a teacher's do without tabs.
  const showTabs = role === 'teacher' && subjects.length > 1;

  // A refresh can take away the subject being looked at; fall back to All.
  const current =
    showTabs && subjects.some(sub => sub.name === activeSubject) ? activeSubject : ALL;

  const filtered = useMemo(
    () => (current === ALL ? books : books.filter(b => b.subject?.name === current)),
    [current, books],
  );

  const fetchBooks = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError('');
      try {
        // Resolve role lazily if it wasn't passed via nav params.
        if (!paramRole) {
          const stored = await getStoredRole();
          if (stored === 'teacher' || stored === 'student') setRole(stored);
        }
        const { items } = await getBooks({ per_page: 50 });
        setBooks(Array.isArray(items) ? items : []);
      } catch (e: any) {
        console.log('[BooksScreen] ❌', e?.response?.data ?? e?.message);
        setError(e?.response?.data?.message ?? 'Failed to load books.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [paramRole],
  );

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBooks({ silent: true });
  }, [fetchBooks]);

  // Open the book in the in-app PDF reader (with go-to-page support); a book
  // with no PDF only says so.
  const openBook = useCallback(
    (book: ApiBook) => {
      if (!book.pdf_url) {
        AppAlert.alert('No PDF added yet');
        return;
      }
      navigation.navigate('BookReader', {
        url: resolveFileUrl(book.pdf_url),
        title: book.title,
      });
    },
    [navigation],
  );

  if (loading) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.list}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[s.skeletonRow, i < 4 && s.rowDivider]}>
              <Skeleton width={30} height={30} radius={6} />
              <View style={s.skeletonBody}>
                <Skeleton width="70%" height={14} />
                <Skeleton width="45%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchBooks()} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const tabs = [{ name: ALL, label: ALL, count: books.length }, ...subjects];

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      {showTabs && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.tabsBar}
            contentContainerStyle={s.tabs}
          >
            {tabs.map(tab => {
              const active = current === tab.name;
              return (
                <TouchableOpacity
                  key={tab.name}
                  activeOpacity={0.6}
                  onPress={() => setActiveSubject(tab.name)}
                  style={[s.tab, active && s.tabActive]}
                >
                  <Text style={[s.tabText, active && s.tabTextActive]}>
                    {tab.label}
                    <Text style={s.tabCount}>{`  ${tab.count}`}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={s.fullDivider} />
        </>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.list, filtered.length === 0 && s.listEmpty]}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          // With tabs on screen the counts are already there.
          !showTabs && filtered.length > 0 ? (
            <Text style={s.count}>
              {filtered.length} {filtered.length === 1 ? 'book' : 'books'}
            </Text>
          ) : null
        }
        renderItem={({ item, index }) => (
          <BookCard
            item={item}
            showClass={role === 'teacher'}
            isLast={index === filtered.length - 1}
            onViewPress={openBook}
          />
        )}
        ListEmptyComponent={
          <DocNoData
            icon="book-outline"
            title="No books found"
            subtitle={
              role === 'teacher'
                ? 'No books for the classes and subjects you teach.'
                : 'No books have been added for your class yet.'
            }
          />
        }
      />
    </View>
  );
};

export default BooksScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Subject tabs. A horizontal ScrollView grows to fill a column by default,
  // so the bar is held to its content.
  tabsBar: { flexGrow: 0 },
  tabs: { paddingHorizontal: 20, paddingTop: 12, gap: 20 },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },
  tabCount: { fontWeight: '400', color: theme.colors.textMuted },

  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },

  // Loading
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  skeletonBody: { flex: 1, gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

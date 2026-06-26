import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import BookCard from './BookCard';
import { subjectMetaFor } from './bookData';
import { getBooks, type ApiBook } from '../../api/booksApi';
import { getStoredRole } from '../../api/authApi';
import constant from '../../utils/constant';

const ALL = 'All';

// Files come from the same host as the API but outside the /api/v1 prefix
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

const BooksScreen = ({ navigation, route }: any) => {
  // Prefer role from navigation params, fall back to AsyncStorage. The API
  // already auto-scopes from the bearer token — role only drives UI variations
  // (teachers see class · section on each card).
  const paramRole: 'student' | 'teacher' | undefined = route?.params?.userRole;
  const [role, setRole] = useState<'student' | 'teacher'>(paramRole ?? 'student');

  const [books, setBooks]       = useState<ApiBook[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string>('');
  const [activeSubject, setActiveSubject] = useState<string>(ALL);

  // Build chip list from the books we actually got back — every subject the
  // caller is entitled to see, plus "All".
  const subjects = useMemo(() => {
    const set = new Set<string>();
    books.forEach(b => b.subject?.name && set.add(b.subject.name));
    return [ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [books]);

  const filtered = useMemo(() =>
    activeSubject === ALL
      ? books
      : books.filter(b => b.subject?.name === activeSubject),
    [activeSubject, books],
  );

  const fetchBooks = useCallback(async (opts?: { silent?: boolean }) => {
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
  }, [paramRole]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBooks({ silent: true });
  }, [fetchBooks]);

  // Open the book in the in-app PDF reader (with go-to-page support).
  const openBook = useCallback((book: ApiBook) => {
    navigation.navigate('BookReader', {
      url: resolveFileUrl(book.pdf_url),
      title: book.title,
    });
  }, [navigation]);

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.root}>
        <Header title="Books" onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <ScreenSkeleton variant="list" />
          <Text style={s.loadingText}>Loading books…</Text>
        </View>
      </View>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={s.root}>
        <Header title="Books" onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <VectorIcon iconSet="Ionicons" iconName="alert-circle-outline" size={48} color={theme.colors.danger} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => fetchBooks()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Header title="Books" onBackPress={() => navigation.goBack()} />

      {/* Filter chips — only show when there are 2+ subjects to choose from */}
      {subjects.length > 2 && (
        <View style={s.filtersWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filtersRow}
          >
            {subjects.map(subj => {
              const active = activeSubject === subj;
              const meta = subjectMetaFor(subj);
              return (
                <TouchableOpacity
                  key={subj}
                  activeOpacity={0.8}
                  onPress={() => setActiveSubject(subj)}
                  style={[s.chip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
                >
                  {active && <View style={s.chipDot} />}
                  <Text style={[s.chipText, active && s.chipTextActive, !active && { color: meta.color }]}>
                    {subj}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Book list (subjects-style cards) */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.listContent, filtered.length === 0 && s.listEmpty]}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          filtered.length > 0 ? (
            <>
              <Text style={s.sectionTitle}>All Books</Text>
              <Text style={s.sectionDesc}>Tap a book to read it in the app.</Text>
            </>
          ) : null
        }
        renderItem={({ item }) => (
          <BookCard item={item} showClass={role === 'teacher'} onViewPress={openBook} />
        )}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <View style={s.emptyIconRing}>
              <VectorIcon iconSet="Ionicons" iconName="book-outline" size={36} color={theme.colors.primary} />
            </View>
            <Text style={s.emptyTitle}>No books found</Text>
            <Text style={s.emptySubtitle}>
              {role === 'teacher'
                ? 'No books assigned to the classes & subjects you teach.'
                : 'No books available for your class yet.'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

export default BooksScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 8 },
  errorText: { fontSize: 14, color: theme.colors.danger, textAlign: 'center' },
  retryBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: theme.radius.full, marginTop: 8 },
  retryText: { color: '#fff', fontWeight: '700' },

  filtersWrapper: { paddingVertical: 12 },
  filtersRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: theme.colors.card, borderWidth: 1.5, borderColor: theme.colors.border,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.card },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  chipTextActive: { color: '#fff' },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, marginBottom: 16 },

  emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIconRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

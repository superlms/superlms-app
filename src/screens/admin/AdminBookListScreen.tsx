import React, { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { BookRow, getBookSubjects } from '../../api/adminBookApi';
import { GroupRow, ListSkeleton, plural } from './adminStudentsUi';
import { HeadBtn } from './adminAdmitCardUi';
import { BookCtx, bookLine } from './adminBookUi';

/**
 * A subject that holds more than one book (the panel allows several, one per
 * title) lists them — its section's own and the whole class's, newest first.
 * A book opens its PDF; + adds another.
 *
 * Route params: ctx — the class, section and subject.
 */

const AdminBookListScreen = ({ navigation, route }: any) => {
  const ctx: BookCtx = route?.params?.ctx;

  const [books, setBooks] = useState<BookRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getBookSubjects(ctx.classId, ctx.sectionId);
      if (mine === seq.current) setBooks(r.subjects.find(x => x.id === ctx.subjectId)?.books ?? []);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the books.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [ctx.classId, ctx.sectionId, ctx.subjectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = books ?? [];

  return (
    <View style={s.root}>
      <DocHeader
        title={ctx.subjectName}
        onBackPress={() => navigation.goBack()}
        rightSlot={<HeadBtn icon="add" onPress={() => navigation.navigate('AdminBookForm', { ctx })} />}
      />

      {!books && !error ? (
        <ListSkeleton />
      ) : error && !books ? (
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
          keyExtractor={b => String(b.id)}
          contentContainerStyle={[s.list, list.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={list.length > 0 ? <Text style={s.count}>{plural(list.length, 'book')}</Text> : null}
          ListEmptyComponent={<DocNoData icon="document-outline" title="No PDF added" subtitle="Tap + to add this subject’s book." />}
          renderItem={({ item, index }) => (
            <GroupRow
              icon="document-text-outline"
              title={item.title}
              meta={bookLine(item)}
              isLast={index === list.length - 1}
              onPress={() => navigation.navigate('AdminBookView', { ctx, book: item })}
            />
          )}
        />
      )}
    </View>
  );
};

export default AdminBookListScreen;

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

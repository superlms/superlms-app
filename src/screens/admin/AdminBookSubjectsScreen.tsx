import React, { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { BookSubject, getBookSubjects } from '../../api/adminBookApi';
import { subjectLabel } from '../books/bookData';
import { GroupRow, ListSkeleton, plural } from './adminStudentsUi';
import { BookCtx } from './adminBookUi';

/**
 * A section's subjects (or, for a class with no sections, the class's), drawn
 * as the student's Subjects list is, each saying whether its book's PDF has
 * been added. A subject opens straight onto its PDF; one without a book says
 * "No PDF added" with Add; one with several lists them first.
 *
 * Route params: classId, className, sectionId, sectionName (none for a class
 * with no sections).
 */

const AdminBookSubjectsScreen = ({ navigation, route }: any) => {
  const { classId, className, sectionId = null, sectionName = null } = route?.params ?? {};
  const title = [className, sectionName ? `Section ${sectionName}` : null].filter(Boolean).join(' · ') || 'Subjects';

  const [subjects, setSubjects] = useState<BookSubject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getBookSubjects(classId, sectionId);
      if (mine === seq.current) setSubjects(r.subjects);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the subjects.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [classId, sectionId]);

  // Back from a book (added, edited or deleted), the rows are fresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = subjects ?? [];
  const withPdf = list.filter(x => x.books.some(b => !!b.pdf_file)).length;

  const ctxOf = (x: BookSubject): BookCtx => ({
    classId,
    className,
    sectionId,
    sectionName,
    subjectId: x.id,
    subjectName: subjectLabel(x.name),
  });

  const open = (x: BookSubject) => {
    const ctx = ctxOf(x);
    if (x.books.length > 1) navigation.navigate('AdminBookList', { ctx });
    else navigation.navigate('AdminBookView', { ctx, book: x.books[0] ?? null });
  };

  const metaOf = (x: BookSubject) => {
    if (x.books.length === 0) return 'No PDF added';
    if (x.books.length > 1) return plural(x.books.length, 'book');
    const b = x.books[0];
    return [b.title, b.section_id ? null : 'Whole class', b.is_active ? null : 'Inactive', b.pdf_file ? null : 'No PDF added']
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />

      {!subjects && !error ? (
        <ListSkeleton />
      ) : error && !subjects ? (
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
            list.length > 0 ? (
              <Text style={s.count}>{`${plural(list.length, 'subject')} · ${withPdf} with a PDF`}</Text>
            ) : null
          }
          ListEmptyComponent={
            <DocNoData
              icon="book-outline"
              title="No subjects yet"
              subtitle={sectionId ? 'Map subjects to this section under Standards first.' : 'Map subjects to this class under Standards first.'}
            />
          }
          renderItem={({ item, index }) => (
            <GroupRow
              icon="book-outline"
              title={subjectLabel(item.name)}
              meta={metaOf(item)}
              isLast={index === list.length - 1}
              onPress={() => open(item)}
            />
          )}
        />
      )}
    </View>
  );
};

export default AdminBookSubjectsScreen;

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

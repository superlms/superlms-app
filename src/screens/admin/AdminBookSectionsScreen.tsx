import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { BookClass, getBookOverview } from '../../api/adminBookApi';
import { GroupRow, plural } from './adminStudentsUi';

/**
 * One class's sections, drawn as the admin app's Students sections are: a count,
 * then a row per section with how many books it has — its own and the whole
 * class's, which every section sees. A section opens onto its subjects.
 *
 * Route params: classItem — the class, with its sections, from the class list.
 */

const AdminBookSectionsScreen = ({ navigation, route }: any) => {
  const passed: BookClass = route?.params?.classItem;
  const [item, setItem] = useState<BookClass>(passed);
  const [refreshing, setRefreshing] = useState(false);

  // Back from a subject (a book added, edited or deleted), the counts are fresh.
  const load = useCallback(async () => {
    try {
      const r = await getBookOverview();
      const fresh = r.classes.find(c => c.id === passed.id);
      if (fresh) setItem(fresh);
    } catch {
      // keep what was passed
    } finally {
      setRefreshing(false);
    }
  }, [passed.id]);

  const first = React.useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      load();
    }, [load]),
  );

  const list = item.sections;
  const books = (sec: BookClass['sections'][number]) => sec.books + item.whole_class_books;

  return (
    <View style={s.root}>
      <DocHeader title={item.name} onBackPress={() => navigation.goBack()} />

      <FlatList
        data={list}
        keyExtractor={x => String(x.id)}
        contentContainerStyle={[s.list, list.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          list.length > 0 ? (
            <Text style={s.count}>
              {[
                plural(list.length, 'section'),
                plural(item.books, 'book'),
                item.whole_class_books > 0 ? `${item.whole_class_books} for the whole class` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <DocNoData icon="grid-outline" title="No sections in this class" subtitle="Add its sections under Standards first." />
        }
        renderItem={({ item: sec, index }) => (
          <GroupRow
            letter={sec.name.slice(0, 2).toUpperCase()}
            title={`Section ${sec.name}`}
            meta={books(sec) > 0 ? plural(books(sec), 'book') : 'No books yet'}
            isLast={index === list.length - 1}
            onPress={() =>
              navigation.navigate('AdminBookSubjects', {
                classId: item.id,
                className: item.name,
                sectionId: sec.id,
                sectionName: sec.name,
              })
            }
          />
        )}
      />
    </View>
  );
};

export default AdminBookSectionsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

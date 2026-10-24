import React, { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { StudentLookups, getStudentLookups } from '../../api/adminStudentApi';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { GroupRow, ListCount, plural } from './adminStudentsUi';

/**
 * One class's sections, for a class of more than one — as the student's
 * Subjects list is drawn: a count, then a row per section with how many
 * students it has. A section opens onto its students.
 *
 * The first load is drawn as a skeleton of the sections: those the Students
 * page already knew of (passed in), else those held the last time the class was
 * opened on this phone, else an ordinary A and B.
 */

type Sections = StudentLookups['sections'];

const AdminStudentSectionsScreen = ({ navigation, route }: any) => {
  const classId: number = route?.params?.classId;
  const className: string = route?.params?.className ?? 'Class';

  const [sections, setSections] = useState<Sections | null>(null);
  // What is known of the sections before they load, for the skeleton.
  const known: Sections | undefined = route?.params?.sections;
  const [last, rememberLast] = useLastLoaded<Sections>(classId ? `admin-student-sections:${classId}` : null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getStudentLookups(classId);
      if (mine === seq.current) {
        const own = r.sections.filter(x => x.standard_id === classId);
        setSections(own);
        rememberLast(own);
      }
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the sections.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [classId, rememberLast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // The sections — the real ones, or the ones known before drawn as a skeleton.
  const skeleton = !sections && !error;
  const sample: Sections = ['A', 'B'].map((name, i) => ({ id: -1 - i, name, code: name, standard_id: classId, students: 30 }));
  const list: Sections =
    sections ?? (known && known.length ? known : last && Array.isArray(last) && last.length ? last : skeleton ? sample : []);
  const total = list.reduce((n, x) => n + (x.students ?? 0), 0);

  return (
    <View style={s.root}>
      <DocHeader title={className} onBackPress={() => navigation.goBack()} />

      {error && !sections ? (
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
          scrollEnabled={!skeleton}
          refreshControl={
            skeleton ? undefined : (
              <AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
            )
          }
          ListHeaderComponent={
            list.length > 0 ? (
              <ListCount skeleton={skeleton} text={`${plural(list.length, 'section')} · ${plural(total, 'student')}`} />
            ) : null
          }
          ListEmptyComponent={
            <DocNoData icon="grid-outline" title="No sections in this class" subtitle="Add its sections under Standards first." />
          }
          renderItem={({ item, index }) => (
            <GroupRow
              letter={item.name.slice(0, 2).toUpperCase()}
              title={`Section ${item.name}`}
              meta={item.students != null ? plural(item.students, 'student') : null}
              isLast={index === list.length - 1}
              skeleton={skeleton}
              onPress={() =>
                navigation.navigate('AdminStudentsList', {
                  classId,
                  className,
                  sectionId: item.id,
                  sectionName: item.name,
                  count: item.students,
                })
              }
            />
          )}
        />
      )}
    </View>
  );
};

export default AdminStudentSectionsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  centered: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

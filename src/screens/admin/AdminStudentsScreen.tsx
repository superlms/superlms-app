import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { StudentLookups, getStudentLookups } from '../../api/adminStudentApi';
import { GroupRow, ListSkeleton, plural } from './adminStudentsUi';
import StudentExportSheet from './StudentExportSheet';

/**
 * Students — the school's classes first, drawn as the student's Subjects list
 * is: a count, then a row per class with its sections and how many students it
 * has. A class of one section opens straight onto its students; a class of
 * more opens onto its sections first. The header holds Export — Excel or PDF,
 * every student or one class, as the panel asks it — and the + that adds a
 * student.
 */

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

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getStudentLookups();
      if (mine === seq.current) setLookups(r);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the classes.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, []);

  // Back from adding or removing a student, the counts are fresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const classes = lookups?.classes ?? [];
  const sectionsOf = (id: number) => (lookups?.sections ?? []).filter(x => x.standard_id === id);
  const total = classes.reduce((n, c) => n + (c.students ?? 0), 0);

  // One section: its students at once. More: the sections first.
  const open = (id: number, name: string) => {
    const secs = sectionsOf(id);
    if (secs.length === 1) {
      navigation.navigate('AdminStudentsList', { classId: id, className: name, sectionId: secs[0].id, sectionName: secs[0].name });
    } else {
      navigation.navigate('AdminStudentSections', { classId: id, className: name });
    }
  };

  const body = () => {
    if (!lookups && !error) return <ListSkeleton />;

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

    return (
      <FlatList
        data={classes}
        keyExtractor={c => String(c.id)}
        contentContainerStyle={[s.list, classes.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          classes.length > 0 ? <Text style={s.count}>{`${plural(classes.length, 'class', 'classes')} · ${plural(total, 'student')}`}</Text> : null
        }
        ListEmptyComponent={
          <DocNoData icon="school-outline" title="No classes yet" subtitle="Add the school’s classes under Standards first." />
        }
        renderItem={({ item, index }) => {
          const secs = sectionsOf(item.id);
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
              isLast={index === classes.length - 1}
              onPress={() =>
                secs.length === 0
                  ? navigation.navigate('AdminStudentSections', { classId: item.id, className: item.name })
                  : open(item.id, item.name)
              }
            />
          );
        }}
      />
    );
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

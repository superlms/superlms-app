import React, { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { AdmitClassCount, AdmitClassOverview, getAdmitClasses } from '../../api/adminAdmitCardApi';
import { GroupRow, ListSkeleton, plural } from './adminStudentsUi';
import { HeadActions, HeadBtn, issuedLine } from './adminAdmitCardUi';

/**
 * One exam's classes, drawn as the admin app's Students list is: a count, then
 * a row per class with its sections and how many of its students hold the
 * exam's card — the web page's Total / Issued / Remaining for each class at
 * once. A class of one section opens straight onto its students; a class of
 * more (or with students outside its sections) opens onto its sections first.
 */

const AdminAdmitCardClassesScreen = ({ navigation, route }: any) => {
  const exam: { id: number; name: string } = route?.params?.exam;

  const [data, setData] = useState<AdmitClassOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getAdmitClasses(exam.id);
      if (mine === seq.current) setData(r);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the classes.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [exam.id]);

  // Back from issuing or deleting, the counts are fresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const classes = data?.classes ?? [];
  const totals = data?.totals;

  const open = (c: AdmitClassCount) => {
    const only = c.sections.length === 1 ? c.sections[0] : null;
    if (c.sections.length === 0) {
      navigation.navigate('AdminAdmitCardStudents', { exam, classId: c.id, className: c.name });
    } else if (only && only.students === c.students) {
      navigation.navigate('AdminAdmitCardStudents', {
        exam,
        classId: c.id,
        className: c.name,
        sectionId: only.id,
        sectionName: only.name,
      });
    } else {
      navigation.navigate('AdminAdmitCardSections', { exam, classItem: c });
    }
  };

  const body = () => {
    if (!data && !error) return <ListSkeleton />;

    if (error && !data) {
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
          classes.length > 0 && totals ? (
            <Text style={s.count}>
              {/* The web page's Total / Issued / Remaining */}
              {`${plural(classes.length, 'class', 'classes')} · ${plural(totals.total, 'student')} · ${totals.issued} issued · ${totals.remaining} remaining`}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <DocNoData icon="school-outline" title="No classes yet" subtitle="Add the school’s classes under Standards first." />
        }
        renderItem={({ item, index }) => {
          const secs = item.sections;
          const meta = [
            secs.length > 1 ? plural(secs.length, 'section') : secs.length === 1 ? `Section ${secs[0].name}` : null,
            issuedLine(item.issued, item.students),
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <GroupRow
              icon="school-outline"
              title={item.name}
              meta={meta}
              isLast={index === classes.length - 1}
              onPress={() => open(item)}
            />
          );
        }}
      />
    );
  };

  return (
    <View style={s.root}>
      <DocHeader
        title={exam?.name ?? 'Admit Card'}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeadActions>
            <HeadBtn icon="print-outline" onPress={() => navigation.navigate('AdminAdmitCardPrint', { examId: exam.id })} />
            <HeadBtn icon="add" onPress={() => navigation.navigate('AdminAdmitCardIssue', { examId: exam.id })} />
          </HeadActions>
        }
      />

      {body()}
    </View>
  );
};

export default AdminAdmitCardClassesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

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

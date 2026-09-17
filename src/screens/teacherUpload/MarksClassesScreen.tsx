import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { SubjectIcon } from '../subjects/subjectIcon';
import { plural } from '../subjects/subjectsUi';
import { getMarksClasses, marksErrorMessage, type MarksClass } from '../../api/marksApi';
import type { Exam } from '../exam/examData';

/**
 * Upload Marks, step two: the classes and sections the teacher teaches (one
 * row per subject taught there), each saying whether the exam's marks are in.
 * A row opens the class's students (MarksSheet).
 */

export const marksClassLabel = (c: MarksClass) =>
  [c.standard_name, c.section_name].filter(Boolean).join(' - ');

const classKey = (c: MarksClass) => `${c.standard_id}-${c.section_id}-${c.subject_id}`;

//   (icon)  Class 5 - A                                  >
//           Hindi · 32 students
//           Marks added · 2 absent
const ClassRow = ({ item, isLast, onPress }: { item: MarksClass; isLast: boolean; onPress: () => void }) => {
  const added = item.saved > 0;
  const status = !added
    ? 'Marks not added'
    : item.saved < item.students
    ? `Marks added for ${item.saved} of ${item.students}`
    : ['Marks added', item.absent > 0 ? `${item.absent} absent` : null].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onPress}>
      <SubjectIcon image={item.subject_image} size={30} />
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>
          {marksClassLabel(item)}
        </Text>
        <Text style={s.meta} numberOfLines={1}>
          {item.subject_name} · {plural(item.students, 'student')}
        </Text>
        <Text style={[s.status, added && s.statusAdded]} numberOfLines={1}>
          {status}
        </Text>
      </View>
      <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
};

const ListSkeleton = ({ rows }: { rows: number }) => {
  const n = rows > 0 ? Math.min(rows, 10) : 4;
  return (
    <View style={s.list}>
      <View style={s.skeletonCount}>
        <Skeleton width={70} height={12} />
      </View>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={[s.row, i < n - 1 && s.rowDivider]}>
          <Skeleton width={30} height={30} radius={6} />
          <View style={s.skeletonBody}>
            <Skeleton width="40%" height={14} />
            <Skeleton width="50%" height={12} />
            <Skeleton width="30%" height={12} />
          </View>
          <Skeleton width={8} height={13} />
        </View>
      ))}
    </View>
  );
};

const MarksClassesScreen = ({ navigation, route }: any) => {
  const exam: Exam = route.params.exam;
  const [classes, setClasses] = useState<MarksClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClasses(await getMarksClasses(exam.id));
    } catch (e: any) {
      console.log('[getMarksClasses] Error:', e?.response?.status, e?.message);
      setError(marksErrorMessage(e));
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [exam.id]);

  const { refreshing, onRefresh } = useRefresh(load);

  // Coming back from a saved class refreshes its status quietly.
  useFocusLoad(load);

  const renderBody = () => {
    if (refreshing || (loading && classes.length === 0)) {
      return <ListSkeleton rows={classes.length} />;
    }

    if (error && classes.length === 0) {
      return (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={classes}
        keyExtractor={classKey}
        contentContainerStyle={[s.list, classes.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          classes.length > 0 ? (
            <Text style={s.count}>
              Choose a class · {classes.length} {classes.length === 1 ? 'class' : 'classes'}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <DocNoData
            icon="people-outline"
            title="No classes assigned"
            subtitle="Classes and subjects from your timetable will appear here."
          />
        }
        renderItem={({ item, index }) => (
          <ClassRow
            item={item}
            isLast={index === classes.length - 1}
            onPress={() => navigation.navigate('MarksSheet', { exam, cls: item })}
          />
        )}
      />
    );
  };

  return (
    <View style={s.root}>
      <DocHeader title={exam.name} onBackPress={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};

export default MarksClassesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },

  // Row — the subject's icon tile, then the class, subject and marks status
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  status: { fontSize: 12, color: theme.colors.textMuted },
  statusAdded: { color: theme.colors.primary, fontWeight: '500' },

  // Loading
  skeletonBody: { flex: 1, gap: 8 },
  skeletonCount: { paddingTop: 13, paddingBottom: 3 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

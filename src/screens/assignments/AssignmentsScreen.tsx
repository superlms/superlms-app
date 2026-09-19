import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { SkeletonText } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { SubjectRow } from '../subjects/subjectLists';
import { plural } from '../subjects/subjectsUi';
import {
  getStudentAssignments,
  getTeacherAssignments,
  assignmentErrorMessage,
  type Assignment,
} from '../../api/assignmentApi';
import { STATUS, classLabel, dueLine } from './assignmentUi';

/**
 * Assignments, laid out as Subjects is: a count, then a row per assignment —
 * its subject's icon, its title, and what it is for and when it is due. Only
 * those not past their due date are listed, soonest due first. A student's
 * rows say where their answer stands; a teacher's say how many have turned it
 * in, and + in the header sets a new one.
 */

// What a row says, kept so the list can draw itself as a skeleton next time.
interface KeptRow {
  key: string;
  title: string;
  meta: string;
  tag?: string | null;
}

interface Row extends KeptRow {
  image?: string | null;
  tagColor?: string;
  assignment: Assignment;
}

// Before the list has ever loaded on this phone.
const SAMPLE: KeptRow[] = [
  { key: 's1', title: 'Chapter 3 worksheet', meta: 'Mathematics · Due Tomorrow, 5:00 PM' },
  { key: 's2', title: 'Essay on the water cycle', meta: 'Science · Due 25 Sep, 9:00 AM' },
  { key: 's3', title: 'Grammar practice', meta: 'English · Due 27 Sep, 5:00 PM' },
  { key: 's4', title: 'Map work', meta: 'Social Science · Due 30 Sep, 5:00 PM' },
];

const studentRow = (a: Assignment): Row => {
  const status = a.submission ? STATUS[a.submission.status] : null;
  const tag = status?.label ?? (a.window_status === 'upcoming' ? 'Upcoming' : null);
  return {
    key: String(a.id),
    image: a.subject_image,
    title: a.title,
    meta: [a.subject, dueLine(a)].filter(Boolean).join(' · '),
    tag,
    tagColor: status?.color ?? theme.colors.textMuted,
    assignment: a,
  };
};

const teacherRow = (a: Assignment): Row => ({
  key: String(a.id),
  image: a.subject_image,
  title: a.title,
  meta: [classLabel(a), dueLine(a)].filter(Boolean).join(' · '),
  // How many of the class have turned it in.
  tag: a.is_active === false ? 'Hidden' : `${a.submitted_count ?? 0}/${a.class_size ?? 0}`,
  tagColor: theme.colors.textMuted,
  assignment: a,
});

const Tag = ({ text, color, skeleton }: { text: string; color?: string; skeleton?: boolean }) =>
  skeleton ? (
    <SkeletonText style={s.tag}>{text}</SkeletonText>
  ) : (
    <Text style={[s.tag, !!color && { color }]}>{text}</Text>
  );

const AssignmentList = ({ navigation, teacher }: { navigation: any; teacher: boolean }) => {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  // The list on screen came from the school.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, remember] = useLastLoaded<KeptRow[]>(teacher ? 'assignments:teacher' : 'assignments:student');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await (teacher ? getTeacherAssignments() : getStudentAssignments()));
      setLoaded(true);
    } catch (e: any) {
      console.log('[Assignments] Error:', e?.response?.status, e?.message);
      setError(assignmentErrorMessage(e));
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [teacher]);

  const { refreshing, onRefresh } = useRefresh(load);
  useFocusLoad(load);

  const rows = items.map(teacher ? teacherRow : studentRow);

  // Keep what the list said for the next first load.
  const keptKey = loaded ? JSON.stringify(rows.map(({ key, title, meta, tag }) => ({ key, title, meta, tag }))) : null;
  useEffect(() => {
    if (keptKey) remember(JSON.parse(keptKey));
  }, [keptKey, remember]);

  const open = (a: Assignment) => navigation.navigate('AssignmentDetail', { assignment: a, teacher });

  const renderBody = () => {
    // The first load and a pull to refresh show the list as it was; coming
    // back to it refetches quietly.
    if (refreshing || (loading && items.length === 0)) {
      const drawn = Array.isArray(last) && last.length > 0 ? last : SAMPLE;
      return (
        <View style={s.list} pointerEvents="none">
          <View style={s.countBox}>
            <SkeletonText style={s.count}>{plural(drawn.length, 'assignment')}</SkeletonText>
          </View>
          {drawn.map((r, i) => (
            <SubjectRow
              key={r.key}
              title={r.title}
              meta={r.meta}
              isLast={i === drawn.length - 1}
              onPress={() => {}}
              trailing={r.tag ? <Tag text={r.tag} skeleton /> : undefined}
              skeleton
            />
          ))}
        </View>
      );
    }

    if (error && items.length === 0) {
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
        data={rows}
        keyExtractor={r => r.key}
        contentContainerStyle={[s.list, rows.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={rows.length > 0 ? <Text style={[s.count, s.countBox]}>{plural(rows.length, 'assignment')}</Text> : null}
        ListEmptyComponent={
          <DocNoData
            icon="document-text-outline"
            title="No assignments"
            subtitle={
              teacher
                ? 'Tap + to set an assignment for one of your classes.'
                : 'Assignments for your class will appear here until they are due.'
            }
          />
        }
        renderItem={({ item, index }) => (
          <SubjectRow
            image={item.image}
            title={item.title}
            meta={item.meta}
            isLast={index === rows.length - 1}
            onPress={() => open(item.assignment)}
            trailing={item.tag ? <Tag text={item.tag} color={item.tagColor} /> : undefined}
          />
        )}
      />
    );
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Assignments"
        onBackPress={() => navigation.goBack()}
        rightIcon={teacher ? 'add' : undefined}
        onRightPress={teacher ? () => navigation.navigate('AssignmentForm') : undefined}
      />
      {renderBody()}
    </View>
  );
};

export const StudentAssignmentsScreen = ({ navigation }: any) => <AssignmentList navigation={navigation} teacher={false} />;

export const TeacherAssignmentsScreen = ({ navigation }: any) => <AssignmentList navigation={navigation} teacher />;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted },
  countBox: { paddingTop: 12, paddingBottom: 2 },
  tag: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },

  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

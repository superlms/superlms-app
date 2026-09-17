import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton, SkeletonIcon } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { SubjectIcon } from '../subjects/subjectIcon';
import { plural } from '../subjects/subjectsUi';
import { getMarksClasses, marksErrorMessage, type MarksClass } from '../../api/marksApi';
import type { Exam } from '../exam/examData';
import { Words } from '../exam/examUi';

/**
 * Upload Marks, step two: the classes and sections the teacher teaches (one
 * row per subject taught there), each saying whether the exam's marks are in.
 * A row opens the class's students (MarksSheet).
 *
 * A load — the first, a pull to refresh, Try again — draws the page as a
 * skeleton from the classes it shows, or those it held last time.
 */

export const marksClassLabel = (c: MarksClass) =>
  [c.standard_name, c.section_name].filter(Boolean).join(' - ');

const classKey = (c: MarksClass) => `${c.standard_id}-${c.section_id}-${c.subject_id}`;

const sampleClass = (id: number, standard: string, section: string, subject: string, students: number): MarksClass => ({
  standard_id: id,
  standard_name: standard,
  section_id: id,
  section_name: section,
  subject_id: id,
  subject_name: subject,
  subject_image: null,
  students,
  saved: 0,
  absent: 0,
});

// Ordinary classes, for a list never loaded on this phone.
const SAMPLE_CLASSES: MarksClass[] = [
  sampleClass(1, 'Class 6', 'A', 'Mathematics', 32),
  sampleClass(2, 'Class 7', 'A', 'Mathematics', 30),
  sampleClass(3, 'Class 8', 'B', 'Science', 28),
];

//   (icon)  Class 5 - A                                  >
//           Hindi · 32 students
//           Marks added · 2 absent
const ClassRow = ({
  item,
  isLast,
  onPress,
  skeleton,
}: {
  item: MarksClass;
  isLast: boolean;
  onPress: () => void;
  skeleton?: boolean;
}) => {
  const added = item.saved > 0;
  const status = !added
    ? 'Marks not added'
    : item.saved < item.students
    ? `Marks added for ${item.saved} of ${item.students}`
    : ['Marks added', item.absent > 0 ? `${item.absent} absent` : null].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider]}
      activeOpacity={0.6}
      onPress={onPress}
      disabled={skeleton}
    >
      {skeleton ? (
        <Skeleton width={30} height={30} radius={6} />
      ) : (
        <SubjectIcon image={item.subject_image} size={30} />
      )}
      <View style={s.body}>
        <Words skeleton={skeleton} style={s.name} numberOfLines={1}>
          {marksClassLabel(item)}
        </Words>
        <Words skeleton={skeleton} style={s.meta} numberOfLines={1}>
          {item.subject_name} · {plural(item.students, 'student')}
        </Words>
        <Words skeleton={skeleton} style={[s.status, added && s.statusAdded]} numberOfLines={1}>
          {status}
        </Words>
      </View>
      {skeleton ? (
        <SkeletonIcon iconName="chevron-forward" size={13} />
      ) : (
        <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
      )}
    </TouchableOpacity>
  );
};

const MarksClassesScreen = ({ navigation, route }: any) => {
  const exam: Exam = route.params.exam;
  const [classes, setClasses] = useState<MarksClass[]>([]);
  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back from a saved class updates the list in place.
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The classes are the teacher's whatever the exam: this exam's last list,
  // else the last one of any exam.
  const [lastHere, rememberHere] = useLastLoaded<MarksClass[]>(`marks-classes:${exam.id}`);
  const [lastAny, rememberAny] = useLastLoaded<MarksClass[]>('marks-classes');
  const last = Array.isArray(lastHere) ? lastHere : lastAny;

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const list = await getMarksClasses(exam.id);
        setClasses(list);
        setLoaded(true);
        rememberHere(list);
        rememberAny(list);
      } catch (e: any) {
        console.log('[getMarksClasses] Error:', e?.response?.status, e?.message);
        setError(marksErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [exam.id, rememberHere, rememberAny],
  );

  const reload = useCallback(() => load(true), [load]);

  useFocusLoad(() => load());

  // While it loads, the page is drawn from the classes it shows.
  const shown = !loading ? classes : loaded ? classes : Array.isArray(last) ? last : SAMPLE_CLASSES;

  const page = (skeleton: boolean) =>
    shown.length === 0 ? (
      <DocNoData
        icon="people-outline"
        title="No classes assigned"
        subtitle="Classes and subjects from your timetable will appear here."
        skeleton={skeleton}
      />
    ) : (
      <>
        <Words skeleton={skeleton} style={s.count}>
          Choose a class · {shown.length} {shown.length === 1 ? 'class' : 'classes'}
        </Words>
        {shown.map((item, i) => (
          <ClassRow
            key={classKey(item)}
            item={item}
            isLast={i === shown.length - 1}
            skeleton={skeleton}
            onPress={() => navigation.navigate('MarksSheet', { exam, cls: item })}
          />
        ))}
      </>
    );

  return (
    <View style={s.root}>
      <DocHeader title={exam.name} onBackPress={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.list, (shown.length === 0 || (!loading && error && !loaded)) && s.listEmpty]}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {loading ? (
          page(true)
        ) : error && !loaded ? (
          <View style={s.centeredBox}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity onPress={reload} hitSlop={10}>
              <Text style={s.linkText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          page(false)
        )}
      </ScrollView>
    </View>
  );
};

export default MarksClassesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, marginTop: 12, marginBottom: 2 },

  // Row — the subject's icon tile, then the class, subject and marks status
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  status: { fontSize: 12, color: theme.colors.textMuted },
  statusAdded: { color: theme.colors.primary, fontWeight: '500' },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

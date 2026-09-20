import React, { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import { Skeleton } from '../../components/Skeleton';
import { AppAlert, AppDialog } from '../../components/AppDialog';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  StudentRow,
  TeacherClass,
  deleteStudent,
  getMyClasses,
  getStudents,
} from '../../api/teacherStudentApi';

/**
 * A class teacher's own students, in the More screen — the admin panel's
 * Students module for the class they are class teacher of, drawn as Subjects
 * is: a count, then a row per student with their photo, their name and their
 * numbers. The header's + adds one, a row opens it to edit, and the bin on
 * the row removes it.
 *
 * A teacher who is class teacher of no class sees that, and adds no one.
 */

const TITLE = 'Students';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The class a row belongs to, said the way the panel says it: "Class 5 · A".
const classOf = (s: { class?: string | null; section?: string | null }) =>
  [s.class, s.section].filter(Boolean).join(' · ');

// ── One student ──────────────────────────────────────────────────────────────
//   (photo)  Aarav Sharma                                  [bin]  >
//            Roll 12 · Adm 2026-0007
const Avatar = ({ uri, name }: { uri?: string | null; name: string }) => {
  const [failed, setFailed] = useState(false);

  if (uri && !failed) {
    return <Image source={{ uri }} style={s.photo} onError={() => setFailed(true)} />;
  }

  return (
    <View style={[s.photo, s.initialBox]}>
      <Text style={s.initial}>{(name || 'S').charAt(0).toUpperCase()}</Text>
    </View>
  );
};

const Row = ({
  student,
  meta,
  onOpen,
  onRemove,
  isLast,
}: {
  student: StudentRow;
  meta: string;
  onOpen: () => void;
  onRemove: () => void;
  isLast: boolean;
}) => (
  <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onOpen}>
    <Avatar uri={student.image} name={student.full_name} />

    <View style={s.body}>
      <Text style={s.name} numberOfLines={1}>
        {student.full_name}
      </Text>
      {!!meta && (
        <Text style={s.meta} numberOfLines={1}>
          {meta}
        </Text>
      )}
    </View>

    {!student.is_active && <Text style={s.off}>OFF</Text>}

    <TouchableOpacity style={s.remove} hitSlop={8} activeOpacity={0.6} onPress={onRemove}>
      <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} />
    </TouchableOpacity>

    <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
  </TouchableOpacity>
);

const ListSkeleton = () => (
  <View style={s.list}>
    <View style={s.skCount}>
      <Skeleton width={70} height={12} />
    </View>
    {Array.from({ length: 6 }, (_, i) => (
      <View key={i} style={[s.row, i < 5 && s.rowDivider]}>
        <Skeleton width={34} height={34} radius={17} />
        <View style={s.skBody}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="35%" height={12} />
        </View>
        <Skeleton width={8} height={13} />
      </View>
    ))}
  </View>
);

// ── Screen ───────────────────────────────────────────────────────────────────
const TeacherStudentsScreen = ({ navigation }: any) => {
  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The student the bin was tapped on, waiting to be confirmed.
  const [removing, setRemoving] = useState<StudentRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mine, list] = await Promise.all([getMyClasses(), getStudents({ per_page: 200 })]);
      setClasses(mine);
      setStudents(list.students ?? []);
    } catch (e: any) {
      setError(apiErr(e, 'Could not load your students.'));
      setClasses([]);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusLoad(load);
  const { refreshing, onRefresh } = useRefresh(load);

  const isClassTeacher = (classes?.length ?? 0) > 0;
  // With one class every row says the same thing, so the class is left out.
  const oneClass = (classes?.length ?? 0) === 1;

  const add = () => navigation.navigate('TeacherStudentForm', { classes });

  const remove = async () => {
    if (!removing || busy) return;
    setBusy(true);
    try {
      await deleteStudent(removing.id);
      setStudents(prev => prev.filter(x => x.id !== removing.id));
      setRemoving(null);
    } catch (e: any) {
      AppAlert.alert('Could not remove', apiErr(e, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const body = () => {
    if (loading && students.length === 0 && !refreshing) return <ListSkeleton />;

    if (error && students.length === 0) {
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

    if (!isClassTeacher) {
      return (
        <DocNoData
          icon="people-outline"
          title="Not a class teacher"
          subtitle="You are not the class teacher of any class yet, so there are no students to keep here."
        />
      );
    }

    return (
      <FlatList
        data={students}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={[s.list, students.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          students.length > 0 ? (
            <Text style={s.count}>
              {plural(students.length, 'student')}
              {oneClass && classes?.[0] ? ` · ${classOf({ class: classes[0].class, section: classes[0].section })}` : ''}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <DocNoData
            icon="person-add-outline"
            title="No students yet"
            subtitle="Add the students of your class with + at the top."
          />
        }
        renderItem={({ item, index }) => (
          <Row
            student={item}
            meta={[
              oneClass ? null : classOf(item),
              item.roll_no ? `Roll ${item.roll_no}` : null,
              item.admission_no ? `Adm ${item.admission_no}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onOpen={() => navigation.navigate('TeacherStudentForm', { id: item.id, classes })}
            onRemove={() => setRemoving(item)}
            isLast={index === students.length - 1}
          />
        )}
      />
    );
  };

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={isClassTeacher ? <HeaderIconButton icon="add" onPress={add} /> : undefined}
      />
      {body()}

      <AppDialog
        visible={!!removing}
        title="Remove this student?"
        message={
          removing
            ? `${removing.full_name} and their login will be deleted. This cannot be undone.`
            : ''
        }
        actions={[
          { text: 'Cancel', style: 'cancel', onPress: () => setRemoving(null) },
          { text: 'Remove', style: 'destructive', onPress: remove, loading: busy },
        ]}
        onRequestClose={() => setRemoving(null)}
      />
    </View>
  );
};

export default TeacherStudentsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },

  // Row — the photo, the name and the numbers under it
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  photo: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.background },
  initialBox: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  off: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },
  remove: { padding: 2 },

  // Loading
  skCount: { paddingTop: 13, paddingBottom: 3 },
  skBody: { flex: 1, gap: 8 },

  // Error
  centered: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

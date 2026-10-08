import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { StudentRow, TeacherClass, getMyClasses, getStudents } from '../../api/teacherStudentApi';
import StudentPhotoModal from './StudentPhotoModal';

/**
 * A class teacher's own students, in the More screen — the admin panel's
 * Students module for the class they are class teacher of, drawn as Subjects
 * is: a count, then a row per student with their photo, their name and their
 * numbers, in name order. The header's + adds one and a row opens it to edit,
 * where it can also be removed. A photo, tapped, opens large, to be cropped
 * and saved there (StudentPhotoModal).
 *
 * A teacher who is class teacher of no class sees that, and adds no one.
 */

const TITLE = 'Students';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The class a row belongs to, said the way the panel says it: "Class 5 · A".
const classOf = (s: { class?: string | null; section?: string | null }) =>
  [s.class, s.section].filter(Boolean).join(' · ');

// ── One student ──────────────────────────────────────────────────────────────
//   (photo)  Aarav Sharma                                          >
//            Roll 12 · Adm 2026-0007
// The photo is decoded at the avatar's size (resizeMethod "resize"): students'
// photos are full camera shots (4000 px), and a class of them decoded whole
// ran out of image memory, so some rows lost theirs at random. One that still
// misses is asked for twice more before the initial stands in.
// The circle shows the top of the photo, where the face is — as the photo
// editor's dotted circle and the web panel's lists show it: once the photo's
// shape is known it is drawn the circle's width (or height) and laid from the
// top; until then, filled from the middle as before. A circle set with
// Profile on the large photo (photo_circle) is drawn as it was set instead.
const Avatar = ({
  uri,
  name,
  circle,
}: {
  uri?: string | null;
  name: string;
  circle?: StudentRow['photo_circle'];
}) => {
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const [shape, setShape] = useState<{ w: number; h: number } | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFailed(false);
    setTries(0);
    setShape(null);
  }, [uri]);
  useEffect(() => () => {
    if (retry.current) clearTimeout(retry.current);
  }, []);

  const onError = () => {
    if (tries < 2) retry.current = setTimeout(() => setTries(t => t + 1), 800 * (tries + 1));
    else setFailed(true);
  };

  if (uri && !failed) {
    const size = s.photo.width as number;
    // The photo laid so the circle set fills the round box.
    const set =
      circle && circle.w > 0 && circle.h > 0
        ? {
            position: 'absolute' as const,
            width: size / circle.w,
            height: size / circle.h,
            left: (-circle.x * size) / circle.w,
            top: (-circle.y * size) / circle.h,
          }
        : null;
    const top = shape
      ? shape.h >= shape.w
        ? { position: 'absolute' as const, left: 0, top: 0, width: size, height: (size * shape.h) / shape.w }
        : { position: 'absolute' as const, top: 0, height: size, width: (size * shape.w) / shape.h, left: (size - (size * shape.w) / shape.h) / 2 }
      : null;
    return (
      <View style={[s.photo, s.photoClip]}>
        <Image
          key={tries}
          source={{ uri }}
          style={set ?? top ?? s.photo}
          resizeMethod="resize"
          onError={onError}
          onLoad={e => {
            const src: any = e?.nativeEvent?.source;
            if (src?.width > 0 && src?.height > 0) setShape({ w: src.width, h: src.height });
          }}
        />
      </View>
    );
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
  onPhoto,
  isLast,
}: {
  student: StudentRow;
  meta: string;
  onOpen: () => void;
  /** The photo tapped: shown large. */
  onPhoto: () => void;
  isLast: boolean;
}) => (
  <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onOpen}>
    {student.image ? (
      <TouchableOpacity onPress={onPhoto} activeOpacity={0.7} hitSlop={6}>
        <Avatar uri={student.image} name={student.full_name} circle={student.photo_circle} />
      </TouchableOpacity>
    ) : (
      <Avatar uri={student.image} name={student.full_name} />
    )}

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
  // The student whose photo is shown large.
  const [viewing, setViewing] = useState<StudentRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mine, list] = await Promise.all([
        getMyClasses(),
        getStudents({ per_page: 200, sort: 'name_asc' }),
      ]);
      setClasses(mine);
      // A to Z, whatever order the school's own list came back in.
      setStudents(
        [...(list.students ?? [])].sort((a, b) =>
          (a.full_name ?? '').localeCompare(b.full_name ?? '', undefined, { sensitivity: 'base' }),
        ),
      );
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
            onPhoto={() => setViewing(item)}
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

      <StudentPhotoModal
        student={viewing}
        onClose={() => setViewing(null)}
        // The cropped photo stands in the list at once (its top, till a circle is set on it).
        onSaved={(id, image) =>
          setStudents(prev => prev.map(x => (x.id === id ? { ...x, image, photo_circle: null } : x)))
        }
        // So does the circle set with Profile.
        onCircleSaved={(id, circle) =>
          setStudents(prev => prev.map(x => (x.id === id ? { ...x, photo_circle: circle } : x)))
        }
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
  photoClip: { overflow: 'hidden' },
  initialBox: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  off: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },

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

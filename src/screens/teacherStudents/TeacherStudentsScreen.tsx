import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import { Skeleton, SkeletonIcon, SkeletonText } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader, DocNoData } from '../more/docUi';
import { StudentRow, TeacherClass, getMyClasses, getStudents } from '../../api/teacherStudentApi';
import StudentPhotoModal from './StudentPhotoModal';

/**
 * A class teacher's own students, in the More screen — the admin panel's
 * Students module for the class they are class teacher of, drawn as Subjects
 * is: a count, then a row per student with their photo, their name and their
 * class and admission number, in name order. The header's + adds one; a row
 * opens the student to look at (TeacherStudentDetail), whose Edit opens the
 * form, where they can also be removed. A photo, tapped, opens large, to be
 * cropped and saved there (StudentPhotoModal).
 *
 * A teacher who is class teacher of no class sees that, and adds no one — but
 * only once the school has said so: a load that failed keeps what was on the
 * screen (or, the first time, says it failed with Try again), and is never
 * read as "no classes". While the list first loads it is drawn as a skeleton
 * of the list last loaded on this phone, row for row.
 */

const TITLE = 'Students';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The class a row belongs to, with the last letter of its section in brackets:
// "Class 5 (A)" — "Section A" is A, and so is a section named just "A".
const classOf = (s: { class?: string | null; section?: string | null }) => {
  const cls = quietCaps(s.class);
  const letter = (s.section ?? '').trim().slice(-1).toUpperCase();
  return [cls, letter ? `(${letter})` : null].filter(Boolean).join(' ');
};

// ── One student ──────────────────────────────────────────────────────────────
//   (photo)  Aarav Sharma                                          >
//            Class 5 (A) · 2026-0007
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
  skeleton,
}: {
  student: StudentRow;
  meta: string;
  onOpen: () => void;
  /** The photo tapped: shown large. */
  onPhoto: () => void;
  isLast: boolean;
  /** Drawn as a skeleton: bars where the name and the numbers will be. */
  skeleton?: boolean;
}) =>
  skeleton ? (
    <View style={[s.row, !isLast && s.rowDivider]}>
      <Skeleton width={34} height={34} radius={17} />
      <View style={s.body}>
        <SkeletonText style={s.name} numberOfLines={1}>
          {student.full_name}
        </SkeletonText>
        {!!meta && (
          <SkeletonText style={s.meta} numberOfLines={1}>
            {meta}
          </SkeletonText>
        )}
      </View>
      {!student.is_active && <SkeletonText style={s.off}>OFF</SkeletonText>}
      <SkeletonIcon iconName="chevron-forward" size={13} />
    </View>
  ) : (
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

// ── What the list keeps for its skeleton ─────────────────────────────────────
// The last list loaded on this phone — the classes and, for each student, what
// a row says — so the next first load draws its skeleton row for row: as many
// rows as the class has, each bar as long as that name and those numbers.
interface KeptList {
  classes: TeacherClass[];
  students: Pick<StudentRow, 'id' | 'full_name' | 'class' | 'section' | 'admission_no' | 'is_active'>[];
}

const toKeep = (classes: TeacherClass[], students: StudentRow[]): KeptList => ({
  classes,
  students: students.map(x => ({
    id: x.id,
    full_name: x.full_name,
    class: x.class,
    section: x.section,
    admission_no: x.admission_no,
    is_active: x.is_active,
  })),
});

// A list never loaded on this phone: an ordinary class, so the skeleton has
// the shape of one.
const SAMPLE: KeptList = {
  classes: [],
  students: ['Aarav Sharma', 'Ananya Verma', 'Ishaan Gupta', 'Kavya Singh', 'Mohammad Arif', 'Riya Patel', 'Vivaan Yadav']
    .map((full_name, i) => ({
      id: -1 - i,
      full_name,
      class: 'Class 6',
      section: 'Section A',
      admission_no: `26SSIC1603${String(10 + i * 7)}`,
      is_active: true,
    })),
};

// ── Screen ───────────────────────────────────────────────────────────────────
const TeacherStudentsScreen = ({ navigation }: any) => {
  // Null until the school has answered: an empty list is never read as "not a
  // class teacher" before then, nor after a load that failed.
  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  // The skeleton shows on the first load and on "Try again"; coming back to the
  // screen, or a pull, updates the list in place.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The student whose photo is shown large.
  const [viewing, setViewing] = useState<StudentRow | null>(null);
  const [last, rememberLast] = useLastLoaded<KeptList>('teacher-students');
  // The newest load wins: an older one that answers late is ignored.
  const seq = useRef(0);

  const load = useCallback(
    async (opts: { skeleton?: boolean; tellFailure?: boolean } = {}) => {
      const mine = ++seq.current;
      if (opts.skeleton) setLoading(true);
      try {
        const [own, list] = await Promise.all([
          getMyClasses(),
          getStudents({ per_page: 200, sort: 'name_asc' }),
        ]);
        if (mine !== seq.current) return;
        // A to Z, whatever order the school's own list came back in.
        const sorted = [...(list?.students ?? [])].sort((a, b) =>
          (a.full_name ?? '').localeCompare(b.full_name ?? '', undefined, { sensitivity: 'base' }),
        );
        setClasses(own);
        setStudents(sorted);
        setError(null);
        rememberLast(toKeep(own, sorted));
      } catch (e: any) {
        if (mine !== seq.current) return;
        const message = apiErr(e, 'Could not load your students.');
        // What is already on screen stays; only a first load shows the error.
        setError(message);
        if (opts.tellFailure) AppAlert.alert('Could not refresh', message);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    },
    [rememberLast],
  );

  useFocusLoad(load);
  const pull = useCallback(() => load({ tellFailure: true }), [load]);
  const { refreshing, onRefresh } = useRefresh(pull);
  const retry = () => load({ skeleton: true });

  const loaded = classes !== null && students !== null;
  const isClassTeacher = (classes?.length ?? 0) > 0;

  const add = () => navigation.navigate('TeacherStudentForm', { classes });

  // The list, as rows — the real one, or the last one kept drawn as a skeleton.
  const list = (rows: StudentRow[], own: TeacherClass[] | null, skeleton: boolean) => {
    // With one class every row says the same thing, so the count line names it.
    const single = (own?.length ?? 0) === 1;
    return (
      <FlatList
        data={rows}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={[s.list, rows.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!skeleton}
        refreshControl={skeleton ? undefined : <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          rows.length > 0 ? (
            skeleton ? (
              <SkeletonText style={s.count}>
                {plural(rows.length, 'student')}
                {single && own?.[0] ? ` · ${classOf({ class: own[0].class, section: own[0].section })}` : ''}
              </SkeletonText>
            ) : (
              <Text style={s.count}>
                {plural(rows.length, 'student')}
                {single && own?.[0] ? ` · ${classOf({ class: own[0].class, section: own[0].section })}` : ''}
              </Text>
            )
          ) : null
        }
        ListEmptyComponent={
          <DocNoData
            icon="person-add-outline"
            title="No students yet"
            subtitle="Add the students of your class with + at the top."
            skeleton={skeleton}
          />
        }
        renderItem={({ item, index }) => (
          <Row
            student={item}
            // "Class 2 (A) · 2024015" — the values alone, no labels.
            meta={[classOf(item), item.admission_no].filter(Boolean).join(' · ')}
            onOpen={() => navigation.navigate('TeacherStudentDetail', { id: item.id, classes, row: item })}
            onPhoto={() => setViewing(item)}
            isLast={index === rows.length - 1}
            skeleton={skeleton}
          />
        )}
      />
    );
  };

  const body = () => {
    if (!loaded && loading) {
      // Drawn from the list last loaded here, row for row.
      const kept = last && Array.isArray(last.students) ? last : SAMPLE;
      return list(kept.students as StudentRow[], kept.classes, true);
    }

    if (!loaded) {
      return (
        <View style={s.centered}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error ?? 'Could not load your students.'}</Text>
          <TouchableOpacity onPress={retry} hitSlop={10}>
            <Text style={s.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Said only once the school has answered with no class for them.
    if (!isClassTeacher) {
      return (
        <ScrollView
          contentContainerStyle={s.listEmpty}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <DocNoData
            icon="people-outline"
            title="Not a class teacher"
            subtitle="You are not the class teacher of any class yet, so there are no students to keep here."
          />
        </ScrollView>
      );
    }

    return list(students ?? [], classes, false);
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
          setStudents(prev => prev?.map(x => (x.id === id ? { ...x, image, photo_circle: null } : x)) ?? prev)
        }
        // So does the circle set with Profile.
        onCircleSaved={(id, circle) =>
          setStudents(prev => prev?.map(x => (x.id === id ? { ...x, photo_circle: circle } : x)) ?? prev)
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

  // Error
  centered: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton, SkeletonIcon, SkeletonText } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import type { TeacherDetail, TeacherRow, TeacherStats } from '../../api/adminTeacherApi';

/**
 * Teachers' shared pieces, drawn as the Students list is: plain rows — the
 * photo, the name and a line or two under it, an arrow — with a line between
 * them.
 *
 * A row can be drawn as a skeleton of itself — bars as long as its words — so
 * the list's first load draws the teachers it held the last time it was opened
 * on this phone, row for row.
 */

/** "Class 5 · A, Class 6", from the class-teacher duties the panel lists. */
export const classTeacherLine = (list?: TeacherRow['class_teacher']) =>
  (list ?? [])
    .map(a => [a.class, a.section].filter(Boolean).join(' · '))
    .filter(Boolean)
    .join(', ');

// ── The photo, or the initial ────────────────────────────────────────────────
// Decoded at the avatar's size: teachers' photos can be full camera shots, and
// a list of them decoded whole runs out of image memory.
export const TeacherAvatar = ({ uri, name, size = 34 }: { uri?: string | null; name?: string | null; size?: number }) => {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (uri && !failed) {
    return <Image source={{ uri }} style={[s.photo, box]} resizeMethod="resize" onError={() => setFailed(true)} />;
  }
  return (
    <View style={[s.photo, box, s.initialBox]}>
      <Text style={[s.initial, { fontSize: Math.round(size * 0.41) }]}>{(name || 'T').charAt(0).toUpperCase()}</Text>
    </View>
  );
};

// ── One teacher ──────────────────────────────────────────────────────────────
//   (photo)  Meera Sharma                                          >
//            meera@tds · EMP001 · 9876543210
//            Class teacher · Class 5 · A
export const TeacherListRow = ({
  teacher,
  onOpen,
  isLast,
  skeleton,
}: {
  teacher: TeacherRow;
  onOpen: () => void;
  isLast: boolean;
  /** Bars where the name and the numbers will be. */
  skeleton?: boolean;
}) => {
  const meta = [teacher.username, teacher.employee_id, teacher.phone].filter(Boolean).join(' · ');
  const duty = classTeacherLine(teacher.class_teacher);

  if (skeleton) {
    return (
      <View style={[s.row, !isLast && s.rowDivider]}>
        <Skeleton width={34} height={34} radius={17} />
        <View style={s.body}>
          <SkeletonText style={s.name} numberOfLines={1}>{teacher.name || '—'}</SkeletonText>
          {!!meta && <SkeletonText style={s.meta} numberOfLines={1}>{meta}</SkeletonText>}
          {!!duty && <SkeletonText style={s.duty} numberOfLines={1}>{`Class teacher · ${duty}`}</SkeletonText>}
        </View>
        {!teacher.is_active && <SkeletonText style={s.off}>OFF</SkeletonText>}
        <SkeletonIcon iconName="chevron-forward" size={13} />
      </View>
    );
  }

  return (
    <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onOpen}>
      <TeacherAvatar uri={teacher.image} name={teacher.name} />
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{teacher.name || '—'}</Text>
        {!!meta && <Text style={s.meta} numberOfLines={1}>{meta}</Text>}
        {!!duty && <Text style={s.duty} numberOfLines={1}>{`Class teacher · ${duty}`}</Text>}
      </View>
      {!teacher.is_active && <Text style={s.off}>OFF</Text>}
      <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
};

// ── What the list keeps for its skeleton, and what it draws never having loaded
export interface KeptTeachers {
  teachers: Pick<TeacherRow, 'id' | 'user_id' | 'name' | 'username' | 'employee_id' | 'phone' | 'is_active' | 'class_teacher'>[];
  this_year?: number | null;
}

export const keepTeacherRows = (rows: TeacherRow[], stats?: TeacherStats | null): KeptTeachers => ({
  teachers: rows.map(r => ({
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    username: r.username,
    employee_id: r.employee_id,
    phone: r.phone,
    is_active: r.is_active,
    class_teacher: r.class_teacher,
  })),
  this_year: stats?.this_year ?? null,
});

const NAMES = ['Meera Sharma', 'Rakesh Verma', 'Anjali Gupta', 'Sunil Yadav', 'Pooja Singh', 'Imran Khan', 'Neha Mishra'];

/** An ordinary staff room, for a list never opened on this phone. */
export const sampleTeachers = (): KeptTeachers => ({
  teachers: NAMES.map((name, i) => ({
    id: -1 - i,
    user_id: 0,
    name,
    username: `${name.split(' ')[0].toLowerCase()}@school`,
    employee_id: `EMP00${i + 1}`,
    phone: `98765432${String(10 + i * 7).slice(-2)}`,
    is_active: true,
    class_teacher: i < 4 ? [{ class: `Class ${i + 3}`, section: 'A' }] : [],
  })),
  this_year: 2,
});

/** What is kept of a teacher for their page's and their form's skeleton: the words, not the photo. */
export const keepTeacherDetail = (d: TeacherDetail): TeacherDetail => ({ ...d, image: d.image ? 'kept' : null });

/** A teacher never opened on this phone: an ordinary one, with what their row already said. */
export const sampleTeacherDetail = (row?: Partial<TeacherDetail> | null): TeacherDetail => ({
  id: 0,
  user_id: 0,
  name: 'Meera Sharma',
  email: 'meera.sharma@example.com',
  username: 'meera@school',
  phone: '9876543210',
  gender: 'female',
  employee_id: 'EMP001',
  qualification: 'M.Sc, B.Ed',
  is_active: true,
  dob: '1990-06-15',
  date_of_joining: '2021-04-01',
  address: 'House 12, Gandhi Nagar',
  city: 'Lucknow',
  state: 'Uttar Pradesh',
  pincode: '226001',
  assignments: [],
  ...(row ?? {}),
});

const __mk_s = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  duty: { fontSize: 12, color: theme.colors.textMuted },
  off: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },

  photo: { backgroundColor: theme.colors.background },
  initialBox: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

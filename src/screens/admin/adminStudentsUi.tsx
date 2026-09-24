import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import type { StudentRow } from '../../api/adminStudentApi';

/**
 * Students' shared pieces, drawn as the student's Subjects list is: a count
 * over plain rows — a small tile, a name and a line under it, an arrow — with a
 * line between them.
 */

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

// ── A class or a section ─────────────────────────────────────────────────────
//   [▣]  Class 5                                              >
//        2 sections · 64 students
export const GroupRow = ({
  icon,
  letter,
  title,
  meta,
  isLast,
  onPress,
}: {
  /** The tile's icon — or, with letter, the section's letter in it. */
  icon?: string;
  letter?: string;
  title: string;
  meta?: string | null;
  isLast: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onPress}>
    <View style={s.tile}>
      {letter ? (
        <Text style={s.tileLetter} numberOfLines={1}>{letter}</Text>
      ) : (
        <VectorIcon iconSet="Ionicons" iconName={icon ?? 'school-outline'} size={17} color={theme.colors.primary} />
      )}
    </View>
    <View style={s.body}>
      <Text style={s.name} numberOfLines={1}>{title}</Text>
      {!!meta && <Text style={s.meta} numberOfLines={1}>{meta}</Text>}
    </View>
    <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
  </TouchableOpacity>
);

// ── One student ──────────────────────────────────────────────────────────────
//   (photo)  Aarav Sharma                                          >
//            2026-0007
//            Class 5 · A
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

export const StudentListRow = ({ student, onOpen, isLast }: { student: StudentRow; onOpen: () => void; isLast: boolean }) => {
  const cls = [student.class, student.section].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onOpen}>
      <Avatar uri={student.image} name={student.full_name} />
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{student.full_name}</Text>
        {!!student.admission_no && <Text style={s.meta} numberOfLines={1}>{student.admission_no}</Text>}
        {!!cls && <Text style={s.cls} numberOfLines={1}>{cls}</Text>}
      </View>
      {!student.is_active && <Text style={s.off}>OFF</Text>}
      <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
};

// ── Loading: the rows at their own sizes ─────────────────────────────────────
export const ListSkeleton = ({ photo, rows = 7 }: { photo?: boolean; rows?: number }) => (
  <View style={s.list}>
    <View style={s.skCount}><Skeleton width={90} height={12} /></View>
    {Array.from({ length: rows }, (_, i) => (
      <View key={i} style={[s.row, i < rows - 1 && s.rowDivider]}>
        {photo ? <Skeleton width={34} height={34} radius={17} /> : <Skeleton width={30} height={30} radius={6} />}
        <View style={s.skBody}>
          <Skeleton width={`${50 + ((i * 13) % 30)}%`} height={13} />
          <Skeleton width={`${34 + ((i * 7) % 24)}%`} height={11} />
        </View>
      </View>
    ))}
  </View>
);

const __mk_s = () => StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tile: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
  },
  tileLetter: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  cls: { fontSize: 12, color: theme.colors.textMuted },
  off: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },

  photo: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.background },
  initialBox: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  skCount: { paddingTop: 13, paddingBottom: 3 },
  skBody: { flex: 1, gap: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

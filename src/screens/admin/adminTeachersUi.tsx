import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import type { TeacherRow } from '../../api/adminTeacherApi';

/**
 * Teachers' shared pieces, drawn as the Students list is: plain rows — the
 * photo, the name and a line or two under it, an arrow — with a line between
 * them.
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
export const TeacherListRow = ({ teacher, onOpen, isLast }: { teacher: TeacherRow; onOpen: () => void; isLast: boolean }) => {
  const meta = [teacher.username, teacher.employee_id, teacher.phone].filter(Boolean).join(' · ');
  const duty = classTeacherLine(teacher.class_teacher);

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

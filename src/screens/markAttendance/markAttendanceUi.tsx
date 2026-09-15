import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import constant from '../../utils/constant';
import type { AttendanceStatus } from './markAttendanceData';

/**
 * Shared by Mark Attendance and its review: a student as it is being marked,
 * their photo, and the totals.
 */

export interface MarkStudent {
  id: number; // student_detail_id
  rollNo: string;
  admissionNo: string;
  name: string;
  photo: string | null;
  status: AttendanceStatus;
}

// Resolve a (possibly relative) photo path into a full URL.
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

export const countByStatus = (students: MarkStudent[]) =>
  students.reduce(
    (acc, st) => {
      acc[st.status]++;
      return acc;
    },
    { present: 0, absent: 0, holiday: 0 } as Record<AttendanceStatus, number>,
  );

// ── Student photo with first-letter fallback ──
export const Avatar = ({ name, photo }: { name: string; photo: string | null }) => {
  const uri = resolveFileUrl(photo);
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return <Image source={{ uri }} style={s.avatar} onError={() => setFailed(true)} />;
  }
  return (
    <View style={[s.avatar, s.avatarFallback]}>
      <Text style={s.avatarInitial}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
};

const __mk_s = () => StyleSheet.create({
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: {
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

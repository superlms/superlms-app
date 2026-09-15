import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import constant from '../../utils/constant';
import { Skeleton } from '../../components/Skeleton';
import { STATUS_CONFIG, formatLong, type AttendanceStatus } from './markAttendanceData';

/**
 * Shared by Mark Attendance and Review Attendance: a student as they are being
 * marked, their photo, and the review — the day, the class, a line of totals,
 * then the students under each status — with its skeleton.
 */

export interface MarkStudent {
  id: number; // student_detail_id
  rollNo: string;
  admissionNo: string;
  name: string;
  photo: string | null;
  /** null until the teacher marks them. */
  status: AttendanceStatus | null;
}

// Resolve a (possibly relative) photo path into a full URL.
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

/** Every student has a status — the class can go on to be submitted. */
export const allMarked = (students: MarkStudent[]) =>
  students.length > 0 && students.every(st => st.status !== null);

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

// ── The review ───────────────────────────────────────────────────────────────
// Present first, then absent, then holiday; anyone not marked yet comes last.
type GroupKey = AttendanceStatus | 'unmarked';
const GROUP_ORDER: GroupKey[] = ['present', 'absent', 'holiday', 'unmarked'];

const groupLabel = (key: GroupKey) => (key === 'unmarked' ? 'Not marked' : STATUS_CONFIG[key].full);
const groupColor = (key: GroupKey) =>
  key === 'unmarked' ? theme.colors.textMuted : STATUS_CONFIG[key].color;

export const reviewGroups = (students: MarkStudent[]) =>
  GROUP_ORDER.map(key => ({
    key,
    list: students.filter(st => (st.status ?? 'unmarked') === key),
  })).filter(g => g.list.length > 0);

//   Tue, 15 Sep 2026
//   Class 5 - A
//   Present 30   Absent 2
//
//   Present · 30
//   12  (photo)  Aarav Sharma                          Present
//                2024/0012
export const ReviewContent = ({
  date,
  classLabel,
  students,
}: {
  date: string;
  classLabel: string;
  students: MarkStudent[];
}) => {
  const groups = reviewGroups(students);
  return (
    <>
      <View style={s.intro}>
        <Text style={s.introTitle}>{formatLong(date)}</Text>
        {!!classLabel && <Text style={s.meta}>{classLabel}</Text>}
        <View style={s.totals}>
          {groups.map(g => (
            <Text key={g.key} style={s.total}>
              {groupLabel(g.key)}{' '}
              <Text style={[s.totalNum, { color: groupColor(g.key) }]}>{g.list.length}</Text>
            </Text>
          ))}
        </View>
      </View>

      {groups.map(g => (
        <View key={g.key}>
          <Text style={s.groupTitle}>
            {groupLabel(g.key)} · {g.list.length}
          </Text>

          {g.list.map((st, i) => (
            <View key={st.id} style={[s.row, i < g.list.length - 1 && s.rowDivider]}>
              <Text style={s.roll}>{st.rollNo || '—'}</Text>
              <Avatar name={st.name} photo={st.photo} />
              <View style={s.body}>
                <Text style={s.name} numberOfLines={1}>
                  {st.name}
                </Text>
                <Text style={s.meta} numberOfLines={1}>
                  {st.admissionNo || '—'}
                </Text>
              </View>
              <Text style={[s.status, { color: groupColor(g.key) }]}>{groupLabel(g.key)}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
};

// The review line for line: the day, class and totals, then each status
// heading and its students — `groups` is how many students each heading holds.
export const ReviewSkeleton = ({ groups }: { groups: number[] }) => {
  const shown = groups.length > 0 ? groups : [6];
  return (
    <>
      <View style={s.intro}>
        <Skeleton width="50%" height={15} />
        <Skeleton width="28%" height={13} />
        <View style={s.totals}>
          {shown.map((_, i) => (
            <Skeleton key={i} width={74} height={13} />
          ))}
        </View>
      </View>

      {shown.map((count, gi) => {
        const n = Math.min(count, 15);
        return (
          <View key={gi}>
            <View style={s.skGroupTitle}>
              <Skeleton width={80} height={12} />
            </View>
            {Array.from({ length: n }, (_, i) => (
              <View key={i} style={[s.row, i < n - 1 && s.rowDivider]}>
                <View style={s.skRoll}>
                  <Skeleton width={16} height={12} />
                </View>
                <Skeleton width={34} height={34} radius={17} />
                <View style={s.skBody}>
                  <Skeleton width="55%" height={14} />
                  <Skeleton width="30%" height={12} />
                </View>
                <Skeleton width={52} height={13} />
              </View>
            ))}
          </View>
        );
      })}
    </>
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

  // The day, the class, the totals
  intro: {
    paddingTop: 16,
    paddingBottom: 14,
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  introTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 },
  total: { fontSize: 13, color: theme.colors.textSecondary },
  totalNum: { fontWeight: '600' },

  // A status and its students
  groupTitle: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 16, paddingBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  roll: { width: 24, fontSize: 13, color: theme.colors.textMuted },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  status: { fontSize: 13, fontWeight: '500' },

  // Loading
  skGroupTitle: { paddingTop: 16, paddingBottom: 6 },
  skRoll: { width: 24 },
  skBody: { flex: 1, gap: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

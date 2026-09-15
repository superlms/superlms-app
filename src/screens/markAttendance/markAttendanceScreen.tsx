import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AttendanceStatus,
  STATUS_CONFIG,
  formatLong,
  isSundayIso,
  sessionStartIso,
  toIso,
} from './markAttendanceData';
import {
  attendanceErrorMessage,
  getStudentsForAttendance,
  type AttendanceClass,
  type AttendanceStudent,
} from '../../api/attendanceApi';
import { theme, onThemeChange } from '../../utils/theme';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad, useRefresh } from '../../hooks/useRefresh';
import { DocHeader, DocNoData } from '../more/docUi';
import AttendanceDateSheet from './AttendanceDateSheet';
import { Avatar, type MarkStudent } from './markAttendanceUi';

/**
 * Mark Attendance, in the Subjects screens' plain look: the date as a row at
 * the top, then the students as rows — each with P / A / H — and Continue at
 * the end of the list, which leads on to the review.
 */

const STATUS_ORDER: AttendanceStatus[] = ['present', 'absent', 'holiday'];

// Map the server's per-student attendance into the P/A/Holiday model.
const mapStatus = (a: AttendanceStudent['attendance']): AttendanceStatus => {
  if (a?.status === 'holiday') return 'holiday';
  if (a?.status === 'absent') return 'absent';
  return 'present'; // present / not_marked default to present
};

const toMarkStudent = (st: AttendanceStudent): MarkStudent => ({
  id: st.student_id,
  rollNo: String(st.roll_no ?? ''),
  admissionNo: String(st.admission_no ?? ''),
  name: st.full_name,
  photo: st.photo ?? null,
  status: mapStatus(st.attendance),
});

// ── One student ──────────────────────────────────────────────────────────────
//   12  (photo)  Aarav Sharma                     (P) (A) (H)
//                2024/0012
const StudentRow = ({
  student,
  last,
  onChange,
}: {
  student: MarkStudent;
  last: boolean;
  onChange: (status: AttendanceStatus) => void;
}) => (
  <View style={[s.row, !last && s.rowDivider]}>
    <Text style={s.roll}>{student.rollNo || '—'}</Text>
    <Avatar name={student.name} photo={student.photo} />
    <View style={s.body}>
      <Text style={s.name} numberOfLines={1}>
        {student.name}
      </Text>
      <Text style={s.meta} numberOfLines={1}>
        {student.admissionNo || '—'}
      </Text>
    </View>
    <View style={s.toggles}>
      {STATUS_ORDER.map(st => {
        const active = student.status === st;
        const cfg = STATUS_CONFIG[st];
        return (
          <TouchableOpacity
            key={st}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6 }}
            onPress={() => onChange(st)}
            style={[s.toggle, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
          >
            <Text style={[s.toggleText, active && s.toggleTextActive]}>{cfg.short}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

// The page line for line: "Mark all as" and its three buttons, then the
// students — roll no, photo, name over admission no, and P / A / H.
const ListSkeleton = () => (
  <View style={s.list}>
    <View style={s.markAll}>
      <Skeleton width={74} height={13} />
      <Skeleton width={70} height={28} radius={14} />
      <Skeleton width={64} height={28} radius={14} />
      <Skeleton width={68} height={28} radius={14} />
    </View>
    {[0, 1, 2, 3, 4, 5, 6].map(i => (
      <View key={i} style={[s.row, i < 6 && s.rowDivider]}>
        <View style={s.skRoll}>
          <Skeleton width={16} height={12} />
        </View>
        <Skeleton width={34} height={34} radius={17} />
        <View style={s.skeletonBody}>
          <Skeleton width="55%" height={14} />
          <Skeleton width="30%" height={12} />
        </View>
        <Skeleton width={114} height={34} radius={17} />
      </View>
    ))}
  </View>
);

const MarkAttendanceScreen = ({ navigation }: any) => {
  // Any day of the session, from 1 April up to today; it opens on today.
  const [today, setToday] = useState(() => toIso(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [dateSheet, setDateSheet] = useState(false);
  const sunday = isSundayIso(selectedDate);

  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [students, setStudents] = useState<MarkStudent[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedClass = useMemo(
    () => classes.find(c => c.assignment_id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );

  // ── Load the teacher's classes + students for the chosen date ──
  const loadClasses = useCallback(async (date: string, quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await getStudentsForAttendance(date);
      const list = res?.classes ?? [];
      setClasses(list);
      setSelectedClassId(prev => {
        const stillThere = list.some(c => c.assignment_id === prev);
        return stillThere ? prev : list[0]?.assignment_id ?? null;
      });
    } catch (e: any) {
      console.log('[getStudentsForAttendance] Error:', e?.response?.status, e?.message);
      setError(attendanceErrorMessage(e));
      setClasses([]);
      setSelectedClassId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // A Sunday is already a holiday: there is nothing to load or mark.
  useEffect(() => {
    if (sunday) {
      setLoading(false);
      setError(null);
      return;
    }
    loadClasses(selectedDate);
  }, [selectedDate, sunday, loadClasses]);

  // Coming back to the screen — after submitting on the review, say — shows
  // what is saved now. The first focus is the mount, already loading above.
  const focusedOnce = useRef(false);
  useFocusLoad(() => {
    if (!focusedOnce.current) {
      focusedOnce.current = true;
      return;
    }
    setToday(toIso(new Date()));
    if (!sunday) loadClasses(selectedDate, true);
  });

  // The chosen class's students, freshly copied to mark whenever the class or
  // the day's data changes.
  useEffect(() => {
    setStudents((selectedClass?.students ?? []).map(toMarkStudent));
  }, [selectedClass]);

  const { refreshing, onRefresh } = useRefresh(() => loadClasses(selectedDate, true));

  // ── Actions ──
  const setStatus = (id: number, status: AttendanceStatus) =>
    setStudents(prev => prev.map(st => (st.id === id ? { ...st, status } : st)));

  // Sets the list only — a holiday for everyone is saved on the review, like
  // any other marking.
  const markAll = (status: AttendanceStatus) =>
    setStudents(prev => prev.map(st => ({ ...st, status })));

  const openReview = () =>
    navigation.navigate('MarkAttendanceReview', {
      date: selectedDate,
      classLabel: selectedClass?.class_info.class_display ?? '',
      students,
    });

  // ── Class pills (when there is more than one) and "Mark all as" ──
  const renderListHead = () => (
    <View>
      {classes.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // A horizontal ScrollView grows to fill a column by default.
          style={s.classBar}
          contentContainerStyle={s.classStrip}
        >
          {classes.map(c => {
            const active = c.assignment_id === selectedClassId;
            return (
              <TouchableOpacity
                key={c.assignment_id}
                activeOpacity={0.7}
                onPress={() => setSelectedClassId(c.assignment_id)}
                style={[s.classPill, active && s.classPillActive]}
              >
                <Text style={[s.classPillText, active && s.classPillTextActive]}>
                  {c.class_info.class_display}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {students.length > 0 && (
        <View style={s.markAll}>
          <Text style={s.markAllLabel}>Mark all as</Text>
          {STATUS_ORDER.map(st => (
            <TouchableOpacity
              key={st}
              activeOpacity={0.6}
              hitSlop={6}
              onPress={() => markAll(st)}
              style={s.markAllBtn}
            >
              <Text style={[s.markAllText, { color: STATUS_CONFIG[st].color }]}>
                {STATUS_CONFIG[st].full}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderBody = () => {
    if (sunday) {
      return (
        <ScrollView contentContainerStyle={s.fillGrow}>
          <DocNoData
            icon="sunny-outline"
            title="Sunday is a holiday"
            subtitle={`${formatLong(selectedDate)} is a Sunday, already marked as a holiday. Choose another date to mark attendance.`}
          />
        </ScrollView>
      );
    }
    if (loading) return <ListSkeleton />;
    if (error) {
      return (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadClasses(selectedDate)} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (classes.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={s.fillGrow}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <DocNoData
            icon="people-outline"
            title="No class assigned"
            subtitle="No classes are assigned to you for attendance. Please contact the administrator."
          />
        </ScrollView>
      );
    }

    return (
      <FlatList
        data={students}
        keyExtractor={i => String(i.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={renderListHead()}
        renderItem={({ item, index }) => (
          <StudentRow
            student={item}
            last={index === students.length - 1}
            onChange={st => setStatus(item.id, st)}
          />
        )}
        ListEmptyComponent={<Text style={s.empty}>No students in this class.</Text>}
        // Continue sits after the last student, reached by scrolling down.
        ListFooterComponent={
          students.length > 0 ? (
            <TouchableOpacity style={s.continueBtn} activeOpacity={0.85} onPress={openReview}>
              <Text style={s.continueText}>Continue</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    );
  };

  return (
    <View style={s.root}>
      <DocHeader title="Mark Attendance" />

      {/* The day being marked — tap to pick another from the calendar */}
      <TouchableOpacity style={s.dateRow} activeOpacity={0.6} onPress={() => setDateSheet(true)}>
        <View style={s.iconSlot}>
          <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={20} color={theme.colors.textMuted} />
        </View>
        <View style={s.body}>
          <Text style={s.name} numberOfLines={1}>
            {formatLong(selectedDate)}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {selectedDate === today ? 'Today' : 'Attendance date'}
          </Text>
        </View>
        <VectorIcon iconSet="Ionicons" iconName="chevron-down" size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>

      <View style={s.fill}>{renderBody()}</View>

      <AttendanceDateSheet
        visible={dateSheet}
        selected={selectedDate}
        minDate={sessionStartIso()}
        maxDate={today}
        onClose={() => setDateSheet(false)}
        onSelect={setSelectedDate}
      />
    </View>
  );
};

export default MarkAttendanceScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  fillGrow: { flexGrow: 1 },

  // Date row — a row like a subject's, with the page's hairline under it
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconSlot: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  classBar: { flexGrow: 0, marginHorizontal: -20 },
  classStrip: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  classPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  classPillActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  classPillText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  classPillTextActive: { color: theme.colors.white },

  markAll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  markAllLabel: { fontSize: 13, color: theme.colors.textMuted, marginRight: 2 },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  markAllText: { fontSize: 13, fontWeight: '500' },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  roll: { width: 24, fontSize: 13, color: theme.colors.textMuted },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  toggles: { flexDirection: 'row', gap: 6 },
  toggle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  toggleTextActive: { color: theme.colors.white },

  empty: { textAlign: 'center', fontSize: 14, color: theme.colors.textMuted, paddingVertical: 30 },

  // Continue, after the last student
  continueBtn: {
    height: 48,
    marginTop: 24,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },

  // Loading
  skeletonBody: { flex: 1, gap: 8 },
  skRoll: { width: 24 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

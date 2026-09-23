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
import {
  Avatar,
  ReviewContent,
  ReviewSkeleton,
  allMarked,
  reviewGroups,
  type MarkStudent,
} from './markAttendanceUi';

/**
 * Mark Attendance, in the Subjects screens' plain look: the date as a row at
 * the top, then the class. A class already marked for that day opens on its
 * review, with Edit in the header to change it. Otherwise each student is
 * marked P / A / H (or all at once), and Continue — once every student is
 * marked — leads on to the review, where it is submitted.
 */

const STATUS_ORDER: AttendanceStatus[] = ['present', 'absent', 'holiday'];

// The server's per-student attendance as P / A / H — null while not marked.
const mapStatus = (a: AttendanceStudent['attendance']): AttendanceStatus | null => {
  switch (a?.status) {
    case 'absent':
      return 'absent';
    case 'holiday':
      return 'holiday';
    case 'present':
    case 'late':
    case 'half_day':
      return 'present';
    default:
      return null; // not_marked
  }
};

// The section's last letter, to tell sections apart in one list: "A" of
// "Section A", "B" of "5B".
const sectionLetter = (section?: string | null) => {
  const t = String(section ?? '').trim();
  return t ? t.slice(-1).toUpperCase() : '';
};

const toMarkStudent = (st: AttendanceStudent): MarkStudent => ({
  id: st.student_id,
  rollNo: String(st.roll_no ?? ''),
  admissionNo: String(st.admission_no ?? ''),
  // Aarav Sharma (A)
  name: sectionLetter(st.section_name) ? `${st.full_name} (${sectionLetter(st.section_name)})` : st.full_name,
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
            // The chosen one in a light tint of its colour.
            style={[s.toggle, active && { backgroundColor: cfg.color + '1F', borderColor: cfg.color + '66' }]}
          >
            <Text style={[s.toggleText, active && { color: cfg.color }]}>{cfg.short}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

// ── Loading ──────────────────────────────────────────────────────────────────
const PillsSkeleton = ({ count }: { count: number }) => (
  <View style={s.skPills}>
    {Array.from({ length: Math.min(count, 4) }, (_, i) => (
      <Skeleton key={i} width={84} height={32} radius={16} />
    ))}
  </View>
);

// Marking line for line: the class pills when there are several, "Mark all
// as" and its buttons, a row per student in the class (seven before the first
// load), then Continue.
const MarkSkeleton = ({ pills, rows }: { pills: number; rows: number }) => {
  const n = rows > 0 ? Math.min(rows, 15) : 7;
  return (
    <View style={s.list}>
      {pills > 1 && <PillsSkeleton count={pills} />}
      <View style={s.markAll}>
        <Skeleton width={74} height={13} />
        <Skeleton width={70} height={28} radius={14} />
        <Skeleton width={64} height={28} radius={14} />
        <Skeleton width={68} height={28} radius={14} />
      </View>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={[s.row, i < n - 1 && s.rowDivider]}>
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
      <View style={s.footer}>
        <Skeleton width="100%" height={48} radius={theme.radius.md} />
      </View>
    </View>
  );
};

const MarkAttendanceScreen = ({ navigation, route }: any) => {
  // Any day of the session, from 1 April up to today; it opens on today.
  const [today, setToday] = useState(() => toIso(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [dateSheet, setDateSheet] = useState(false);
  const sunday = isSundayIso(selectedDate);
  // Bumped each time the screen is opened afresh, so its list starts at the top.
  const [visit, setVisit] = useState(0);

  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [students, setStudents] = useState<MarkStudent[]>([]);
  // Changing a class already marked for the day; one not marked yet is simply
  // being marked.
  const [editing, setEditing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedClass = useMemo(
    () => classes.find(c => c.assignment_id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );
  const classLabel = selectedClass?.class_info.class_display ?? '';

  // Already marked when any student has a saved status for the day.
  const alreadyMarked = useMemo(
    () => !!selectedClass?.students.some(st => mapStatus(st.attendance) !== null),
    [selectedClass],
  );
  const reviewing = alreadyMarked && !editing;
  const canContinue = allMarked(students);
  const left = students.filter(st => st.status === null).length;

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

  // Back from the review with the day saved: reload it, opening on its review.
  const submitted = route?.params?.submitted;
  const handledSubmit = useRef(submitted);
  useEffect(() => {
    if (!submitted || submitted === handledSubmit.current) return;
    handledSubmit.current = submitted;
    setEditing(false);
    loadClasses(selectedDate, true);
  }, [submitted, selectedDate, loadClasses]);

  // Opened again from the bottom tabs or the drawer: start over on today, as a
  // fresh screen — not the day, class or unsaved marks left behind.
  const startFresh = () => {
    const now = toIso(new Date());
    setToday(now);
    setDateSheet(false);
    setEditing(false);
    setSelectedClassId(null); // the load picks the first class again
    setVisit(v => v + 1);
    if (now !== selectedDate) {
      setSelectedDate(now); // the date effect above loads it
    } else if (!isSundayIso(now)) {
      loadClasses(now);
    }
  };

  // Back from the review, the marks are kept (a save reloads above); coming
  // back from anywhere else starts afresh. The first focus is the mount,
  // already loading above.
  const focusedOnce = useRef(false);
  const inReview = useRef(false);
  useFocusLoad(() => {
    if (!focusedOnce.current) {
      focusedOnce.current = true;
      return;
    }
    if (inReview.current) {
      inReview.current = false;
      return;
    }
    startFresh();
  });

  // The chosen class's students, freshly copied whenever the class or the
  // day's data changes — which also ends any editing.
  useEffect(() => {
    setStudents((selectedClass?.students ?? []).map(toMarkStudent));
    setEditing(false);
  }, [selectedClass]);

  const { refreshing, onRefresh } = useRefresh(() => loadClasses(selectedDate, true));

  // ── Actions ──
  const setStatus = (id: number, status: AttendanceStatus) =>
    setStudents(prev => prev.map(st => (st.id === id ? { ...st, status } : st)));

  // Sets the list only — a holiday for everyone is saved on the review, like
  // any other marking.
  const markAll = (status: AttendanceStatus) =>
    setStudents(prev => prev.map(st => ({ ...st, status })));

  // Leave editing without saving: back to the saved review.
  const cancelEdit = () => {
    setStudents((selectedClass?.students ?? []).map(toMarkStudent));
    setEditing(false);
  };

  const openReview = () => {
    inReview.current = true;
    navigation.navigate('MarkAttendanceReview', {
      date: selectedDate,
      classLabel,
      students,
      returnKey: route?.key,
    });
  };

  // ── Class pills, when there is more than one class ──
  const renderClassPills = () =>
    classes.length > 1 ? (
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
    ) : null;

  // ── Marking: the pills and "Mark all as" above the students ──
  const renderListHead = () => (
    <View>
      {renderClassPills()}
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
              <Text style={s.markAllText}>{STATUS_CONFIG[st].full}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // Continue after the last student, reached by scrolling down, and only once
  // every student is marked.
  const renderListFoot = () =>
    students.length > 0 ? (
      <View style={s.footer}>
        {!canContinue && (
          <Text style={s.footerHint}>
            Mark {left} more {left === 1 ? 'student' : 'students'} to continue
          </Text>
        )}
        <TouchableOpacity
          style={[s.continueBtn, !canContinue && s.continueOff]}
          activeOpacity={0.85}
          disabled={!canContinue}
          onPress={openReview}
        >
          <Text style={s.continueText}>Continue</Text>
        </TouchableOpacity>
      </View>
    ) : null;

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

    // The first load and a pull to refresh show the skeleton of what is on
    // screen — the review of a marked class, or the marking list — with as many
    // rows as the class has.
    if (loading || refreshing) {
      return reviewing ? (
        <View style={s.list}>
          {classes.length > 1 && <PillsSkeleton count={classes.length} />}
          <ReviewSkeleton groups={reviewGroups(students).map(g => g.list.length)} />
        </View>
      ) : (
        <MarkSkeleton pills={classes.length} rows={students.length} />
      );
    }

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

    if (reviewing) {
      return (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {renderClassPills()}
          <ReviewContent date={selectedDate} classLabel={classLabel} students={students} />
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
        ListFooterComponent={renderListFoot()}
      />
    );
  };

  // Edit on a saved review; while editing it, a cross to leave without saving.
  const settled = !sunday && !loading && !refreshing && !error && students.length > 0;
  const headerAction = !settled
    ? {}
    : reviewing
    ? { rightIcon: 'create-outline', onRightPress: () => setEditing(true) }
    : alreadyMarked
    ? { rightIcon: 'close-outline', onRightPress: cancelEdit }
    : {};

  return (
    <View style={s.root}>
      <DocHeader title={reviewing ? 'Review Attendance' : 'Mark Attendance'} {...headerAction} />

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

      <View key={visit} style={s.fill}>
        {renderBody()}
      </View>

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

  // "Mark all as" — plain blue buttons
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
    borderColor: theme.colors.primary,
  },
  markAllText: { fontSize: 13, fontWeight: '500', color: theme.colors.primary },

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

  empty: { textAlign: 'center', fontSize: 14, color: theme.colors.textMuted, paddingVertical: 30 },

  // Continue, after the last student
  footer: { marginTop: 24, gap: 10 },
  footerHint: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  continueBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueOff: { opacity: 0.45 },
  continueText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },

  // Loading
  skeletonBody: { flex: 1, gap: 8 },
  skRoll: { width: 24 },
  skPills: { flexDirection: 'row', gap: 8, paddingTop: 12 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

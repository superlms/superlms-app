import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AttendanceStatus,
  STATUS_CODE,
  STATUS_CONFIG,
  STATUS_ORDER,
  formatLong,
  getRecentMarkableDates,
} from './markAttendanceData';
import {
  attendanceErrorMessage,
  getStudentsForAttendance,
  submitAttendance,
  type AttendanceClass,
  type AttendanceStudent,
} from '../../api/attendanceApi';
import { theme, onThemeChange } from '../../utils/theme';
import constant from '../../utils/constant';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { ConfirmDialog, SuccessDialog } from '../../components/ConfirmDialog';
import { useRefresh } from '../../hooks/useRefresh';
import { DocHeader, DocNoData } from '../more/docUi';
import { ErrorBox } from '../homework/homeworkUi';

interface MarkStudent {
  id: number; // student_detail_id
  rollNo: string;
  name: string;
  photo: string | null;
  status: AttendanceStatus;
}

// Teachers may only mark the last 3 working days — Sundays (auto-holidays) are skipped.
const RECENT_DATES = getRecentMarkableDates(3);

// Resolve a (possibly relative) photo path into a full URL.
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

// Map the server's per-student attendance into the P/A/Holiday model.
const mapStatus = (a: AttendanceStudent['attendance']): AttendanceStatus => {
  if (a?.status === 'holiday') return 'holiday';
  if (a?.status === 'absent') return 'absent';
  return 'present'; // present / not_marked default to present
};

const toMarkStudent = (st: AttendanceStudent): MarkStudent => ({
  id: st.student_id,
  rollNo: String(st.roll_no ?? ''),
  name: st.full_name,
  photo: st.photo ?? null,
  status: mapStatus(st.attendance),
});

const countByStatus = (students: MarkStudent[]) =>
  students.reduce(
    (acc, st) => {
      acc[st.status]++;
      return acc;
    },
    { present: 0, absent: 0, holiday: 0 } as Record<AttendanceStatus, number>,
  );

// ── Student photo with first-letter fallback ──
const Avatar = ({ name, photo }: { name: string; photo: string | null }) => {
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

// ── One student: roll no, photo, name, then P / A / H ──
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
    <Text style={s.name} numberOfLines={1}>
      {student.name}
    </Text>
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

const ListSkeleton = () => (
  <View style={s.list}>
    <View style={s.skHead}>
      <Skeleton width="35%" height={16} />
      <Skeleton width="60%" height={12} />
    </View>
    {[0, 1, 2, 3, 4, 5].map(i => (
      <View key={i} style={[s.row, s.rowDivider]}>
        <Skeleton width={34} height={34} radius={17} />
        <View style={s.fill}>
          <Skeleton width="60%" height={13} />
        </View>
        <Skeleton width={114} height={34} radius={17} />
      </View>
    ))}
  </View>
);

const MarkAttendanceScreen = () => {
  const navigation = useNavigation<any>();
  const [selectedDate, setSelectedDate] = useState<string>(
    RECENT_DATES[RECENT_DATES.length - 1].iso,
  );

  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [students, setStudents] = useState<MarkStudent[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Dialogs
  const [holidayConfirm, setHolidayConfirm] = useState(false);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const counts = countByStatus(students);

  const selectedClass = useMemo(
    () => classes.find(c => c.assignment_id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );
  const classLabel = selectedClass?.class_info.class_display ?? '';

  // Already marked when any student carries a real (non not_marked) status.
  const alreadyMarked = useMemo(
    () =>
      !!selectedClass?.students.some(
        st => st.attendance?.status && st.attendance.status !== 'not_marked',
      ),
    [selectedClass],
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

  useEffect(() => {
    loadClasses(selectedDate);
  }, [selectedDate, loadClasses]);

  // The chosen class's students, freshly copied to mark whenever the class or
  // the day's data changes.
  useEffect(() => {
    setStudents((selectedClass?.students ?? []).map(toMarkStudent));
  }, [selectedClass]);

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  const { refreshing, onRefresh } = useRefresh(() => loadClasses(selectedDate, true));

  // ── Actions ──
  const setStatus = (id: number, status: AttendanceStatus) =>
    setStudents(prev => prev.map(st => (st.id === id ? { ...st, status } : st)));

  const markAll = (status: AttendanceStatus) =>
    setStudents(prev => prev.map(st => ({ ...st, status })));

  // Dismiss the success popup and return to the dashboard.
  const goToDashboard = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
    setSuccessMsg(null);
    loadClasses(selectedDate, true);
    navigation.navigate('MainTabs');
  };

  const doSubmit = async () => {
    setSubmitConfirm(false);
    if (!students.length) return;
    setSubmitting(true);
    try {
      const attendances = students.map(st => ({
        student_detail_id: st.id,
        status: STATUS_CODE[st.status],
        remarks: null,
      }));
      await submitAttendance(selectedDate, attendances);
      setSuccessMsg(
        `${classLabel} · ${formatLong(selectedDate)}\nPresent ${counts.present} · Absent ${counts.absent} · Holiday ${counts.holiday}`,
      );
      // Briefly show the success popup, then head back to the dashboard.
      leaveTimer.current = setTimeout(goToDashboard, 1500);
    } catch (e: any) {
      Alert.alert('Submit failed', attendanceErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // The confirm stands in for a review: the totals, and who is marked absent.
  const absentees = students.filter(st => st.status === 'absent').map(st => st.name);
  const confirmMessage = [
    `${classLabel} · ${formatLong(selectedDate)}`,
    `Present ${counts.present} · Absent ${counts.absent} · Holiday ${counts.holiday}`,
    absentees.length > 0 && absentees.length <= 8 ? `Absent: ${absentees.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  // ── Class pills, the class, its totals and "mark all" ──
  const renderListHead = () => (
    <View style={s.head}>
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

      <View style={s.summary}>
        <Text style={s.className}>{classLabel}</Text>
        <Text style={s.classMeta}>
          {formatLong(selectedDate)} · {students.length} {students.length === 1 ? 'student' : 'students'}
          {alreadyMarked ? ' · already marked' : ''}
        </Text>

        <View style={s.counts}>
          {STATUS_ORDER.map(st => (
            <View key={st} style={s.count}>
              <View style={[s.countDot, { backgroundColor: STATUS_CONFIG[st].color }]} />
              <Text style={s.countText}>
                {STATUS_CONFIG[st].full} <Text style={s.countNum}>{counts[st]}</Text>
              </Text>
            </View>
          ))}
        </View>

        {students.length > 0 && (
          <View style={s.markAll}>
            <Text style={s.markAllLabel}>Mark all</Text>
            {STATUS_ORDER.map(st => (
              <TouchableOpacity
                key={st}
                hitSlop={8}
                activeOpacity={0.6}
                onPress={() => (st === 'holiday' ? setHolidayConfirm(true) : markAll(st))}
              >
                <Text style={s.markAllLink}>{STATUS_CONFIG[st].full}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const renderBody = () => {
    if (loading) return <ListSkeleton />;
    if (error) return <ErrorBox message={error} onRetry={() => loadClasses(selectedDate)} />;
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
      />
    );
  };

  const canSubmit = !loading && !error && !!selectedClass && students.length > 0;

  return (
    <View style={s.root}>
      <DocHeader title="Mark Attendance" />

      {/* The markable days: chosen one filled, today outlined */}
      <View style={s.top}>
        <View style={s.days}>
          {RECENT_DATES.map(d => {
            const active = d.iso === selectedDate;
            const today = !active && d.isToday;
            return (
              <TouchableOpacity
                key={d.iso}
                activeOpacity={0.7}
                onPress={() => setSelectedDate(d.iso)}
                style={[s.day, active && s.dayActive, today && s.dayToday]}
              >
                <Text style={[s.dayName, active && s.dayTextActive, today && s.dayTextToday]}>
                  {d.weekday}
                </Text>
                <Text style={[s.dayDate, active && s.dayTextActive, today && s.dayTextToday]}>
                  {Number(d.day)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={s.note}>You can mark the last 3 working days. Sundays are holidays.</Text>
      </View>

      <View style={s.fill}>{renderBody()}</View>

      {canSubmit && (
        <View style={s.bar}>
          <TouchableOpacity
            style={[s.submitBtn, submitting && s.submitBtnBusy]}
            activeOpacity={0.85}
            disabled={submitting}
            onPress={() => setSubmitConfirm(true)}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text style={s.submitText}>
                {alreadyMarked ? 'Update attendance' : 'Submit attendance'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Mark-all-holiday confirmation */}
      <ConfirmDialog
        visible={holidayConfirm}
        title="Mark all as Holiday?"
        message={`Every student in ${classLabel || 'this class'} will be set to Holiday for ${formatLong(selectedDate)}.`}
        confirmText="Mark Holiday"
        confirmColor={STATUS_CONFIG.holiday.color}
        iconName="sunny-outline"
        iconColor={STATUS_CONFIG.holiday.color}
        iconBg={STATUS_CONFIG.holiday.bg}
        onConfirm={() => {
          markAll('holiday');
          setHolidayConfirm(false);
        }}
        onCancel={() => setHolidayConfirm(false)}
      />

      {/* Submit confirmation */}
      <ConfirmDialog
        visible={submitConfirm}
        title={alreadyMarked ? 'Update attendance?' : 'Submit attendance?'}
        message={confirmMessage}
        confirmText={alreadyMarked ? 'Update' : 'Submit'}
        confirmColor={theme.colors.primary}
        iconName="checkmark-done-outline"
        loading={submitting}
        onConfirm={doSubmit}
        onCancel={() => setSubmitConfirm(false)}
      />

      {/* Success popup */}
      <SuccessDialog
        visible={!!successMsg}
        title={alreadyMarked ? 'Attendance Updated' : 'Attendance Submitted'}
        message={successMsg ?? ''}
        buttonText="Done"
        onClose={goToDashboard}
      />
    </View>
  );
};

export default MarkAttendanceScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  fillGrow: { flexGrow: 1 },

  // Days
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  days: { flexDirection: 'row', gap: 8 },
  day: {
    width: 48,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  dayActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayToday: { borderColor: theme.colors.primary },
  dayName: { fontSize: 11, fontWeight: '500', color: theme.colors.textMuted },
  dayDate: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 2 },
  dayTextActive: { color: theme.colors.white },
  dayTextToday: { color: theme.colors.primary },
  note: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },

  list: { paddingHorizontal: 20, paddingBottom: 24 },

  // Class pills, the class, totals, mark all
  head: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  classBar: { flexGrow: 0, marginHorizontal: -20 },
  classStrip: { paddingHorizontal: 20, paddingTop: 14, gap: 8 },
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
  summary: { paddingTop: 16 },
  className: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  classMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 3 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countDot: { width: 8, height: 8, borderRadius: 4 },
  countText: { fontSize: 13, color: theme.colors.textSecondary },
  countNum: { fontWeight: '600', color: theme.colors.textPrimary },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  markAllLabel: { fontSize: 13, color: theme.colors.textMuted },
  markAllLink: { fontSize: 13, fontWeight: '500', color: theme.colors.primary },

  // Student row
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  roll: { width: 26, fontSize: 13, color: theme.colors.textMuted },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: {
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  name: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
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

  // Submit
  bar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  submitBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnBusy: { opacity: 0.7 },
  submitText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },

  // Loading
  skHead: { gap: 8, paddingTop: 16, paddingBottom: 12 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

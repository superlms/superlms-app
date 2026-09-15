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
  markHoliday,
  type AttendanceClass,
  type AttendanceStudent,
} from '../../api/attendanceApi';
import { theme, onThemeChange } from '../../utils/theme';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppDialog, AppAlert } from '../../components/AppDialog';
import { useFocusLoad, useRefresh } from '../../hooks/useRefresh';
import { DocHeader, DocNoData } from '../more/docUi';
import { ErrorBox } from '../homework/homeworkUi';
import AttendanceDateSheet from './AttendanceDateSheet';
import { Avatar, countByStatus, type MarkStudent } from './markAttendanceUi';

const STATUS_ORDER: AttendanceStatus[] = ['present', 'absent', 'holiday'];
// "Mark all" sets the list only; a holiday for everyone is its own button,
// saved straight away.
const MARK_ALL: AttendanceStatus[] = ['present', 'absent'];

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

// ── One student: roll no, photo, name over admission no, then P / A / H ──
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
    <View style={s.fill}>
      <Text style={s.name} numberOfLines={1}>
        {student.name}
      </Text>
      <Text style={s.admission} numberOfLines={1}>
        Adm. No. {student.admissionNo || '—'}
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

const ListSkeleton = () => (
  <View style={s.list}>
    <View style={s.skHead}>
      <Skeleton width="35%" height={16} />
      <Skeleton width="60%" height={12} />
    </View>
    {[0, 1, 2, 3, 4, 5].map(i => (
      <View key={i} style={[s.row, s.rowDivider]}>
        <Skeleton width={34} height={34} radius={17} />
        <View style={[s.fill, s.skLines]}>
          <Skeleton width="60%" height={13} />
          <Skeleton width="35%" height={11} />
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
  const [markingHoliday, setMarkingHoliday] = useState(false);

  // Dialogs
  const [holidayConfirm, setHolidayConfirm] = useState(false);
  const [success, setSuccess] = useState<{ title: string; message: string } | null>(null);

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
  const savedAsHoliday =
    !!selectedClass?.students.length &&
    selectedClass.students.every(st => st.attendance?.status === 'holiday');

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

  const markAll = (status: AttendanceStatus) =>
    setStudents(prev => prev.map(st => ({ ...st, status })));

  // Submitting goes by way of a review of who is present and who is absent.
  const openReview = () =>
    navigation.navigate('MarkAttendanceReview', {
      date: selectedDate,
      classLabel,
      students,
    });

  const doMarkHoliday = async () => {
    if (!selectedClass) return;
    setMarkingHoliday(true);
    try {
      const res = await markHoliday(
        selectedDate,
        selectedClass.class_info.standard_id,
        selectedClass.class_info.section_id,
      );
      setHolidayConfirm(false);
      const n = res?.marked_students ?? students.length;
      setSuccess({
        title: 'Marked as Holiday',
        message: `${classLabel} · ${formatLong(selectedDate)}\n${n} ${n === 1 ? 'student' : 'students'} set to Holiday`,
      });
      loadClasses(selectedDate, true);
    } catch (e: any) {
      setHolidayConfirm(false);
      AppAlert.alert('Could not mark holiday', attendanceErrorMessage(e));
    } finally {
      setMarkingHoliday(false);
    }
  };

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
          {students.length} {students.length === 1 ? 'student' : 'students'}
          {savedAsHoliday ? ' · marked as holiday' : alreadyMarked ? ' · already marked' : ''}
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
            {MARK_ALL.map(st => (
              <TouchableOpacity key={st} hitSlop={8} activeOpacity={0.6} onPress={() => markAll(st)}>
                <Text style={s.markAllLink}>{STATUS_CONFIG[st].full}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
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

  const canAct = !sunday && !loading && !error && !!selectedClass && students.length > 0;

  return (
    <View style={s.root}>
      <DocHeader title="Mark Attendance" />

      {/* The day being marked — tap to pick another from the calendar */}
      <View style={s.top}>
        <TouchableOpacity style={s.dateField} activeOpacity={0.7} onPress={() => setDateSheet(true)}>
          <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={18} color={theme.colors.primary} />
          <View style={s.fill}>
            <Text style={s.dateLabel}>Date</Text>
            <Text style={s.dateValue} numberOfLines={1}>
              {formatLong(selectedDate)}
              {selectedDate === today ? ' · Today' : ''}
            </Text>
          </View>
          <VectorIcon iconSet="Ionicons" iconName="chevron-down" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={s.fill}>{renderBody()}</View>

      {canAct && (
        <View style={s.bar}>
          <TouchableOpacity
            style={[s.holidayBtn, markingHoliday && s.btnBusy]}
            activeOpacity={0.7}
            disabled={markingHoliday}
            onPress={() => setHolidayConfirm(true)}
          >
            <VectorIcon
              iconSet="Ionicons"
              iconName="sunny-outline"
              size={16}
              color={STATUS_CONFIG.holiday.color}
            />
            <Text style={s.holidayText} numberOfLines={1}>
              Mark as holiday
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.submitBtn, markingHoliday && s.btnBusy]}
            activeOpacity={0.85}
            disabled={markingHoliday}
            onPress={openReview}
          >
            <Text style={s.submitText} numberOfLines={1}>
              {alreadyMarked ? 'Update attendance' : 'Submit attendance'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <AttendanceDateSheet
        visible={dateSheet}
        selected={selectedDate}
        minDate={sessionStartIso()}
        maxDate={today}
        onClose={() => setDateSheet(false)}
        onSelect={setSelectedDate}
      />

      {/* Whole class holiday — saved straight away */}
      <AppDialog
        visible={holidayConfirm}
        title="Mark as Holiday?"
        message={`Every student in ${classLabel || 'this class'} will be marked Holiday for ${formatLong(selectedDate)}. You can still change it afterwards.`}
        actions={[
          { text: 'Cancel', style: 'cancel', onPress: () => setHolidayConfirm(false) },
          { text: 'Mark Holiday', onPress: doMarkHoliday, loading: markingHoliday },
        ]}
        onRequestClose={() => setHolidayConfirm(false)}
      />

      {/* Saved */}
      <AppDialog
        visible={!!success}
        title={success?.title ?? ''}
        message={success?.message ?? ''}
        actions={[{ text: 'Done', onPress: () => setSuccess(null) }]}
        onRequestClose={() => setSuccess(null)}
      />
    </View>
  );
};

export default MarkAttendanceScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  fillGrow: { flexGrow: 1 },

  // Date
  top: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateLabel: { fontSize: 11, color: theme.colors.textMuted },
  dateValue: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 1 },

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
  name: { fontSize: 15, color: theme.colors.textPrimary },
  admission: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
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

  // Bottom bar: holiday for everyone, and submit
  bar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  holidayBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  holidayText: { fontSize: 14, fontWeight: '600', color: STATUS_CONFIG.holiday.color },
  submitBtn: {
    flex: 1.3,
    height: 48,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBusy: { opacity: 0.7 },
  submitText: { fontSize: 14, fontWeight: '600', color: theme.colors.white },

  // Loading
  skHead: { gap: 8, paddingTop: 16, paddingBottom: 12 },
  skLines: { gap: 6 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

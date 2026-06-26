import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AttendanceStatus,
  DateItem,
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
import { useNavigation } from '@react-navigation/native';
import { theme, onThemeChange } from '../../utils/theme';
import constant from '../../utils/constant';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { ConfirmDialog, SuccessDialog } from '../../components/ConfirmDialog';
import { useRefresh } from '../../hooks/useRefresh';

type Step = 'setup' | 'mark' | 'preview';

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

const countByStatus = (students: MarkStudent[]) =>
  students.reduce(
    (acc, s) => {
      acc[s.status]++;
      return acc;
    },
    { present: 0, absent: 0, holiday: 0 } as Record<AttendanceStatus, number>,
  );

// ── Student avatar: photo with first-letter fallback ──
const Avatar = ({ name, photo }: { name: string; photo: string | null }) => {
  const uri = resolveFileUrl(photo);
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={styles.avatarImg}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>
        {(name || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
};

// ── Per-student P / A / H toggle ──
const StatusButtons = ({
  status,
  onChange,
}: {
  status: AttendanceStatus;
  onChange: (s: AttendanceStatus) => void;
}) => (
  <View style={styles.statusBtns}>
    {STATUS_ORDER.map(st => {
      const active = status === st;
      const cfg = STATUS_CONFIG[st];
      return (
        <TouchableOpacity
          key={st}
          onPress={() => onChange(st)}
          activeOpacity={0.8}
          style={[
            styles.statusBtn,
            {
              backgroundColor: active ? cfg.bg : theme.colors.background,
              borderColor: active ? cfg.color : theme.colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.statusBtnText,
              { color: active ? cfg.color : theme.colors.textMuted },
            ]}
          >
            {cfg.short}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const MarkAttendanceScreen = () => {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState<Step>('setup');
  const [selectedDate, setSelectedDate] = useState<string>(
    RECENT_DATES[RECENT_DATES.length - 1].iso,
  );

  const [classes, setClasses] = useState<AttendanceClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [students, setStudents] = useState<MarkStudent[]>([]);
  const [alreadyMarked, setAlreadyMarked] = useState(false);

  const [loadingClasses, setLoadingClasses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Dialogs
  const [holidayConfirm, setHolidayConfirm] = useState(false);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const counts = countByStatus(students);

  const selectedClass = useMemo(
    () => classes.find(c => c.assignment_id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );

  // ── Load the teacher's classes + students for the chosen date ──
  const loadClasses = useCallback(async (date: string) => {
    setLoadingClasses(true);
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
      setLoadingClasses(false);
    }
  }, []);

  useEffect(() => {
    loadClasses(selectedDate);
  }, [selectedDate, loadClasses]);

  const { refreshing, onRefresh } = useRefresh(() => loadClasses(selectedDate));

  // ── Actions ──
  const setStatus = (id: number, status: AttendanceStatus) =>
    setStudents(prev => prev.map(s => (s.id === id ? { ...s, status } : s)));

  const markAll = (status: AttendanceStatus) =>
    setStudents(prev => prev.map(s => ({ ...s, status })));

  const handleContinue = () => {
    if (!selectedClass) return;
    // Already-marked when any student carries a real (non not_marked) status.
    const marked = selectedClass.students.some(
      st => st.attendance?.status && st.attendance.status !== 'not_marked',
    );
    setStudents(
      selectedClass.students.map(st => ({
        id: st.student_id,
        rollNo: String(st.roll_no ?? ''),
        name: st.full_name,
        photo: st.photo ?? null,
        status: mapStatus(st.attendance),
      })),
    );
    setAlreadyMarked(marked);
    setStep('mark');
  };

  const doSubmit = async () => {
    setSubmitConfirm(false);
    if (!students.length) return;
    setSubmitting(true);
    try {
      const attendances = students.map(s => ({
        student_detail_id: s.id,
        status: STATUS_CODE[s.status],
        remarks: null,
      }));
      await submitAttendance(selectedDate, attendances);
      setSuccessMsg(
        `${selectedClass?.class_info.class_display ?? ''} · ${formatLong(
          selectedDate,
        )}\nPresent ${counts.present} · Absent ${counts.absent} · Holiday ${counts.holiday}`,
      );
      // Briefly show the success popup, then head back to the dashboard.
      setTimeout(goToDashboard, 1500);
    } catch (e: any) {
      Alert.alert('Submit failed', attendanceErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // Reset everything and return to the setup screen.
  const resetToSetup = () => {
    setStep('setup');
    setStudents([]);
    setAlreadyMarked(false);
    loadClasses(selectedDate);
  };

  // Dismiss the success popup and return to the dashboard.
  const goToDashboard = () => {
    setSuccessMsg(null);
    setStep('setup');
    setStudents([]);
    setAlreadyMarked(false);
    navigation.navigate('MainTabs');
  };

  // ── Info bar shown on mark / preview ──
  const InfoBar = () => (
    <View style={styles.infoBar}>
      <View style={styles.infoLeft}>
        <View style={styles.infoIcon}>
          <VectorIcon
            iconSet="Ionicons"
            iconName="calendar-outline"
            size={16}
            color={theme.colors.primary}
          />
        </View>
        <View>
          <Text style={styles.infoDate}>{formatLong(selectedDate)}</Text>
          <Text style={styles.infoClass}>
            {selectedClass?.class_info.class_display ?? ''}
          </Text>
        </View>
      </View>
      <View style={[styles.editChip, { backgroundColor: theme.colors.primaryLight }]}>
        <VectorIcon
          iconSet="Ionicons"
          iconName="people-outline"
          size={11}
          color={theme.colors.primary}
        />
        <Text style={[styles.editChipText, { color: theme.colors.primary }]}>
          {students.length} students
        </Text>
      </View>
    </View>
  );

  // ── Setup ──
  const renderSetup = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.setupBody}
      refreshControl={
        <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.noteBar}>
        <VectorIcon
          iconSet="Ionicons"
          iconName="information-circle-outline"
          size={16}
          color={theme.colors.primary}
        />
        <Text style={styles.noteText}>
          You can mark the last 3 working days. Sundays are auto-holidays.
        </Text>
      </View>

      {/* Date card */}
      <View style={styles.setupCard}>
        <View style={[styles.cardAccent, { backgroundColor: theme.colors.primary }]} />
        <View style={styles.setupCardInner}>
          <Text style={styles.setupCardTitle}>Select Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateStrip}
          >
            {RECENT_DATES.map((d: DateItem) => {
              const active = d.iso === selectedDate;
              return (
                <TouchableOpacity
                  key={d.iso}
                  activeOpacity={0.85}
                  onPress={() => setSelectedDate(d.iso)}
                  style={[styles.dateCard, active && styles.dateCardActive]}
                >
                  <Text
                    style={[styles.dateWeekday, active && styles.dateTextActive]}
                  >
                    {d.weekday}
                  </Text>
                  <Text style={[styles.dateDay, active && styles.dateTextActive]}>
                    {d.day}
                  </Text>
                  <Text style={[styles.dateMonth, active && styles.dateTextActive]}>
                    {d.isToday ? 'Today' : d.month}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Class card */}
      <View style={styles.setupCard}>
        <View style={[styles.cardAccent, { backgroundColor: theme.colors.success }]} />
        <View style={styles.setupCardInner}>
          <Text style={styles.setupCardTitle}>Class & Section</Text>

          {loadingClasses ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="cloud-offline-outline"
                size={26}
                color={theme.colors.danger}
              />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => loadClasses(selectedDate)}
                activeOpacity={0.85}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : classes.length === 0 ? (
            <View style={styles.errorBox}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="people-outline"
                size={26}
                color={theme.colors.textMuted}
              />
              <Text style={styles.errorText}>
                No classes are assigned to you. Please contact the administrator.
              </Text>
            </View>
          ) : (
            <View style={styles.dropdown}>
              {classes.map(c => {
                const active = c.assignment_id === selectedClassId;
                return (
                  <TouchableOpacity
                    key={c.assignment_id}
                    style={[
                      styles.dropdownItem,
                      active && styles.dropdownItemActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedClassId(c.assignment_id)}
                  >
                    <View style={styles.classRowLeft}>
                      <View style={styles.infoIcon}>
                        <VectorIcon
                          iconSet="Ionicons"
                          iconName="people-outline"
                          size={16}
                          color={theme.colors.primary}
                        />
                      </View>
                      <View>
                        <Text
                          style={[
                            styles.dropdownText,
                            active && styles.dropdownTextActive,
                          ]}
                        >
                          {c.class_info.class_display}
                        </Text>
                        <Text style={styles.classMeta}>
                          {c.total_students} students
                        </Text>
                      </View>
                    </View>
                    {active && (
                      <VectorIcon
                        iconSet="Ionicons"
                        iconName="checkmark-circle"
                        size={18}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          (!selectedClass || loadingClasses) && styles.primaryBtnDisabled,
        ]}
        activeOpacity={0.9}
        disabled={!selectedClass || loadingClasses}
        onPress={handleContinue}
      >
        <Text style={styles.primaryBtnText}>Load Students</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Mark ──
  const renderMark = () => (
    <FlatList
      data={students}
      keyExtractor={i => String(i.id)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rollNo}>{item.rollNo}</Text>
            <Avatar name={item.name} photo={item.photo} />
            <Text style={styles.studentName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <StatusButtons
            status={item.status}
            onChange={s => setStatus(item.id, s)}
          />
        </View>
      )}
      ListHeaderComponent={
        <>
          <InfoBar />
          {alreadyMarked && (
            <View style={styles.editBanner}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="create-outline"
                size={15}
                color={theme.colors.primary}
              />
              <Text style={styles.editBannerText}>
                Attendance already exists for this date — edit and re-submit.
              </Text>
            </View>
          )}
          <View style={styles.markAllRow}>
            <Text style={styles.markAllLabel}>Mark all:</Text>
            {STATUS_ORDER.map(st => (
              <TouchableOpacity
                key={st}
                style={[
                  styles.markAllBtn,
                  {
                    backgroundColor: STATUS_CONFIG[st].bg,
                    borderColor: STATUS_CONFIG[st].color,
                  },
                ]}
                onPress={() =>
                  st === 'holiday' ? setHolidayConfirm(true) : markAll(st)
                }
              >
                <Text
                  style={[styles.markAllBtnText, { color: STATUS_CONFIG[st].color }]}
                >
                  {STATUS_CONFIG[st].full}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>Student</Text>
            <Text style={styles.listHeaderText}>P / A / H</Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>No students in this class.</Text>
      }
      ListFooterComponent={
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.9}
          onPress={() => setStep('preview')}
        >
          <Text style={styles.primaryBtnText}>Review</Text>
        </TouchableOpacity>
      }
    />
  );

  // ── Preview (clean review, no analytics) ──
  const renderPreview = () => (
    <FlatList
      data={students}
      keyExtractor={i => String(i.id)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const cfg = STATUS_CONFIG[item.status];
        return (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rollNo}>{item.rollNo}</Text>
              <Avatar name={item.name} photo={item.photo} />
              <Text style={styles.studentName} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
              <Text style={[styles.statusBadgeText, { color: cfg.color }]}>
                {cfg.full}
              </Text>
            </View>
          </View>
        );
      }}
      ListHeaderComponent={
        <>
          <InfoBar />
          <Text style={styles.previewHint}>
            Review the attendance below, then submit.
          </Text>
        </>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>No students to review.</Text>
      }
      ListFooterComponent={
        <View style={styles.footerCol}>
          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
            activeOpacity={0.9}
            disabled={submitting}
            onPress={() => setSubmitConfirm(true)}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {alreadyMarked ? 'Update Attendance' : 'Submit Attendance'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.85}
            onPress={resetToSetup}
          >
            <Text style={styles.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );

  return (
    <KeyboardAvoidingView
      style={styles.safeArea}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Mark Attendance" />

      {step === 'setup' && renderSetup()}
      {step === 'mark' && renderMark()}
      {step === 'preview' && renderPreview()}

      {/* Mark-all-holiday confirmation (logout style) */}
      <ConfirmDialog
        visible={holidayConfirm}
        title="Mark all as Holiday?"
        message={`Every student in ${
          selectedClass?.class_info.class_display ?? 'this class'
        } will be set to Holiday for ${formatLong(selectedDate)}.`}
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

      {/* Submit confirmation (logout style) */}
      <ConfirmDialog
        visible={submitConfirm}
        title={alreadyMarked ? 'Update attendance?' : 'Submit attendance?'}
        message={`${formatLong(selectedDate)}\nPresent ${counts.present} · Absent ${
          counts.absent
        } · Holiday ${counts.holiday}`}
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
    </KeyboardAvoidingView>
  );
};

export default MarkAttendanceScreen;

const __mk_styles = () => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },

  // Setup
  setupBody: { padding: theme.spacing.lg, paddingBottom: 40 },

  // Announcement-style note banner
  noteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: theme.spacing.md,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },

  // Accent-bar cards (attendance template)
  setupCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    elevation: 1,
  },
  cardAccent: { height: 4, width: '100%' },
  setupCardInner: { padding: theme.spacing.md },
  setupCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 10,
  },
  dateStrip: { gap: 10, paddingBottom: 4 },
  dateCard: {
    width: 62,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    gap: 2,
  },
  dateCardActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dateWeekday: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted },
  dateDay: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary },
  dateMonth: { fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary },
  dateTextActive: { color: '#fff' },

  centerBox: { paddingVertical: 30, alignItems: 'center' },
  errorBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  retryBtn: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 2,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  dropdown: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropdownItemActive: { backgroundColor: theme.colors.primaryLight },
  classRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  classMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  dropdownText: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  dropdownTextActive: { color: theme.colors.primary, fontWeight: '700' },

  // Info bar
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoDate: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary },
  infoClass: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  },
  editChipText: { fontSize: 10, fontWeight: '700' },

  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: theme.spacing.sm,
  },
  editBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: theme.colors.primary },

  // Lists
  list: { paddingHorizontal: theme.spacing.lg, paddingBottom: 40 },
  markAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  markAllLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  markAllBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  markAllBtnText: { fontSize: 11, fontWeight: '700' },

  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 4,
  },
  listHeaderText: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted },

  previewHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: theme.spacing.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 10,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rollNo: { fontSize: 12, color: theme.colors.textMuted, width: 22 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryLight,
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
  studentName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    flex: 1,
  },

  statusBtns: { flexDirection: 'row', gap: 6 },
  statusBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusBtnText: { fontSize: 12, fontWeight: '700' },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  empty: { textAlign: 'center', color: theme.colors.textMuted, paddingVertical: 30 },

  // Footer / buttons (login pill style)
  footerCol: { marginTop: theme.spacing.lg, gap: 10 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 99,
    marginTop: theme.spacing.lg,
  },
  primaryBtnDisabled: { backgroundColor: '#B0B0B0' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  secondaryBtnText: { color: theme.colors.primary, fontWeight: '700', fontSize: 15 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AttendanceStatus,
  STATUS_CODE,
  STATUS_CONFIG,
  formatLong,
} from './markAttendanceData';
import { attendanceErrorMessage, submitAttendance } from '../../api/attendanceApi';
import { theme, onThemeChange } from '../../utils/theme';
import { AppDialog, AppAlert } from '../../components/AppDialog';
import { DocHeader } from '../more/docUi';
import { Skeleton } from '../../components/Skeleton';
import { Avatar, countByStatus, type MarkStudent } from './markAttendanceUi';

// Present first, then absent, then holiday.
const GROUP_ORDER: AttendanceStatus[] = ['present', 'absent', 'holiday'];

// The page line for line: the day, the class and the totals, then a status
// heading and its students — roll no, photo, name over admission no, status.
const ReviewSkeleton = () => (
  <View style={s.list}>
    <View style={s.intro}>
      <Skeleton width="50%" height={15} />
      <Skeleton width="28%" height={13} />
      <View style={s.totals}>
        <Skeleton width={78} height={13} />
        <Skeleton width={70} height={13} />
      </View>
    </View>
    <View style={s.skGroupTitle}>
      <Skeleton width={80} height={12} />
    </View>
    {[0, 1, 2, 3, 4, 5].map(i => (
      <View key={i} style={[s.row, i < 5 && s.rowDivider]}>
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

/**
 * Before attendance is saved, in the Subjects screens' plain look: the day,
 * the class and a line of totals, then the students under Present, Absent and
 * Holiday, and Submit attendance after the last of them.
 */
const MarkAttendanceReviewScreen = ({ navigation, route }: any) => {
  const date: string = route?.params?.date;
  const classLabel: string = route?.params?.classLabel ?? '';
  const students: MarkStudent[] = route?.params?.students ?? [];

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // The list draws once the screen has finished sliding in, so a big class
  // does not stall the transition; its skeleton stands in until then.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);

  const counts = countByStatus(students);
  const groups = GROUP_ORDER.map(status => ({
    status,
    list: students.filter(st => st.status === status),
  })).filter(g => g.list.length > 0);

  const submit = async () => {
    if (!students.length || submitting) return;
    setSubmitting(true);
    try {
      await submitAttendance(
        date,
        students.map(st => ({
          student_detail_id: st.id,
          status: STATUS_CODE[st.status],
          remarks: null,
        })),
      );
      setSubmitted(true);
    } catch (e: any) {
      AppAlert.alert('Submit failed', attendanceErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // Back to Mark Attendance, which reloads and shows what was saved.
  const finish = () => {
    setSubmitted(false);
    navigation.goBack();
  };

  if (!ready) {
    return (
      <View style={s.root}>
        <DocHeader title="Review Attendance" onBackPress={() => navigation.goBack()} />
        <ReviewSkeleton />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <DocHeader title="Review Attendance" onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        {/* Tue, 15 Sep 2026 / Class 5 - A / Present 30  Absent 2 */}
        <View style={s.intro}>
          <Text style={s.introTitle}>{formatLong(date)}</Text>
          {!!classLabel && <Text style={s.meta}>{classLabel}</Text>}
          <View style={s.totals}>
            {groups.map(g => (
              <Text key={g.status} style={s.total}>
                {STATUS_CONFIG[g.status].full}{' '}
                <Text style={[s.totalNum, { color: STATUS_CONFIG[g.status].color }]}>
                  {counts[g.status]}
                </Text>
              </Text>
            ))}
          </View>
        </View>

        {groups.map(g => (
          <View key={g.status}>
            <Text style={s.groupTitle}>
              {STATUS_CONFIG[g.status].full} · {g.list.length}
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
                <Text style={[s.status, { color: STATUS_CONFIG[st.status].color }]}>
                  {STATUS_CONFIG[st.status].full}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {/* Submit sits after the last student, reached by scrolling down. */}
        <TouchableOpacity
          style={[s.submitBtn, submitting && s.btnBusy]}
          activeOpacity={0.85}
          disabled={submitting}
          onPress={submit}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={s.submitText}>Submit attendance</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <AppDialog
        visible={submitted}
        title="Attendance submitted successfully"
        message={`${classLabel ? `${classLabel} · ` : ''}${formatLong(date)}`}
        actions={[{ text: 'Done', onPress: finish }]}
        onRequestClose={finish}
      />
    </View>
  );
};

export default MarkAttendanceReviewScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  list: { paddingHorizontal: 20, paddingBottom: 40 },

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

  // Submit, after the last student
  submitBtn: {
    height: 48,
    marginTop: 24,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBusy: { opacity: 0.7 },
  submitText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

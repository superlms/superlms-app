import React, { useState } from 'react';
import {
  ActivityIndicator,
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
  STATUS_ORDER,
  formatLong,
} from './markAttendanceData';
import { attendanceErrorMessage, submitAttendance } from '../../api/attendanceApi';
import { theme, onThemeChange } from '../../utils/theme';
import { AppDialog, AppAlert } from '../../components/AppDialog';
import { DocHeader } from '../more/docUi';
import { Avatar, countByStatus, type MarkStudent } from './markAttendanceUi';

// Absent first — the names worth a second look before saving.
const GROUP_ORDER: AttendanceStatus[] = ['absent', 'present', 'holiday'];

/**
 * Before attendance is saved: the class, the day and its totals, then who is
 * absent, present and on holiday, and the button that submits it.
 */
const MarkAttendanceReviewScreen = ({ navigation, route }: any) => {
  const date: string = route?.params?.date;
  const classLabel: string = route?.params?.classLabel ?? '';
  const students: MarkStudent[] = route?.params?.students ?? [];

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  return (
    <View style={s.root}>
      <DocHeader title="Review Attendance" onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.summary}>
          <Text style={s.className}>{classLabel}</Text>
          <Text style={s.meta}>
            {formatLong(date)} · {students.length} {students.length === 1 ? 'student' : 'students'}
          </Text>

          <View style={s.totals}>
            {STATUS_ORDER.map(st => (
              <View key={st} style={[s.total, { backgroundColor: STATUS_CONFIG[st].color + '1A' }]}>
                <Text style={[s.totalNum, { color: STATUS_CONFIG[st].color }]}>{counts[st]}</Text>
                <Text style={[s.totalLabel, { color: STATUS_CONFIG[st].color }]}>
                  {STATUS_CONFIG[st].full}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {groups.map(g => (
          <View key={g.status} style={s.group}>
            <View style={s.groupHead}>
              <View style={[s.groupDot, { backgroundColor: STATUS_CONFIG[g.status].color }]} />
              <Text style={s.groupTitle}>{STATUS_CONFIG[g.status].full}</Text>
              <Text style={s.groupCount}>{g.list.length}</Text>
            </View>

            {g.list.map((st, i) => (
              <View key={st.id} style={[s.row, i < g.list.length - 1 && s.rowDivider]}>
                <Text style={s.roll}>{st.rollNo || '—'}</Text>
                <Avatar name={st.name} photo={st.photo} />
                <View style={s.fill}>
                  <Text style={s.name} numberOfLines={1}>
                    {st.name}
                  </Text>
                  <Text style={s.admission} numberOfLines={1}>
                    Adm. No. {st.admissionNo || '—'}
                  </Text>
                </View>
                <View style={[s.badge, { backgroundColor: STATUS_CONFIG[st.status].color }]}>
                  <Text style={s.badgeText}>{STATUS_CONFIG[st.status].short}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={s.bar}>
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
      </View>

      <AppDialog
        visible={submitted}
        title="Attendance submitted successfully"
        message={`${classLabel} · ${formatLong(date)}`}
        actions={[{ text: 'Done', onPress: finish }]}
        onRequestClose={finish}
      />
    </View>
  );
};

export default MarkAttendanceReviewScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },

  // The class, the day, the totals
  summary: { paddingTop: 16, paddingBottom: 16 },
  className: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  meta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 3 },
  totals: { flexDirection: 'row', gap: 10, marginTop: 14 },
  total: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: theme.radius.md },
  totalNum: { fontSize: 20, fontWeight: '700' },
  totalLabel: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // One status and its students
  group: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 14, paddingBottom: 6 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  groupCount: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  roll: { width: 26, fontSize: 13, color: theme.colors.textMuted },
  name: { fontSize: 15, color: theme.colors.textPrimary },
  admission: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: theme.colors.white },

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
  btnBusy: { opacity: 0.7 },
  submitText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

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
import { CommonActions } from '@react-navigation/native';
import { STATUS_CODE, formatLong } from './markAttendanceData';
import { attendanceErrorMessage, submitAttendance } from '../../api/attendanceApi';
import { theme, onThemeChange } from '../../utils/theme';
import { AppDialog, AppAlert } from '../../components/AppDialog';
import { DocHeader } from '../more/docUi';
import { ReviewContent, ReviewSkeleton, reviewGroups, type MarkStudent } from './markAttendanceUi';

/**
 * Before attendance is saved, in the Subjects screens' plain look: the day,
 * the class and a line of totals, then the students under Present, Absent and
 * Holiday, and Submit attendance after the last of them.
 */
const MarkAttendanceReviewScreen = ({ navigation, route }: any) => {
  const date: string = route?.params?.date;
  const classLabel: string = route?.params?.classLabel ?? '';
  const students: MarkStudent[] = route?.params?.students ?? [];
  // The Mark Attendance screen this came from, told when the day is saved.
  const returnKey: string | undefined = route?.params?.returnKey;

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // The list draws once the screen has finished sliding in, so a big class
  // does not stall the transition; its skeleton stands in until then.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);

  const submit = async () => {
    if (!students.length || submitting) return;
    setSubmitting(true);
    try {
      await submitAttendance(
        date,
        students.flatMap(st =>
          st.status
            ? [{ student_detail_id: st.id, status: STATUS_CODE[st.status], remarks: null }]
            : [],
        ),
      );
      setSubmitted(true);
    } catch (e: any) {
      AppAlert.alert('Submit failed', attendanceErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // Back to Mark Attendance, told the day was saved so it opens on its review.
  const finish = () => {
    setSubmitted(false);
    if (returnKey) {
      navigation.dispatch({ ...CommonActions.setParams({ submitted: Date.now() }), source: returnKey });
    }
    navigation.goBack();
  };

  return (
    <View style={s.root}>
      <DocHeader title="Review Attendance" onBackPress={() => navigation.goBack()} />

      {!ready ? (
        <View style={s.list}>
          <ReviewSkeleton groups={reviewGroups(students).map(g => g.list.length)} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          <ReviewContent date={date} classLabel={classLabel} students={students} />

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
      )}

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

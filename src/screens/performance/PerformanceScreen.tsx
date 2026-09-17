import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { getExams, examErrorMessage } from '../../api/examApi';
import type { Exam } from '../exam/examData';
import { ExamList, examsToDraw, examsToKeep } from '../exam/examUi';

/**
 * A student's performance, exam by exam: the exams as the Exams screen lists
 * them, each opening onto its result subject by subject (ExamResult).
 */

const TITLE = 'My Performance';

const PerformanceScreen = ({ navigation }: any) => {
  const [exams, setExams] = useState<Exam[]>([]);
  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back to the screen updates the list in place.
  const [loading, setLoading] = useState(true);
  // The list on screen came from the school.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, rememberLast] = useLastLoaded<Exam[]>('exams:performance');

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const list = await getExams();
        setExams(list);
        setLoaded(true);
        rememberLast(examsToKeep(list));
      } catch (e: any) {
        console.log('[getExams] Error:', e?.response?.status, e?.message);
        setError(examErrorMessage(e));
        setExams([]);
        setLoaded(false);
      } finally {
        setLoading(false);
      }
    },
    [rememberLast],
  );

  const reload = useCallback(() => load(true), [load]);

  useFocusLoad(() => load());

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <ExamList
        exams={exams}
        loading={loading}
        refreshing={false}
        onRefresh={reload}
        error={error}
        onRetry={reload}
        drawn={examsToDraw(loaded, exams, last)}
        onPressExam={exam => navigation.navigate('ExamResult', { exam })}
        emptySubtitle="Exams the school schedules for your class will appear here, with your marks once they are added."
      />
    </View>
  );
};

export default PerformanceScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { getExams, examErrorMessage } from '../../api/examApi';
import type { Exam } from '../exam/examData';
import { ExamList } from '../exam/examUi';

/**
 * A student's performance, exam by exam: the exams as the Exams screen lists
 * them, each opening onto its result subject by subject (ExamResult).
 */

const TITLE = 'My Performance';

const PerformanceScreen = ({ navigation }: any) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setExams(await getExams());
    } catch (e: any) {
      console.log('[getExams] Error:', e?.response?.status, e?.message);
      setError(examErrorMessage(e));
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
      <ExamList
        exams={exams}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        error={error}
        onRetry={load}
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

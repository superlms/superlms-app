import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { getExams, examErrorMessage } from '../../api/examApi';
import type { Exam } from './examData';
import { ExamList } from './examUi';

const TITLE = 'Exams';

// Route params: teacher – true when a teacher opens it from their Exams.
const ExamsScreen = ({ navigation, route }: any) => {
  const teacher = !!route?.params?.teacher;
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
        onPressExam={exam => navigation.navigate('ExamDetail', { examId: exam.id, exam, teacher })}
        emptySubtitle={
          teacher
            ? 'Exams set for the classes and subjects you teach will appear here.'
            : 'Exams the school schedules for your class will appear here.'
        }
      />
    </View>
  );
};

export default ExamsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

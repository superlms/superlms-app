import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import { getExams, examErrorMessage } from '../../api/examApi';
import type { Exam } from '../exam/examData';
import { ExamList } from '../exam/examUi';

/**
 * Upload Marks, step one: the exams, listed as on the Exams screen. An exam
 * opens onto the classes the teacher teaches (MarksClasses), and a class onto
 * its students' marks (MarksSheet).
 */

const TITLE = 'Upload Marks';

const UploadMarksScreen = ({ navigation }: any) => {
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
        onPressExam={exam => navigation.navigate('MarksClasses', { exam })}
        emptySubtitle="Exams set for the classes and subjects you teach will appear here."
      />
    </View>
  );
};

export default UploadMarksScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import {
  getExams,
  getExamSyllabus,
  examErrorMessage,
} from '../../api/examApi';
import type { Exam, SyllabusItem } from './examData';
import { ExamList, SyllabusList } from './examUi';

const TITLE = 'Exam Syllabus';

// A syllabus is fetched the first time its exam is opened, and kept.
type SyllabusState = SyllabusItem[] | 'loading' | 'error';

const TeacherExamsScreen = ({ navigation }: any) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [syllabi, setSyllabi] = useState<Record<string, SyllabusState>>({});

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

  const fetchSyllabus = useCallback(async (id: string) => {
    setSyllabi(p => ({ ...p, [id]: 'loading' }));
    try {
      const list = await getExamSyllabus(id);
      setSyllabi(p => ({ ...p, [id]: list }));
    } catch (e: any) {
      console.log('[getExamSyllabus] Error:', e?.response?.status, e?.message);
      // Not cached as empty: a failed fetch is offered again, not reported as
      // "no syllabus".
      setSyllabi(p => ({ ...p, [id]: 'error' }));
    }
  }, []);

  const toggle = (exam: Exam) => {
    const opening = openId !== exam.id;
    setOpenId(opening ? exam.id : null);
    const cached = syllabi[exam.id];
    if (opening && (cached === undefined || cached === 'error')) fetchSyllabus(exam.id);
  };

  const rowExtras = (exam: Exam) => {
    const open = openId === exam.id;
    const syllabus = syllabi[exam.id];

    return {
      cue: open ? 'Hide syllabus' : 'View syllabus',
      expanded: open,
      below: open ? (
        <View style={s.panel}>
          {syllabus === undefined || syllabus === 'loading' ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={s.spinner} />
          ) : syllabus === 'error' ? (
            <View style={s.panelLine}>
              <Text style={s.panelText}>Couldn’t load the syllabus.</Text>
              <TouchableOpacity onPress={() => fetchSyllabus(exam.id)} hitSlop={8}>
                <Text style={s.linkText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : syllabus.length === 0 ? (
            <Text style={[s.panelText, s.panelLine]}>No syllabus has been set for this exam.</Text>
          ) : (
            <SyllabusList items={syllabus} />
          )}
        </View>
      ) : null,
    };
  };

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
        onPressExam={toggle}
        rowExtras={rowExtras}
        emptySubtitle="Exams set for the classes and subjects you teach will appear here."
      />
    </View>
  );
};

export default TeacherExamsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // The syllabus, opened in place under its exam
  panel: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  spinner: { paddingVertical: 14 },
  panelLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  panelText: { fontSize: 13, color: theme.colors.textSecondary },
  linkText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

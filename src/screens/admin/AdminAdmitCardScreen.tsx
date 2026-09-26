import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { DocHeader } from '../more/docUi';
import { ExamList, examsToDraw, examsToKeep } from '../exam/examUi';
import type { Exam } from '../exam/examData';
import { AdmitExam, admitExamToExam, getAdmitLookups } from '../../api/adminAdmitCardApi';
import { HeadActions, HeadBtn } from './adminAdmitCardUi';

/**
 * Admit Card (admin) — as the student's Admit Card screen opens: the school's
 * exams, listed as on the Exams screen. An exam opens onto its classes, a class
 * onto its sections and students, each with whether their card is issued —
 * the web page's exam → class → section filters, one step at a time.
 *
 * The header holds Print (the web's Print panel: the cards not printed yet, on
 * the four-up sheet) and + (the web's Issue panel: a class at once, by
 * attendance or fee if asked).
 */

const TITLE = 'Admit Card';

const AdminAdmitCardScreen = ({ navigation }: any) => {
  const [exams, setExams] = useState<AdmitExam[]>([]);
  const [loading, setLoading] = useState(true);
  // The list on screen came from the school.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, rememberLast] = useLastLoaded<Exam[]>('admin:admit-card:exams');

  const seq = useRef(0);
  const load = useCallback(
    async (showSkeleton = false) => {
      const mine = ++seq.current;
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const r = await getAdmitLookups();
        if (mine !== seq.current) return;
        setExams(r.exams ?? []);
        setLoaded(true);
        rememberLast(examsToKeep((r.exams ?? []).map(admitExamToExam)));
      } catch (e) {
        if (mine !== seq.current) return;
        setError(apiErr(e, 'Could not load the exams.'));
        setExams([]);
        setLoaded(false);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    },
    [rememberLast],
  );

  const reload = useCallback(() => load(true), [load]);

  // Opening the screen, and coming back to it, reads what is issued now.
  useFocusLoad(() => load());

  const mapped = useMemo(() => exams.map(admitExamToExam), [exams]);

  const open = (exam: Exam) => {
    const raw = exams.find(e => String(e.id) === exam.id);
    if (raw) navigation.navigate('AdminAdmitCardClasses', { exam: { id: raw.id, name: raw.name } });
  };

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={
          <HeadActions>
            <HeadBtn icon="print-outline" onPress={() => navigation.navigate('AdminAdmitCardPrint')} />
            <HeadBtn icon="add" onPress={() => navigation.navigate('AdminAdmitCardIssue')} />
          </HeadActions>
        }
      />
      <ExamList
        exams={mapped}
        loading={loading}
        refreshing={false}
        onRefresh={reload}
        error={error}
        onRetry={reload}
        onPressExam={open}
        emptySubtitle="Exams the school adds under Exams will appear here."
        drawn={examsToDraw(loaded, mapped, last)}
      />
    </View>
  );
};

export default AdminAdmitCardScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

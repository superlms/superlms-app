import { useCallback, useState } from 'react';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { getExams, examErrorMessage } from '../../api/examApi';
import type { Exam } from './examData';
import { examsToDraw, examsToKeep } from './examUi';

/**
 * The caller's exams for a list that draws itself as a skeleton while it
 * loads (ExamList's `drawn`): the first load, a pull to refresh and Try again
 * show the skeleton; coming back to the screen updates the list in place.
 * `name` keeps what the list held for its next first load.
 */
export function useExamList(name: string) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  // The list on screen came from the school.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, rememberLast] = useLastLoaded<Exam[]>(`exams:${name}`);

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

  // Spread into <ExamList>.
  return {
    exams,
    loading,
    refreshing: false,
    onRefresh: reload,
    error,
    onRetry: reload,
    drawn: examsToDraw(loaded, exams, last),
  };
}

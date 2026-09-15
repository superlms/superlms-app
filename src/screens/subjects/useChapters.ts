import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { contentErrorMessage, type SyllabusChapter } from '../../api/contentApi';

/**
 * One subject's chapters, for the Subjects, Syllabus and Study Content detail
 * screens: the list, which chapters are open, and a loader to refetch it.
 */
export interface ChaptersState {
  /** null until the first load lands. */
  chapters: SyllabusChapter[] | null;
  setChapters: Dispatch<SetStateAction<SyllabusChapter[] | null>>;
  error: string | null;
  load: () => Promise<void>;
  openIds: number[];
  toggle: (chapterId: number) => void;
  openChapter: (chapterId: number) => void;
}

export function useChapters(fetchChapters: () => Promise<SyllabusChapter[]>): ChaptersState {
  // Screens pass a fresh function on every render; the loader reads the latest.
  const fetchRef = useRef(fetchChapters);
  fetchRef.current = fetchChapters;

  const [chapters, setChapters] = useState<SyllabusChapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Every chapter starts closed; the reader opens the ones they want.
  const [openIds, setOpenIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchRef.current();
      setChapters(list);
    } catch (e: any) {
      console.log('[getChapters] Error:', e?.response?.status, e?.message);
      // A failed refresh keeps whatever was already on screen.
      setError(contentErrorMessage(e));
    }
  }, []);

  const toggle = useCallback(
    (id: number) => setOpenIds(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id])),
    [],
  );

  const openChapter = useCallback(
    (id: number) => setOpenIds(p => (p.includes(id) ? p : [...p, id])),
    [],
  );

  return { chapters, setChapters, error, load, openIds, toggle, openChapter };
}

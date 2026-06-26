import apiClient from './apiClient';

// Quiz (MCQ) module. Mirrors app/Livewire/Admin/Quiz.php over /admin/quiz.

const unwrap = (data: any) => data?.data ?? data;

export type QuizTarget = 'chapter' | 'topic';

export interface QuizTopic {
  id: number;
  name: string;
  mcq_count: number;
}

export interface QuizChapter {
  id: number;
  name: string;
  mcq_count: number;
  topics: QuizTopic[];
}

export interface McqOption {
  id?: number;
  text: string;
  is_correct: boolean;
}

export interface Mcq {
  id?: number;
  question_text: string;
  time_limit: number;
  options: McqOption[];
}

export const getQuizStats = async (): Promise<{ questions: number }> => {
  const { data } = await apiClient.get('/admin/quiz/stats');
  return unwrap(data);
};

export const getQuizTree = async (p: {
  standard_id: number;
  section_id?: number | null;
  subject_id: number;
}): Promise<QuizChapter[]> => {
  const { data } = await apiClient.get('/admin/quiz', { params: p });
  return unwrap(data).chapters ?? [];
};

export const getMcqs = async (type: QuizTarget, id: number): Promise<{ name: string; mcqs: Mcq[] }> => {
  const { data } = await apiClient.get(`/admin/quiz/${type}/${id}`);
  return unwrap(data);
};

export const createMcqs = async (type: QuizTarget, id: number, mcqs: Mcq[]) => {
  const { data } = await apiClient.post(`/admin/quiz/${type}/${id}`, { mcqs });
  return unwrap(data);
};

export const updateMcqs = async (mcqs: Mcq[]) => {
  const { data } = await apiClient.put('/admin/quiz/mcqs', { mcqs });
  return unwrap(data);
};

export const deleteMcqs = async (ids: number[]) => {
  const { data } = await apiClient.delete('/admin/quiz/mcqs', { data: { ids } });
  return unwrap(data);
};

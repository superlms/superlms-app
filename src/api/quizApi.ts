import apiClient from './apiClient';
import { contentErrorMessage } from './contentApi';

// Unwrap the standard { success, message, data } envelope.
const unwrap = (data: any) => data?.data ?? data;

const truthy = (v: any) => v === true || v === 1 || v === '1';

// ─── Types (UI-facing) ─────────────────────────────────────────────────────────
export interface QuizOption {
  id?: number;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: number;
  questionText: string;
  timeLimit: number; // seconds
  chapterId: number | null;
  topicId: number | null;
  options: QuizOption[];
}

// ─── Mappers ───────────────────────────────────────────────────────────────────
const mapOption = (o: any): QuizOption => ({
  id: o.id,
  text: o.option_text ?? o.text ?? '',
  isCorrect: truthy(o.is_correct),
});

const mapQuestion = (q: any): QuizQuestion => ({
  id: q.id,
  questionText: q.question_text ?? '',
  timeLimit: Number(q.time_limit ?? 60),
  chapterId: q.chapter_id ?? null,
  topicId: q.topic_id ?? null,
  options: Array.isArray(q.options) ? q.options.map(mapOption) : [],
});

// ─── Read ──────────────────────────────────────────────────────────────────────
export interface QuizFilter {
  standard_id?: number;
  section_id?: number;
  chapter_id?: number;
  topic_id?: number;
}

// POST /quiz/get — MCQ questions (with options) for a chapter/topic.
export const getQuizzes = async (filter: QuizFilter): Promise<QuizQuestion[]> => {
  const { data } = await apiClient.post('/quiz/get', { ...filter, per_page: 200 });
  const d = unwrap(data);
  const list = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
  return list.map(mapQuestion);
};

// ─── Teacher CRUD ────────────────────────────────────────────────────────────────
export interface QuizQuestionInput {
  question_text: string;
  standard_id: number;
  section_id: number;
  chapter_id?: number | null;
  topic_id?: number | null;
  time_limit: number;
  options: { option_text: string; is_correct: boolean }[];
}

// POST /quiz/upload
export const createQuestion = async (p: QuizQuestionInput): Promise<QuizQuestion> => {
  const { data } = await apiClient.post('/quiz/upload', p);
  return mapQuestion(unwrap(data));
};

// POST /quiz/update/{id}
export const updateQuestion = async (id: number, p: QuizQuestionInput): Promise<QuizQuestion> => {
  const { data } = await apiClient.post(`/quiz/update/${id}`, p);
  return mapQuestion(unwrap(data));
};

// DELETE /quiz/delete/{id}
export const deleteQuestion = async (id: number): Promise<void> => {
  await apiClient.delete(`/quiz/delete/${id}`);
};

// ─── Student attempt ─────────────────────────────────────────────────────────────
// POST /quiz/submit-answer — persists the attempt so the report + admin stay in sync.
export const submitAnswer = async (
  mcqQuestionId: number,
  mcqOptionId: number,
  timeTaken: number,
): Promise<void> => {
  await apiClient.post('/quiz/submit-answer', {
    mcq_question_id: mcqQuestionId,
    mcq_option_id: mcqOptionId,
    time_taken: Math.max(0, Math.round(timeTaken)),
  });
};

// Reuse the shared friendly-error mapper.
export const quizErrorMessage = contentErrorMessage;

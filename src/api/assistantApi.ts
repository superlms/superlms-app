import apiClient from './apiClient';

// ─── LMS Assist ───────────────────────────────────────────────────────────────
// The web panel's Super LMS assistant. It answers about the signed-in admin's
// own school; the conversation is kept here and sent with each question.

export type AssistantTurn = { role: 'user' | 'model'; text: string };

export interface AssistantQuota {
  unlimited: boolean;
  daily_limit: number | null;
  remaining: number | null;
  resets: string;
}

export interface AssistantStatus extends AssistantQuota {
  enabled: boolean;
  name: string;
  scope: string;
  suggestions: string[];
}

export const getAssistantStatus = async (): Promise<AssistantStatus> => {
  const { data } = await apiClient.get('/assistant');
  return data?.data as AssistantStatus;
};

/**
 * The answer (markdown), and the allowance left. A refusal the assistant
 * explains — the day's questions used up, say — comes back as the answer too.
 */
export const askAssistant = async (
  question: string,
  history: AssistantTurn[],
): Promise<{ text: string; quota: AssistantQuota | null }> => {
  try {
    const { data } = await apiClient.post(
      '/assistant/ask',
      { question, history: history.slice(-40) },
      { timeout: 90000 },
    );
    return { text: data?.data?.text ?? '', quota: data?.data ?? null };
  } catch (e: any) {
    const body = e?.response?.data;
    if (body?.message && e?.response?.status !== 401) {
      // A refusal carries the allowance in `errors`; a validation error, fields.
      const quota = body.errors && 'resets' in body.errors ? body.errors : null;
      return { text: body.message, quota };
    }
    throw e;
  }
};

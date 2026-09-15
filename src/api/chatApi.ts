import apiClient from './apiClient';
import type { PickedFile } from './adminProfileApi';

// ─────────────────────────────────────────────────────────────────────────────
//  Chat between a student and their teachers — /chat/…
//
//  The backend keeps the web panel's chat rules: one-to-one conversations,
//  deletes that only hide things for you, and ticks for delivered and read.
//  Attachments come back with a signed link that lasts about an hour.
// ─────────────────────────────────────────────────────────────────────────────

const unwrap = (data: any) => data?.data ?? data;

export interface ChatPreview {
  body: string | null;
  attachment_type: 'image' | 'file' | null;
  mine: boolean;
  created_at: string;
}

export interface ChatPerson {
  user_id: number;
  name: string;
  avatar: string | null;
  // A student's teacher: the subjects they teach the class. A teacher's student: "10th A".
  subtitle: string | null;
  // A teacher: each subject they teach the student's class.
  subjects?: string[];
  // A student: their class and section, to pick a class before a student.
  standard?: { id: number; name: string } | null;
  section?: { id: number; name: string } | null;
}

export interface ChatContact extends ChatPerson {
  conversation_id: number | null;
  last_message: ChatPreview | null;
  unread: number;
}

export interface ChatAttachment {
  type: 'image' | 'file';
  name: string | null;
  size: number | null;
  url: string | null;
}

export interface ChatMessage {
  id: number;
  body: string | null;
  mine: boolean;
  created_at: string;
  status: 'sent' | 'delivered' | 'read';
  attachment: ChatAttachment | null;
}

export interface ChatThread {
  conversation_id: number | null;
  contact: ChatPerson;
  messages: ChatMessage[];
  // Older messages remain before the first one returned.
  has_more: boolean;
  // Every message of mine up to these ids has reached the other person / been read.
  receipts?: { delivered_up_to: number; read_up_to: number };
}

/** Everyone this user can chat with, the latest conversation first. */
export const getChatContacts = async (): Promise<ChatContact[]> => {
  const { data } = await apiClient.get('/chat/contacts');
  return unwrap(data) ?? [];
};

/**
 * A conversation's latest messages — or only those after `afterId` (checking for
 * new ones) or before `beforeId` (older ones). Reading marks theirs read.
 */
export const getChatThread = async (
  userId: number,
  opts: { afterId?: number; beforeId?: number } = {},
): Promise<ChatThread> => {
  const { data } = await apiClient.get(`/chat/with/${userId}`, {
    params: { after_id: opts.afterId, before_id: opts.beforeId },
  });
  return unwrap(data);
};

/** Send a message: words, a file, or both. */
export const sendChatMessage = async (
  userId: number,
  message: { body?: string; file?: PickedFile | null },
): Promise<ChatMessage> => {
  const form = new FormData();
  if (message.body) form.append('body', message.body);
  if (message.file) {
    form.append('file', { uri: message.file.uri, name: message.file.name, type: message.file.type } as any);
  }
  const { data } = await apiClient.post(`/chat/with/${userId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // A file can take a while on a slow connection.
    timeout: 60000,
  });
  return unwrap(data);
};

/** Delete messages for yourself; the other person keeps theirs. */
export const deleteChatMessages = async (ids: number[]): Promise<void> => {
  await apiClient.post('/chat/messages/delete', { ids });
};

/** Delete whole chats for yourself; they come back when a new message arrives. */
export const deleteChatConversations = async (userIds: number[]): Promise<void> => {
  await apiClient.post('/chat/conversations/delete', { user_ids: userIds });
};

export const chatErrorMessage = (e: any): string => {
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.message === 'Network Error' || !e?.response) {
    return 'No internet connection. Check your network and try again.';
  }
  return 'Something went wrong. Please try again.';
};

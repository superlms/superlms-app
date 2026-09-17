import axios from 'axios';
import apiClient from './apiClient';
import constant from '../utils/constant';
import type { PickedFile } from './adminProfileApi';

// ─────────────────────────────────────────────────────────────────────────────
//  Chat between a student and their teachers — /chat/…
//
//  The backend keeps the web panel's chat rules: one-to-one conversations,
//  deletes that only hide things for you, and ticks for delivered and read.
//  Attachments come back with a signed link that lasts about an hour — until
//  the phone they were sent to has saved them, and then with none at all.
// ─────────────────────────────────────────────────────────────────────────────

const unwrap = (data: any) => data?.data ?? data;

export interface ChatPreview {
  body: string | null;
  attachment_type: 'image' | 'video' | 'file' | null;
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
  // You have blocked them.
  blocked?: boolean;
}

export interface ChatAttachment {
  // Chats send photos and documents; a video from elsewhere is shown as a document.
  type: 'image' | 'video' | 'file';
  name: string | null;
  size: number | null;
  // null once the other phone has saved the file: each phone opens its own copy.
  url: string | null;
}

export interface ChatMessage {
  id: number;
  body: string | null;
  mine: boolean;
  created_at: string;
  status: 'sent' | 'delivered' | 'read';
  // Pinned in the conversation, for both people.
  pinned?: boolean;
  // A copy forwarded from another message.
  forwarded?: boolean;
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
  // Every pinned message, the latest pin first.
  pinned?: ChatMessage[];
  // You have blocked them.
  blocked?: boolean;
  // False when either of you has blocked the other.
  can_message?: boolean;
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

/**
 * Send a message: words, a file, or both. `forwardedFrom` marks a copy of one of
 * my messages, sent again with its file from this phone.
 */
export const sendChatMessage = async (
  userId: number,
  message: { body?: string; file?: PickedFile | null; forwardedFrom?: number },
): Promise<ChatMessage> => {
  const form = new FormData();
  if (message.body) form.append('body', message.body);
  if (message.file) {
    form.append('file', { uri: message.file.uri, name: message.file.name, type: message.file.type } as any);
  }
  if (message.forwardedFrom) form.append('forwarded_from', String(message.forwardedFrom));
  const { data } = await apiClient.post(`/chat/with/${userId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // A file can take a while on a slow connection.
    timeout: 60000,
  });
  return unwrap(data);
};

/** This phone has saved these messages' files, so the server can let them go. */
export const markChatFilesReceived = async (ids: number[]): Promise<void> => {
  await apiClient.post('/chat/attachments/received', { ids });
};

/** Delete messages for yourself; the other person keeps theirs. */
export const deleteChatMessages = async (ids: number[]): Promise<void> => {
  await apiClient.post('/chat/messages/delete', { ids });
};

/** Pin messages for both people — or unpin them, when every one is pinned already. */
export const pinChatMessages = async (ids: number[]): Promise<{ pinned: boolean; ids: number[] }> => {
  const { data } = await apiClient.post('/chat/messages/pin', { ids });
  return unwrap(data);
};

/** Send copies of messages, files included, to other people. */
export const forwardChatMessages = async (ids: number[], userIds: number[]): Promise<void> => {
  await apiClient.post('/chat/messages/forward', { ids, user_ids: userIds });
};

/**
 * This phone has what was sent to its user — the senders see two ticks. For
 * another account signed in on the phone, pass that account's sign-in token.
 */
export const markChatDelivered = async (authToken?: string): Promise<void> => {
  if (authToken) {
    await axios.post(
      `${constant.API_BASE_URL}/chat/delivered`,
      {},
      { headers: { Accept: 'application/json', Authorization: `Bearer ${authToken}` }, timeout: 15000 },
    );
    return;
  }
  await apiClient.post('/chat/delivered');
};

/** Block people: they can't message you — so none of their notifications — nor you them, until you unblock. */
export const blockChatUsers = async (userIds: number[]): Promise<void> => {
  await apiClient.post('/chat/block', { user_ids: userIds });
};

export const unblockChatUsers = async (userIds: number[]): Promise<void> => {
  await apiClient.post('/chat/unblock', { user_ids: userIds });
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

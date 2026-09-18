import axios from 'axios';
import apiClient from './apiClient';
import constant from '../utils/constant';
import type { PickedFile } from './adminProfileApi';

// ─────────────────────────────────────────────────────────────────────────────
//  Chat between a student and their teachers — /chat/… — and the admin app's
//  Messages — /admin/chat/… — the web panel's chat between a school's admins,
//  sub-admins and accounts team.
//
//  The backend keeps the web panel's chat rules: one-to-one conversations,
//  deletes that only hide things for you, and ticks for delivered and read.
//  Attachments come back with a signed link that lasts about an hour — until
//  the phone they were sent to has saved them, and then with none at all.
//  Messages keeps its files on the server, as the web panel does.
// ─────────────────────────────────────────────────────────────────────────────

const unwrap = (data: any) => data?.data ?? data;

/** Who is signed in: a student or teacher chats with each other, an admin in Messages. */
export type ChatRole = 'student' | 'teacher' | 'admin';

/** The role a chat screen was opened for — a student's, unless it says otherwise. */
export const chatRoleOf = (value: any): ChatRole =>
  value === 'teacher' || value === 'admin' ? value : 'student';

const base = (role?: ChatRole) => (role === 'admin' ? '/admin/chat' : '/chat');

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
  // In Messages: their role, "Admin", "Sub-admin" or "Accounts".
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
  // Messages: you have pinned this chat to the top of your list.
  pinned?: boolean;
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

/** Everyone this user can chat with, the latest conversation first (in Messages, pinned chats before it). */
export const getChatContacts = async (role?: ChatRole): Promise<ChatContact[]> => {
  const { data } = await apiClient.get(`${base(role)}/contacts`);
  return unwrap(data) ?? [];
};

/**
 * A conversation's latest messages — or only those after `afterId` (checking for
 * new ones) or before `beforeId` (older ones). Reading marks theirs read.
 */
export const getChatThread = async (
  userId: number,
  opts: { afterId?: number; beforeId?: number } = {},
  role?: ChatRole,
): Promise<ChatThread> => {
  const { data } = await apiClient.get(`${base(role)}/with/${userId}`, {
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
  role?: ChatRole,
): Promise<ChatMessage> => {
  const form = new FormData();
  if (message.body) form.append('body', message.body);
  if (message.file) {
    form.append('file', { uri: message.file.uri, name: message.file.name, type: message.file.type } as any);
  }
  if (message.forwardedFrom) form.append('forwarded_from', String(message.forwardedFrom));
  const { data } = await apiClient.post(`${base(role)}/with/${userId}`, form, {
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
export const deleteChatMessages = async (ids: number[], role?: ChatRole): Promise<void> => {
  await apiClient.post(`${base(role)}/messages/delete`, { ids });
};

/** Pin messages for both people — or unpin them, when every one is pinned already. */
export const pinChatMessages = async (
  ids: number[],
  role?: ChatRole,
): Promise<{ pinned: boolean; ids: number[] }> => {
  const { data } = await apiClient.post(`${base(role)}/messages/pin`, { ids });
  return unwrap(data);
};

/** Send copies of messages, files included, to other people. */
export const forwardChatMessages = async (ids: number[], userIds: number[], role?: ChatRole): Promise<void> => {
  await apiClient.post(`${base(role)}/messages/forward`, { ids, user_ids: userIds });
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
export const deleteChatConversations = async (userIds: number[], role?: ChatRole): Promise<void> => {
  await apiClient.post(`${base(role)}/conversations/delete`, { user_ids: userIds });
};

/** Messages: pin chats to the top of your own list — or unpin them, when every one is pinned already. */
export const pinChatConversations = async (userIds: number[]): Promise<{ pinned: boolean }> => {
  const { data } = await apiClient.post(`${base('admin')}/conversations/pin`, { user_ids: userIds });
  return unwrap(data);
};

export const chatErrorMessage = (e: any): string => {
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.message === 'Network Error' || !e?.response) {
    return 'No internet connection. Check your network and try again.';
  }
  return 'Something went wrong. Please try again.';
};

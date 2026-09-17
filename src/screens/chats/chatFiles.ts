import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import type { ChatAttachment, ChatMessage } from '../../api/chatApi';
import type { PickedFile } from '../../api/adminProfileApi';

// ─────────────────────────────────────────────────────────────────────────────
//  Chat files, the WhatsApp way.
//
//  The server only carries a file across: the phone it was sent to downloads
//  it, keeps it and says so, and the server then lets it go. Every phone keeps
//  its own copy in the app's folder, named by the message — the sender's from
//  the moment it is sent — and a photo or document that arrives is also put in
//  the phone's Pictures or Download under SuperLMS, where the gallery and Files
//  show it. Chats carry photos and documents only; a video that arrives from
//  elsewhere is kept and opened as a document.
// ─────────────────────────────────────────────────────────────────────────────

const { fs, config, MediaCollection } = ReactNativeBlobUtil;
const DIR = `${fs.dirs.DocumentDir}/chat`;

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  '3gp': 'video/3gpp',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
};

type WithFile = { id: number; attachment: ChatAttachment };

const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

const defaultName = (type: ChatAttachment['type']) =>
  type === 'image' ? 'photo.jpg' : type === 'video' ? 'video.mp4' : 'file';

// React Native sends a file's name percent-encoded ("Annual%20Sports%20Day.pdf")
// and the server keeps it that way, so it is read back decoded. A name that
// isn't encoded ("50% marks.pdf") stays as it is.
const decodeName = (name: string) => {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
};

/** The file's name as it was picked, for showing — and for sending on. */
export const displayNameOf = (a: ChatAttachment) => (a.name ? decodeName(a.name).trim() : '') || 'File';

/**
 * The file's name, safe to write to disk and to put in a file:// link: "%" and
 * "#" go too, since the PDF reader decodes the link it is given. A long name
 * keeps its end, where the extension is.
 */
export const fileNameOf = (a: ChatAttachment) => {
  const safe = decodeName(a.name || '')
    .replace(/[\\/:*?"<>|%#]+/g, '_')
    .trim();
  return safe.slice(-100).trim() || defaultName(a.type);
};

// How files were named before, with the server's encoded name — found and renamed.
const legacyNameOf = (a: ChatAttachment) =>
  (a.name || defaultName(a.type)).replace(/[\\/:*?"<>|]+/g, '_').trim().slice(-100) || defaultName(a.type);

export const mimeOf = (a: ChatAttachment) =>
  MIME[extOf(fileNameOf(a))] ??
  (a.type === 'image' ? 'image/jpeg' : a.type === 'video' ? 'video/mp4' : 'application/octet-stream');

/** How the app opens it: a photo or text here, a PDF in the reader, anything else in the phone's app. */
export const kindOf = (a: ChatAttachment): 'image' | 'pdf' | 'text' | 'other' => {
  if (a.type === 'image') return 'image';
  if (a.type === 'video') return 'other';
  const ext = extOf(fileNameOf(a));
  return ext === 'pdf' ? 'pdf' : ext === 'txt' ? 'text' : 'other';
};

/**
 * A file on this phone as a file:// link, each part of the path encoded — the
 * image and PDF views decode it back to the path.
 */
export const fileUri = (path: string) => {
  if (path.startsWith('file://')) return path;
  return `file://${path.split('/').map(encodeURIComponent).join('/')}`;
};

/** Where this message's file lives on this phone. */
export const chatFilePath = (m: WithFile) => `${DIR}/${m.id}-${fileNameOf(m.attachment)}`;

// Several files download at once when a conversation opens; the folder is made
// once, and one made meanwhile is no failure.
let dirReady: Promise<void> | null = null;
const ensureDir = () => {
  if (!dirReady) {
    dirReady = (async () => {
      if (await fs.isDir(DIR)) return;
      try {
        await fs.mkdir(DIR);
      } catch (e) {
        if (!(await fs.isDir(DIR))) throw e;
      }
    })().catch(e => {
      dirReady = null;
      throw e;
    });
  }
  return dirReady;
};

/** The message's file on this phone, or null. */
export const findChatFile = async (m: WithFile): Promise<string | null> => {
  const path = chatFilePath(m);
  try {
    if (await fs.exists(path)) return path;
    // A copy kept under its old name moves to the new one.
    const legacy = `${DIR}/${m.id}-${legacyNameOf(m.attachment)}`;
    if (legacy !== path && (await fs.exists(legacy))) {
      await fs.mv(legacy, path);
      return path;
    }
    return null;
  } catch {
    return null;
  }
};

/** Keep this phone's copy of a file just sent, from the gallery or Files. */
export const keepSentFile = async (m: ChatMessage, picked: PickedFile): Promise<string | null> => {
  if (!m.attachment) return null;
  const dest = chatFilePath(m as WithFile);
  try {
    await ensureDir();
    if (picked.uri.startsWith('content://')) {
      await MediaCollection.copyToInternal(picked.uri, dest);
    } else {
      await fs.cp(decodeURIComponent(picked.uri.replace(/^file:\/\//, '')), dest);
    }
    return dest;
  } catch (e) {
    console.log('[chatFiles] keeping the sent file failed:', e);
    return null;
  }
};

// A file that arrived goes where the phone's gallery and Files find it too.
const publishToPhone = async (path: string, a: ChatAttachment) => {
  if (Platform.OS !== 'android') return;
  await MediaCollection.copyToMediaStore(
    { name: fileNameOf(a), parentFolder: 'SuperLMS', mimeType: mimeOf(a) },
    a.type === 'image' ? 'Image' : 'Download',
    path,
  );
};

/** Fetch a file the server still holds and keep it on this phone. Returns its path. */
export const downloadChatFile = async (m: ChatMessage): Promise<string> => {
  const a = m.attachment;
  if (!a?.url) throw new Error('This file is no longer on the server.');
  await ensureDir();
  const dest = chatFilePath(m as WithFile);
  const part = `${dest}.part`;

  const res = await config({ path: part }).fetch('GET', a.url);
  const status = res.info().status;
  if (status >= 400) {
    await fs.unlink(part).catch(() => {});
    throw new Error(`Download failed (HTTP ${status})`);
  }
  await fs.mv(part, dest);

  if (!m.mine) {
    publishToPhone(dest, a).catch(e => console.log('[chatFiles] publishing to the phone failed:', e));
  }
  return dest;
};

/** A document no screen here shows opens in the phone's own app for it, from this phone's copy. */
export const openInPhoneApp = async (path: string, a: ChatAttachment) => {
  if (Platform.OS === 'android') {
    await ReactNativeBlobUtil.android.actionViewIntent(path, mimeOf(a));
  } else {
    await ReactNativeBlobUtil.ios.openDocument(path);
  }
};

/** A file's words, for a text file opened here. */
export const readTextFile = (path: string) => fs.readFile(path, 'utf8');

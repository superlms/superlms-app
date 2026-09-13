import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';

/**
 * Sanctum bearer header for token-protected PDF endpoints (admit card / report
 * card). Also used by the in-app PDF reader via the `headers` source prop.
 */
export const authHeader = async (): Promise<Record<string, string>> => {
  const token = await AsyncStorage.getItem('auth_token');
  return {
    Accept: 'application/pdf',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// A file's type from its extension, for the Downloads listing.
const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
};

/**
 * Download a file to the device.
 *
 * We deliberately do NOT use Android's DownloadManager: it doesn't reliably
 * forward an auth header, so the request would hang and the spinner never
 * stops. Instead we fetch the bytes ourselves (the promise resolves once the
 * file is on disk), then surface the file:
 *   • Android → copy into the public Downloads via MediaStore (API 29+),
 *     falling back to DownloadManager registration / a view intent.
 *   • iOS     → open the share/preview sheet so the user can save to Files.
 *
 * No header is sent unless given, so a public link (e.g. S3) never sees the
 * app's token. Throws when the server answers with an error. Returns the local
 * file path.
 */
export const downloadFile = async (
  url: string,
  fileName: string,
  headers: Record<string, string> = {},
): Promise<string> => {
  const { config, fs, android, ios, MediaCollection } = ReactNativeBlobUtil;
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  const mimeType = MIME[ext] ?? 'application/octet-stream';

  // App-private dir is always writable (no scoped-storage issues).
  const localPath = `${fs.dirs.DocumentDir}/${fileName}`;
  const res = await config({ path: localPath, fileCache: true }).fetch('GET', url, headers);
  const status = res.info().status;
  if (status >= 400) throw new Error(`Download failed (HTTP ${status})`);
  const path = res.path();

  if (Platform.OS === 'android') {
    try {
      // Android 10+ : publish to the public Downloads collection.
      await MediaCollection.copyToMediaStore(
        { name: fileName, parentFolder: '', mimeType },
        'Download',
        path,
      );
      return path;
    } catch {
      // Older Android / MediaStore unavailable → register with the system
      // Downloads UI, else just open it so the user can save it manually.
      try {
        await android.addCompleteDownload({
          title: fileName,
          description: 'Downloaded',
          mime: mimeType,
          path,
          showNotification: true,
        });
      } catch {
        try {
          await android.actionViewIntent(path, mimeType);
        } catch {
          // give up silently — the file is still saved at `path`
        }
      }
      return path;
    }
  }

  // iOS
  await ios.openDocument(path);
  return path;
};

/** Download a (Sanctum-protected) PDF to the device — see downloadFile. */
export const downloadPdf = async (url: string, fileName: string): Promise<string> =>
  downloadFile(url, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`, await authHeader());

/**
 * Write a CSV string to a file and surface it the same way as a downloaded PDF
 * (Android → public Downloads via MediaStore; iOS → share/preview sheet). A BOM
 * is prepended so Excel reads UTF-8 correctly. Returns the local file path.
 */
export const saveCsvFile = async (fileName: string, csv: string): Promise<string> => {
  const { fs, android, ios, MediaCollection } = ReactNativeBlobUtil;
  const safeName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  const localPath = `${fs.dirs.DocumentDir}/${safeName}`;

  await fs.writeFile(localPath, '﻿' + csv, 'utf8');

  if (Platform.OS === 'android') {
    try {
      await MediaCollection.copyToMediaStore(
        { name: safeName, parentFolder: '', mimeType: 'text/csv' },
        'Download',
        localPath,
      );
      return localPath;
    } catch {
      try {
        await android.addCompleteDownload({
          title: safeName,
          description: 'Downloaded',
          mime: 'text/csv',
          path: localPath,
          showNotification: true,
        });
      } catch {
        try {
          await android.actionViewIntent(localPath, 'text/csv');
        } catch {
          // give up silently — the file is still saved at `localPath`
        }
      }
      return localPath;
    }
  }

  await ios.openDocument(localPath);
  return localPath;
};

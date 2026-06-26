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

/**
 * Download a (Sanctum-protected) PDF to the device.
 *
 * We deliberately do NOT use Android's DownloadManager: it doesn't reliably
 * forward our auth header, so the request would hang and the spinner never
 * stops. Instead we fetch the bytes ourselves (header is sent, promise resolves
 * once the file is on disk), then surface the file:
 *   • Android → copy into the public Downloads via MediaStore (API 29+),
 *     falling back to DownloadManager registration / a view intent.
 *   • iOS     → open the share/preview sheet so the user can save to Files.
 *
 * Returns the local file path.
 */
export const downloadPdf = async (url: string, fileName: string): Promise<string> => {
  const headers = await authHeader();
  const { config, fs, android, ios, MediaCollection } = ReactNativeBlobUtil;
  const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  // App-private dir is always writable (no scoped-storage issues) and the
  // authenticated fetch resolves as soon as the bytes land — fixing the hang.
  const localPath = `${fs.dirs.DocumentDir}/${safeName}`;
  const res = await config({ path: localPath, fileCache: true }).fetch('GET', url, headers);
  const path = res.path();

  if (Platform.OS === 'android') {
    try {
      // Android 10+ : publish to the public Downloads collection.
      await MediaCollection.copyToMediaStore(
        { name: safeName, parentFolder: '', mimeType: 'application/pdf' },
        'Download',
        path,
      );
      return path;
    } catch {
      // Older Android / MediaStore unavailable → register with the system
      // Downloads UI, else just open it so the user can save it manually.
      try {
        await android.addCompleteDownload({
          title: safeName,
          description: 'Downloaded',
          mime: 'application/pdf',
          path,
          showNotification: true,
        });
      } catch {
        try {
          await android.actionViewIntent(path, 'application/pdf');
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

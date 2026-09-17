import { NativeModules, Platform } from 'react-native';

// ChatClipboard is the app's own Android module (android/app/…/ChatClipboardModule.kt).
// A build without it — or iOS — copies words only.
type ChatClipboardModule = { copyFile: (path: string, label: string) => Promise<boolean> };

const nativeModule = (): ChatClipboardModule | null => {
  const m = Platform.OS === 'android' ? NativeModules.ChatClipboard : null;
  return m && typeof m.copyFile === 'function' ? m : null;
};

/** Whether this build can put a file itself on the clipboard. */
export const canCopyFiles = () => nativeModule() !== null;

/** Put a file on the phone's clipboard, for another app to paste. Throws on a build that cannot. */
export const copyFileToClipboard = async (path: string, label: string): Promise<void> => {
  const m = nativeModule();
  if (!m) throw new Error('Copying files needs the latest version of the app.');
  await m.copyFile(path, label);
};

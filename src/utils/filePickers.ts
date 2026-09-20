import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { PickedFile } from '../api/adminProfileApi';
import { AppAlert } from '../components/AppDialog';

// Document picker is a native module; require it lazily so the JS bundle still
// loads on builds that haven't been rebuilt with it yet.
let DocPicker: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DocPicker = require('@react-native-documents/picker');
} catch {
  DocPicker = null;
}

export const pickImage = (): Promise<PickedFile | null> =>
  new Promise(resolve => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, res => {
      if (res.didCancel || res.errorCode) return resolve(null);
      const a = res.assets?.[0];
      if (!a?.uri) return resolve(null);
      resolve({ uri: a.uri, type: a.type ?? 'image/jpeg', name: a.fileName ?? 'photo.jpg', size: a.fileSize });
    });
  });

/**
 * The phone's camera, for a photo taken there and then — a student's profile
 * picture, say. The system camera app is opened by intent, so no CAMERA
 * permission is asked for (the manifest declares none).
 */
export const takePhoto = (): Promise<PickedFile | null> =>
  new Promise(resolve => {
    launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: false }, res => {
      if (res.didCancel) return resolve(null);
      if (res.errorCode) {
        AppAlert.alert('Camera unavailable', res.errorMessage || 'Could not open the camera on this phone.');
        return resolve(null);
      }
      const a = res.assets?.[0];
      if (!a?.uri) return resolve(null);
      resolve({ uri: a.uri, type: a.type ?? 'image/jpeg', name: a.fileName ?? 'photo.jpg', size: a.fileSize });
    });
  });

export const pickPdf = async (): Promise<PickedFile | null> => {
  if (!DocPicker?.pick) {
    AppAlert.alert('Picker unavailable', 'Rebuild the app to enable PDF uploads.');
    return null;
  }
  try {
    const results = await DocPicker.pick({
      type: [DocPicker.types?.pdf ?? 'application/pdf'],
      allowMultiSelection: false,
    });
    const f = Array.isArray(results) ? results[0] : results;
    if (!f?.uri) return null;
    return { uri: f.uri, type: f.type ?? 'application/pdf', name: f.name ?? 'document.pdf', size: f.size };
  } catch (e: any) {
    if (String(e?.code ?? e?.message ?? '').toLowerCase().includes('cancel')) return null;
    AppAlert.alert('Could not pick file', e?.message ?? 'Please try again.');
    return null;
  }
};

export const apiErr = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.message || fallback;

// Any common document — PDF, Word, Excel, PowerPoint or plain text.
export const pickDocument = async (): Promise<PickedFile | null> => {
  if (!DocPicker?.pick) {
    AppAlert.alert('Picker unavailable', 'Rebuild the app to enable file uploads.');
    return null;
  }
  const t = DocPicker.types ?? {};
  const types = [t.pdf, t.doc, t.docx, t.xls, t.xlsx, t.ppt, t.pptx, t.plainText].filter(Boolean);
  try {
    const results = await DocPicker.pick({ type: types.length ? types : ['*/*'], allowMultiSelection: false });
    const f = Array.isArray(results) ? results[0] : results;
    if (!f?.uri) return null;
    return { uri: f.uri, type: f.type ?? 'application/octet-stream', name: f.name ?? 'document' };
  } catch (e: any) {
    if (String(e?.code ?? e?.message ?? '').toLowerCase().includes('cancel')) return null;
    AppAlert.alert('Could not pick file', e?.message ?? 'Please try again.');
    return null;
  }
};

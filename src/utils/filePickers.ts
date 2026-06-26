import { Alert } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { PickedFile } from '../api/adminProfileApi';

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
      resolve({ uri: a.uri, type: a.type ?? 'image/jpeg', name: a.fileName ?? 'photo.jpg' });
    });
  });

export const pickPdf = async (): Promise<PickedFile | null> => {
  if (!DocPicker?.pick) {
    Alert.alert('Picker unavailable', 'Rebuild the app to enable PDF uploads.');
    return null;
  }
  try {
    const results = await DocPicker.pick({
      type: [DocPicker.types?.pdf ?? 'application/pdf'],
      allowMultiSelection: false,
    });
    const f = Array.isArray(results) ? results[0] : results;
    if (!f?.uri) return null;
    return { uri: f.uri, type: f.type ?? 'application/pdf', name: f.name ?? 'document.pdf' };
  } catch (e: any) {
    if (String(e?.code ?? e?.message ?? '').toLowerCase().includes('cancel')) return null;
    Alert.alert('Could not pick file', e?.message ?? 'Please try again.');
    return null;
  }
};

export const apiErr = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.message || fallback;

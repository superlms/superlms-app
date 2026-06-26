import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics from 'react-native-biometrics';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

// allowDeviceCredentials: if biometrics fail/unavailable the system falls
// back to the device PIN/pattern, same as WhatsApp & banking apps. This also
// prevents users from being locked out after removing their fingerprints.
const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true,
});

export type BiometricCheck = {
  available: boolean;
  biometryType: string | null;
};

// True while any system auth sheet is open. The sheet (or the PIN/pattern
// fallback screen) can background the app, which must not re-trigger the
// app lock.
let promptInProgress = false;
export const isPromptInProgress = () => promptInProgress;

export const Biometrics = {
  // ─── Sensor ─────────────────────────────────────────────────────────────────
  check: async (): Promise<BiometricCheck> => {
    try {
      const { available, biometryType } =
        await rnBiometrics.isSensorAvailable();
      return { available, biometryType: biometryType ?? null };
    } catch {
      return { available: false, biometryType: null };
    }
  },

  /**
   * Shows the system biometric prompt.
   * Returns true on success, false if the user cancelled.
   * Never throws — hardware errors resolve to false.
   */
  authenticate: async (promptMessage: string): Promise<boolean> => {
    promptInProgress = true;
    try {
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage,
        cancelButtonText: 'Cancel',
      });
      return success;
    } catch {
      return false;
    } finally {
      // Small delay so the AppState 'background' event fired by the closing
      // auth sheet is still ignored.
      setTimeout(() => {
        promptInProgress = false;
      }, 700);
    }
  },

  // ─── App-lock preference ────────────────────────────────────────────────────
  isEnabled: async (): Promise<boolean> => {
    const val = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return val === 'true';
  },
  setEnabled: (enabled: boolean) =>
    enabled
      ? AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true')
      : AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY),
};

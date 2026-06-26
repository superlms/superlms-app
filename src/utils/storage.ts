import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ONBOARDING_SEEN: 'onboarding_seen',
  AUTH_TOKEN:      'auth_token',
  USER_DATA:       'user_data',
  USER_ROLE:       'user_role',
};

export const Storage = {
  // ─── Onboarding ─────────────────────────────────────────────────────────────
  setOnboardingSeen: () => AsyncStorage.setItem(KEYS.ONBOARDING_SEEN, 'true'),
  isOnboardingSeen:  async () => {
    const val = await AsyncStorage.getItem(KEYS.ONBOARDING_SEEN);
    return val === 'true';
  },

  // ─── Auth ────────────────────────────────────────────────────────────────────
  getToken:    () => AsyncStorage.getItem(KEYS.AUTH_TOKEN),
  setToken:    (token: string) => AsyncStorage.setItem(KEYS.AUTH_TOKEN, token),
  removeToken: () => AsyncStorage.removeItem(KEYS.AUTH_TOKEN),

  getUserData: async () => {
    const raw = await AsyncStorage.getItem(KEYS.USER_DATA);
    return raw ? JSON.parse(raw) : null;
  },
  setUserData: (data: object) =>
    AsyncStorage.setItem(KEYS.USER_DATA, JSON.stringify(data)),

  getRole: () => AsyncStorage.getItem(KEYS.USER_ROLE),
  setRole: (role: string) => AsyncStorage.setItem(KEYS.USER_ROLE, role),

  // ─── Clear ───────────────────────────────────────────────────────────────────
  clearAuth: () =>
    AsyncStorage.multiRemove([KEYS.AUTH_TOKEN, KEYS.USER_DATA, KEYS.USER_ROLE]),
  clearAll: () => AsyncStorage.clear(),
};

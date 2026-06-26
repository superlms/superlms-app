import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncDeviceToken, clearDeviceToken } from '../notifications';

export type UserRole = 'student' | 'teacher' | 'admin' | 'accounts';

export interface StudentUser {
  id: string | number;
  name: string;
  admission_number: string;
  role: 'student';
  class?: string;
  roll_no?: string;
  avatar?: string;
}

export interface TeacherUser {
  id: string | number;
  name: string;
  email: string;
  role: 'teacher';
  subject?: string;
  avatar?: string;
}

export interface AdminUser {
  id: string | number;
  name: string;
  email: string;
  role: 'admin' | 'sub-admin';
  image?: string | null;
  organization?: {
    id: number;
    name: string;
    logo?: string | null;
    school_code?: string | null;
  } | null;
}

export interface AccountsUser {
  id: string | number;
  name: string;
  email: string;
  role: 'accounts';
  image?: string | null;
  organization?: {
    id: number;
    name: string;
    logo?: string | null;
    school_code?: string | null;
  } | null;
}

export type AuthUser = StudentUser | TeacherUser | AdminUser | AccountsUser;

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

// ─── Unified Login ──────────────────────────────────────────────────────────
// One login for every user type. Students enter their admission number, every
// other role (teacher / admin / accounts) enters their email — the role is
// auto-detected by the backend from the identifier. No "select user type" step.
export interface UnifiedAuthResponse {
  token: string;
  user: AuthUser;
  role: UserRole; // 'student' | 'teacher' | 'admin' | 'accounts'
}

export const login = async (
  identifier: string,
  password: string,
): Promise<UnifiedAuthResponse> => {
  const form = new FormData();
  form.append('identifier', identifier);
  form.append('password', password);

  const { data } = await apiClient.post('/login', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  console.log('[login] Raw response:', JSON.stringify(data, null, 2));

  const payload = (data as any)?.data ?? data;
  const token = payload?.token ?? payload?.access_token;
  const user = payload?.user ?? payload;
  // Friendly account type chosen by the backend; fall back to mapping the raw role.
  const role = normalizeRole(payload?.user_type ?? payload?.dashboard ?? user?.role);

  if (!token) {
    throw new Error('No token in response: ' + JSON.stringify(data));
  }

  await _persistAuth({ token, user }, role);
  return { token, user, role };
};

// Map any backend role/user_type to the app's stored role values.
const normalizeRole = (raw?: string): UserRole => {
  switch (raw) {
    case 'teacher':
      return 'teacher';
    case 'admin':
    case 'sub-admin':
      return 'admin';
    case 'accounts':
      return 'accounts';
    default:
      return 'student'; // 'user' / 'student' / anything else
  }
};

// ─── Student Login ────────────────────────────────────────────────────────────
export const studentLogin = async (
  admission_number: string,
  password: string,
): Promise<AuthResponse> => {
  const form = new FormData();
  form.append('admission_number', admission_number);
  form.append('password', password);

  const { data } = await apiClient.post<AuthResponse>('/user/login', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  console.log('[studentLogin] Raw response:', JSON.stringify(data, null, 2));

  // Handle both { token, user } and { data: { token, user } } shapes
  const token = (data as any)?.token ?? (data as any)?.data?.token ?? (data as any)?.access_token;
  const user  = (data as any)?.user  ?? (data as any)?.data?.user  ?? (data as any)?.data;

  if (!token) {
    throw new Error('No token in response: ' + JSON.stringify(data));
  }

  await _persistAuth({ token, user }, 'student');
  return { token, user };
};

// ─── Teacher Login ────────────────────────────────────────────────────────────
export const teacherLogin = async (
  email: string,
  password: string,
): Promise<AuthResponse> => {
  const form = new FormData();
  form.append('email', email);
  form.append('password', password);

  const { data } = await apiClient.post<AuthResponse>('/teacher/login', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  console.log('[teacherLogin] Raw response:', JSON.stringify(data, null, 2));

  const token = (data as any)?.token ?? (data as any)?.data?.token ?? (data as any)?.access_token;
  const user  = (data as any)?.user  ?? (data as any)?.data?.user  ?? (data as any)?.data;

  if (!token) {
    throw new Error('No token in response: ' + JSON.stringify(data));
  }

  await _persistAuth({ token, user }, 'teacher');
  return { token, user };
};

// ─── Admin Login ──────────────────────────────────────────────────────────────
export const adminLogin = async (
  email: string,
  password: string,
): Promise<AuthResponse> => {
  const form = new FormData();
  form.append('email', email);
  form.append('password', password);

  const { data } = await apiClient.post<AuthResponse>('/admin/login', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const token = (data as any)?.token ?? (data as any)?.data?.token ?? (data as any)?.access_token;
  const user = (data as any)?.user ?? (data as any)?.data?.user ?? (data as any)?.data;

  if (!token) {
    throw new Error('No token in response: ' + JSON.stringify(data));
  }

  await _persistAuth({ token, user }, 'admin');
  return { token, user };
};

// ─── Accounts Login ───────────────────────────────────────────────────────────
export const accountsLogin = async (
  email: string,
  password: string,
): Promise<AuthResponse> => {
  const form = new FormData();
  form.append('email', email);
  form.append('password', password);

  const { data } = await apiClient.post<AuthResponse>('/accounts/login', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const token = (data as any)?.token ?? (data as any)?.data?.token ?? (data as any)?.access_token;
  const user = (data as any)?.user ?? (data as any)?.data?.user ?? (data as any)?.data;

  if (!token) {
    throw new Error('No token in response: ' + JSON.stringify(data));
  }

  await _persistAuth({ token, user }, 'accounts');
  return { token, user };
};

// ─── Forgot Password ──────────────────────────────────────────────────────────
export const forgotPassword = async (
  email: string,
): Promise<{ user_id: number | string; message: string }> => {
  const form = new FormData();
  form.append('email', email);

  const { data } = await apiClient.post('/forgot-password', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  console.log('[forgotPassword] Raw response:', JSON.stringify(data, null, 2));

  // Response shape: { success, status_code, message, data: { user_id } }
  const user_id = data?.data?.user_id ?? data?.user_id;
  const message = data?.message ?? 'OTP sent successfully.';

  if (!user_id) {
    throw new Error('No user_id in response: ' + JSON.stringify(data));
  }

  return { user_id, message };
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────
export const verifyOtp = async (
  otp: string,
  user_id: string | number,
): Promise<{ success: boolean; message: string }> => {
  const form = new FormData();
  form.append('otp', otp);
  form.append('user_id', String(user_id));

  const { data } = await apiClient.post('/verify-otp', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  console.log('[verifyOtp] Raw response:', JSON.stringify(data, null, 2));

  const success = data?.success ?? data?.status ?? false;
  const message = data?.message ?? 'OTP verified successfully.';

  if (!success) {
    throw new Error(message);
  }

  return { success, message };
};

// ─── Resend OTP ───────────────────────────────────────────────────────────────
export const resendOtp = async (
  email: string,
  user_id: string | number,
): Promise<{ success: boolean; message: string }> => {
  const form = new FormData();
  form.append('email', email);
  form.append('user_id', String(user_id));

  const { data } = await apiClient.post('/resend-otp', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  console.log('[resendOtp] Raw response:', JSON.stringify(data, null, 2));

  return {
    success: data?.success ?? data?.status ?? false,
    message: data?.message ?? 'OTP resent successfully.',
  };
};

// ─── Change Password (after OTP verify) ─────────────────────────────
export const changePassword = async (
  password: string,
  password_confirmation: string,
  user_id: string | number,
): Promise<{ success: boolean; message: string }> => {
  const form = new FormData();
  form.append('password', password);
  form.append('password_confirmation', password_confirmation);
  form.append('user_id', String(user_id));

  const { data } = await apiClient.post('/change-password', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  console.log('[changePassword] Raw response:', JSON.stringify(data, null, 2));

  return {
    success: data?.success ?? data?.status ?? false,
    message: data?.message ?? 'Password changed successfully.',
  };
};

// ─── Privacy Policy ─────────────────────────────────────────────────────────
export const getPrivacyPolicy = async () => {
  const { data } = await apiClient.get('/privacy-policy');
  console.log('[getPrivacyPolicy] Raw response:', JSON.stringify(data, null, 2));
  return data?.data ?? data;
};

// ─── Terms of Use ────────────────────────────────────────────────────────────
export const getTermsOfUse = async () => {
  const { data } = await apiClient.get('/terms-of-use');
  console.log('[getTermsOfUse] Raw response:', JSON.stringify(data, null, 2));
  return data?.data ?? data;
};

// ─── Rules & Regulations ───────────────────────────────────────────────────
export const getRulesRegulations = async () => {
  const { data } = await apiClient.get('/rules-and-regulation');
  console.log('[getRulesRegulations] Raw response:', JSON.stringify(data, null, 2));
  return data?.data ?? data;
};

// ─── Terms & Conditions ──────────────────────────────────────────────────────
export const getTermsConditions = async () => {
  const { data } = await apiClient.get('/terms-and-conditions');
  console.log('[getTermsConditions] Raw response:', JSON.stringify(data, null, 2));
  return data?.data ?? data;
};

// ─── Student Profile ───────────────────────────────────────────────
export const getStudentProfile = async () => {
  const { data } = await apiClient.get('/user/profile');
  console.log('[getStudentProfile] Raw response:', JSON.stringify(data, null, 2));
  return data?.data ?? data;
};

// ─── About App ─────────────────────────────────────────────────────────────
export const getAboutApp = async () => {
  const { data } = await apiClient.get('/about-app');
  console.log('[getAboutApp] Raw response:', JSON.stringify(data, null, 2));
  return data?.data ?? data;
};

// ─── School Info ─────────────────────────────────────────────────────────────
export const getSchoolInfo = async () => {
  const { data } = await apiClient.get('/school-info');
  console.log('[getSchoolInfo] Raw response:', JSON.stringify(data, null, 2));
  return data?.data ?? data;
};

// ─── Update Password (authenticated user) ───────────────────────────
export const updatePassword = async (
  current_password: string,
  new_password: string,
  new_password_confirmation: string,
): Promise<{ success: boolean; message: string }> => {
  const form = new FormData();
  form.append('current_password', current_password);
  form.append('new_password', new_password);
  form.append('new_password_confirmation', new_password_confirmation);

  const { data } = await apiClient.post('/update-password', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  console.log('[updatePassword] Raw response:', JSON.stringify(data, null, 2));

  // Update token if a new one is returned
  const newToken = data?.data?.token ?? data?.token;
  if (newToken) {
    await AsyncStorage.setItem('auth_token', newToken);
    console.log('[updatePassword] ✅ Token updated in storage');
  }

  return {
    success: data?.success ?? data?.status ?? false,
    message: data?.message ?? 'Password updated successfully.',
  };
};

// ─── Logout ───────────────────────────────────────────────────────────────────
export const logout = async (): Promise<void> => {
  try {
    // Stop pushes to this device before the token is dropped.
    await clearDeviceToken();
    await apiClient.post('/logout');
  } finally {
    await AsyncStorage.multiRemove(['auth_token', 'user_data', 'user_role']);
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const _persistAuth = async (data: AuthResponse, role: UserRole) => {
  const token = data.token;
  console.log('[_persistAuth] Saving token:', token ? `${token.slice(0, 20)}...` : 'NULL');
  await AsyncStorage.setItem('auth_token', token);
  await AsyncStorage.setItem('user_data', JSON.stringify({ ...data.user, role }));
  await AsyncStorage.setItem('user_role', role);
  // Verify it was saved
  const saved = await AsyncStorage.getItem('auth_token');
  console.log('[_persistAuth] Verified saved token:', saved ? `${saved.slice(0, 20)}...` : 'NULL');
  // Register this device for push now that we're authenticated (fire-and-forget).
  syncDeviceToken();
};

export const getStoredUser = async (): Promise<AuthUser | null> => {
  const raw = await AsyncStorage.getItem('user_data');
  return raw ? JSON.parse(raw) : null;
};

export const getStoredRole = async (): Promise<UserRole | null> => {
  const r = await AsyncStorage.getItem('user_role');
  return r as UserRole | null;
};

export const getStoredToken = (): Promise<string | null> =>
  AsyncStorage.getItem('auth_token');

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';
import constant from '../utils/constant';
import type { AccountType } from '../utils/accountStore';

// ─── Snapshot type (mirror of buildSnapshot() on the backend) ─────────────────

export interface AccountSnapshot {
  user_id:      number;
  name:         string;
  username?:    string;
  email?:       string;
  role:         string;          // 'user' | 'teacher'
  role_label?:  string;
  user_type:    AccountType;     // 'student' | 'teacher'
  image?:       string | null;
  organization?: { id: number; name: string; logo?: string | null } | null;
  class_info?:  Record<string, any> | null;
}

// ─── /switch-account/me ──────────────────────────────────────────────────────
// Refreshes the active account's snapshot (name, image, class, etc.).
export const fetchCurrentSnapshot = async (): Promise<AccountSnapshot | null> => {
  const { data } = await apiClient.get('/switch-account/me');
  return (data?.data ?? null) as AccountSnapshot | null;
};

// ─── /switch-account/add ─────────────────────────────────────────────────────
// Bare axios on purpose — we do NOT want the apiClient interceptor to attach
// the currently-active account's token. The endpoint is public (under the
// login throttle group) and returns a fresh token for the added account.

export interface AddAccountInput {
  identifier: string;          // admission number (student) OR email (any other role)
  password:   string;
  login_type?: AccountType;    // optional — backend auto-detects from the identifier
}

export interface AddAccountResult {
  account:    AccountSnapshot;
  token:      string;
  token_type: string;
}

export const addAccount = async (input: AddAccountInput): Promise<AddAccountResult> => {
  const { data } = await axios.post(
    `${constant.API_BASE_URL}/switch-account/add`,
    {
      identifier: input.identifier.trim(),
      password:   input.password,
      // login_type omitted on purpose — the backend auto-detects the role.
      ...(input.login_type ? { login_type: input.login_type } : {}),
    },
    {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      timeout: 15000,
    },
  );

  const payload = data?.data ?? data;
  const account = payload?.account as AccountSnapshot | undefined;
  const token   = payload?.token   as string | undefined;
  const ttype   = payload?.token_type as string | undefined;

  if (!account || !token) {
    throw new Error('Malformed response from /switch-account/add');
  }
  return { account, token, token_type: ttype ?? 'Bearer' };
};

// ─── /switch-account/remove ──────────────────────────────────────────────────
// Revokes a specific account's token server-side. We temporarily swap the
// Authorization header so we revoke the *target* token, not the active one.

export const revokeAccountToken = async (token: string): Promise<void> => {
  await axios.post(
    `${constant.API_BASE_URL}/switch-account/remove`,
    {},
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      timeout: 15000,
    },
  ).catch(err => {
    // Server-side revoke failure shouldn't block local removal — the token
    // simply stops being used. Log and swallow.
    console.log('[revokeAccountToken] non-fatal:', err?.response?.status ?? err?.message);
  });
};

// Helper: read the currently-active token without going through the interceptor.
export const peekActiveToken = () => AsyncStorage.getItem('auth_token');

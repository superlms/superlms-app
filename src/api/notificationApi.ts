import axios from 'axios';
import apiClient from './apiClient';
import constant from '../utils/constant';

// ─────────────────────────────────────────────────────────────────────────────
//  Device token registration for push (FCM).
//
//  The backend stores one row per (user, device token) so it can target a user's
//  devices when sending a push. Tokens can rotate, so we (re)register on every
//  login and on token refresh, and remove on logout.
//
//  A phone can hold several signed-in accounts (Switch account), and each of
//  them gets its pushes here: every registration names all the accounts on the
//  phone, and one for an account other than the active one signs in with that
//  account's own token.
// ─────────────────────────────────────────────────────────────────────────────

export type DevicePlatform = 'android' | 'ios';

const asAccount = (authToken: string) => ({
  headers: { Accept: 'application/json', Authorization: `Bearer ${authToken}` },
  timeout: 15000,
});

/** Register / upsert this device's FCM token against the logged-in user — or, with `authToken`, another account. */
export const registerDeviceToken = async (
  token: string,
  platform: DevicePlatform,
  opts: { accounts?: number[]; authToken?: string } = {},
): Promise<void> => {
  const body = { token, platform, accounts: opts.accounts ?? [] };
  if (opts.authToken) {
    await axios.post(`${constant.API_BASE_URL}/device-token`, body, asAccount(opts.authToken));
    return;
  }
  await apiClient.post('/device-token', body);
};

/** Remove this device's token (on logout, or removing an account) so that user stops getting pushes here. */
export const unregisterDeviceToken = async (token: string, authToken?: string): Promise<void> => {
  if (authToken) {
    await axios.post(`${constant.API_BASE_URL}/device-token/remove`, { token }, asAccount(authToken));
    return;
  }
  await apiClient.post('/device-token/remove', { token });
};

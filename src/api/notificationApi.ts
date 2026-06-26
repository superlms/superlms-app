import apiClient from './apiClient';

// ─────────────────────────────────────────────────────────────────────────────
//  Device token registration for push (FCM).
//
//  The backend stores one row per (user, device token) so it can target a user's
//  devices when sending a push. Tokens can rotate, so we (re)register on every
//  login and on token refresh, and remove on logout.
// ─────────────────────────────────────────────────────────────────────────────

export type DevicePlatform = 'android' | 'ios';

/** Register / upsert this device's FCM token against the logged-in user. */
export const registerDeviceToken = async (
  token: string,
  platform: DevicePlatform,
): Promise<void> => {
  const form = new FormData();
  form.append('token', token);
  form.append('platform', platform);
  await apiClient.post('/device-token', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/** Remove this device's token (call on logout so the user stops getting pushes here). */
export const unregisterDeviceToken = async (token: string): Promise<void> => {
  const form = new FormData();
  form.append('token', token);
  await apiClient.post('/device-token/remove', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

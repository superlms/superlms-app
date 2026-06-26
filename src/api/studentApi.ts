import apiClient from './apiClient';

// ─── Student Profile ──────────────────────────────────────────────────────────
export const getStudentProfile = async () => {
  const { data } = await apiClient.get('/user/profile');
  console.log('[getStudentProfile] Raw response:', JSON.stringify(data, null, 2));
  return data?.data ?? data;
};

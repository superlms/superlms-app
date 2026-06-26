import apiClient from './apiClient';

// ─── Teacher Profile ──────────────────────────────────────────────────────────
export const getTeacherProfile = async () => {
  const { data } = await apiClient.get('/teacher/profile');
  console.log('[getTeacherProfile] Raw response:', JSON.stringify(data, null, 2));
  return data?.data ?? data;
};
  
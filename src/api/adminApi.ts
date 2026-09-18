import apiClient from './apiClient';
import { AdminUser } from './authApi';

// GET /admin/me — authenticated admin profile + organization
export const getAdminProfile = async (): Promise<AdminUser> => {
  const { data } = await apiClient.get('/admin/me');
  return data?.data ?? data;
};

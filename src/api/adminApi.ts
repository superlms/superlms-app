import apiClient from './apiClient';
import { AdminUser } from './authApi';

export interface AdminDashboard {
  students: number;
  teachers: number;
  fees_collected_total: number;
  fees_collected_this_month: number;
}

// GET /admin/me — authenticated admin profile + organization
export const getAdminProfile = async (): Promise<AdminUser> => {
  const { data } = await apiClient.get('/admin/me');
  return data?.data ?? data;
};

// GET /admin/dashboard — headline counts for the admin home
export const getAdminDashboard = async (): Promise<AdminDashboard> => {
  const { data } = await apiClient.get('/admin/dashboard');
  return data?.data ?? data;
};

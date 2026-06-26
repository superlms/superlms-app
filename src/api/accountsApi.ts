import apiClient from './apiClient';
import { AccountsUser } from './authApi';

export interface AccountsDashboard {
  fees_collected_total: number;
  fees_collected_today: number;
  fees_collected_this_month: number;
  transport_collected: number;
  pending: number;
  students: number;
}

// GET /accounts/me — authenticated accounts profile + organization
export const getAccountsProfile = async (): Promise<AccountsUser> => {
  const { data } = await apiClient.get('/accounts/me');
  return data?.data ?? data;
};

// GET /accounts/dashboard — finance headline numbers
export const getAccountsDashboard = async (): Promise<AccountsDashboard> => {
  const { data } = await apiClient.get('/accounts/dashboard');
  return data?.data ?? data;
};

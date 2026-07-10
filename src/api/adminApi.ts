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

// ─── Analytics (mirrors the web admin Analytics page) ─────────────────────────
export interface AdminAnalytics {
  days: number;
  stats: {
    totalStudents: number;
    presentToday: number;
    absentToday: number;
    newAdmissions: number;
    teachers: number;
  };
  student_monthly: { months: string[]; present: number[]; absent: number[] };
  teacher_monthly: { months: string[]; present: number[]; absent: number[] };
  student_pie: { present: number; absent: number };
  teacher_pie: { present: number; absent: number };
  top_students: { rank: number; name: string; class: string; section: string; score: number }[];
  class_distribution: { labels: string[]; present: number[]; absent: number[] };
  fee: { total: number; collected: number; remaining: number };
  structure: { classes: number; sections: number; subjects: number };
  homework: { total: number; submitted: number; pending: number };
  ledger: { credit: number; expense: number; balance: number };
  enquiries: { total: number; pending: number; admitted: number; other: number };
  performance: { avg: number; graded: number; buckets: { labels: string[]; values: number[] } };
  recent_activities: { title: string; description: string; time: string | null; color: string }[];
}

// GET /admin/analytics?days=7 — full analytics payload for the admin app
export const getAdminAnalytics = async (days = 7): Promise<AdminAnalytics> => {
  const { data } = await apiClient.get('/admin/analytics', { params: { days } });
  return data?.data ?? data;
};

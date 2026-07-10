import apiClient from './apiClient';
import { PickedFile } from './adminProfileApi';

// Transport module. Mirrors app/Livewire/Admin/Transport.php + HandlesTransportFees
// over /admin/transport.

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };
const filePart = (f: PickedFile) =>
  ({ uri: f.uri, type: f.type || 'image/jpeg', name: f.name || 'driver.jpg' } as any);

export interface TransportStats {
  drivers: number;
  routes: number;
  students: number;
  monthly_revenue: number;
}

export interface RouteRow {
  id: number;
  route_name: string;
  driver_id: number | null;
  driver_name: string | null;
  pickup_time: string | null;
  drop_time: string | null;
  monthly_fee: number;
  capacity: number;
  students_count: number;
  is_active: boolean;
}

export interface DriverRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  license_no: string | null;
  vehicle_no: string | null;
  vehicle_type: string | null;
  address: string | null;
  experience_years: number;
  image: string | null;
  is_active: boolean;
  routes: { id: number; name: string }[];
}

export type Months = Record<string, boolean>;

export interface TransportStudent {
  student_detail_id: number;
  name: string;
  admission_no: string | null;
  class: string;
  image: string | null;
  route_id: number | null;
  route: string;
  driver: string;
  monthly: number;
  months: Months;
  months_count: number;
  annual: number;
  paid: number;
  remaining: number;
}

export interface MonthStatus {
  key: string;
  label: string;
  amount: number;
  paid: number;
  status: 'paid' | 'partial' | 'unpaid';
}
export interface FeeSummary {
  student: { id: number; name: string; admission_no: string | null; class: string; image: string | null };
  route: { id: number; name: string } | null;
  monthly: number;
  months_count: number;
  annual: number;
  paid: number;
  remaining: number;
  payments: { id: number; amount: number; mode: string; date: string; receipt: string; route: string | null; remark: string | null }[];
  month_status: MonthStatus[];
}

// ── Stats + options ──
export const getTransportStats = async (): Promise<TransportStats> => {
  const { data } = await apiClient.get('/admin/transport/stats');
  return unwrap(data);
};
export const getRouteOptions = async (): Promise<{ id: number; route_name: string }[]> => {
  const { data } = await apiClient.get('/admin/transport/route-options');
  return unwrap(data)?.routes ?? [];
};

// ── Routes ──
export const getRoutes = async (p: { search?: string; driver_id?: number | null; status?: string }): Promise<RouteRow[]> => {
  const { data } = await apiClient.get('/admin/transport/routes', { params: p });
  return unwrap(data)?.routes ?? [];
};
export interface RoutePayload {
  route_name: string;
  pickup_time?: string | null;
  drop_time?: string | null;
  monthly_fee?: number;
  capacity?: number;
  is_active?: boolean;
}
export const saveRoute = async (id: number | null, p: RoutePayload) => {
  const url = id ? `/admin/transport/routes/${id}` : '/admin/transport/routes';
  const { data } = await apiClient.post(url, p);
  return unwrap(data);
};
export const toggleRoute = async (id: number) => { await apiClient.post(`/admin/transport/routes/${id}/toggle`); };
export const deleteRoute = async (id: number) => { await apiClient.delete(`/admin/transport/routes/${id}`); };

// ── Drivers ──
export const getDrivers = async (p: { search?: string; route_id?: number | null; status?: string }): Promise<{ drivers: DriverRow[]; vehicle_types: string[] }> => {
  const { data } = await apiClient.get('/admin/transport/drivers', { params: p });
  return unwrap(data);
};
export interface DriverPayload {
  name: string;
  email: string;
  phone?: string | null;
  license_no?: string | null;
  vehicle_no?: string | null;
  vehicle_type?: string | null;
  address?: string | null;
  experience_years?: number;
  is_active?: boolean;
  routes?: number[];
  image?: PickedFile | null;
}
const driverForm = (p: DriverPayload) => {
  const form = new FormData();
  form.append('name', p.name);
  form.append('email', p.email);
  if (p.phone) form.append('phone', p.phone);
  if (p.license_no) form.append('license_no', p.license_no);
  if (p.vehicle_no) form.append('vehicle_no', p.vehicle_no);
  if (p.vehicle_type) form.append('vehicle_type', p.vehicle_type);
  if (p.address) form.append('address', p.address);
  form.append('experience_years', String(p.experience_years ?? 0));
  form.append('is_active', p.is_active === false ? '0' : '1');
  form.append('routes', JSON.stringify(p.routes ?? []));
  if (p.image) form.append('image', filePart(p.image));
  return form;
};
export const saveDriver = async (id: number | null, p: DriverPayload) => {
  const url = id ? `/admin/transport/drivers/${id}` : '/admin/transport/drivers';
  const { data } = await apiClient.post(url, driverForm(p), MULTIPART);
  return unwrap(data);
};
export const toggleDriver = async (id: number) => { await apiClient.post(`/admin/transport/drivers/${id}/toggle`); };
export const deleteDriver = async (id: number) => { await apiClient.delete(`/admin/transport/drivers/${id}`); };

// ── Transport students ──
export const getTransportStudents = async (route_id: number | null, search = ''): Promise<{ students: TransportStudent[]; months_order: Record<string, string> }> => {
  const { data } = await apiClient.get('/admin/transport/students', { params: { route_id: route_id || undefined, search: search || undefined } });
  return unwrap(data);
};
export const saveStudentMonths = async (p: { student_detail_id: number; transportation_id: number; months: Months }) => {
  const { data } = await apiClient.post('/admin/transport/students/months', p);
  return unwrap(data);
};
export const removeTransportStudent = async (student_detail_id: number, transportation_id: number) => {
  await apiClient.delete('/admin/transport/students', { data: { student_detail_id, transportation_id } });
};

// ── Fees ──
export const getFeeStudents = async (route_id: number | null, search = ''): Promise<{ id: number; name: string; admission_no: string | null; class: string }[]> => {
  const { data } = await apiClient.get('/admin/transport/fees/students', { params: { route_id: route_id || undefined, search: search || undefined } });
  return unwrap(data)?.students ?? [];
};
export const getFeeSummary = async (student_id: number): Promise<FeeSummary> => {
  const { data } = await apiClient.get('/admin/transport/fees/summary', { params: { student_id } });
  return unwrap(data);
};
export const recordPayment = async (p: { student_id: number; amount: number; mode: string; date: string; remark?: string }) => {
  const { data } = await apiClient.post('/admin/transport/fees/payment', p);
  return unwrap(data);
};
export const deletePayment = async (id: number) => { await apiClient.delete(`/admin/transport/fees/payment/${id}`); };

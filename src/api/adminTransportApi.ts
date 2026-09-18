import apiClient from './apiClient';
import constant from '../utils/constant';
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

/**
 * A route as the panel lists it: one per route, with a row under it for each
 * vehicle type it runs (a driver is set per type).
 */
export interface RouteGroup {
  key: string;
  route_name: string;
  vehicle_types: string[];
  driver_names: string[];
  driver_image: string | null;
  vehicle_nos: string[];
  pickup_time: string | null;
  drop_time: string | null;
  monthly_fee: number;
  /** The year at the default eleven months (June off). */
  annual_fee: number;
  capacity: number;
  students: number;
  is_active: boolean;
  rows: {
    id: number;
    vehicle_type: string | null;
    driver_id: number | null;
    driver_name: string | null;
    driver_phone: string | null;
    vehicle_no: string | null;
    students: number;
    is_active: boolean;
  }[];
}

/** One vehicle-type row, for pickers: "Route 1 — Bus". */
export interface RouteOption {
  id: number;
  route_name: string;
  vehicle_type?: string | null;
  group?: string;
  is_active?: boolean;
  label?: string;
}

export const routeLabel = (r: RouteOption) =>
  r.label ?? `${r.route_name}${r.vehicle_type ? ` — ${r.vehicle_type}` : ''}`;

export interface DriverRow {
  id: number;
  name: string;
  /** Empty when the driver was saved without one. */
  email: string;
  phone: string | null;
  license_no: string | null;
  vehicle_no: string | null;
  vehicle_type: string | null;
  address: string | null;
  experience_years: number;
  image: string | null;
  is_active: boolean;
  routes: { id: number; name: string; vehicle_type?: string | null; label?: string }[];
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
  vehicle_type?: string | null;
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
/** A month of the academic year as the panel's Monthly Fee Status shows it. */
export interface YearMonthStatus {
  key: string;
  label: string;
  year: number;
  amount: number;
  paid: number;
  status: 'paid' | 'partial' | 'unpaid' | 'upcoming' | 'not_used';
  billable: boolean;
  is_current: boolean;
}

export interface FeePayment {
  id: number;
  amount: number;
  mode: string;
  date: string;
  receipt: string;
  route: string | null;
  remark: string | null;
}

export interface FeeSummary {
  student: {
    id: number;
    name: string;
    admission_no: string | null;
    class: string;
    image: string | null;
    email?: string | null;
    mobile?: string | null;
  };
  route: {
    id: number;
    name: string;
    vehicle_type?: string | null;
    pickup_time?: string | null;
    drop_time?: string | null;
    driver?: string | null;
  } | null;
  monthly: number;
  months?: Months;
  months_count: number;
  annual: number;
  paid: number;
  remaining: number;
  payments: FeePayment[];
  month_status: MonthStatus[];
  months_year?: YearMonthStatus[];
}

// ── Stats + options ──
export const getTransportStats = async (): Promise<TransportStats> => {
  const { data } = await apiClient.get('/admin/transport/stats');
  return unwrap(data);
};
export const getRouteOptions = async (): Promise<RouteOption[]> => {
  const { data } = await apiClient.get('/admin/transport/route-options');
  return unwrap(data)?.routes ?? [];
};

// ── Route groups (the panel's Routes tab) ──
export const getRouteGroups = async (
  p: { search?: string; driver_id?: number | null; status?: string } = {},
): Promise<{ routes: RouteGroup[]; vehicle_types: string[] }> => {
  const { data } = await apiClient.get('/admin/transport/route-groups', { params: p });
  const d = unwrap(data);
  return { routes: d?.routes ?? [], vehicle_types: d?.vehicle_types ?? [] };
};
export const getRouteGroup = async (key: string): Promise<RouteGroup> => {
  const { data } = await apiClient.get(`/admin/transport/route-groups/${key}`);
  return unwrap(data);
};
export interface RouteGroupPayload {
  route_name: string;
  vehicle_types: string[];
  pickup_time?: string | null;
  drop_time?: string | null;
  monthly_fee?: number;
  capacity?: number;
  is_active?: boolean;
}
/** Saves a route; the message says what happened (and any type kept for its students). */
export const saveRouteGroup = async (
  key: string | null,
  p: RouteGroupPayload,
): Promise<{ key: string; kept: string[]; message: string }> => {
  const url = key ? `/admin/transport/route-groups/${key}` : '/admin/transport/route-groups';
  const { data } = await apiClient.post(url, p);
  return { ...(unwrap(data) ?? {}), message: data?.message ?? '' };
};
export const toggleRouteGroup = async (key: string) => { await apiClient.post(`/admin/transport/route-groups/${key}/toggle`); };
export const deleteRouteGroup = async (key: string) => { await apiClient.delete(`/admin/transport/route-groups/${key}`); };

// ── Drivers ──
export const getDrivers = async (p: { search?: string; route_id?: number | null; status?: string }): Promise<{ drivers: DriverRow[]; vehicle_types: string[] }> => {
  const { data } = await apiClient.get('/admin/transport/drivers', { params: p });
  return unwrap(data);
};
export const getDriver = async (id: number): Promise<DriverRow> => {
  const { data } = await apiClient.get(`/admin/transport/drivers/${id}`);
  return unwrap(data);
};
export interface DriverPayload {
  name: string;
  /** Optional: a driver without one gets a stand-in address. */
  email?: string;
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
  if (p.email) form.append('email', p.email);
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
// ── Fees ──
export const getFeeStudents = async (route_id: number | null, search = ''): Promise<{ id: number; name: string; admission_no: string | null; class: string }[]> => {
  const { data } = await apiClient.get('/admin/transport/fees/students', { params: { route_id: route_id || undefined, search: search || undefined } });
  return unwrap(data)?.students ?? [];
};
/** A student's transport fee; `route_id` reads it on that route when they ride it. */
export const getFeeSummary = async (student_id: number, route_id?: number | null): Promise<FeeSummary> => {
  const { data } = await apiClient.get('/admin/transport/fees/summary', {
    params: { student_id, route_id: route_id || undefined },
  });
  return unwrap(data);
};
// The receipt as the panel prints it, behind the admin's token.
export const adminTransportReceiptUrl = (id: number) =>
  `${constant.API_BASE_URL}/admin/transport/fees/payment/${id}/pdf`;

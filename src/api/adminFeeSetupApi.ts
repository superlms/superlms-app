import apiClient from './apiClient';
import constant from '../utils/constant';
import { PickedFile } from './adminProfileApi';

// Fees — the panel's sections beside collecting (adminFeeApi): Fee Structure
// (Add Dues, a route's fee), Penalties, Fee Cycle (Calculator), Concession,
// Payment QR and Accounts user. The server runs the panel's own components
// (AdminFeeSetupController), so the app saves exactly what the panel saves and
// a refusal carries the panel's own words, with the field it is about.

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };
const said = (data: any, fallback: string): string => data?.message ?? fallback;

/** "1500.00" → "1500", "21.50" → "21.5" — as someone would type it. */
export const plainNumber = (n?: number | string | null) => {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return '';
  return String(Math.round(v * 100) / 100);
};

/** The academic year running now — April → March, e.g. "2026-27". */
export const currentAcademicYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
};

// ── Fee Structure ────────────────────────────────────────────────────────────

export interface StructureGroup {
  standard_id: number;
  section_id: number | null;
  class: string;
  section: string;
  year: string | null;
  rows: { id: number; fee_name: string; amount: number }[];
  total: number;
}

export interface FeeRoute {
  id: number;
  name: string;
  monthly_fee: number;
  is_active: boolean;
}

export interface RouteStructure extends FeeRoute {
  pickup_time?: string | null;
  driver?: string | null;
  months: { month: string; free: boolean; amount: number; running: number }[];
  annual: number;
  billable_months: number;
}

export interface StructurePage {
  groups: StructureGroup[];
  routes: FeeRoute[];
  route: RouteStructure | null;
  current_year: string;
}

export const getStructure = async (p: { standard_id?: number; section_id?: number; search?: string; route_id?: number }): Promise<StructurePage> => {
  const { data } = await apiClient.get('/admin/fees/structure', { params: p });
  return unwrap(data);
};

export interface StructureForm {
  standard_id: number | null;
  section_ids: number[];
  academic_year: string;
  rows: { name: string; amount: string }[];
}

export const addStructure = async (f: StructureForm): Promise<string> => {
  const { data } = await apiClient.post('/admin/fees/structure', f);
  return said(data, 'Fee structure added!');
};

export const editStructure = async (f: { standard_id: number; section_id: number | null; academic_year: string; rows: { name: string; amount: string }[] }): Promise<string> => {
  const { data } = await apiClient.post('/admin/fees/structure/group', f);
  return said(data, 'Fee structure updated!');
};

export const deleteStructure = async (standard_id: number, section_id: number | null): Promise<string> => {
  const { data } = await apiClient.delete('/admin/fees/structure/group', { params: { standard_id, section_id: section_id ?? undefined } });
  return said(data, 'Fee structure deleted!');
};

export const structurePdfUrl = (standard_id: number, section_id: number | null) =>
  `${constant.API_BASE_URL}/admin/fees/structure/pdf?standard_id=${standard_id}${section_id ? `&section_id=${section_id}` : ''}`;

export const transportPdfUrl = (route_id: number) => `${constant.API_BASE_URL}/admin/fees/structure/transport-pdf?route_id=${route_id}`;

export const saveRouteFee = async (id: number, f: { name: string; monthly_fee: string; pickup_time: string; is_active: boolean }): Promise<string> => {
  const { data } = await apiClient.post(`/admin/fees/routes/${id}`, f);
  return said(data, 'Route fee updated!');
};

export const deleteRoute = async (id: number): Promise<string> => {
  const { data } = await apiClient.delete(`/admin/fees/routes/${id}`);
  return said(data, 'Route deleted!');
};

// ── Add Dues ─────────────────────────────────────────────────────────────────

export interface DuesExtra {
  id: number | null;
  name: string;
  amount: string;
}

export interface DuesStudent {
  id: number;
  name: string;
  admission_no?: string | null;
  roll_no?: string | null;
  section?: string | null;
  amount: string;
  extras: DuesExtra[];
}

export const getDues = async (standard_id: number, section_id?: number | null): Promise<{ sections: { id: number; name: string }[]; students: DuesStudent[] }> => {
  const { data } = await apiClient.get('/admin/fees/dues', { params: { standard_id, section_id: section_id ?? undefined } });
  return unwrap(data);
};

export const saveDues = async (
  standard_id: number,
  amounts: Record<number, string>,
  extras: Record<number, DuesExtra[]>,
): Promise<string> => {
  const { data } = await apiClient.post('/admin/fees/dues', { standard_id, amounts, extras });
  return said(data, 'Dues saved.');
};

// ── Penalties ────────────────────────────────────────────────────────────────

export interface PenaltyClassRow {
  id: number;
  name: string;
  admission_no: string;
  class_section: string;
  academic_penalty: number;
  transport_penalty: number;
  total_penalty: number;
}

export const getPenaltyClass = async (standard_id: number, section_id?: number | null): Promise<{ students: PenaltyClassRow[]; total: number }> => {
  const { data } = await apiClient.get('/admin/fees/penalties/class', { params: { standard_id, section_id: section_id ?? undefined } });
  return unwrap(data);
};

export interface WaiverForm {
  fee_type: 'academic' | 'transport';
  cycle_id: number | null;
  amount: string;
  mode: string;
  collected_by: string;
}

export const waivePenalty = async (studentId: number, f: WaiverForm): Promise<string> => {
  const { data } = await apiClient.post(`/admin/fees/penalties/${studentId}/waiver`, f);
  return said(data, 'Penalty waived successfully!');
};

// ── Fee Cycle ────────────────────────────────────────────────────────────────

export type CycleKind = 'monthly' | 'quarterly' | 'custom';
export const KIND_LABEL: Record<CycleKind, string> = { monthly: 'Monthly', quarterly: 'Quarterly', custom: 'Custom' };

export interface CycleRow {
  id: number;
  is_token: boolean;
  serial: number;
  label: string;
  span: string | null;
  fee_type: string;
  year: string;
  due_date: string | null;
  start_date: string | null;
  end_date: string | null;
  fee_percent: number;
  amount: number;
  penalty_per_day: number;
}

export interface CycleGroup {
  key: string;
  fee_type: string;
  year: string;
  kind: CycleKind;
  count: number;
  percent: number;
  token: CycleRow | null;
  rows: CycleRow[];
}

export const getCycles = async (): Promise<{ groups: CycleGroup[]; counts: { total: number; academic: number; transport: number }; current_year: string }> => {
  const { data } = await apiClient.get('/admin/fees/cycles');
  return unwrap(data);
};

export const getCycle = async (id: number): Promise<{ cycle: CycleRow; token: CycleRow | null; siblings: CycleRow[] }> => {
  const { data } = await apiClient.get(`/admin/fees/cycles/${id}`);
  return unwrap(data);
};

export const previewCycle = async (id: number, percent: string): Promise<{ id: number; serial: number; was: number; percent: number }[]> => {
  const { data } = await apiClient.get(`/admin/fees/cycles/${id}/preview`, { params: { percent } });
  return unwrap(data)?.siblings ?? [];
};

export interface CustomRow {
  serial: number;
  start_date: string;
  end_date: string;
  due_date: string;
  fee_percent: string;
  penalty_per_day: string;
}

export interface TokenFields {
  token_amount: string;
  token_due_date: string;
  token_penalty_per_day: string;
}

export const addCycles = async (
  f: { mode: CycleKind; monthly_due_day?: number; penalty_per_day?: string; rows?: CustomRow[] } & TokenFields,
): Promise<string> => {
  const { data } = await apiClient.post('/admin/fees/cycles', f);
  return said(data, 'Fee cycle saved!');
};

export const saveCycle = async (
  id: number,
  f: Partial<{ serial: number; due_date: string; start_date: string; end_date: string; fee_percent: string; penalty_per_day: string; amount: string }> & Partial<TokenFields>,
): Promise<string> => {
  const { data } = await apiClient.post(`/admin/fees/cycles/${id}`, f);
  return said(data, 'Installment updated!');
};

export const deleteCycle = async (id: number): Promise<string> => {
  const { data } = await apiClient.delete(`/admin/fees/cycles/${id}`);
  return said(data, 'Installment deleted!');
};

export interface BulkRow {
  id: number;
  serial: number;
  label: string;
  start_date: string;
  end_date: string;
  due_date: string;
  fee_percent: string;
  penalty_per_day: string;
}

export const getCycleBulk = async (fee_type: string, year: string): Promise<{ fee_type: string; year: string; kind: CycleKind; rows: BulkRow[] }> => {
  const { data } = await apiClient.get('/admin/fees/cycles/bulk', { params: { fee_type, year } });
  return unwrap(data);
};

export const saveCycleBulk = async (fee_type: string, year: string, rows: BulkRow[]): Promise<string> => {
  const { data } = await apiClient.post('/admin/fees/cycles/bulk', { fee_type, year, rows });
  return said(data, 'Installments updated.');
};

export const cycleCsvUrl = (fee_type: string, year: string) =>
  `${constant.API_BASE_URL}/admin/fees/cycles/csv?fee_type=${encodeURIComponent(fee_type)}&year=${encodeURIComponent(year)}`;

export interface CalcRow {
  serial: string;
  span: string | null;
  percent: number | null;
  due_date: string | null;
  amount: number | null;
  class_total: number;
  collected: number;
  remaining: number;
}

export interface CalcStudent {
  id: number;
  name: string;
  admission?: string | null;
  roll?: string | null;
  section: string;
  fee: number;
  paid: number;
  remaining: number;
  cleared: number;
  parts: Record<string, { amount: number; paid: number }>;
}

export interface CalcSummary {
  students: number;
  fee_min: number;
  fee_max: number;
  total: number;
  collected: number;
  remaining: number;
  paid_up: number;
  has_cycles: boolean;
}

export const getCalculator = async (
  standard_id: number,
  section_id?: number | null,
): Promise<{ rows: CalcRow[]; students: CalcStudent[]; summary: CalcSummary | null; installments: number[] }> => {
  const { data } = await apiClient.get('/admin/fees/cycles/calculator', { params: { standard_id, section_id: section_id ?? undefined } });
  return unwrap(data);
};

// ── The % rule behind every Fee Cycle form, as the panel has it ─────────────
// One row's % changed: the other rows each give up (or take back) an equal
// slice of the difference and keep the rest of their own numbers, so the set
// stays at 100%. (HandlesFeeCycles::shiftPercentRows and its helpers.)

const r2 = (n: number) => Math.round(n * 100) / 100;
export const trimPercent = (n: number) => {
  const t = String(r2(n));
  return t === '' ? '0' : t;
};

export function shiftPercentRows<T extends { fee_percent: string }>(rows: T[], changed: number): T[] {
  if (changed < 0 || changed >= rows.length || rows.length < 2) return rows;
  const out = rows.map(r => ({ ...r }));
  const percent = Math.max(0, Math.min(100, Number(out[changed].fee_percent) || 0));
  out[changed].fee_percent = trimPercent(percent);

  const left = r2(100 - percent);
  const others = out.map((_, i) => i).filter(i => i !== changed);
  const values: Record<number, number> = {};
  others.forEach(i => (values[i] = Number(out[i].fee_percent) || 0));
  const sum = () => others.reduce((s, i) => s + values[i], 0);

  const slice = (left - sum()) / others.length;
  others.forEach(i => (values[i] = r2(Math.max(0, values[i] + slice))));

  for (let pass = 0; pass < 5; pass++) {
    const owed = r2(left - sum());
    if (Math.abs(owed) < 0.01) break;
    const movable = others.filter(i => owed > 0 || values[i] > 0);
    if (movable.length === 0) break;
    const step = owed / movable.length;
    movable.forEach(i => (values[i] = r2(Math.max(0, values[i] + step))));
  }

  const last = others[others.length - 1];
  values[last] = r2(Math.max(0, values[last] + (left - sum())));
  others.forEach(i => (out[i].fee_percent = trimPercent(values[i])));
  return out;
}

/** Every row an even share of the 100% — "Equal split". */
export function equalSplitRows<T extends { fee_percent: string }>(rows: T[]): T[] {
  if (rows.length === 0) return rows;
  const share = Math.floor((100 / rows.length) * 100) / 100;
  const last = rows.length - 1;
  return rows.map((r, n) => ({ ...r, fee_percent: trimPercent(n === last ? r2(100 - share * last) : share) }));
}

/** Rows still blank share out what the filled ones leave. */
export function fillBlankPercents<T extends { fee_percent: string }>(rows: T[]): T[] {
  const blank: number[] = [];
  let filled = 0;
  rows.forEach((r, i) => {
    if (String(r.fee_percent ?? '').trim() === '') blank.push(i);
    else filled += Number(r.fee_percent) || 0;
  });
  if (blank.length === 0) return rows;
  const left = Math.max(0, r2(100 - filled));
  const share = Math.floor((left / blank.length) * 100) / 100;
  const last = blank.length - 1;
  const out = rows.map(r => ({ ...r }));
  blank.forEach((i, n) => (out[i].fee_percent = trimPercent(n === last ? r2(left - share * last) : share)));
  return out;
}

/** Every row nudged by the same amount until the set adds up to 100 again. */
export function rebalanceToHundred<T extends { fee_percent: string }>(rows: T[]): T[] {
  if (rows.length === 0) return rows;
  const values = rows.map(r => Number(r.fee_percent) || 0);
  const slice = (100 - values.reduce((s, v) => s + v, 0)) / values.length;
  const next = values.map(v => r2(Math.max(0, v + slice)));
  const last = next.length - 1;
  next[last] = r2(Math.max(0, next[last] + (100 - next.reduce((s, v) => s + v, 0))));
  return rows.map((r, i) => ({ ...r, fee_percent: trimPercent(next[i]) }));
}

export const percentTotal = (rows: { fee_percent: string }[]) => r2(rows.reduce((s, r) => s + (Number(r.fee_percent) || 0), 0));

// ── Concession ───────────────────────────────────────────────────────────────

export type ConcessionType = 'amount' | 'percent';

export interface ConcessionRow {
  id: number;
  student: { id: number; name: string; father_name?: string | null; admission_no?: string | null } | null;
  standard_id: number | null;
  section_id: number | null;
  class?: string | null;
  section?: string | null;
  fee_type: string;
  applies_to: string;
  type: ConcessionType;
  value: number;
  reason?: string | null;
  year?: string | null;
  granted?: string | null;
}

export interface ConcessionPage {
  concessions: ConcessionRow[];
  pagination: { total: number; per_page: number; current_page: number; last_page: number };
  applies_to: { key: string; label: string }[];
  current_year: string;
}

export const getConcessions = async (
  p: { standard_id?: number; section_id?: number; student_id?: number; date?: string },
  page = 1,
): Promise<ConcessionPage> => {
  const { data } = await apiClient.get('/admin/fees/concessions', { params: { ...p, page } });
  return unwrap(data);
};

export interface ConcessionForm {
  student_id: number | null;
  type: ConcessionType;
  value: string;
  fee_type: string;
  reason: string;
  year: string;
}

export const saveConcession = async (f: ConcessionForm, id?: number): Promise<string> => {
  const { data } = await apiClient.post(id ? `/admin/fees/concessions/${id}` : '/admin/fees/concessions', f);
  return said(data, id ? 'Concession updated successfully!' : 'Concession added successfully!');
};

/** "25%" or "₹2,000.00", as the panel's list writes it. */
export const concessionValue = (c: Pick<ConcessionRow, 'type' | 'value'>) =>
  c.type === 'percent'
    ? `${plainNumber(c.value)}%`
    : `₹${Number(c.value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Payment QR ───────────────────────────────────────────────────────────────

export interface SchoolQr {
  qr: { image_url: string | null; upi_id?: string | null; payee_name?: string | null; updated_at?: string | null } | null;
  school_name?: string | null;
}

export const getPaymentQr = async (): Promise<SchoolQr> => {
  const { data } = await apiClient.get('/admin/fees/payment-qr');
  return unwrap(data);
};

export const savePaymentQr = async (f: { image?: PickedFile | null; upi_id: string; payee_name: string }): Promise<{ message: string; qr: SchoolQr }> => {
  const form = new FormData();
  form.append('upi_id', f.upi_id.trim());
  form.append('payee_name', f.payee_name.trim());
  if (f.image) form.append('image', { uri: f.image.uri, type: f.image.type || 'image/jpeg', name: f.image.name || 'qr.jpg' } as any);
  const { data } = await apiClient.post('/admin/fees/payment-qr', form, MULTIPART);
  return { message: said(data, 'Payment QR saved.'), qr: unwrap(data) };
};

export const deletePaymentQr = async (): Promise<string> => {
  const { data } = await apiClient.delete('/admin/fees/payment-qr');
  return said(data, 'Payment QR removed');
};

// ── Accounts user ────────────────────────────────────────────────────────────

export interface AccountUser {
  id: number;
  name: string;
  email: string;
  mobile_number?: string | null;
  alternate_mobile?: string | null;
  designation?: string | null;
  department?: string | null;
  employee_id?: string | null;
  address?: string | null;
  image?: string | null;
  is_active: boolean;
  created_at?: string | null;
}

export const getAccountUsers = async (
  p: { search?: string; status?: '' | '1' | '0' },
  page = 1,
): Promise<{ users: AccountUser[]; pagination: { total: number; current_page: number; last_page: number }; stats: { total: number; active: number; inactive: number } }> => {
  const params: Record<string, any> = { page };
  if (p.search?.trim()) params.search = p.search.trim();
  if (p.status) params.status = p.status;
  const { data } = await apiClient.get('/admin/fees/account-users', { params });
  return unwrap(data);
};

export const getAccountUser = async (id: number): Promise<AccountUser> => {
  const { data } = await apiClient.get(`/admin/fees/account-users/${id}`);
  return unwrap(data);
};

export interface AccountUserForm {
  name: string;
  email: string;
  password: string;
  mobile_number: string;
  alternate_mobile: string;
  designation: string;
  department: string;
  employee_id: string;
  address: string;
  image?: PickedFile | null;
}

export const saveAccountUser = async (f: AccountUserForm, id?: number): Promise<string> => {
  const form = new FormData();
  (Object.keys(f) as (keyof AccountUserForm)[]).forEach(k => {
    if (k === 'image') return;
    const v = f[k];
    if (v !== undefined && v !== null && String(v) !== '') form.append(k, k === 'password' ? String(v) : String(v).trim());
  });
  if (f.image) form.append('image', { uri: f.image.uri, type: f.image.type || 'image/jpeg', name: f.image.name || 'user.jpg' } as any);
  const { data } = await apiClient.post(id ? `/admin/fees/account-users/${id}` : '/admin/fees/account-users', form, MULTIPART);
  return said(data, id ? 'User Updated' : 'User Created');
};

export const toggleAccountUser = async (id: number): Promise<{ message: string; is_active: boolean }> => {
  const { data } = await apiClient.post(`/admin/fees/account-users/${id}/toggle`);
  return { message: said(data, 'Status Updated'), is_active: !!unwrap(data)?.is_active };
};

export const removeAccountUserImage = async (id: number): Promise<string> => {
  const { data } = await apiClient.post(`/admin/fees/account-users/${id}/remove-image`);
  return said(data, 'Photo removed.');
};

export const deleteAccountUser = async (id: number): Promise<string> => {
  const { data } = await apiClient.delete(`/admin/fees/account-users/${id}`);
  return said(data, 'User Deleted');
};

// ── What the server said about a field ──────────────────────────────────────
/** The first of the server's field errors, with the field it is about. */
export const fieldErrorOf = (e: any): { field: string | null; message: string } | null => {
  const data = e?.response?.data;
  const errors = data?.errors;
  if (errors && typeof errors === 'object') {
    const key = Object.keys(errors)[0];
    const first = key && Array.isArray(errors[key]) ? errors[key][0] : null;
    if (first) return { field: key, message: String(first) };
  }
  if (typeof data?.message === 'string' && data.message) return { field: null, message: data.message };
  return null;
};

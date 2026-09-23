import apiClient from './apiClient';
import constant from '../utils/constant';

// Fees — app/Livewire/Admin/Fee.php over /admin/fees. The server runs the
// panel's own methods (a student's ledger, what may be collected against it,
// Payments and its figures, Analytics, QR Payments), so the app and the panel
// always agree.

const unwrap = (data: any) => data?.data ?? data;

export type CollectType = 'academic' | 'transport' | 'penalty';
export type PayMode = 'cash' | 'online' | 'cheque' | 'bank_transfer';

export const PAY_MODES: { key: PayMode; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'online', label: 'Online' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'bank_transfer', label: 'Bank transfer' },
];

/** "bank_transfer" → "Bank transfer", "upi" → "UPI". */
export const modeLabel = (m?: string | null) => {
  if (!m) return '';
  if (m.toLowerCase() === 'upi') return 'UPI';
  return PAY_MODES.find(x => x.key === m)?.label ?? m.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
};

export const typeLabel = (t?: string | null) =>
  t === 'transport' ? 'Transport' : t === 'penalty' ? 'Penalty' : 'Academic';

// ── Lookups ──────────────────────────────────────────────────────────────────

export interface FeeClass {
  id: number;
  name: string;
  sections: { id: number; name: string }[];
}

export const getFeeLookups = async (): Promise<{ classes: FeeClass[] }> => {
  const { data } = await apiClient.get('/admin/fees/lookups');
  return unwrap(data);
};

// ── Students (Fee Submission) ────────────────────────────────────────────────

export interface FeeStudent {
  id: number;
  name: string;
  father_name?: string | null;
  admission_no?: string | null;
  roll_no?: string | null;
  class?: string | null;
  section?: string | null;
  photo?: string | null;
  /** With a class picked: View Fee's By Class figures for the year. */
  fee: { total: number; collected: number; pending: number } | null;
}

export const getFeeStudents = async (p: { standard_id?: number; section_id?: number; search?: string }): Promise<FeeStudent[]> => {
  const { data } = await apiClient.get('/admin/fees/students', { params: p });
  return unwrap(data)?.students ?? [];
};

// ── A student's ledger (View Fee) ────────────────────────────────────────────

export interface FeeSide {
  rows: { fee_name: string; amount: number }[];
  gross: number;
  concession: number;
  applied: { reason: string; label: string; amount: number }[];
  net: number;
  paid: number;
  remaining: number;
  pct: number;
  route: { id: number; name: string; driver: string; monthly: number; months: number } | null;
}

export interface CycleInstallment {
  cycle_id: number;
  serial: number;
  label: string;
  due_date: string | null;
  overdue: boolean;
  percent: number;
  amount: number;
  paid: number;
  balance: number;
  status: 'paid' | 'partial' | 'pending' | 'na';
  penalty_per_day: number;
  days_late: number;
  penalty: number;
  penalty_waived: number;
  penalty_paid: number;
  penalty_net: number;
}

export interface FeeCycle {
  fee_type: 'academic' | 'transport';
  label: string;
  year: string;
  total: number;
  paid: number;
  paid_count: number;
  count: number;
  installments: CycleInstallment[];
  penalty_total: number;
  penalty_waived: number;
  penalty_paid: number;
  penalty_net: number;
}

export interface LedgerPayment {
  id: number;
  kind: 'academic' | 'transport';
  receipt_number: string | null;
  amount: number;
  penalty_amount: number;
  waiver_amount: number;
  fee_type: string;
  payment_mode: string | null;
  payment_date: string | null; // "12 Sep 2026"
  collected_by: string;
  remark?: string | null;
  is_concession: boolean;
}

export interface StudentLedger {
  student: {
    id: number;
    name: string;
    father_name: string;
    mother_name: string;
    admission_no: string;
    roll_no: string;
    class_section: string;
    phone: string;
    initial: string;
  };
  hasTransport: boolean;
  academic: FeeSide;
  transport: FeeSide;
  cycles: FeeCycle[];
  concessions: { reason: string; scope: string; value: string; year?: string | null; on?: string | null }[];
  totals: {
    gross: number;
    concession: number;
    net: number;
    paid: number;
    remaining: number;
    pct: number;
    penalties: number;
    waivers: number;
  };
  payments: LedgerPayment[];
  photo?: string | null;
  /** How much each fee type can take now — the panel's Collect Fee caps. */
  caps: Record<CollectType, number>;
  net_payable: number;
  submitted_by: string;
}

export const getStudentLedger = async (id: number): Promise<StudentLedger> => {
  const { data } = await apiClient.get(`/admin/fees/students/${id}`);
  return unwrap(data);
};

export interface CollectForm {
  amount: string;
  fee_type: CollectType;
  payment_mode: PayMode;
  date: string;
  submitted_by: string;
  remark: string;
}

export const collectFee = async (
  id: number,
  f: CollectForm,
): Promise<{ message: string; id: number; kind: 'academic' | 'transport'; receipt_number: string | null }> => {
  const { data } = await apiClient.post(`/admin/fees/students/${id}/payments`, {
    ...f,
    amount: f.amount.trim(),
    submitted_by: f.submitted_by.trim(),
    remark: f.remark.trim() || undefined,
  });
  return { message: data?.message ?? 'Fee submitted successfully!', ...unwrap(data) };
};

/** An academic / penalty receipt, as the panel prints it. */
export const adminFeeReceiptUrl = (id: number) => `${constant.API_BASE_URL}/admin/fees/receipt/${id}/pdf`;

// ── Payments ─────────────────────────────────────────────────────────────────

export type DatePreset = 'today' | 'yesterday' | '7' | '15' | '30' | 'this_month' | 'last_month' | '';
export const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7', label: 'Last 7 days' },
  { key: '15', label: 'Last 15 days' },
  { key: '30', label: 'Last 30 days' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: '', label: 'Custom range' },
];

export interface FeePaymentRow {
  id: number;
  kind: 'academic' | 'transport';
  student_name: string;
  admission_no?: string | null;
  class?: string | null;
  section?: string | null;
  fee_type: string;
  payment_mode: string | null;
  amount: number;
  penalty_amount: number;
  waiver_amount: number;
  payment_date: string | null; // YYYY-MM-DD
  submitted_by?: string | null;
}

export interface PaymentStats {
  total_fee: number;
  total_academic_fee: number;
  total_transport_fee: number;
  academic_collected: number;
  transport_collected: number;
  total_collected: number;
  academic_remaining: number;
  transport_remaining: number;
  remaining_fee: number;
}

export interface PaymentsPage {
  payments: FeePaymentRow[];
  pagination: { total: number; per_page: number; current_page: number; last_page: number };
  stats: PaymentStats;
  window: { preset: string; date_from: string; date_to: string };
}

export interface PaymentFilters {
  preset: DatePreset;
  date_from?: string;
  date_to?: string;
  standard_id?: number;
  section_id?: number;
  search?: string;
  mode?: string;
  fee_type?: '' | CollectType;
}

export const getFeePayments = async (f: PaymentFilters, page = 1): Promise<PaymentsPage> => {
  const params: Record<string, any> = { preset: f.preset, page, per_page: 20 };
  if (f.preset === '') {
    if (f.date_from) params.date_from = f.date_from;
    if (f.date_to) params.date_to = f.date_to;
  }
  if (f.standard_id) params.standard_id = f.standard_id;
  if (f.section_id) params.section_id = f.section_id;
  if (f.search?.trim()) params.search = f.search.trim();
  if (f.mode) params.mode = f.mode;
  if (f.fee_type) params.fee_type = f.fee_type;
  const { data } = await apiClient.get('/admin/fees/payments', { params });
  return unwrap(data);
};

// ── Analytics ────────────────────────────────────────────────────────────────

export interface FeeAnalytics {
  summary: {
    students: number;
    riders: number;
    academic_billable: number;
    transport_billable: number;
    total_billable: number;
    academic_collected: number;
    transport_collected: number;
    penalty_collected: number;
    total_collected: number;
    academic_due: number;
    transport_due: number;
    total_due: number;
    rate: number;
    fully_paid: number;
    defaulters: number;
  };
  /** Today, Yesterday, This Week, This Month, Last Month. */
  periods: Record<string, { amount: number; count: number }>;
  daily: {
    points: { label: string; title: string; amount: number; count: number; pct: number }[];
    peak: number;
    total: number;
    count: number;
  };
  modes: { label: string; amount: number; count: number; pct: number }[];
  classes: { id: number; name: string; students: number; billable: number; collected: number; due: number; rate: number }[];
  students: {
    id: number;
    name: string;
    admission_no?: string | null;
    class: string;
    section?: string | null;
    billable: number;
    collected: number;
    due: number;
  }[];
  student_scope: 'top_due' | 'class';
}

export const getFeeAnalytics = async (p: { standard_id?: number; section_id?: number } = {}): Promise<FeeAnalytics> => {
  const { data } = await apiClient.get('/admin/fees/analytics', { params: p });
  return unwrap(data);
};

// ── QR Payments ──────────────────────────────────────────────────────────────

export type QrStatus = 'pending' | 'approved' | 'rejected';

export interface QrRequest {
  id: number;
  fee_type: 'academic' | 'transport';
  amount: number;
  approved_amount: number | null;
  utr: string | null;
  paid_on: string | null; // YYYY-MM-DD
  note: string | null;
  months: string[];
  installment: string | null;
  status: QrStatus;
  review_note: string | null;
  receipt_number: string | null;
  fee_payment_id: number | null;
  transport_fee_payment_id: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  student: {
    id: number;
    name: string | null;
    admission_no?: string | null;
    roll_no?: string | null;
    class?: string | null;
    section?: string | null;
    photo?: string | null;
  } | null;
}

export interface QrReview extends QrRequest {
  screenshot_url: string | null;
  reviewer: string | null;
  /** Where the student stands on that fee this year. */
  side: { net: number; paid: number; remaining: number } | null;
}

export interface QrPage {
  requests: QrRequest[];
  pagination: { total: number; per_page: number; current_page: number; last_page: number };
  stats: { total: number; amount: number; pending: number; approved: number; rejected: number };
}

export const getQrRequests = async (
  f: { status: '' | QrStatus; fee_type?: string; search?: string; date?: string },
  page = 1,
): Promise<QrPage> => {
  const params: Record<string, any> = { status: f.status, page };
  if (f.fee_type) params.fee_type = f.fee_type;
  if (f.search?.trim()) params.search = f.search.trim();
  if (f.date) params.date = f.date;
  const { data } = await apiClient.get('/admin/fees/qr', { params });
  return unwrap(data);
};

export const getQrRequest = async (id: number): Promise<QrReview> => {
  const { data } = await apiClient.get(`/admin/fees/qr/${id}`);
  return unwrap(data);
};

export const approveQr = async (id: number, amount: string, note: string): Promise<string> => {
  const { data } = await apiClient.post(`/admin/fees/qr/${id}/approve`, { amount: amount.trim(), note: note.trim() || undefined });
  return data?.message ?? 'Payment approved.';
};

export const rejectQr = async (id: number, reason: string): Promise<string> => {
  const { data } = await apiClient.post(`/admin/fees/qr/${id}/reject`, { reason: reason.trim() });
  return data?.message ?? 'Payment rejected.';
};

/** "What it was for" — the months a transport payment covers, or the installment. */
export const qrForLine = (r: Pick<QrRequest, 'months' | 'installment'>) =>
  r.months?.length ? r.months.join(', ').toUpperCase() : r.installment ?? null;

import apiClient from './apiClient';
import { PickedFile } from './adminProfileApi';

// Payroll — app/Livewire/Admin/Payroll.php over /admin/payroll. The server
// runs the panel's own rules (salary breakdown, calendars, one row per person).

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

export type EmpType = 'management' | 'driver' | 'employee' | 'teacher';
export const EMP_TYPES: { key: EmpType; label: string }[] = [
  { key: 'management', label: 'Management' },
  { key: 'driver', label: 'Driver' },
  { key: 'employee', label: 'Employee' },
  { key: 'teacher', label: 'Teacher' },
];
export const typeLabel = (t: string) => EMP_TYPES.find(x => x.key === t)?.label ?? t;

export interface Employee {
  id: number;
  name: string;
  designation?: string | null;
  type: EmpType;
  /** Every role the one person holds — "teacher, driver". */
  types: string[];
  mobile?: string | null;
  email?: string | null;
  salary: number;
  photo?: string | null;
  joining_date?: string | null;
  is_teacher: boolean;
  teacher_detail_id?: number | null;
  driver_detail_id?: number | null;
}

export interface EmployeeDetail extends Employee {
  address?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_holder_name?: string | null;
  bank_branch?: string | null;
  bank_ifsc?: string | null;
  linked_teacher?: string | null;
  linked_driver?: string | null;
}

export type EmpStats = { total: number } & Record<EmpType, number>;
export type EmpSort = 'type_order' | 'name_asc' | 'name_desc' | 'salary_asc' | 'salary_desc';

export const getEmployees = async (p: { search?: string; type?: string; sort?: EmpSort } = {}): Promise<{ employees: Employee[]; stats: EmpStats }> => {
  const { data } = await apiClient.get('/admin/payroll/employees', { params: p });
  return unwrap(data);
};

export const getEmployee = async (id: number): Promise<EmployeeDetail> => {
  const { data } = await apiClient.get(`/admin/payroll/employees/${id}`);
  return unwrap(data);
};

export interface EmployeeForm {
  name: string;
  type: EmpType;
  designation: string;
  mobile: string;
  email: string;
  salary: string;
  joining_date: string;
  address: string;
  bank_name: string;
  bank_holder_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  bank_branch: string;
  photo?: PickedFile | null;
}

export const saveEmployee = async (f: EmployeeForm, id?: number): Promise<string> => {
  const form = new FormData();
  (Object.keys(f) as (keyof EmployeeForm)[]).forEach(k => {
    if (k === 'photo') return;
    const v = f[k];
    if (v !== undefined && v !== null && String(v) !== '') form.append(k, String(v).trim());
  });
  if (f.photo) form.append('photo', { uri: f.photo.uri, type: f.photo.type || 'image/jpeg', name: f.photo.name || 'employee.jpg' } as any);
  const { data } = await apiClient.post(id ? `/admin/payroll/employees/${id}` : '/admin/payroll/employees', form, MULTIPART);
  return data?.message ?? 'Saved.';
};

export const deleteEmployee = async (id: number) => {
  await apiClient.delete(`/admin/payroll/employees/${id}`);
};

// ── Attendance ───────────────────────────────────────────────────────────────

export type StaffStatus = 'present' | 'absent' | 'half_day' | 'leave';
export const STAFF_STATUS: { key: StaffStatus; label: string; short: string }[] = [
  { key: 'present', label: 'Present', short: 'P' },
  { key: 'absent', label: 'Absent', short: 'A' },
  { key: 'half_day', label: 'Half day', short: 'H' },
  { key: 'leave', label: 'Leave', short: 'L' },
];

export interface DateRow extends Employee {
  status: string | null;
  /** Teachers are marked from the Teacher module, not here. */
  markable: boolean;
}

export interface DateAttendance {
  date: string;
  employees: DateRow[];
  counts: Record<StaffStatus | 'not_marked', number>;
  marked: boolean;
}

export const getDateAttendance = async (date: string, type?: string): Promise<DateAttendance> => {
  const { data } = await apiClient.get('/admin/payroll/attendance/date', { params: { date, type } });
  return unwrap(data);
};

export const markStaffAttendance = async (date: string, marks: { id: number; status: StaffStatus }[]): Promise<string> => {
  const { data } = await apiClient.post('/admin/payroll/attendance', { date, marks });
  return data?.message ?? 'Saved.';
};

export interface CalCell {
  day: number;
  date: string;
  status: string | null;
  in_period: boolean;
  dim: boolean;
}
export interface CalMonth {
  key: string;
  label: string;
  lead: number;
  cells: CalCell[];
  counts: Record<string, number>;
  pct: number;
}
export interface EmployeeAttendance {
  employee: Employee;
  period: string;
  counts: Record<string, number>;
  months: CalMonth[];
}

export const getEmployeeAttendance = async (id: number, p: { month?: string; year?: string }): Promise<EmployeeAttendance> => {
  const { data } = await apiClient.get(`/admin/payroll/attendance/employee/${id}`, { params: p });
  return unwrap(data);
};

// ── Salary ───────────────────────────────────────────────────────────────────

export type PayMode = 'cash' | 'online' | 'bank_transfer' | 'cheque';
export const PAY_MODES: { key: PayMode; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'online', label: 'Online' },
  { key: 'bank_transfer', label: 'Bank transfer' },
  { key: 'cheque', label: 'Cheque' },
];
export const modeLabel = (m?: string | null) => PAY_MODES.find(x => x.key === m)?.label ?? m ?? '';

export interface Breakdown {
  base: number;
  present: number;
  absent: number;
  half_day: number;
  leave: number;
  payable: number;
}

export interface SalaryPayment {
  id: number;
  amount: number;
  mode: PayMode;
  paid_by?: string | null;
  status?: string | null;
  date?: string | null;
  transaction_id?: string | null;
  remark?: string | null;
  month: string;
}

export interface SalaryRow extends Employee {
  breakdown: Breakdown;
  payment: SalaryPayment | null;
}

export interface SalaryMonth {
  month: string;
  month_label: string;
  can_pay: boolean;
  employees: SalaryRow[];
  totals: { payable: number; paid: number };
}

export const getSalary = async (month: string, p: { type?: string; search?: string } = {}): Promise<SalaryMonth> => {
  const { data } = await apiClient.get('/admin/payroll/salary', { params: { month, ...p } });
  return unwrap(data);
};

export interface PayForm {
  amount: string;
  mode: PayMode;
  paid_by: string;
  date: string;
  transaction_id: string;
  remark: string;
}

export const getSalaryFor = async (
  empId: number,
  month: string,
): Promise<{ employee: Employee; month: string; can_pay: boolean; breakdown: Breakdown; form: Omit<PayForm, 'amount'> & { amount: number }; existing: SalaryPayment | null }> => {
  const { data } = await apiClient.get(`/admin/payroll/salary/${empId}`, { params: { month } });
  return unwrap(data);
};

export const paySalary = async (empId: number, month: string, f: PayForm): Promise<string> => {
  const { data } = await apiClient.post(`/admin/payroll/salary/${empId}`, { month, ...f, amount: f.amount.trim() });
  return data?.message ?? 'Saved.';
};

export interface PaymentRow extends SalaryPayment {
  employee: { id: number; name: string; designation?: string | null; photo?: string | null; types: string[] } | null;
}

export const getSalaryPayments = async (p: { month?: string; search?: string; employee_id?: number } = {}): Promise<{ payments: PaymentRow[]; total: number }> => {
  const { data } = await apiClient.get('/admin/payroll/payments', { params: p });
  return unwrap(data);
};

// ── The panel's newer screens ────────────────────────────────────────────────
// Mark Attendance for everyone at once (teachers too), a date's statuses with
// their remarks, the Mark Salary tab, Payments narrowed to a type, and
// Add → Driver.

/** This month's present days out of working days (holidays apart; a half day is half). */
export interface MonthAttendance {
  present: number;
  working: number;
  absent: number;
  half: number;
  leave: number;
}

export type EmployeeWithMonth = Employee & { month_attendance?: MonthAttendance | null };

export const getEmployeesWithMonth = async (
  p: { search?: string; type?: string; sort?: EmpSort } = {},
): Promise<{ employees: EmployeeWithMonth[]; stats: EmpStats; month?: string }> => {
  const { data } = await apiClient.get('/admin/payroll/employees', { params: p });
  return unwrap(data);
};

/** What a row may be marked in the panel's Mark Attendance — the same four for everyone. */
export type SheetStatus = 'present' | 'absent' | 'half_day' | 'holiday';
export const SHEET_STATUS: { key: SheetStatus; label: string; short: string }[] = [
  { key: 'present', label: 'Present', short: 'P' },
  { key: 'absent', label: 'Absent', short: 'A' },
  { key: 'half_day', label: 'Half day', short: 'H' },
  { key: 'holiday', label: 'Holiday', short: 'Hol' },
];

export interface DayRow extends Employee {
  status: string | null;
  remark: string;
}

export interface DayAttendance {
  date: string;
  label: string;
  employees: DayRow[];
  counts: Record<'present' | 'absent' | 'half_day' | 'holiday' | 'leave' | 'not_marked', number>;
}

export const getDayAttendance = async (date: string): Promise<DayAttendance> => {
  const { data } = await apiClient.get('/admin/payroll/attendance/day', { params: { date } });
  return unwrap(data);
};

export interface SheetRow extends Employee {
  status: SheetStatus | '';
  remark: string;
}

export interface AttendanceSheet {
  date: string;
  label: string;
  existing: boolean;
  rows: SheetRow[];
}

export const getAttendanceSheet = async (date: string): Promise<AttendanceSheet> => {
  const { data } = await apiClient.get('/admin/payroll/attendance/sheet', { params: { date } });
  return unwrap(data);
};

export const saveAttendanceSheet = async (
  date: string,
  rows: Record<number, { status: SheetStatus | ''; remark: string }>,
): Promise<string> => {
  const { data } = await apiClient.post('/admin/payroll/attendance/sheet', { date, rows });
  return data?.message ?? 'Attendance saved.';
};

export interface AccountPayment {
  id: number;
  amount: number;
  date: string;
  from?: string | null;
  remark?: string | null;
  mode?: string | null;
}

export interface AccountMonth {
  ym: string;
  label: string;
  running: boolean;
  base: number;
  present: number;
  absent: number;
  half: number;
  leave: number;
  payable: number;
  paid_leave: number;
  cut_days: number;
  per_day: number;
  deduction: number;
  paid: number;
  payments: AccountPayment[];
}

export interface SalaryAccount {
  employee: Employee & {
    bank_name?: string | null;
    bank_account_no?: string | null;
    bank_ifsc?: string | null;
    bank_holder_name?: string | null;
  };
  months: AccountMonth[];
  payable: number;
  paid: number;
  balance: number;
  paid_leaves_a_month: number;
}

export const getSalaryAccount = async (id: number): Promise<SalaryAccount> => {
  const { data } = await apiClient.get(`/admin/payroll/account/${id}`);
  return unwrap(data);
};

export const addSalaryAccountPayment = async (
  id: number,
  f: { amount: string; date: string; from: string; remark: string; month?: string },
): Promise<string> => {
  const { data } = await apiClient.post(`/admin/payroll/account/${id}/payments`, { ...f, amount: f.amount.trim() });
  return data?.message ?? 'Payment added.';
};

export const getSalaryPaymentsByType = async (
  p: { type?: string; employee_id?: number; month?: string } = {},
): Promise<{ payments: PaymentRow[]; total: number }> => {
  const { data } = await apiClient.get('/admin/payroll/payments', { params: p });
  return unwrap(data);
};

export const getPayrollRoutes = async (): Promise<{ id: number; name: string; vehicle_type?: string | null }[]> => {
  const { data } = await apiClient.get('/admin/payroll/lookups');
  return unwrap(data)?.routes ?? [];
};

export interface DriverForm {
  name: string;
  mobile: string;
  email: string;
  license_no: string;
  vehicle_no: string;
  experience: string;
  is_active: boolean;
  route_ids: number[];
  salary: string;
  designation: string;
  joining_date: string;
  address: string;
  bank_name: string;
  bank_holder_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  bank_branch: string;
  photo?: PickedFile | null;
}

export const addDriver = async (f: DriverForm): Promise<string> => {
  const form = new FormData();
  (Object.keys(f) as (keyof DriverForm)[]).forEach(k => {
    if (k === 'photo' || k === 'route_ids' || k === 'is_active') return;
    const v = f[k];
    if (v !== undefined && v !== null && String(v) !== '') form.append(k, String(v).trim());
  });
  form.append('is_active', f.is_active ? '1' : '0');
  f.route_ids.forEach(id => form.append('route_ids[]', String(id)));
  if (f.photo) form.append('photo', { uri: f.photo.uri, type: f.photo.type || 'image/jpeg', name: f.photo.name || 'driver.jpg' } as any);
  const { data } = await apiClient.post('/admin/payroll/drivers', form, MULTIPART);
  return data?.message ?? 'Driver added!';
};

import apiClient from './apiClient';
import constant from '../utils/constant';

// Ledger — app/Livewire/Admin/Ledger.php over /admin/ledger. The same
// LedgerService as the panel, so the figures always agree with it.

const unwrap = (data: any) => data?.data ?? data;

export type LedgerType = 'credit' | 'expense';

export interface LedgerEntry {
  date: string; // YYYY-MM-DD
  time?: string | null; // "3:45 PM"
  type: LedgerType;
  amount: number;
  /** Academic Fee, Transport Fee, Admission Fee, Salary, Manual … */
  source: string;
  from?: string | null;
  to?: string | null;
  mode?: string | null;
  party?: string | null;
  reason?: string | null;
  /** Set on a manual entry only. */
  manual_id?: number | null;
  /** A manual entry is editable for edit_window_days after it was made. */
  editable: boolean;
  collected_by?: string | null;
  /** The balance after this row. */
  balance: number;
}

export interface LedgerSummary {
  net_balance: number;
  opening: number;
  closing: number;
  period_credit: number;
  period_expense: number;
}

export interface LedgerPage {
  entries: LedgerEntry[];
  pagination: { current_page: number; last_page: number; per_page: number; total: number };
  summary: LedgerSummary;
  window: { overall: boolean; start_date: string | null; end_date: string | null };
  modes: string[];
  edit_window_days: number;
}

/** A window: a month, a range (a single day is a range of one), or all time. */
export type LedgerWindow =
  | { kind: 'month'; month: string } // YYYY-MM
  | { kind: 'range'; start: string; end: string }
  | { kind: 'overall' };

const windowParams = (w: LedgerWindow): Record<string, string> =>
  w.kind === 'overall'
    ? { overall: '1' }
    : w.kind === 'month'
    ? { month: w.month }
    : { start_date: w.start, end_date: w.end };

export const getLedger = async (w: LedgerWindow, page = 1): Promise<LedgerPage> => {
  const { data } = await apiClient.get('/admin/ledger', { params: { ...windowParams(w), page, per_page: 30 } });
  return unwrap(data);
};

/** The panel's PDF statement for the same window. */
export const ledgerStatementUrl = (w: LedgerWindow) => {
  const q = Object.entries(windowParams(w))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `${constant.API_BASE_URL}/admin/ledger/statement?${q}`;
};

export interface LedgerEntryForm {
  type: LedgerType;
  date: string;
  amount: string;
  /** "From" — who paid in, or who paid out. */
  party: string;
  /** "To" — the payee, on an expense. */
  party_to: string;
  /** On a credit: the staff member who took the money. */
  collected_by: string;
  mode: string;
  /** The remark — required. */
  reason: string;
}

export interface LedgerManualEntry extends Omit<LedgerEntryForm, 'amount'> {
  id: number;
  amount: number;
  editable: boolean;
}

export const getLedgerEntry = async (id: number): Promise<LedgerManualEntry> => {
  const { data } = await apiClient.get(`/admin/ledger/entry/${id}`);
  const d = unwrap(data);
  return {
    ...d,
    party: d.party ?? '',
    party_to: d.party_to ?? '',
    collected_by: d.collected_by ?? '',
    mode: d.mode ?? '',
    reason: d.reason ?? '',
  };
};

export const saveLedgerEntry = async (f: LedgerEntryForm, id?: number): Promise<string> => {
  const body = { ...f, amount: f.amount.trim() };
  const { data } = await apiClient.post(id ? `/admin/ledger/${id}` : '/admin/ledger', body);
  return data?.message ?? 'Saved.';
};

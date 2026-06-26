import apiClient from './apiClient';

// Unwrap the standard { success, message, data } envelope.
const unwrap = (data: any) => data?.data ?? data;

export type IdRole = 'student' | 'teacher';

export interface IdCardField {
  label: string;
  value: string;
}

export interface IdCardSchool {
  name: string;
  logo: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
}

// Mirror of the backend IdCardService::cardViewData() shape — the SAME data the
// admin "Executive Navy" ID card renders, so the app card is identical.
export interface IdCardData {
  type: IdRole;
  name: string;
  subtitle: string;
  photo: string | null;
  cardNumber: string;
  issueDate: string;
  expiryDate: string;
  status: string;
  qrCode: string | null; // full data URI ready for <Image>
  school: IdCardSchool;
  frontRows: IdCardField[];
  transport: IdCardField[] | null;
  daysRemaining: number | null;
  isExpired: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Backend front_rows / transport are associative objects ({ "Reg No": "123" }).
// Convert to an ordered [{label,value}] list, keeping admin's row order, and
// dropping rows whose value is empty or the placeholder dash.
const toFields = (obj: any): IdCardField[] => {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .map(([label, v]) => ({ label, value: v == null ? '' : String(v) }))
    .filter(f => f.value.trim() !== '' && f.value.trim() !== '—');
};

// QR comes back as raw base64 (no prefix). Build a data URI for <Image>.
const qrUri = (qr?: string | null): string | null => {
  if (!qr) return null;
  return qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
};

const str = (v: any, fallback = ''): string =>
  v == null || String(v).trim() === '' ? fallback : String(v);

// ─── Mapper ──────────────────────────────────────────────────────────────────
const mapCard = (d: any, role: IdRole): IdCardData => {
  const school = d.school ?? {};
  return {
    type: (d.type as IdRole) || role,
    name: str(d.name, role === 'teacher' ? 'Teacher' : 'Student'),
    subtitle: str(d.subtitle, role === 'teacher' ? 'Teacher' : 'Student'),
    photo: d.photo || null,
    cardNumber: str(d.card_number, '—'),
    issueDate: str(d.issue_date, '—'),
    expiryDate: str(d.expiry_date, '—'),
    status: str(d.status, 'active').toLowerCase(),
    qrCode: qrUri(d.qr_code),
    school: {
      name: str(school.name, 'School'),
      logo: school.logo || null,
      address: school.address || null,
      website: school.website || null,
      email: school.email || null,
      phone: school.phone || null,
    },
    frontRows: toFields(d.front_rows),
    transport: d.transport ? toFields(d.transport) : null,
    daysRemaining:
      typeof d.days_remaining === 'number' ? d.days_remaining : null,
    isExpired: Boolean(d.is_expired),
  };
};

// ─── Endpoints ─────────────────────────────────────────────────────────────────
export const getIdCard = async (role: IdRole): Promise<IdCardData> => {
  const { data } = await apiClient.get(`/id-card/${role}`);
  return mapCard(unwrap(data), role);
};

// ─── Error → friendly message ──────────────────────────────────────────────────
export const idCardErrorMessage = (e: any): string => {
  const status = e?.response?.status;
  const serverMsg = e?.response?.data?.message;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return serverMsg || 'You are not allowed to view this ID card.';
  if (status === 404) return serverMsg || 'No active ID card found for your account.';
  if (e?.message === 'Network Error' || !e?.response) {
    return 'No internet connection. Check your network and try again.';
  }
  if (status >= 500) return serverMsg || 'The server ran into a problem. Please try again.';
  return serverMsg || 'Something went wrong. Please try again.';
};

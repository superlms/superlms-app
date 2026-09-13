import apiClient from './apiClient';
import constant from '../utils/constant';

// ─── Types ────────────────────────────────────────────────────────────────────
export type FeeStatus = 'paid' | 'partial' | 'pending' | 'no_transport';

export interface TransportDriver {
  id: number;
  name: string | null;
  email: string | null;
  image: string | null;
  phone: string | null;
  license_no: string | null;
  vehicle_no: string | null;
  vehicle_type: string | null;
}

export interface TransportFeeRow {
  key: string;
  month: string;
  amount: number;
  status: FeeStatus;
}

export interface TransportPayment {
  id: number;
  serial: number;
  amount: number;
  date: string | null;
  day: string | null;
  submitted_by: string;
  type: string;
  mode: string;
  receipt_number: string;
}

export interface TransportFees {
  monthly_fee: number;
  annual_fee: number;
  months_count: number;
  total_paid: number;
  total_due: number;
  schedule: TransportFeeRow[];
  payments?: TransportPayment[];
}

export interface TransportRoute {
  id: number;
  route_name: string;
  pickup_location: string | null;
  drop_location: string | null;
  pickup_time: string | null;
  drop_time?: string | null;
  stops: string[];
  monthly_fee: number;
  capacity: number;
  vehicle_no: string | null;
  vehicle_type?: string | null;
  driver: TransportDriver | null;
  fees: TransportFees;
}

// GET /transport/my-route — active route + fee schedule for the logged-in student
export const getMyTransport = async (): Promise<TransportRoute> => {
  const { data } = await apiClient.get('/transport/my-route');
  return data?.data ?? data;
};

// GET /transport/receipt/{id}/pdf — one of the student's transport fee receipts
export const transportReceiptUrl = (id: number) =>
  `${constant.API_BASE_URL}/transport/receipt/${id}/pdf`;

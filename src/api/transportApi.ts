import apiClient from './apiClient';

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

export interface TransportFees {
  monthly_fee: number;
  annual_fee: number;
  months_count: number;
  total_paid: number;
  total_due: number;
  schedule: TransportFeeRow[];
}

export interface TransportRoute {
  id: number;
  route_name: string;
  pickup_location: string | null;
  drop_location: string | null;
  pickup_time: string | null;
  stops: string[];
  monthly_fee: number;
  capacity: number;
  vehicle_no: string | null;
  driver: TransportDriver | null;
  fees: TransportFees;
}

// GET /transport/my-route — active route + fee schedule for the logged-in student
export const getMyTransport = async (): Promise<TransportRoute> => {
  const { data } = await apiClient.get('/transport/my-route');
  console.log('[getMyTransport] Response:', JSON.stringify(data, null, 2));
  return data?.data ?? data;
};

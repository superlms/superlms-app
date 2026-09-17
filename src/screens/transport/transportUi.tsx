import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { Words } from '../exam/examUi';
import { getMyTransport, type FeeStatus, type TransportRoute } from '../../api/transportApi';

/**
 * What every Transport page shares: the student's route (one call, one kept
 * copy, so each page draws itself as a skeleton from real numbers), the way
 * money, times and months are written, the fee year up to this month, and the
 * plain rows the pages are built from — the ones the Exams screens use.
 */

export const TITLE = 'Transport';

export const formatINR = (n: number) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

// "07:30:00" / "07:30" → "07:30 AM"; anything else is shown as it comes.
export const clock = (time?: string | null): string | null => {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!m) return time;
  const h = Number(m[1]);
  return `${String(h % 12 || 12).padStart(2, '0')}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

export const STATUS_LABEL: Record<FeeStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  pending: 'Pending',
  no_transport: '—',
};

// The fee schedule's order — the academic year, April to March.
const MONTH_KEYS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'];

export interface FeeMonth {
  key: string;
  label: string;
  amount: number;
  status: FeeStatus;
}

export interface FeeYear {
  months: FeeMonth[];
  /** Billed for the months that have come, this one included. */
  billed: number;
  paid: number;
  due: number;
  monthly: number;
}

/**
 * The fee year as far as it has run: the months up to this one, each with the
 * year it falls in, and what they come to against what has been paid. Months
 * still ahead are left out, as the school bills them when they come.
 */
export const feeYear = (data: TransportRoute): FeeYear => {
  const fees = data.fees;
  const now = new Date();
  const thisMonth = (now.getMonth() + 9) % 12; // April = 0 … March = 11
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  const months = (fees?.schedule ?? [])
    .map((row, i) => {
      const at = MONTH_KEYS.indexOf(row.key);
      const idx = at >= 0 ? at : i;
      return { ...row, idx, label: `${row.month} ${idx <= 8 ? startYear : startYear + 1}` };
    })
    .filter(row => row.idx <= thisMonth)
    .map(({ key, label, amount, status }): FeeMonth => ({ key, label, amount, status }));

  // Payments cover the oldest months first, so what is due is what has been
  // billed so far less everything paid.
  const billed = months
    .filter(m => m.status !== 'no_transport')
    .reduce((sum, m) => sum + Number(m.amount || 0), 0);
  const paid = Number(fees?.total_paid || 0);

  return {
    months,
    billed,
    paid,
    due: Math.max(0, billed - paid),
    monthly: fees?.monthly_fee || data.monthly_fee || 0,
  };
};

// ── A route to draw before one has ever loaded here ──────────────────────────
const SAMPLE_MONTHS = ['April', 'May', 'June', 'July', 'August', 'September'];

export const SAMPLE_ROUTE: TransportRoute = {
  id: -1,
  route_name: 'Route 4 — Green Park',
  pickup_location: 'Green Park Main Gate',
  drop_location: 'School Gate 2',
  pickup_time: '07:20',
  drop_time: '14:20',
  stops: ['Green Park', 'Model Town', 'Civil Lines'],
  monthly_fee: 1200,
  capacity: 40,
  vehicle_no: 'DL 1A 2345',
  vehicle_type: 'Bus',
  driver: {
    id: -1,
    name: 'Ramesh Kumar',
    email: 'driver@school.in',
    image: null,
    phone: '98765 43210',
    license_no: 'DL-0420110012345',
    vehicle_no: 'DL 1A 2345',
    vehicle_type: 'Bus',
  },
  fees: {
    monthly_fee: 1200,
    annual_fee: 13200,
    months_count: 11,
    total_paid: 3600,
    total_due: 2400,
    schedule: SAMPLE_MONTHS.map((month, i) => ({
      key: MONTH_KEYS[i],
      month,
      amount: 1200,
      status: (i < 3 ? 'paid' : 'pending') as FeeStatus,
    })),
    payments: [
      {
        id: -1,
        serial: 1,
        amount: 3600,
        date: '12 Jun 2026',
        day: 'Friday',
        submitted_by: 'School Office',
        type: 'Counter',
        mode: 'Cash',
        receipt_number: 'TR-0001',
      },
    ],
  },
};

const isRoute = (v: TransportRoute | null | undefined): v is TransportRoute =>
  !!v && typeof v.route_name === 'string';

export const transportErrorMessage = (e: any): string => {
  const status = e?.response?.status;
  const serverMsg = e?.response?.data?.message;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return 'You are not allowed to view transport details.';
  if (e?.message === 'Network Error' || !e?.response) {
    return 'No internet connection. Check your network and try again.';
  }
  if (status >= 500) return serverMsg || 'The server ran into a problem. Please try again shortly.';
  return serverMsg || 'Unable to load transport details. Please try again.';
};

/**
 * The student's route for a page that draws itself as a skeleton while it
 * loads: the first load, a pull to refresh and Try again show the skeleton;
 * coming back to the page updates it in place. Every Transport page keeps the
 * same copy, so each opens drawn from what the last one saw.
 *
 * `notUsing` is a student who simply isn't on a route — nothing to retry.
 */
export function useMyTransport() {
  const [route, setRoute] = useState<TransportRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [notUsing, setNotUsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, rememberLast] = useLastLoaded<TransportRoute>('transport');

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const next = await getMyTransport();
        if (!next || !next.id) {
          // Signed in, but no route in the payload → not using transport.
          setNotUsing(true);
          setRoute(null);
        } else {
          setNotUsing(false);
          setRoute(next);
          rememberLast(next);
        }
      } catch (e: any) {
        const status = e?.response?.status;
        console.log('[getMyTransport] Error:', status, e?.message);
        if (status === 404) {
          setNotUsing(true);
          setRoute(null);
        } else {
          setError(transportErrorMessage(e));
        }
      } finally {
        setLoading(false);
      }
    },
    [rememberLast],
  );

  const reload = useCallback(() => load(true), [load]);

  useFocusLoad(() => load());

  // What a page is drawn from while it loads: what it shows, what this phone
  // kept, else an ordinary route.
  const drawn: TransportRoute | null = loading
    ? route ?? (isRoute(last) ? last : SAMPLE_ROUTE)
    : route;

  return {
    route,
    drawn,
    loading,
    notUsing,
    error,
    reload,
    // Nothing to draw: no route of their own, or nothing loaded and a failure.
    blocked: notUsing || (!!error && !route),
  };
}

// ── The pages' plain rows ────────────────────────────────────────────────────

/** A label and its value on one line, with a hairline under all but the last. */
export const InfoRow = ({
  label,
  value,
  onPress,
  tone,
  last,
  skeleton,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  /** Money settled, or money still owed. */
  tone?: 'paid' | 'due';
  last?: boolean;
  skeleton?: boolean;
}) => {
  const body = (
    <>
      <View style={s.infoLabelCol}>
        <Words skeleton={skeleton} style={s.infoLabel}>
          {label}
        </Words>
      </View>
      <View style={s.infoValueCol}>
        <Words
          skeleton={skeleton}
          style={[
            s.infoValue,
            !!onPress && s.infoLink,
            tone === 'paid' && s.infoPaid,
            tone === 'due' && s.infoDue,
          ]}
        >
          {value}
        </Words>
      </View>
    </>
  );

  return onPress ? (
    <TouchableOpacity
      style={[s.infoRow, !last && s.rowDivider]}
      activeOpacity={0.6}
      onPress={onPress}
      disabled={skeleton}
    >
      {body}
    </TouchableOpacity>
  ) : (
    <View style={[s.infoRow, !last && s.rowDivider]}>{body}</View>
  );
};

/** A block under a plain heading, separated from the last by a full-width line. */
export const Section = ({
  title,
  skeleton,
  children,
}: {
  title: string;
  skeleton?: boolean;
  children: React.ReactNode;
}) => (
  <>
    <View style={s.divider} />
    <View style={s.section}>
      <Words skeleton={skeleton} style={s.sectionTitle}>
        {title}
      </Words>
      {children}
    </View>
  </>
);

/**
 * The page under its header while there is nothing to show — the student isn't
 * on a route, or nothing has loaded and the call failed. Pages draw it when the
 * hook says they are `blocked`.
 */
export const TransportState = ({
  title,
  notUsing,
  error,
  onBack,
  onRetry,
}: {
  title: string;
  notUsing: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
}) => (
  <View style={s.root}>
    <DocHeader title={title} onBackPress={onBack} />
    <ScrollView
      contentContainerStyle={s.stateScroll}
      refreshControl={<AppRefreshControl refreshing={false} onRefresh={onRetry} />}
    >
      {notUsing ? (
        <DocNoData
          icon="bus-outline"
          title="No transport service"
          subtitle="You are not using the school transport. To opt in, please contact the school office."
        />
      ) : (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error ?? 'No transport details found.'}</Text>
          <TouchableOpacity onPress={onRetry} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  </View>
);

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  stateScroll: { flexGrow: 1 },

  // Sections, with a full-width line between the blocks
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  section: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
  sectionTitle: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 2 },

  // Label / value
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  infoLabelCol: { width: 122 },
  infoLabel: { fontSize: 13, color: theme.colors.textSecondary },
  infoValueCol: { flex: 1, alignItems: 'flex-end' },
  infoValue: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary, textAlign: 'right' },
  infoLink: { color: theme.colors.primary },
  infoPaid: { color: theme.colors.success },
  infoDue: { color: theme.colors.danger },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

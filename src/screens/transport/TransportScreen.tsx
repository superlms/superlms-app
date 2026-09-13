import React, { useCallback, useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { Skeleton } from '../../components/Skeleton';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import constant from '../../utils/constant';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  CardDetailRow,
  CardDetails,
  CardDetailsSkeleton,
  CardDivider,
  CardFooter,
  CardFooterSkeleton,
  CardHead,
  CardHeadSkeleton,
  CardLeadIcon,
  TransportCard,
  TransportPayments,
  TransportPaymentsSkeleton,
} from '../fees/TransportPayments';
import {
  getMyTransport,
  type FeeStatus,
  type TransportRoute,
} from '../../api/transportApi';

const TITLE = 'Transport';

// Files come from the same host as the API but outside the /api/v1 prefix.
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

const STATUS_LABEL: Record<FeeStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  pending: 'Pending',
  no_transport: '—',
};

// The fee schedule's order — the academic year, April to March.
const MONTH_KEYS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'];

const formatINR = (n: number) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

// "07:30:00" / "07:30" → "07:30 AM"; anything else is shown as it comes.
const clock = (time?: string | null): string | null => {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!m) return time;
  const h = Number(m[1]);
  return `${String(h % 12 || 12).padStart(2, '0')}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

const initialsOf = (name?: string | null) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// A card (or cards) under a plain heading, separated from the block before by
// a line — the first one sits straight under the header.
const Section = ({
  title,
  first,
  children,
}: {
  title: string;
  first?: boolean;
  children: React.ReactNode;
}) => (
  <>
    {!first && <View style={s.divider} />}
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  </>
);

// ── Loading ──────────────────────────────────────────────────────────────────
// What the page held when it last loaded — the skeleton draws the same cards
// (the route's lines and the driver under them, the months so far, the
// payments), so nothing jumps when the page arrives. Before anything has
// loaded it assumes no pickup or drop points, a driver with four details and a
// phone, the fees up to this month and one payment.
type PageShape = {
  points: number;
  driverLines: number | null;
  driverPhone: boolean;
  fees: boolean;
  feeRows: number;
  payments: number;
};
let lastShape: PageShape | null = null;

// This month's place in the fee year, April being the first.
const monthsSoFar = () => ((new Date().getMonth() + 9) % 12) + 1;

const shapeOf = (d: TransportRoute): PageShape => {
  const driver = d.driver;
  const vehicle = driver?.vehicle_no || d.vehicle_no || d.vehicle_type || driver?.vehicle_type;
  return {
    points: [d.pickup_location, d.drop_location].filter(Boolean).length,
    driverLines: driver ? [driver.phone, driver.email, driver.license_no, vehicle].filter(Boolean).length : null,
    driverPhone: !!driver?.phone,
    fees: !!d.fees,
    feeRows: d.fees ? Math.min(monthsSoFar(), d.fees.schedule?.length ?? 0) : 0,
    payments: d.fees?.payments?.length ?? 0,
  };
};

// The driver's values run to different lengths — phone, email, licence, vehicle.
const DRIVER_WIDTHS = [96, 150, 104, 124];
const DRIVER_LABELS = [44, 40, 76, 52];

const TransportSkeleton = ({ onBack }: { onBack: () => void }) => {
  const shape = lastShape ?? {
    points: 0,
    driverLines: 4,
    driverPhone: true,
    fees: true,
    feeRows: monthsSoFar(),
    payments: 1,
  };
  const rows = shape.feeRows;

  // The route's lines: monthly fee, pickup and drop times, the points that are
  // set, then paid and remaining.
  const routeWidths = [62, 70, 70, ...Array(shape.points).fill(120), ...(shape.fees ? [62, 62] : [])];
  const routeLabels = [84, 78, 68, ...Array(shape.points).fill(80), ...(shape.fees ? [60, 98] : [])];

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={onBack} />
      <ScrollView scrollEnabled={false} contentContainerStyle={s.scroll}>
        {/* Route, then the driver in the same card */}
        <View style={s.section}>
          <Skeleton width={44} height={12} style={s.skSectionTitle} />
          <TransportCard>
            <CardHeadSkeleton lead={false} titleWidth="40%" subWidth={null} />
            <CardDetailsSkeleton widths={routeWidths} labels={routeLabels} />
            {shape.driverLines !== null && (
              <>
                <CardDivider />
                <CardHeadSkeleton titleWidth="36%" subWidth={40} />
                {shape.driverLines > 0 && (
                  <CardDetailsSkeleton
                    widths={DRIVER_WIDTHS.slice(0, shape.driverLines)}
                    labels={DRIVER_LABELS}
                  />
                )}
                {shape.driverPhone && <CardFooterSkeleton width={96} />}
              </>
            )}
          </TransportCard>
        </View>

        {/* Transport Fees, up to this month */}
        {rows > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              <Skeleton width={96} height={12} style={s.skSectionTitle} />
              <TransportCard>
                <CardHeadSkeleton titleWidth="34%" subWidth={62} chipWidth={92} />
                <CardDetailsSkeleton
                  widths={Array.from({ length: rows }, () => 62)}
                  labels={[80, 70, 104]}
                  aside={46}
                />
              </TransportCard>
            </View>
          </>
        )}

        {/* Payments */}
        {shape.fees && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              <Skeleton width={68} height={12} style={s.skSectionTitle} />
              {shape.payments > 0 ? (
                <TransportPaymentsSkeleton count={Math.min(shape.payments, 3)} />
              ) : (
                <Skeleton width="48%" height={13} style={s.skEmpty} />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const TransportScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  // `notUsing` = the student simply has no route (informational, no retry).
  // `error`    = an actual failure (network / server) — retryable.
  const [notUsing, setNotUsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TransportRoute | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotUsing(false);
    try {
      const res = await getMyTransport();
      if (!res || !res.id) {
        // Authenticated but no route in the payload → not using transport.
        setNotUsing(true);
        setData(null);
      } else {
        setData(res);
        lastShape = shapeOf(res);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.message;
      console.log('[getMyTransport] ❌', status, serverMsg || e?.message);

      if (status === 404) {
        setNotUsing(true);
      } else if (status === 401) {
        setError('Your session has expired. Please log in again.');
      } else if (status === 403) {
        setError('You are not allowed to view transport details.');
      } else if (e?.message === 'Network Error' || !e?.response) {
        setError('No internet connection. Check your network and try again.');
      } else if (status >= 500) {
        setError(serverMsg || 'The server ran into a problem. Please try again shortly.');
      } else {
        setError(serverMsg || 'Unable to load transport details. Please try again.');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusLoad(load);

  // The skeleton on the way in; coming back to a loaded page refetches quietly.
  if (loading && !refreshing && !data) return <TransportSkeleton onBack={() => navigation.goBack()} />;

  const refreshControl = <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />;

  // Not using school transport — a plain statement, nothing to retry.
  if (notUsing) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={s.stateScroll} refreshControl={refreshControl}>
          <DocNoData
            icon="bus-outline"
            title="No transport service"
            subtitle="You are not using the school transport. To opt in, please contact the school office."
          />
        </ScrollView>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={s.stateScroll} refreshControl={refreshControl}>
          <View style={s.centeredBox}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
            <Text style={s.errorText}>{error || 'No transport details found.'}</Text>
            <TouchableOpacity onPress={load} hitSlop={10}>
              <Text style={s.linkText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  const { driver, fees } = data;
  const driverPhoto = resolveFileUrl(driver?.image);
  // Vehicle number and type on one line
  const vehicle = [driver?.vehicle_no || data.vehicle_no, data.vehicle_type || driver?.vehicle_type]
    .filter(Boolean)
    .join('  ·  ');

  // Fees only up to this month — upcoming months are left out. The year runs
  // April to March, so January–March belong to the year after its April.
  const now = new Date();
  const thisMonth = (now.getMonth() + 9) % 12; // April = 0 … March = 11
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const schedule = (fees?.schedule ?? [])
    .map((row, i) => {
      const at = MONTH_KEYS.indexOf(row.key);
      const idx = at >= 0 ? at : i;
      return { ...row, idx, label: `${row.month} ${idx <= 8 ? startYear : startYear + 1}` };
    })
    .filter(row => row.idx <= thisMonth);
  // Due for the months shown — payments cover the oldest months first.
  const billedSoFar = schedule
    .filter(row => row.status !== 'no_transport')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const dueSoFar = Math.max(0, billedSoFar - Number(fees?.total_paid || 0));
  const payments = fees?.payments ?? [];
  const monthlyFee = fees?.monthly_fee || data.monthly_fee;

  const callDriver = driver?.phone ? () => Linking.openURL(`tel:${driver.phone}`) : undefined;
  const mailDriver = driver?.email ? () => Linking.openURL(`mailto:${driver.email}`) : undefined;

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={refreshControl}
      >
        {/* The route — its name, monthly fee, pickup and drop, what is paid and
            what remains — then, in the same card, who drives it, with a call
            button across the foot */}
        <Section title="Route" first>
          <TransportCard>
            <CardHead title={data.route_name} />
            <CardDetails>
              <CardDetailRow label="Monthly Fee" value={monthlyFee ? formatINR(monthlyFee) : null} />
              <CardDetailRow label="Pickup Time" value={clock(data.pickup_time)} />
              <CardDetailRow label="Drop Time" value={clock(data.drop_time)} />
              {!!data.pickup_location && <CardDetailRow label="Pickup Point" value={data.pickup_location} />}
              {!!data.drop_location && <CardDetailRow label="Drop Point" value={data.drop_location} />}
              {!!fees && (
                <>
                  <CardDetailRow
                    label="Fee Paid"
                    value={formatINR(fees.total_paid)}
                    tone={fees.total_paid > 0 ? 'paid' : undefined}
                  />
                  <CardDetailRow
                    label="Fee Remaining"
                    value={formatINR(dueSoFar)}
                    tone={dueSoFar > 0 ? 'due' : 'paid'}
                  />
                </>
              )}
            </CardDetails>

            {!!driver && (
              <>
                <CardDivider />
                <CardHead
                  lead={
                    driverPhoto ? (
                      <Image source={{ uri: driverPhoto }} style={s.driverAvatar} />
                    ) : (
                      <View style={[s.driverAvatar, s.driverAvatarFallback]}>
                        <Text style={s.driverInitials}>{initialsOf(driver.name)}</Text>
                      </View>
                    )
                  }
                  title={driver.name || '—'}
                  sub="Driver"
                />
                {!!(driver.phone || driver.email || driver.license_no || vehicle) && (
                  <CardDetails>
                    {!!driver.phone && <CardDetailRow label="Phone" value={driver.phone} onPress={callDriver} />}
                    {!!driver.email && <CardDetailRow label="Email" value={driver.email} onPress={mailDriver} />}
                    {!!driver.license_no && <CardDetailRow label="Licence No." value={driver.license_no} />}
                    {!!vehicle && <CardDetailRow label="Vehicle" value={vehicle} />}
                  </CardDetails>
                )}
                {!!callDriver && <CardFooter icon="call-outline" label="Call Driver" onPress={callDriver} />}
              </>
            )}
          </TransportCard>
        </Section>

        {/* What has been paid, and each month up to this one — a card like a
            payment's */}
        {!!fees && schedule.length > 0 && (
          <Section title="Transport Fees">
            <TransportCard>
              <CardHead
                lead={<CardLeadIcon icon="wallet-outline" />}
                title={formatINR(fees.total_paid)}
                sub="Total paid"
                chip={
                  dueSoFar > 0
                    ? { label: `Due ${formatINR(dueSoFar)}`, tone: 'due' }
                    : { label: 'No dues', tone: 'paid' }
                }
              />
              <CardDetails>
                {schedule.map(row => (
                  <CardDetailRow
                    key={row.key}
                    label={row.label}
                    value={row.amount > 0 ? formatINR(row.amount) : '—'}
                    aside={
                      <Text
                        style={[
                          s.feeStatus,
                          row.status === 'paid' && s.feeStatusPaid,
                          row.status === 'pending' && s.feeStatusDue,
                          row.status === 'partial' && s.feeStatusPartial,
                        ]}
                      >
                        {STATUS_LABEL[row.status] ?? '—'}
                      </Text>
                    }
                  />
                ))}
              </CardDetails>
            </TransportCard>
          </Section>
        )}

        {/* Every payment made, each with its receipt to download */}
        {!!fees && (
          <Section title="Payments">
            <TransportPayments payments={payments} />
          </Section>
        )}
      </ScrollView>
    </View>
  );
};

export default TransportScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },
  stateScroll: { flexGrow: 1 },

  // Full-width lines between the blocks
  divider: { height: 1, backgroundColor: theme.colors.divider },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 10 },

  // Driver — the photo, or initials on the accent tint, in the card's lead
  driverAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.background },
  driverAvatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primaryLight },
  driverInitials: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },

  // A month's status, in the fee card's last column
  feeStatus: { fontSize: 13, fontWeight: '500', color: theme.colors.textMuted },
  feeStatusPaid: { color: theme.colors.success },
  feeStatusDue: { color: theme.colors.danger },
  feeStatusPartial: { color: theme.colors.textPrimary },

  // Skeleton — boxes the height of the text they stand in for
  skSectionTitle: { marginTop: 2, marginBottom: 13 },
  skEmpty: { marginVertical: 14 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

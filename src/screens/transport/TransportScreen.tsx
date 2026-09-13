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
import { TransportPayments, TransportPaymentsSkeleton } from '../fees/TransportPayments';
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

// ── Label : value line ───────────────────────────────────────────────────────
const InfoRow = ({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string | null;
  onPress?: () => void;
}) => {
  if (!value) return null;
  return (
    <TouchableOpacity
      style={s.infoRow}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
      onPress={onPress}
    >
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoColon}>:</Text>
      <Text style={[s.infoValue, !!onPress && s.infoValueLink]}>{value}</Text>
    </TouchableOpacity>
  );
};

// Pickup or drop — its time (a dash when not set) and, if known, the place.
const TimeCol = ({ label, time, place }: { label: string; time: string | null; place?: string | null }) => (
  <View style={s.timeCol}>
    <Text style={s.timeLabel}>{label}</Text>
    <Text style={s.timeValue}>{time || '—'}</Text>
    {!!place && <Text style={s.timePlace} numberOfLines={2}>{place}</Text>}
  </View>
);

// A block of rows under a plain heading, separated from the last by a line.
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <>
    <View style={s.divider} />
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  </>
);

// ── Loading ──────────────────────────────────────────────────────────────────
// What the page held when it last loaded — the skeleton draws the same blocks
// (the driver's lines, the months so far, the payments), so nothing jumps when
// the page arrives. Before anything has loaded it assumes a driver with four
// lines, the fees up to this month and one payment.
type PageShape = {
  driverLines: number | null;
  places: boolean;
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
    driverLines: driver ? [driver.phone, driver.email, driver.license_no, vehicle].filter(Boolean).length : null,
    places: !!(d.pickup_location || d.drop_location),
    fees: !!d.fees,
    feeRows: d.fees ? Math.min(monthsSoFar(), d.fees.schedule?.length ?? 0) : 0,
    payments: d.fees?.payments?.length ?? 0,
  };
};

// The driver's values run to different lengths — phone, email, licence, vehicle.
const LINE_WIDTHS = ['36%', '58%', '16%', '34%'];

const TimeColSkeleton = ({ place }: { place: boolean }) => (
  <View style={s.timeCol}>
    <Skeleton width={42} height={11} style={s.skLine} />
    <Skeleton width={80} height={16} style={s.skTime} />
    {place && <Skeleton width={92} height={11} style={s.skTime} />}
  </View>
);

const TransportSkeleton = ({ onBack }: { onBack: () => void }) => {
  const shape = lastShape ?? { driverLines: 4, places: false, fees: true, feeRows: monthsSoFar(), payments: 1 };
  const rows = shape.feeRows;

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={onBack} />
      <ScrollView scrollEnabled={false} contentContainerStyle={s.scroll}>
        {/* Bus, route, pickup and drop */}
        <View style={s.head}>
          <Skeleton width={88} height={88} radius={44} />
          <Skeleton width="42%" height={22} style={s.skTitle} />
          <View style={s.times}>
            <TimeColSkeleton place={shape.places} />
            <View style={s.timesSep} />
            <TimeColSkeleton place={shape.places} />
          </View>
        </View>

        {/* Driver */}
        {shape.driverLines !== null && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              <Skeleton width={46} height={12} style={s.skSectionTitle} />
              <View style={s.driverRow}>
                <Skeleton width={44} height={44} radius={22} />
                <Skeleton width="32%" height={15} />
              </View>
              <View style={s.driverRows}>
                {Array.from({ length: shape.driverLines }, (_, i) => (
                  <View key={i} style={s.infoRow}>
                    <Skeleton width={72} height={14} style={[s.skLine, s.skLabel]} />
                    <Skeleton width={LINE_WIDTHS[i % LINE_WIDTHS.length]} height={14} style={s.skLine} />
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Transport Fees, up to this month */}
        {rows > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              <Skeleton width={96} height={12} style={s.skSectionTitle} />
              <Skeleton width="46%" height={13} style={s.skSummary} />
              <View style={s.schedule}>
                {Array.from({ length: rows }, (_, i) => (
                  <View key={i} style={[s.feeRow, i < rows - 1 && s.rowDivider]}>
                    <View style={s.skMonth}>
                      <Skeleton width={i % 3 === 2 ? 118 : 94} height={14} style={s.skLine} />
                    </View>
                    <Skeleton width={62} height={14} style={[s.skLine, s.skAmount]} />
                    <Skeleton width={52} height={13} style={s.skLine} />
                  </View>
                ))}
              </View>
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

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={refreshControl}
      >
        {/* A big bus, the route, and its pickup and drop times — centred */}
        <View style={s.head}>
          <View style={s.busIcon}>
            <VectorIcon iconSet="Ionicons" iconName="bus" size={44} color={theme.colors.primary} />
          </View>
          <Text style={s.title}>{data.route_name}</Text>
          <View style={s.times}>
            <TimeCol label="Pickup" time={clock(data.pickup_time)} place={data.pickup_location} />
            <View style={s.timesSep} />
            <TimeCol label="Drop" time={clock(data.drop_time)} place={data.drop_location} />
          </View>
        </View>

        {/* Who drives it, and the vehicle */}
        {!!driver && (
          <Section title="Driver">
            <View style={s.driverRow}>
              {driverPhoto ? (
                <Image source={{ uri: driverPhoto }} style={s.driverAvatar} />
              ) : (
                <View style={[s.driverAvatar, s.driverAvatarFallback]}>
                  <Text style={s.driverInitials}>{initialsOf(driver.name)}</Text>
                </View>
              )}
              <Text style={s.driverName}>{driver.name || '—'}</Text>
            </View>

            <View style={s.driverRows}>
              <InfoRow
                label="Phone"
                value={driver.phone}
                onPress={driver.phone ? () => Linking.openURL(`tel:${driver.phone}`) : undefined}
              />
              <InfoRow
                label="Email"
                value={driver.email}
                onPress={driver.email ? () => Linking.openURL(`mailto:${driver.email}`) : undefined}
              />
              <InfoRow label="Licence No" value={driver.license_no} />
              <InfoRow label="Vehicle" value={vehicle} />
            </View>
          </Section>
        )}

        {/* What has been paid, month by month, up to this month */}
        {!!fees && schedule.length > 0 && (
          <Section title="Transport Fees">
            <Text style={s.feeSummary}>
              Paid <Text style={s.feePaid}>{formatINR(fees.total_paid)}</Text>
              {'   ·   '}
              Due{' '}
              <Text style={dueSoFar > 0 ? s.feeDue : s.feePaid}>{formatINR(dueSoFar)}</Text>
            </Text>

            <View style={s.schedule}>
              {schedule.map((row, i) => (
                <View
                  key={row.key}
                  style={[s.feeRow, i < schedule.length - 1 && s.rowDivider]}
                >
                  <Text style={s.feeMonth}>{row.label}</Text>
                  <Text style={s.feeAmount}>
                    {row.amount > 0 ? formatINR(row.amount) : '—'}
                  </Text>
                  <Text
                    style={[
                      s.feeStatus,
                      row.status === 'pending' && s.feeStatusDue,
                      row.status === 'partial' && s.feeStatusPartial,
                    ]}
                  >
                    {STATUS_LABEL[row.status] ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
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

  // Head
  head: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 22 },
  busIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    lineHeight: 27,
    textAlign: 'center',
    marginTop: 14,
  },
  times: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 16 },
  timesSep: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  timeCol: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  timeLabel: { fontSize: 12, color: theme.colors.textMuted },
  timeValue: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 3 },
  timePlace: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 2 },

  // Full-width lines between the blocks
  divider: { height: 1, backgroundColor: theme.colors.divider },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },

  // Label : value lines
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7 },
  infoLabel: { width: 84, fontSize: 14, color: theme.colors.textSecondary },
  infoColon: { width: 14, fontSize: 14, color: theme.colors.textSecondary },
  infoValue: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  infoValueLink: { color: theme.colors.primary },

  // Sections
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 10 },

  // Driver
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.background },
  driverAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  driverInitials: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  driverName: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  driverRows: { marginTop: 10, paddingBottom: 8 },

  // Fees
  feeSummary: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 6 },
  feePaid: { fontWeight: '600', color: theme.colors.textPrimary },
  feeDue: { fontWeight: '600', color: theme.colors.danger },
  schedule: { marginTop: 2 },
  feeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  feeMonth: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  feeAmount: { width: 90, textAlign: 'right', fontSize: 14, color: theme.colors.textSecondary },
  feeStatus: { width: 72, textAlign: 'right', fontSize: 13, color: theme.colors.textMuted },
  feeStatusDue: { color: theme.colors.danger, fontWeight: '500' },
  feeStatusPartial: { color: theme.colors.textPrimary, fontWeight: '500' },

  // Skeleton — boxes the height of the text they stand in for
  skLine: { marginVertical: 2.5 },
  skTitle: { marginTop: 17, marginBottom: 2 },
  skTime: { marginTop: 5 },
  skSectionTitle: { marginTop: 2, marginBottom: 13 },
  skLabel: { marginRight: 26 },
  skSummary: { marginTop: 2, marginBottom: 8 },
  skMonth: { flex: 1 },
  skAmount: { marginRight: 20 },
  skEmpty: { marginVertical: 14 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

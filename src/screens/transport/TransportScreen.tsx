import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import constant from '../../utils/constant';
import { downloadPdf } from '../../api/pdfDownload';
import { DocHeader, DocLoading, DocNoData } from '../more/docUi';
import {
  getMyTransport,
  transportReceiptUrl,
  type FeeStatus,
  type TransportPayment,
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

// One detail of a payment — a small label over its value, half the width.
const PayField = ({ label, value }: { label: string; value?: string | null }) => (
  <View style={s.payField}>
    <Text style={s.payFieldLabel}>{label}</Text>
    <Text style={s.payFieldValue}>{value || '—'}</Text>
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

const TransportScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  // `notUsing` = the student simply has no route (informational, no retry).
  // `error`    = an actual failure (network / server) — retryable.
  const [notUsing, setNotUsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TransportRoute | null>(null);
  // The payment whose receipt is downloading — its button shows a spinner.
  const [downloading, setDownloading] = useState<number | null>(null);

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

  if (loading && !refreshing) return <DocLoading title={TITLE} />;

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

  // Saves the receipt PDF to the phone's Downloads (the share sheet on iOS).
  const downloadReceipt = async (p: TransportPayment) => {
    if (downloading) return;
    setDownloading(p.id);
    const fileName = `Transport-Receipt-${p.receipt_number.replace(/[\\/:*?"<>|\s]+/g, '-')}.pdf`;
    try {
      await downloadPdf(transportReceiptUrl(p.id), fileName);
      if (Platform.OS === 'android') AppAlert.alert('Downloaded', `${fileName} is saved in Downloads.`);
    } catch (e: any) {
      console.log('[transportReceipt] ❌', e?.message);
      AppAlert.alert('Could not download', 'Please check your connection and try again.');
    } finally {
      setDownloading(null);
    }
  };

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
        {payments.length > 0 && (
          <Section title="Payments">
            {payments.map((p, i) => (
              <View key={p.id} style={[s.payment, i < payments.length - 1 && s.rowDivider]}>
                <View style={s.paymentHead}>
                  <View style={s.serial}>
                    <Text style={s.serialText}>{p.serial}</Text>
                  </View>
                  <Text style={s.paymentAmount}>{formatINR(p.amount)}</Text>
                  <TouchableOpacity
                    style={s.receiptBtn}
                    onPress={() => downloadReceipt(p)}
                    disabled={downloading !== null}
                    activeOpacity={0.7}
                  >
                    {downloading === p.id ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <VectorIcon iconSet="Ionicons" iconName="download-outline" size={16} color={theme.colors.primary} />
                    )}
                    <Text style={s.receiptBtnText}>Receipt</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.payGrid}>
                  <PayField label="Date" value={p.date} />
                  <PayField label="Day" value={p.day} />
                  <PayField label="Submitted By" value={p.submitted_by} />
                  <PayField label="Type" value={p.type} />
                  <PayField label="Mode" value={p.mode} />
                  <PayField label="Receipt No" value={p.receipt_number} />
                </View>
              </View>
            ))}
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

  // Payments
  payment: { paddingVertical: 14 },
  paymentHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  serial: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  serialText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  paymentAmount: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 96,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primaryLight,
  },
  receiptBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  payGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, paddingLeft: 34, rowGap: 10 },
  payField: { width: '50%', paddingRight: 8 },
  payFieldLabel: { fontSize: 11, color: theme.colors.textMuted },
  payFieldValue: { fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary, marginTop: 2 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

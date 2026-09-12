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
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import constant from '../../utils/constant';
import { DocHeader, DocLoading, DocNoData } from '../more/docUi';
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

const formatINR = (n: number) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

const initialsOf = (name?: string | null) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// ── Label / value row ────────────────────────────────────────────────────────
const InfoRow = ({
  label,
  value,
  onPress,
  last,
}: {
  label: string;
  value?: string | null;
  onPress?: () => void;
  last?: boolean;
}) => {
  if (!value) return null;
  return (
    <TouchableOpacity
      style={[s.infoRow, !last && s.rowDivider]}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
      onPress={onPress}
    >
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, !!onPress && s.infoValueLink]}>{value}</Text>
    </TouchableOpacity>
  );
};

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
  const schedule = fees?.schedule ?? [];
  const driverPhoto = resolveFileUrl(driver?.image);

  // Only the lines that are actually filled in.
  const routeRows = [
    ['Vehicle No', data.vehicle_no],
    ['Capacity', data.capacity ? `${data.capacity} seats` : null],
    ['Pickup Point', data.pickup_location],
    ['Pickup Time', data.pickup_time],
    ['Drop Point', data.drop_location],
  ].filter(([, v]) => !!v) as [string, string][];

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={refreshControl}
      >
        {/* The route, and what it costs */}
        <View style={s.head}>
          <Text style={s.kicker}>ROUTE</Text>
          <Text style={s.title}>{data.route_name}</Text>
          <Text style={s.fee}>{formatINR(data.monthly_fee)} per month</Text>
        </View>

        {routeRows.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.body}>
              {routeRows.map(([label, value], i) => (
                <InfoRow
                  key={label}
                  label={label}
                  value={value}
                  last={i === routeRows.length - 1}
                />
              ))}
            </View>
          </>
        )}

        {/* Who drives it */}
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
              <View style={s.driverInfo}>
                <Text style={s.driverName}>{driver.name || '—'}</Text>
                {!!driver.vehicle_type && (
                  <Text style={s.driverSub}>{driver.vehicle_type}</Text>
                )}
              </View>
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
              <InfoRow label="Licence No" value={driver.license_no} last />
            </View>
          </Section>
        )}

        {/* What has been paid, month by month */}
        {!!fees && schedule.length > 0 && (
          <Section title="Transport Fees">
            <Text style={s.feeSummary}>
              Paid <Text style={s.feePaid}>{formatINR(fees.total_paid)}</Text>
              {'   ·   '}
              Due{' '}
              <Text style={fees.total_due > 0 ? s.feeDue : s.feePaid}>
                {formatINR(fees.total_due)}
              </Text>
            </Text>

            <View style={s.schedule}>
              {schedule.map((row, i) => (
                <View
                  key={row.key}
                  style={[s.feeRow, i < schedule.length - 1 && s.rowDivider]}
                >
                  <Text style={s.feeMonth}>{row.month}</Text>
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
  head: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    lineHeight: 29,
    marginTop: 6,
  },
  fee: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },

  // Full-width lines between the blocks
  divider: { height: 1, backgroundColor: theme.colors.divider },

  // Label / value rows
  body: { paddingHorizontal: 20, paddingTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  infoLabel: { width: '40%', paddingRight: 12, fontSize: 14, color: theme.colors.textSecondary },
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
  driverInfo: { flex: 1 },
  driverName: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  driverSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  driverRows: { marginTop: 6 },

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

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useCallback, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import constant from '../../utils/constant';
import {
  getMyTransport,
  type FeeStatus,
  type TransportRoute,
} from '../../api/transportApi';

// Files come from the same host as the API but outside the /api/v1 prefix.
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

// Status key → label + colors (matches backend `fees.schedule[].status`)
const STATUS_CONFIG: Record<FeeStatus, { label: string; color: string; bg: string }> = {
  paid: { label: 'Paid', color: '#16A34A', bg: '#DCFCE7' },
  partial: { label: 'Partial', color: '#0284C7', bg: '#E0F2FE' },
  pending: { label: 'Pending', color: '#D97706', bg: '#FEF3C7' },
  no_transport: { label: 'No Transport', color: '#6B7280', bg: '#F3F4F6' },
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

// ─── Label / value row ────────────────────────────────────────────────────────
const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={s.infoRow}>
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={s.infoValue}>{value}</Text>
  </View>
);

const TransportScreen = ({ navigation }: any) => {
  const [driverExpanded, setDriverExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  // `notUsing` = student simply has no transport assigned (informational, no retry).
  // `error`    = an actual failure (network/server) — retryable.
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
        // Authenticated but no route in the payload → treat as "not using transport".
        setNotUsing(true);
        setData(null);
      } else {
        setData(res);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.message;
      console.log(
        '[getMyTransport] Error status:',
        status,
        '| message:',
        serverMsg || e?.message,
      );

      if (status === 404) {
        // No transport route assigned to this student.
        setNotUsing(true);
      } else if (status === 401) {
        setError('Your session has expired. Please log in again.');
      } else if (status === 403) {
        setError('You are not allowed to view transport details.');
      } else if (e?.message === 'Network Error' || !e?.response) {
        setError('No internet connection. Check your network and try again.');
      } else if (status >= 500) {
        setError(
          serverMsg || 'The server ran into a problem. Please try again shortly.',
        );
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

  const renderBody = () => {
    if (loading) {
      return (
        <View style={s.center}>
          <ScreenSkeleton variant="list" />
        </View>
      );
    }

    // Student is not using school transport — friendly, no retry.
    // Wrapped in a refreshable ScrollView so a pull still re-checks the API.
    if (notUsing) {
      return (
        <ScrollView
          contentContainerStyle={s.centerScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={s.emptyIconWrap}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="bus-outline"
              size={36}
              color={theme.colors.primary}
            />
          </View>
          <Text style={s.emptyTitle}>No Transport Service</Text>
          <Text style={s.emptyText}>
            You are not using the school transport service. If you'd like to
            opt in, please contact the school office.
          </Text>
        </ScrollView>
      );
    }

    // Real failure (network / server) — retryable + pull-to-refresh.
    if (error || !data) {
      return (
        <ScrollView
          contentContainerStyle={s.centerScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={[s.emptyIconWrap, { backgroundColor: '#FEE2E2' }]}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="cloud-offline-outline"
              size={34}
              color={theme.colors.danger}
            />
          </View>
          <Text style={s.emptyTitle}>Something went wrong</Text>
          <Text style={s.emptyText}>
            {error || 'No transport details found.'}
          </Text>
          <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.85}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="refresh"
              size={15}
              color={theme.colors.primary}
            />
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    const { driver, fees } = data;
    const schedule = fees?.schedule ?? [];

    return (
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ── School & Bus Card ── */}
        <View style={s.card}>
          <View style={[s.accentBar, { backgroundColor: theme.colors.primary }]} />
          <View style={s.cardInner}>
            <View style={s.cardTop}>
              <View style={s.iconWrap}>
                <VectorIcon
                  iconSet="Ionicons"
                  iconName="bus-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{data.route_name}</Text>
                <Text style={s.cardSubtitle}>School Transport</Text>
              </View>
              <View style={s.fareBadge}>
                <Text style={s.fareBadgeText}>
                  {formatINR(data.monthly_fee)}/pm
                </Text>
              </View>
            </View>

            {(data.pickup_location || data.pickup_time) && (
              <View style={s.pillsRow}>
                {!!data.pickup_location && (
                  <View style={s.pill}>
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName="location-outline"
                      size={12}
                      color={theme.colors.primary}
                    />
                    <Text style={s.pillText}>{data.pickup_location}</Text>
                  </View>
                )}
                {!!data.pickup_time && (
                  <View style={s.pill}>
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName="time-outline"
                      size={12}
                      color={theme.colors.primary}
                    />
                    <Text style={s.pillText}>Pickup {data.pickup_time}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={s.divider} />

            <InfoRow label="Vehicle Number" value={data.vehicle_no || '–'} />
            <InfoRow
              label="Capacity"
              value={data.capacity ? `${data.capacity} Seats` : '–'}
            />
            <InfoRow label="Pickup Time" value={data.pickup_time || '–'} />
            <InfoRow label="Pickup Point" value={data.route_name || '–'} />
            <InfoRow label="Drop Point" value={data.route_name || '–'} />

            {/* Driver Details accordion */}
            {driver && (
              <>
                <TouchableOpacity
                  style={s.driverHeader}
                  onPress={() => setDriverExpanded(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={s.driverHeaderLeft}>
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName="person-outline"
                      size={14}
                      color={theme.colors.primary}
                    />
                    <Text style={s.driverHeaderText}>Driver Details</Text>
                  </View>
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName={driverExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>

                {driverExpanded && (
                  <View style={s.driverBody}>
                    <View style={s.driverTop}>
                      {resolveFileUrl(driver.image) ? (
                        <Image
                          source={{ uri: resolveFileUrl(driver.image) }}
                          style={s.driverAvatar}
                        />
                      ) : (
                        <View style={s.driverAvatar}>
                          <Text style={s.driverInitial}>
                            {initialsOf(driver.name)}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={s.driverName}>{driver.name || '–'}</Text>
                        {!!driver.email && (
                          <Text style={s.driverEmail}>{driver.email}</Text>
                        )}
                      </View>
                    </View>
                    {!!driver.phone && (
                      <View style={s.driverPhoneRow}>
                        <VectorIcon
                          iconSet="Ionicons"
                          iconName="call-outline"
                          size={13}
                          color={theme.colors.primary}
                        />
                        <Text style={s.driverPhone}>{driver.phone}</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* ── Transport Fees Card ── */}
        {!!fees && (
          <View style={s.card}>
            <View style={[s.accentBar, { backgroundColor: '#16A34A' }]} />
            <View style={s.cardInner}>
              <View style={s.cardTop}>
                <View style={s.iconWrap}>
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="wallet-outline"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Transport Fees</Text>
                  <Text style={s.cardSubtitle}>Monthly payments</Text>
                </View>
              </View>

              {/* Table header */}
              <View style={[s.tableRow, s.tableHead]}>
                <Text style={[s.tableHeadText, { flex: 1.4 }]}>Month</Text>
                <Text style={[s.tableHeadText, { flex: 1, textAlign: 'center' }]}>
                  Amount
                </Text>
                <Text style={[s.tableHeadText, { flex: 1.6, textAlign: 'right' }]}>
                  Status
                </Text>
              </View>

              {schedule.map((row, i) => {
                const sc = STATUS_CONFIG[row.status];
                return (
                  <View
                    key={row.key}
                    style={[
                      s.tableRow,
                      i < schedule.length - 1 && s.tableRowBorder,
                    ]}
                  >
                    <Text style={[s.tableCellText, { flex: 1.4 }]}>
                      {row.month}
                    </Text>
                    <Text
                      style={[s.tableCellText, { flex: 1, textAlign: 'center' }]}
                    >
                      {row.amount > 0 ? formatINR(row.amount) : '–'}
                    </Text>
                    <View style={{ flex: 1.6, alignItems: 'flex-end' }}>
                      {sc ? (
                        <View style={[s.badge, { backgroundColor: sc.bg }]}>
                          <View
                            style={[s.badgeDot, { backgroundColor: sc.color }]}
                          />
                          <Text style={[s.badgeText, { color: sc.color }]}>
                            {sc.label}
                          </Text>
                        </View>
                      ) : (
                        <Text style={s.tableCellText}>–</Text>
                      )}
                    </View>
                  </View>
                );
              })}

              {/* Footer totals */}
              <View style={s.tableFooter}>
                <View style={s.footerItem}>
                  <Text style={s.footerLabel}>Total Paid</Text>
                  <Text style={[s.footerValue, { color: '#16A34A' }]}>
                    {formatINR(fees.total_paid)}
                  </Text>
                </View>
                <View style={s.footerDivider} />
                <View style={s.footerItem}>
                  <Text style={s.footerLabel}>Total Due</Text>
                  <Text style={[s.footerValue, { color: theme.colors.danger }]}>
                    {formatINR(fees.total_due)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={s.root}>
      <Header title="Transport" onBackPress={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};

export default TransportScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: 36, gap: 14 },

  // States
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: 10,
  },
  // Fills the viewport but stays pull-to-refreshable for the empty/error states.
  centerScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  // Card (exam style)
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: theme.spacing.md, gap: 10 },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  // Pills (exam style)
  pillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },

  // Driver accordion
  driverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  driverHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  driverHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  driverBody: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm,
    padding: 12,
    gap: 10,
  },
  driverTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitial: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  driverEmail: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  driverPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverPhone: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },

  // Info rows
  divider: { height: 1, backgroundColor: theme.colors.border },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },

  // Fare badge
  fareBadge: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  fareBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },

  // Table
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableHead: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    marginBottom: 2,
  },
  tableHeadText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    paddingHorizontal: 4,
  },
  tableCellText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    paddingHorizontal: 4,
  },

  // Status badge (exam style)
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  // Footer
  tableFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  footerValue: { fontSize: 14, fontWeight: '900' },
  footerDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.border,
    marginHorizontal: 8,
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

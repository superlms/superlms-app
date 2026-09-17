import React from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import constant from '../../utils/constant';
import { DocHeader } from '../more/docUi';
import { Words } from '../exam/examUi';
import {
  InfoRow,
  Section,
  TransportState,
  clock,
  formatINR,
  useMyTransport,
} from './transportUi';

/**
 * My Route: the bus the student is on — where it picks them up and drops them,
 * when, what it costs a month, the stops it makes, and who drives it, written
 * as the Exam Detail page writes an exam.
 *
 * A load — the first, a pull to refresh, Try again — draws the page as a
 * skeleton from the route this phone kept, or an ordinary one.
 */

const TITLE = 'My Route';

// Files come from the same host as the API but outside the /api/v1 prefix.
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

const initialsOf = (name?: string | null) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const TransportRouteScreen = ({ navigation }: any) => {
  const { drawn, loading, notUsing, error, blocked, reload } = useMyTransport();

  if (blocked || !drawn) {
    return (
      <TransportState
        title={TITLE}
        notUsing={notUsing}
        error={error}
        onBack={() => navigation.goBack()}
        onRetry={reload}
      />
    );
  }

  const skeleton = loading;
  const data = drawn;
  const driver = data.driver;
  const driverPhoto = resolveFileUrl(driver?.image);
  const vehicle = [driver?.vehicle_no || data.vehicle_no, data.vehicle_type || driver?.vehicle_type]
    .filter(Boolean)
    .join(' · ');
  const stops = data.stops ?? [];
  const monthly = data.fees?.monthly_fee || data.monthly_fee;

  // Only the lines that are actually filled in.
  const rows = [
    ['Monthly Fee', monthly ? formatINR(monthly) : ''],
    ['Pickup Time', clock(data.pickup_time) ?? ''],
    ['Drop Time', clock(data.drop_time) ?? ''],
    ['Pickup Point', data.pickup_location ?? ''],
    ['Drop Point', data.drop_location ?? ''],
    ['Vehicle', vehicle],
  ].filter(([, v]) => !!v) as [string, string][];

  const callDriver = driver?.phone ? () => Linking.openURL(`tel:${driver.phone}`) : undefined;
  const mailDriver = driver?.email ? () => Linking.openURL(`mailto:${driver.email}`) : undefined;

  const driverRows = driver
    ? ([
        ['Phone', driver.phone ?? '', callDriver],
        ['Email', driver.email ?? '', mailDriver],
        ['Licence No.', driver.license_no ?? '', undefined],
      ].filter(([, v]) => !!v) as [string, string, (() => void) | undefined][])
    : [];

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {/* The route, and when it runs */}
        <View style={s.head}>
          <Words skeleton={skeleton} style={s.kicker}>
            SCHOOL TRANSPORT
          </Words>
          <Words skeleton={skeleton} style={s.title}>
            {data.route_name}
          </Words>
          {!!vehicle && (
            <Words skeleton={skeleton} style={s.sub}>
              {vehicle}
            </Words>
          )}
        </View>

        {rows.length > 0 && (
          <View style={s.rows}>
            {rows.map(([label, value], i) => (
              <InfoRow
                key={label}
                label={label}
                value={value}
                last={i === rows.length - 1}
                skeleton={skeleton}
              />
            ))}
          </View>
        )}

        {stops.length > 0 && (
          <Section title="Stops" skeleton={skeleton}>
            {stops.map((stop, i) => (
              <View key={`${stop}-${i}`} style={[s.stopRow, i < stops.length - 1 && s.rowDivider]}>
                <View style={s.stopNo}>
                  <Words skeleton={skeleton} style={s.stopNoText}>
                    {String(i + 1)}
                  </Words>
                </View>
                <Words skeleton={skeleton} style={s.stopName} numberOfLines={2}>
                  {stop}
                </Words>
              </View>
            ))}
          </Section>
        )}

        {!!driver && (
          <Section title="Driver" skeleton={skeleton}>
            <View style={[s.driver, driverRows.length > 0 && s.rowDivider]}>
              {skeleton ? (
                <Skeleton width={40} height={40} radius={20} />
              ) : driverPhoto ? (
                <Image source={{ uri: driverPhoto }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.initials}>{initialsOf(driver.name)}</Text>
                </View>
              )}
              <View style={s.driverBody}>
                <Words skeleton={skeleton} style={s.driverName} numberOfLines={1}>
                  {driver.name || '—'}
                </Words>
                <Words skeleton={skeleton} style={s.driverRole}>
                  {callDriver ? 'Tap the number to call' : 'Driver'}
                </Words>
              </View>
            </View>
            {driverRows.map(([label, value, onPress], i) => (
              <InfoRow
                key={label}
                label={label}
                value={value}
                onPress={onPress}
                last={i === driverRows.length - 1}
                skeleton={skeleton}
              />
            ))}
          </Section>
        )}
      </ScrollView>
    </View>
  );
};

export default TransportRouteScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },

  // What the route is
  head: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: theme.colors.textMuted },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 4 },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },

  rows: { paddingHorizontal: 20, paddingBottom: 6 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },

  // Stops, numbered down the route
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  stopNo: { width: 22, alignItems: 'center' },
  stopNoText: { fontSize: 13, color: theme.colors.textMuted },
  stopName: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },

  // Who drives it
  driver: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.background },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primaryLight },
  initials: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
  driverBody: { flex: 1, gap: 2 },
  driverName: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  driverRole: { fontSize: 13, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

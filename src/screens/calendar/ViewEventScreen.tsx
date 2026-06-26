import React, { useState, useEffect, useCallback } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { TYPE_META } from './calendarTypes';
import type { CalEvent } from './calendarTypes';
import { getEventById } from '../../api/calendarApi';
import type { EventDetail } from '../../api/calendarApi';
import { mapEventType } from '../../api/calendarApi';
import constant from '../../utils/constant';

// Files come from the same host as the API but outside the /api/v1 prefix
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

const ViewEventScreen = ({ navigation, route }: any) => {
  const passedEvent: CalEvent | undefined = route.params?.event;
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!passedEvent?.id) {
      setLoading(false);
      return;
    }
    try {
      const data = await getEventById(passedEvent.id);
      if (data?.id) setDetail(data);
    } catch (err: any) {
      console.log(
        '[ViewEvent] Fetch failed, using passed event:',
        err?.response?.status ?? err?.message,
      );
    } finally {
      setLoading(false);
    }
  }, [passedEvent?.id]);

  const { refreshing, onRefresh } = useRefresh(load);

  useEffect(() => {
    load();
  }, [passedEvent?.id]);

  // Resolve type/colors from either the fetched detail or the passed event
  const type = detail
    ? mapEventType(detail.event_type)
    : passedEvent?.type ?? 'Event';
  const meta = TYPE_META[type];

  const title = detail?.title ?? passedEvent?.title ?? 'Event';
  const description = detail?.description ?? passedEvent?.description ?? '';
  const dateStr = detail?.date ?? passedEvent?.date;
  const dateLabel = dateStr ? moment(dateStr).format('dddd, DD MMM YYYY') : '';
  const timingDisplay =
    detail?.timing_display ??
    (detail?.is_all_day ? 'All Day Event' : undefined) ??
    passedEvent?.time;

  const location = detail?.location;
  const academic = detail?.academic_details;
  const isCancelled = detail?.is_cancelled;

  const creatorName = detail?.creator_name;
  const creatorEmail = detail?.creator_email;
  const creatorAvatar = resolveFileUrl(detail?.creator_avatar);

  if (!passedEvent && !detail) {
    return (
      <View style={s.root}>
        <Header title="View Event" onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <Text style={s.errorText}>Event not found</Text>
        </View>
      </View>
    );
  }

  const Detail = ({
    icon,
    iconSet = 'Feather',
    label,
    value,
  }: {
    icon: string;
    iconSet?: string;
    label: string;
    value?: string | null;
  }) => {
    if (!value) return null;
    return (
      <View style={s.detailRow}>
        <View style={[s.detailIconBox, { backgroundColor: meta.bg }]}>
          <VectorIcon
            iconSet={iconSet as any}
            iconName={icon}
            size={16}
            color={meta.color}
          />
        </View>
        <View style={s.detailTextBox}>
          <Text style={s.detailLabel}>{label}</Text>
          <Text style={s.detailValue}>{value}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <Header title="View Event" onBackPress={() => navigation.goBack()} />

      {loading && !detail ? (
        <View style={s.centeredBox}>
          <ScreenSkeleton variant="detail" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={s.card}>
            <View style={[s.accentStrip, { backgroundColor: meta.color }]} />

            <View style={s.cardInner}>
              {/* Meta row: type + cancelled + timing */}
              <View style={s.metaRow}>
                <View style={[s.tagPill, { backgroundColor: meta.bg }]}>
                  <VectorIcon
                    iconSet={meta.iconSet as any}
                    iconName={meta.icon}
                    size={11}
                    color={meta.color}
                  />
                  <Text style={[s.tagPillText, { color: meta.color }]}>
                    {type}
                  </Text>
                </View>
                {isCancelled && (
                  <View style={[s.tagPill, { backgroundColor: '#FEE2E2' }]}>
                    <View style={s.cancelDot} />
                    <Text style={[s.tagPillText, { color: theme.colors.danger }]}>
                      Cancelled
                    </Text>
                  </View>
                )}
                <View style={s.metaSpacer} />
                {!!timingDisplay && (
                  <View style={s.timeRow}>
                    <VectorIcon
                      iconSet="Feather"
                      iconName="clock"
                      size={12}
                      color={theme.colors.textMuted}
                    />
                    <Text style={s.timeText}>{timingDisplay}</Text>
                  </View>
                )}
              </View>

              {/* Title */}
              <Text style={s.title}>{title}</Text>
              {!!dateLabel && <Text style={s.dateText}>{dateLabel}</Text>}

              <View style={s.divider} />

              {/* Description */}
              <Text style={s.sectionLabel}>Description</Text>
              <Text style={s.bodyText}>
                {description || 'No description available'}
              </Text>

              {/* Cancellation reason */}
              {isCancelled && !!detail?.cancellation_reason && (
                <>
                  <View style={s.divider} />
                  <Text style={s.sectionLabel}>Cancellation Reason</Text>
                  <Text style={s.bodyText}>{detail.cancellation_reason}</Text>
                </>
              )}

              {/* Details */}
              {(location?.full_address ||
                academic?.standard ||
                academic?.section ||
                academic?.subject ||
                academic?.teacher) && (
                <>
                  <View style={s.divider} />
                  <Text style={s.sectionLabel}>Details</Text>
                  <View style={s.detailList}>
                    <Detail
                      icon="map-pin"
                      label="Location"
                      value={location?.full_address}
                    />
                    <Detail
                      icon="book"
                      label="Subject"
                      value={academic?.subject?.name}
                    />
                    <Detail
                      icon="users"
                      iconSet="Feather"
                      label="Class"
                      value={
                        academic?.standard || academic?.section
                          ? [academic?.standard?.name, academic?.section?.name]
                              .filter(Boolean)
                              .join(' - ')
                          : undefined
                      }
                    />
                    <Detail
                      icon="user"
                      label="Teacher"
                      value={academic?.teacher?.name}
                    />
                  </View>
                </>
              )}

              {/* Posted by */}
              {!!creatorName && (
                <>
                  <View style={s.divider} />
                  <Text style={s.sectionLabel}>Posted By</Text>
                  <View style={s.creatorRow}>
                    {creatorAvatar ? (
                      <Image
                        source={{ uri: creatorAvatar }}
                        style={s.creatorAvatar}
                      />
                    ) : (
                      <View
                        style={[s.creatorAvatar, { backgroundColor: meta.bg }]}
                      >
                        <Text style={[s.creatorInitial, { color: meta.color }]}>
                          {creatorName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={s.creatorInfo}>
                      <Text style={s.creatorName}>{creatorName}</Text>
                      {!!creatorEmail && (
                        <Text style={s.creatorEmail}>{creatorEmail}</Text>
                      )}
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default ViewEventScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  centeredBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  accentStrip: { height: 5 },
  cardInner: { padding: 18 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  metaSpacer: { flex: 1 },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: theme.radius.full,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  tagPillText: { fontSize: 12, fontWeight: '700' },
  cancelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.danger,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    lineHeight: 28,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 16,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    lineHeight: 25,
  },

  detailList: { gap: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTextBox: { flex: 1 },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },

  // Creator ("Posted By")
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  creatorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorInitial: { fontSize: 17, fontWeight: '800' },
  creatorInfo: { flex: 1 },
  creatorName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  creatorEmail: { fontSize: 13, color: theme.colors.textSecondary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

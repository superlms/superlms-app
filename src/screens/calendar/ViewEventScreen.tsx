import React, { useState, useEffect, useCallback } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import type { CalEvent } from './calendarTypes';
import { DetailRow } from './calendarUi';
import { getEventById, mapEventType } from '../../api/calendarApi';
import type { EventDetail } from '../../api/calendarApi';
import { DocHeader, DocSection, DocBody, DocLoading, docStyles } from '../more/docUi';
import constant from '../../utils/constant';

const TITLE = 'Event';

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

  // The event passed from the calendar shows straight away; this fills in the
  // parts only the detail endpoint knows about.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passedEvent?.id]);

  const type = detail ? mapEventType(detail.event_type) : passedEvent?.type ?? 'Event';
  const title = detail?.title ?? passedEvent?.title ?? 'Event';
  const description = detail?.description ?? passedEvent?.description ?? '';
  const dateStr = detail?.date ?? passedEvent?.date;
  const dateLabel = dateStr ? moment(dateStr).format('dddd, DD MMM YYYY') : '';
  const timingDisplay =
    detail?.timing_display ??
    (detail?.is_all_day ? 'All day' : undefined) ??
    passedEvent?.time;

  const location = detail?.location;
  const academic = detail?.academic_details;
  const isCancelled = detail?.is_cancelled;

  const creatorName = detail?.creator_name;
  const creatorEmail = detail?.creator_email;
  const creatorAvatar = resolveFileUrl(detail?.creator_avatar);

  const classLabel =
    academic?.standard || academic?.section
      ? [academic?.standard?.name, academic?.section?.name].filter(Boolean).join(' - ')
      : undefined;

  const details = [
    ['Location', location?.full_address],
    ['Subject', academic?.subject?.name],
    ['Class', classLabel],
    ['Teacher', academic?.teacher?.name],
  ].filter(([, v]) => !!v) as [string, string][];

  // Nothing to show yet: wait for the fetch before saying the event is missing.
  if (loading && !detail && !passedEvent) return <DocLoading title={TITLE} />;

  if (!passedEvent && !detail) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <Text style={s.mutedText}>Event not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={docStyles.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={docStyles.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Type, title, when */}
        <View>
          <Text style={s.metaText}>
            {type}
            {timingDisplay ? ` · ${timingDisplay}` : ''}
          </Text>
          <Text style={s.title}>{title}</Text>
          {!!dateLabel && <Text style={s.dateText}>{dateLabel}</Text>}
          {isCancelled && <Text style={s.cancelled}>Cancelled</Text>}
        </View>

        {/* Description */}
        <DocSection title="Description">
          <DocBody>{description || 'No description available.'}</DocBody>
        </DocSection>

        {/* Why it was called off */}
        {isCancelled && !!detail?.cancellation_reason && (
          <DocSection title="Cancellation Reason">
            <DocBody>{detail.cancellation_reason}</DocBody>
          </DocSection>
        )}

        {/* Where, what and who — only the parts that are filled in */}
        {details.length > 0 && (
          <DocSection title="Details">
            <View style={s.detailList}>
              {details.map(([label, value], i) => (
                <DetailRow
                  key={label}
                  label={label}
                  value={value}
                  last={i === details.length - 1}
                />
              ))}
            </View>
          </DocSection>
        )}

        {/* Posted by */}
        {!!creatorName && (
          <>
            <View style={s.divider} />
            <DocSection title="Posted By">
              <View style={s.creatorRow}>
                {creatorAvatar ? (
                  <Image source={{ uri: creatorAvatar }} style={s.creatorAvatar} />
                ) : (
                  <View style={[s.creatorAvatar, s.creatorAvatarFallback]}>
                    <Text style={s.creatorInitial}>{creatorName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={s.creatorInfo}>
                  <Text style={s.creatorName}>{creatorName}</Text>
                  {!!creatorEmail && <Text style={s.creatorEmail}>{creatorEmail}</Text>}
                </View>
              </View>
            </DocSection>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default ViewEventScreen;

const __mk_s = () => StyleSheet.create({
  centeredBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mutedText: { fontSize: 14, color: theme.colors.textMuted },

  // Meta + title
  metaText: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 27 },
  dateText: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  cancelled: { fontSize: 13, fontWeight: '600', color: theme.colors.danger, marginTop: 8 },

  // Details
  detailList: { marginTop: -6 },

  // Line before who posted it
  divider: { height: 1, backgroundColor: theme.colors.border },

  // Creator
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  creatorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.background },
  creatorAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  creatorInitial: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  creatorInfo: { flex: 1 },
  creatorName: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  creatorEmail: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

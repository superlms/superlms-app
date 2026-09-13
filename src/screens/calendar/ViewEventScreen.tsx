import React, { useState, useEffect, useCallback } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import type { CalEvent } from './calendarTypes';
import { DetailRow } from './calendarUi';
import { getEventById, mapEventType } from '../../api/calendarApi';
import type { EventDetail } from '../../api/calendarApi';
import { DocHeader, DocSection, DocBody, docStyles } from '../more/docUi';
import { INK, QUIET } from '../notification/inboxUi';
import constant from '../../utils/constant';

const TITLE = 'Event';

// Files come from the same host as the API but outside the /api/v1 prefix
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

// "09:00:00" → "9:00 AM"
const clock = (t?: string | null) => (t ? moment(t, 'HH:mm:ss').format('h:mm A') : '');

// ── Loading ──────────────────────────────────────────────────────────────────
// The page line for line: the type/date line, the timing, the title, the
// Description heading and text, the rule, then Posted By — each box at the
// height of the text it stands in for.
const BODY_W = ['100%', '94%', '97%', '58%'];

const DetailSkeleton = () => (
  <View style={docStyles.scroll}>
    <View>
      <View style={[s.skLine, s.skMeta]}>
        <Skeleton width={190} height={10} />
      </View>
      <View style={[s.skLine, s.skMeta, s.skTiming]}>
        <Skeleton width={120} height={10} />
      </View>
      <View style={[s.skLine, s.skTitle]}>
        <Skeleton width="70%" height={18} />
      </View>
    </View>

    <View>
      <View style={[s.skLine, s.skSection]}>
        <Skeleton width={100} height={14} />
      </View>
      {BODY_W.map((w, i) => (
        <View key={i} style={[s.skLine, s.skBody]}>
          <Skeleton width={w} height={12} />
        </View>
      ))}
    </View>

    <View style={s.divider} />

    <View>
      <View style={[s.skLine, s.skSection]}>
        <Skeleton width={84} height={14} />
      </View>
      <View style={s.creatorRow}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={s.creatorInfo}>
          <View style={[s.skLine, s.skName]}>
            <Skeleton width={56} height={12} />
          </View>
          <View style={[s.skLine, s.skSub]}>
            <Skeleton width={150} height={10} />
          </View>
        </View>
      </View>
    </View>
  </View>
);

const ViewEventScreen = ({ navigation, route }: any) => {
  // From the calendar the event shows at once and the detail fills in the rest.
  // Opened by id alone it is fetched, with the skeleton meanwhile.
  const passedEvent: CalEvent | undefined = route.params?.event;
  const rawId = passedEvent?.id ?? route.params?.id;
  const id: string | undefined = rawId != null ? String(rawId) : undefined;

  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(!passedEvent && !!id);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const data = await getEventById(id);
      if (data?.id) setDetail(data);
    } catch (err: any) {
      console.log('[ViewEvent] Fetch failed:', err?.response?.status ?? err?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Pulling to refresh shows the skeleton again while the page reloads.
  const { refreshing, onRefresh } = useRefresh(async () => {
    setLoading(true);
    await load();
  });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const type = detail ? mapEventType(detail.event_type) : passedEvent?.type ?? 'Event';
  const title = detail?.title ?? passedEvent?.title ?? 'Event';
  const description = detail?.description ?? passedEvent?.description ?? '';
  const dateStr = detail?.date ?? passedEvent?.date;
  const isAllDay = detail ? detail.is_all_day : passedEvent?.isAllDay;

  // "Exam · 13 Sep 2026 · Saturday"
  const headLine = [
    type,
    dateStr ? moment(dateStr).format('D MMM YYYY') : null,
    dateStr ? moment(dateStr).format('dddd') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // "All day event", or "9:00 AM – 10:00 AM"
  const timing = isAllDay
    ? 'All day event'
    : detail?.start_time
    ? [clock(detail.start_time), clock(detail.end_time)].filter(Boolean).join(' – ')
    : passedEvent?.time;

  const location = detail?.location;
  const academic = detail?.academic_details;
  const isCancelled = detail?.is_cancelled;

  const creatorAvatar = resolveFileUrl(detail?.creator_avatar);
  // Older servers send no school name; the admin account's own name is the
  // school's there.
  const schoolName = detail?.organization_name || detail?.creator_name;

  const classLabel =
    academic?.standard || academic?.section
      ? [academic?.standard?.name, academic?.section?.name].filter(Boolean).join(' - ')
      : undefined;

  // Where and for whom — only the lines that are actually filled in.
  const rows = [
    ['Location', location?.full_address],
    ['Class', classLabel],
    ['Subject', academic?.subject?.name],
    ['Teacher', academic?.teacher?.name],
  ].filter(([, v]) => !!v) as [string, string][];

  if (loading) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <DetailSkeleton />
      </View>
    );
  }

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
        {/* Type, date and day; the timing; then the title */}
        <View>
          {!!headLine && <Text style={s.metaText}>{headLine}</Text>}
          {!!timing && <Text style={[s.metaText, s.timing]}>{timing}</Text>}
          <Text style={s.title}>{title}</Text>
          {isCancelled && <Text style={s.cancelled}>Cancelled</Text>}
        </View>

        <DocSection title="Description">
          <DocBody>{description || 'No description available'}</DocBody>
        </DocSection>

        {isCancelled && !!detail?.cancellation_reason && (
          <DocSection title="Cancellation Reason">
            <DocBody>{detail.cancellation_reason}</DocBody>
          </DocSection>
        )}

        {rows.length > 0 && (
          <DocSection title="Details">
            {rows.map(([label, value], i) => (
              <DetailRow key={label} label={label} value={value} last={i === rows.length - 1} />
            ))}
          </DocSection>
        )}

        {/* Posted by — "Admin", with the school's name under it */}
        {!!detail?.creator_name && (
          <>
            <View style={s.divider} />
            <DocSection title="Posted By">
              <View style={s.creatorRow}>
                {creatorAvatar ? (
                  <Image source={{ uri: creatorAvatar }} style={s.creatorAvatar} />
                ) : (
                  <View style={[s.creatorAvatar, s.creatorAvatarFallback]}>
                    <Text style={s.creatorInitial}>A</Text>
                  </View>
                )}
                <View style={s.creatorInfo}>
                  <Text style={s.creatorName}>Admin</Text>
                  {!!schoolName && <Text style={s.creatorSub}>{schoolName}</Text>}
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

  // Head: type · date · day, the timing, the title
  metaText: { fontSize: 12, color: QUIET },
  timing: { marginTop: 2 },
  title: { fontSize: 20, fontWeight: '700', color: INK, lineHeight: 27, marginTop: 6 },
  cancelled: { fontSize: 13, fontWeight: '600', color: theme.colors.danger, marginTop: 6 },

  // Line before who posted it
  divider: { height: 1, backgroundColor: theme.colors.border },

  // Creator
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  creatorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.background },
  creatorAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  creatorInitial: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  creatorInfo: { flex: 1 },
  creatorName: { fontSize: 15, fontWeight: '500', color: INK },
  creatorSub: { fontSize: 13, color: QUIET, marginTop: 2 },

  // Skeleton boxes, at the heights of the real lines: meta 12px, title 20/27,
  // section heading 17px, body 15/24, name 15px, school 13px.
  skLine: { justifyContent: 'center' },
  skMeta: { height: 16 },
  skTiming: { marginTop: 2 },
  skTitle: { height: 27, marginTop: 6 },
  skSection: { height: 23, marginBottom: 8 },
  skBody: { height: 24 },
  skName: { height: 20 },
  skSub: { height: 18, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

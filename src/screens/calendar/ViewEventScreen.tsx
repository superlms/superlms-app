import React, { useState, useEffect, useCallback } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { AttachmentChips, INK, QUIET } from '../notification/inboxUi';
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
//
// With the event already known (pulling to refresh) the skeleton is that
// event's own page: the title and description wrapped as they read, the
// attachment chip, the cancellation, one row per detail, and Posted By only
// where there is one.
const BODY_W = ['100%', '94%', '97%', '58%'];
// The wrapped lines of a paragraph before its last one run nearly to the edge.
const FULL_W = [1, 0.95, 0.98, 0.92, 0.97];

// About how wide one character is: meta 12px, title 20px bold, body 15px,
// detail 14px, school name 13px.
const CHAR_W = { meta: 6.1, title: 12.3, body: 7.6, detail: 7.3, sub: 6.6 };

const fit = (len: number, charW: number, maxW: number) => Math.min(Math.max(2, len) * charW, maxW);

// A text's lines as drawn at `maxW`: one width per line, 0 for a blank line.
const lineWidths = (text: string, charW: number, maxW: number) => {
  const perLine = Math.max(8, Math.floor(maxW / charW));
  const rows: number[] = [];
  text.split('\n').forEach(line => {
    const len = line.trim().length;
    if (len === 0) {
      rows.push(0);
      return;
    }
    const count = Math.ceil(len / perLine);
    for (let i = 1; i < count; i++) rows.push(Math.round(maxW * FULL_W[rows.length % FULL_W.length]));
    rows.push(fit(len - (count - 1) * perLine, charW, maxW));
  });
  return rows;
};

/** The event's page as it stands, for its skeleton. */
interface PageShape {
  headLine: string;
  timing?: string;
  title: string;
  cancelled: boolean;
  description: string;
  attachment?: 'pdf' | 'image';
  cancellation?: string;
  rows: [string, string][];
  /** The school named under "Admin"; absent when the page has no Posted By. */
  school?: string;
}

const SectionHeadSkeleton = ({ width }: { width: number }) => (
  <View style={[s.skLine, s.skSection]}>
    <Skeleton width={width} height={14} />
  </View>
);

// Who posted it: the round photo, "Admin", and the school's name under it.
const PostedBySkeleton = ({ schoolWidth = 150 }: { schoolWidth?: number }) => (
  <View>
    <SectionHeadSkeleton width={84} />
    <View style={s.creatorRow}>
      <Skeleton width={40} height={40} radius={20} />
      <View style={s.creatorInfo}>
        <View style={[s.skLine, s.skName]}>
          <Skeleton width={56} height={12} />
        </View>
        {schoolWidth > 0 && (
          <View style={[s.skLine, s.skSub]}>
            <Skeleton width={schoolWidth} height={10} />
          </View>
        )}
      </View>
    </View>
  </View>
);

const DetailSkeleton = ({ shape }: { shape?: PageShape }) => {
  const { width } = useWindowDimensions();
  const textW = width - 40;
  // Details: the label takes 40% of the line, the value the rest.
  const labelW = textW * 0.4 - 12;
  const valueW = textW * 0.6;

  const titleRows: (number | string)[] = shape ? lineWidths(shape.title, CHAR_W.title, textW) : ['70%'];
  const bodyRows: (number | string)[] = shape
    ? lineWidths(shape.description || 'No description available', CHAR_W.body, textW).slice(0, 40)
    : BODY_W;
  // Beside the 40px photo and its gap; no line when the school is unnamed.
  const schoolWidth = !shape ? 150 : shape.school ? fit(shape.school.length, CHAR_W.sub, textW - 52) : 0;

  return (
    <View style={s.skRoot}>
      <View style={docStyles.scroll}>
        <View>
          <View style={[s.skLine, s.skMeta]}>
            <Skeleton width={shape ? fit(shape.headLine.length, CHAR_W.meta, textW) : 190} height={10} />
          </View>
          {(!shape || !!shape.timing) && (
            <View style={[s.skLine, s.skMeta, s.skTiming]}>
              <Skeleton width={shape?.timing ? fit(shape.timing.length, CHAR_W.meta, textW) : 120} height={10} />
            </View>
          )}
          {titleRows.map((w, i) => (
            <View key={i} style={[s.skLine, s.skTitle, i === 0 && s.skTitleFirst]}>
              <Skeleton width={w} height={18} />
            </View>
          ))}
          {shape?.cancelled && (
            <View style={[s.skLine, s.skCancelled]}>
              <Skeleton width={64} height={11} />
            </View>
          )}
        </View>

        <View>
          <SectionHeadSkeleton width={100} />
          {bodyRows.map((w, i) => (
            <View key={i} style={[s.skLine, s.skBody]}>
              {!!w && <Skeleton width={w} height={12} />}
            </View>
          ))}
          {!!shape?.attachment && (
            <View style={s.skChips}>
              <Skeleton width={shape.attachment === 'pdf' ? 88 : 100} height={32} radius={16} />
            </View>
          )}
        </View>

        {!!shape?.cancellation && (
          <View>
            <SectionHeadSkeleton width={176} />
            {lineWidths(shape.cancellation, CHAR_W.body, textW)
              .slice(0, 12)
              .map((w, i) => (
                <View key={i} style={[s.skLine, s.skBody]}>
                  {!!w && <Skeleton width={w} height={12} />}
                </View>
              ))}
          </View>
        )}

        {!!shape && shape.rows.length > 0 && (
          <View>
            <SectionHeadSkeleton width={64} />
            {shape.rows.map(([label, value], i) => (
              <View key={label} style={[s.skDetailRow, i < shape.rows.length - 1 && s.skDetailDivider]}>
                <View style={[s.skLine, s.skDetailLabel]}>
                  <Skeleton width={fit(label.length, CHAR_W.detail, labelW)} height={11} />
                </View>
                <View style={s.skDetailValue}>
                  {lineWidths(value, CHAR_W.detail, valueW).map((w, j) => (
                    <View key={j} style={[s.skLine, s.skDetailLine]}>
                      {!!w && <Skeleton width={w} height={11} />}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {(!shape || shape.school !== undefined) && (
          <>
            <View style={s.divider} />
            <PostedBySkeleton schoolWidth={schoolWidth} />
          </>
        )}
      </View>
    </View>
  );
};

const ViewEventScreen = ({ navigation, route }: any) => {
  // From the calendar the event shows at once and the detail fills in the rest.
  // Opened by id alone it is fetched, with the skeleton meanwhile.
  const passedEvent: CalEvent | undefined = route.params?.event;
  const rawId = passedEvent?.id ?? route.params?.id;
  const id: string | undefined = rawId != null ? String(rawId) : undefined;

  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(!passedEvent && !!id);
  // The first fetch has answered, one way or the other.
  const [fetched, setFetched] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!id) return;
      const data = await getEventById(id);
      if (data?.id) setDetail(data);
    } catch (err: any) {
      console.log('[ViewEvent] Fetch failed:', err?.response?.status ?? err?.message);
    } finally {
      setLoading(false);
      setFetched(true);
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
  const attachmentUrl = resolveFileUrl(detail?.attachment);

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

  // The page as it stands, once any of the event is known — the skeleton's shape.
  const shape: PageShape | undefined =
    passedEvent || detail
      ? {
          headLine,
          timing: timing || undefined,
          title,
          cancelled: !!isCancelled,
          description,
          attachment: attachmentUrl ? (/\.pdf(\?|#|$)/i.test(attachmentUrl) ? 'pdf' : 'image') : undefined,
          cancellation: (isCancelled && detail?.cancellation_reason) || undefined,
          rows,
          school: detail?.creator_name ? schoolName ?? '' : undefined,
        }
      : undefined;

  if (loading) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <DetailSkeleton shape={shape} />
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

        {/* Description, with the attachment right under it */}
        <DocSection title="Description">
          <DocBody>{description || 'No description available'}</DocBody>
          <AttachmentChips
            // A tap saves the file to Downloads, named after the event
            downloadAs={title}
            items={[{ url: attachmentUrl }]}
          />
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

        {/* Who posted it comes with the event's detail; its outline holds the place meanwhile */}
        {!detail && !fetched && (
          <>
            <View style={s.divider} />
            <PostedBySkeleton />
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
  // cancelled 13px, section heading 17px, body 15/24, attachment chip, detail
  // rows 14px, name 15px, school 13px. Clipped at the bottom of the screen.
  skRoot: { flex: 1, overflow: 'hidden' },
  skLine: { justifyContent: 'center' },
  skMeta: { height: 16 },
  skTiming: { marginTop: 2 },
  skTitle: { height: 27 },
  skTitleFirst: { marginTop: 6 },
  skCancelled: { height: 18, marginTop: 6 },
  skSection: { height: 23, marginBottom: 8 },
  skBody: { height: 24 },
  skChips: { flexDirection: 'row', marginTop: 14 },
  skDetailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
  skDetailDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  skDetailLabel: { width: '40%', height: 20, paddingRight: 12 },
  skDetailValue: { flex: 1 },
  skDetailLine: { height: 20 },
  skName: { height: 20 },
  skSub: { height: 18, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

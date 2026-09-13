import React from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { AppAlert } from '../../components/AppDialog';
import { useDocumentDownload } from '../more/docUi';

// The shared look of the inbox-style lists — Notifications, Announcements and
// calendar events: filter pills, day headings, rows led by a round icon, and
// the attachment chips on their detail pages.

// A step darker than the theme's text colours, so these lists read crisply.
export const INK = '#0F172A';   // titles
export const BODY = '#475569';  // descriptions, tabs, day headings
export const QUIET = '#64748B'; // times, counts, kinds

// "3 mins ago" / "2 hrs ago".
const relativeTime = (ts: number): string => {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min${min > 1 ? 's' : ''} ago`;
  const hr = Math.floor(min / 60);
  return `${hr} hr${hr > 1 ? 's' : ''} ago`;
};

// Today's items say how long ago; older ones, the time of day — the day itself
// is in the heading above them.
export const timeLabel = (ts: number) =>
  moment(ts).isSame(moment(), 'day') ? relativeTime(ts) : moment(ts).format('h:mm A');

export const dayHeading = (ts: number) => {
  const d = moment(ts);
  if (d.isSame(moment(), 'day')) return 'Today';
  if (d.isSame(moment().subtract(1, 'day'), 'day')) return 'Yesterday';
  return d.isSame(moment(), 'year') ? d.format('ddd, D MMM') : d.format('D MMM YYYY');
};

export interface DaySection<T> {
  title: string;
  data: T[];
}

// Newest first, gathered under a heading per day.
export function groupByDay<T>(items: T[], at: (item: T) => number): DaySection<T>[] {
  const sections: DaySection<T>[] = [];
  [...items]
    .sort((a, b) => at(b) - at(a))
    .forEach(item => {
      const title = dayHeading(at(item));
      const last = sections[sections.length - 1];
      if (last && last.title === title) last.data.push(item);
      else sections.push({ title, data: [item] });
    });
  return sections;
}

// ── Filter pills, with their totals when given ───────────────────────────────
export interface PillOption<K extends string> {
  key: K;
  label: string;
  count?: number;
}

export function FilterPills<K extends string>({
  options,
  active,
  onChange,
  compact,
}: {
  options: PillOption<K>[];
  active: K;
  onChange: (key: K) => void;
  /** Narrower pills — a little less padding either side of the label. */
  compact?: boolean;
}) {
  return (
    <View style={s.pills}>
      {options.map(o => {
        const on = o.key === active;
        return (
          <TouchableOpacity
            key={o.key}
            activeOpacity={0.7}
            onPress={() => onChange(o.key)}
            style={[s.pill, compact && s.pillCompact, on && s.pillActive]}
          >
            <Text style={[s.pillText, on && s.pillTextActive]}>
              {o.label}
              {o.count !== undefined && ' '}
              {o.count !== undefined && (
                <Text style={[s.pillCount, on && s.pillTextActive]}>{o.count}</Text>
              )}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const DayHeading = ({ title }: { title: string }) => <Text style={s.dayHead}>{title}</Text>;

// ── One item ─────────────────────────────────────────────────────────────────
// A round icon centred on the row, the title, one line of description running
// to the right edge, and the kind and/or time on the last line. While picking
// rows the icon's slot holds a small tick instead, so the text never shifts.
//   (📣)  Exam Schedule Released
//         The mid-term timetable has been published for all …
//         Exam · 2 hrs ago
export const InboxRow = ({
  icon,
  title,
  body,
  kind,
  time,
  highlight,
  tinted,
  dot,
  attachment,
  isLast,
  selectionMode = false,
  selected = false,
  onPress,
  onLongPress,
}: {
  icon: string;
  title: string;
  body?: string;
  kind?: string;
  time?: string;
  /** Unread: tinted icon, bold title, time in the accent colour. */
  highlight?: boolean;
  /** Tint the icon circle whatever the state, so every row looks alike. */
  tinted?: boolean;
  /** A green dot on the icon — unread, where the row is otherwise alike. */
  dot?: boolean;
  attachment?: boolean;
  isLast: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) => {
  const tint = highlight || tinted;

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider, selected && s.rowSelected]}
      activeOpacity={0.6}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
    >
      <View style={s.leadSlot}>
        {selectionMode ? (
          <View style={[s.check, selected ? s.checkOn : s.checkOff]}>
            {selected && (
              <VectorIcon iconSet="Ionicons" iconName="checkmark" size={13} color={theme.colors.white} />
            )}
          </View>
        ) : (
          <View style={[s.lead, tint ? s.leadOn : s.leadOff]}>
            <VectorIcon
              iconSet="Ionicons"
              iconName={icon}
              size={17}
              color={tint ? theme.colors.primary : BODY}
            />
            {dot && <View style={s.dot} />}
          </View>
        )}
      </View>

      <View style={s.body}>
        <Text style={[s.title, highlight && s.titleOn]} numberOfLines={1}>
          {title}
        </Text>

        {!!body && (
          <Text style={s.preview} numberOfLines={1}>
            {body}
          </Text>
        )}

        {(!!kind || !!time || attachment) && (
          <View style={s.metaLine}>
            <Text style={s.meta} numberOfLines={1}>
              {kind}
              {!!kind && !!time && ' · '}
              {!!time && <Text style={highlight ? s.timeOn : undefined}>{time}</Text>}
            </Text>
            {attachment && <VectorIcon iconSet="Feather" iconName="paperclip" size={11} color={QUIET} />}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ── Attachments on a detail page ─────────────────────────────────────────────
// A chip per file — its kind's icon and label — that opens the file straight
// away in the phone's viewer or browser, or, where the page asks for it, saves
// it to the phone's Downloads instead.
type AttachmentKind = 'image' | 'pdf';

const kindOf = (url: string): AttachmentKind => (/\.pdf(\?|#|$)/i.test(url) ? 'pdf' : 'image');

export const AttachmentChip = ({
  url,
  kind,
  onDownload,
  busy,
}: {
  url: string;
  kind?: AttachmentKind;
  // Given, a tap saves the file instead of opening it.
  onDownload?: () => void;
  // A download of this file is running.
  busy?: boolean;
}) => {
  const k = kind ?? kindOf(url);
  const open = async () => {
    try {
      await Linking.openURL(url);
    } catch {
      AppAlert.alert('Error', 'Unable to open this file on this device.');
    }
  };

  return (
    <TouchableOpacity style={s.chip} activeOpacity={0.7} disabled={busy} onPress={onDownload ?? open}>
      <VectorIcon
        iconSet="Feather"
        iconName={k === 'pdf' ? 'file-text' : 'image'}
        size={14}
        color={theme.colors.primary}
      />
      <Text style={s.chipText} numberOfLines={1}>
        {k === 'pdf' ? 'PDF' : 'Image'}
      </Text>
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.textMuted} style={s.chipSpinner} />
      ) : (
        <VectorIcon
          iconSet="Feather"
          iconName={onDownload ? 'download' : 'external-link'}
          size={12}
          color={theme.colors.textMuted}
        />
      )}
    </TouchableOpacity>
  );
};

/**
 * The chips for whichever files are present; nothing at all when none are.
 * With `downloadAs` — the name to save under, e.g. the announcement's title —
 * a tap downloads the file instead of opening it.
 */
export const AttachmentChips = ({
  items,
  downloadAs,
}: {
  items: { url?: string | null; kind?: AttachmentKind }[];
  downloadAs?: string;
}) => {
  const { downloading, download } = useDocumentDownload();
  const present = items.filter(i => !!i.url) as { url: string; kind?: AttachmentKind }[];
  if (present.length === 0) return null;
  return (
    <View style={s.chips}>
      {present.map(i => {
        const k = i.kind ?? kindOf(i.url);
        return (
          <AttachmentChip
            key={i.url}
            url={i.url}
            kind={k}
            busy={downloading === i.url}
            onDownload={
              downloadAs !== undefined
                ? () => download(i.url, downloadAs || (k === 'pdf' ? 'PDF' : 'Image'), i.url, k === 'pdf' ? 'pdf' : 'jpg')
                : undefined
            }
          />
        );
      })}
    </View>
  );
};

// ── Loading ──────────────────────────────────────────────────────────────────
// Each box at the height of the text it stands in for, so nothing moves when
// the list arrives.
const TITLE_W = ['62%', '48%', '70%', '55%', '66%', '44%'];
const BODY_W = ['88%', '76%', '92%', '70%', '84%', '80%'];

/** One row's skeleton: the round icon, the title, the description, the last line. */
export const InboxRowSkeleton = ({
  index,
  isLast,
  metaWidth = 96,
}: {
  index: number;
  isLast: boolean;
  metaWidth?: number;
}) => (
  <View style={[s.row, !isLast && s.rowDivider]}>
    <View style={s.leadSlot}>
      <Skeleton width={36} height={36} radius={18} />
    </View>
    <View style={s.body}>
      <View style={s.skTitle}>
        <Skeleton width={TITLE_W[index % TITLE_W.length]} height={13} />
      </View>
      <View style={s.skPreview}>
        <Skeleton width={BODY_W[index % BODY_W.length]} height={11} />
      </View>
      <View style={s.skMeta}>
        <Skeleton width={metaWidth} height={9} />
      </View>
    </View>
  </View>
);

/** The pills, the rule, a day heading and a run of rows. */
export const InboxSkeleton = ({
  pillWidths,
  trailing,
  metaWidth = 96,
  rows = 7,
}: {
  /** Width of each filter pill the screen shows. */
  pillWidths: number[];
  /** A link on the right of the pills (e.g. "Mark all read"). */
  trailing?: boolean;
  /** Width of the last line (kind · time). */
  metaWidth?: number;
  rows?: number;
}) => (
  <View>
    <View style={s.metaBar}>
      <View style={s.pills}>
        {pillWidths.map((w, i) => (
          <Skeleton key={i} width={w} height={28} radius={14} />
        ))}
      </View>
      {trailing && <Skeleton width={84} height={12} />}
    </View>
    <View style={s.fullDivider} />

    <View style={s.skList}>
      <View style={s.skDayHead}>
        <Skeleton width={64} height={11} />
      </View>
      {Array.from({ length: rows }, (_, i) => (
        <InboxRowSkeleton key={i} index={i} isLast={i === rows - 1} metaWidth={metaWidth} />
      ))}
    </View>
  </View>
);

const __mk_s = () => StyleSheet.create({
  // Bar over the list: pills on the left, a count or link on the right
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  metaBarText: { fontSize: 13, color: QUIET },
  linkText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // List — grows to the full height so the empty part below it takes taps.
  list: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 30 },

  // Pills
  pills: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1, gap: 6 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillCompact: { paddingHorizontal: 8 },
  pillActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  pillText: { fontSize: 12, fontWeight: '500', color: BODY },
  pillCount: { fontWeight: '700', color: INK },
  pillTextActive: { color: theme.colors.primary },

  dayHead: { paddingTop: 18, paddingBottom: 2, fontSize: 13, fontWeight: '600', color: BODY },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  // Full-bleed highlight: the row's own padding stops at the page margin.
  rowSelected: {
    backgroundColor: theme.colors.background,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  leadSlot: { width: 36, alignItems: 'center', justifyContent: 'center' },
  lead: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  leadOff: { backgroundColor: theme.colors.background },
  leadOn: { backgroundColor: theme.colors.primaryLight },
  // Unread dot on the icon's upper right, ringed in the page colour.
  dot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.card,
  },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  checkOff: { borderWidth: 1.5, borderColor: theme.colors.border },
  checkOn: { backgroundColor: theme.colors.primary },

  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '500', color: INK },
  titleOn: { fontWeight: '700' },
  preview: { fontSize: 13, lineHeight: 18, color: BODY },
  // Kind and time share the last line, in small type.
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  meta: { flexShrink: 1, fontSize: 11, color: QUIET },
  timeOn: { color: theme.colors.primary, fontWeight: '500' },

  // Attachment chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 200,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  // Scaled to the 12px icon it stands in for, so the chip keeps its size.
  chipSpinner: { width: 12, height: 12, transform: [{ scale: 0.6 }] },

  // Skeleton boxes, at the heights of the real lines
  skList: { paddingHorizontal: 20 },
  skDayHead: { height: 38, paddingTop: 18, paddingBottom: 2, justifyContent: 'center' },
  skTitle: { height: 20, justifyContent: 'center' },
  skPreview: { height: 18, justifyContent: 'center' },
  skMeta: { height: 15, marginTop: 1, justifyContent: 'center' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

export { s as inboxStyles };

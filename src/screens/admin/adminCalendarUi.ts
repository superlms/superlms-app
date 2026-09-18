import moment from 'moment';
import type { AdminEvent, EventType } from '../../api/adminContentApi';
import { capitalize } from '../calendar/calendarUi';

/**
 * What the admin calendar screens share: the admin panel's event types and its
 * colour palette, each type's icon (the student calendar's where they meet),
 * and how an event's day and time are written.
 */

export const EVENT_TYPES: { key: EventType; label: string; icon: string }[] = [
  { key: 'class', label: 'Class', icon: 'book' },
  { key: 'exam', label: 'Exam', icon: 'school' },
  { key: 'meeting', label: 'Meeting', icon: 'people' },
  { key: 'event', label: 'Event', icon: 'calendar' },
  { key: 'holiday', label: 'Holiday', icon: 'sunny' },
];

export const typeLabel = (t?: string | null) =>
  EVENT_TYPES.find(e => e.key === t)?.label ?? (capitalize(t) || 'Event');

export const typeIcon = (t?: string | null) => EVENT_TYPES.find(e => e.key === t)?.icon ?? 'calendar';

/**
 * The panel's twelve swatches — distinct hues, none near white — and the blue
 * a new event starts on.
 */
export const EVENT_COLORS = [
  '#E6194B', // red
  '#F58231', // orange
  '#FFE119', // yellow
  '#BFEF45', // lime
  '#3CB44B', // green
  '#469990', // teal
  '#42D4F4', // cyan
  '#4363D8', // blue
  '#911EB4', // purple
  '#F032E6', // magenta
  '#9A6324', // brown
  '#808080', // grey
];
export const DEFAULT_EVENT_COLOR = '#4363D8';

// "09:00" → "9:00 AM"
const clock = (t?: string | null) => (t ? moment(t, ['HH:mm:ss', 'HH:mm']).format('h:mm A') : '');

/** "All day event", or "9:00 AM – 10:00 AM". */
export const eventTiming = (e: Pick<AdminEvent, 'is_all_day' | 'start_time' | 'end_time'>) =>
  e.is_all_day
    ? 'All day event'
    : [clock(e.start_time), clock(e.end_time)].filter(Boolean).join(' – ');

/** "All day", "09:00 – 10:00" — the student calendar's row time. */
export const rowTiming = (e: Pick<AdminEvent, 'is_all_day' | 'start_time' | 'end_time'>) => {
  if (e.is_all_day) return 'All day';
  const a = e.start_time?.slice(0, 5);
  const b = e.end_time?.slice(0, 5);
  return a ? (b ? `${a} – ${b}` : a) : '';
};

export const isPastDay = (date?: string | null) => !!date && date < moment().format('YYYY-MM-DD');

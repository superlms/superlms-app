import moment from 'moment';
import type { ChatContact, ChatMessage } from '../../api/chatApi';

// "10:42 AM" today, "Yesterday", "Mon" within the week, "14 Sep" before that.
export const listTimeLabel = (date?: string | null): string => {
  const d = moment(date);
  if (!date || !d.isValid()) return '';
  if (d.isSame(moment(), 'day')) return d.format('h:mm A');
  if (d.isSame(moment().subtract(1, 'day'), 'day')) return 'Yesterday';
  if (d.isAfter(moment().subtract(6, 'days').startOf('day'))) return d.format('ddd');
  return d.isSame(moment(), 'year') ? d.format('D MMM') : d.format('D MMM YYYY');
};

// The line under a contact's name: "You: Photo", "Please submit…", "No messages yet".
export const previewLine = (c: ChatContact): string => {
  const m = c.last_message;
  if (!m) return 'No messages yet';
  const what = m.body || (m.attachment_type === 'image' ? 'Photo' : 'File');
  return m.mine ? `You: ${what}` : what;
};

// "9:05 AM"
export const bubbleTime = (date: string) => moment(date).format('h:mm A');

// "240 KB", "1.2 MB"
export const fileSize = (bytes?: number | null): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ── Skeletons for a list or conversation never loaded on this phone ──────────
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

export const SAMPLE_CONTACTS: ChatContact[] = [
  {
    user_id: -1,
    name: 'Ravi Sharma',
    avatar: null,
    subtitle: 'Physics',
    conversation_id: -1,
    last_message: { body: 'Please submit your assignment by tomorrow.', attachment_type: null, mine: false, created_at: minutesAgo(40) },
    unread: 2,
  },
  {
    user_id: -2,
    name: 'Priya Mehta',
    avatar: null,
    subtitle: 'Mathematics',
    conversation_id: -2,
    last_message: { body: 'Thank you for the notes!', attachment_type: null, mine: true, created_at: minutesAgo(200) },
    unread: 0,
  },
  {
    user_id: -3,
    name: 'Anil Verma',
    avatar: null,
    subtitle: 'Chemistry',
    conversation_id: -3,
    last_message: { body: null, attachment_type: 'file', mine: false, created_at: minutesAgo(1600) },
    unread: 1,
  },
  {
    user_id: -4,
    name: 'Sunita Rao',
    avatar: null,
    subtitle: 'Biology',
    conversation_id: null,
    last_message: null,
    unread: 0,
  },
];

const sample = (id: number, mine: boolean, body: string, ago: number): ChatMessage => ({
  id,
  body,
  mine,
  created_at: minutesAgo(ago),
  status: 'read',
  attachment: null,
});

export const SAMPLE_MESSAGES: ChatMessage[] = [
  sample(-6, true, 'Good morning! I had a doubt in chapter 4.', 30),
  sample(-5, false, 'Sure, what is it?', 28),
  sample(-4, true, 'I did not understand the third law in the context of rockets.', 27),
  sample(-3, false, 'When a rocket pushes gas down, the gas pushes the rocket up — equal and opposite.', 25),
  sample(-2, true, 'That makes sense now. Thank you!', 24),
];

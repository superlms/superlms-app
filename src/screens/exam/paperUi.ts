import moment from 'moment';

/**
 * How a paper's day and time are written — shared by Date Sheet and Seating
 * Plan, which list the same papers.
 */

// "2026-10-02" → that calendar day, or null.
export const dayOf = (iso?: string | null) => {
  if (!iso) return null;
  const d = moment(iso.slice(0, 10), 'YYYY-MM-DD', true);
  return d.isValid() ? d : null;
};

// "14:00" → "2:00 PM"
export const clock = (t?: string | null) => {
  const m = t ? moment(t, 'HH:mm', true) : null;
  return m?.isValid() ? m.format('h:mm A') : null;
};

// "3 hrs", "1 hr 30 min", "45 min"
export const duration = (from?: string | null, to?: string | null) => {
  const a = from ? moment(from, 'HH:mm', true) : null;
  const b = to ? moment(to, 'HH:mm', true) : null;
  if (!a?.isValid() || !b?.isValid()) return null;
  const mins = b.diff(a, 'minutes');
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h} ${h === 1 ? 'hr' : 'hrs'}` : null, m ? `${m} min` : null].filter(Boolean).join(' ');
};

// "10:00 AM – 1:00 PM  ·  3 hrs", or that the time isn't set.
export const timeLine = (p: { start_time: string | null; end_time: string | null }) => {
  const from = clock(p.start_time);
  const to = clock(p.end_time);
  if (!from) return 'Time to be announced';
  return [to ? `${from} – ${to}` : from, duration(p.start_time, p.end_time)].filter(Boolean).join('  ·  ');
};

// "Today", "Tomorrow", "In 5 days" — nothing once it has passed.
export const soon = (d: moment.Moment) => {
  const n = d.diff(moment().startOf('day'), 'days');
  return n < 0 ? null : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
};

// "2 – 10 Oct 2026", from the first paper's day to the last.
export const papersRange = (papers: { exam_date: string | null }[]) => {
  const days = papers.map(p => dayOf(p.exam_date)).filter((d): d is moment.Moment => !!d);
  if (days.length === 0) return null;
  const from = moment.min(days);
  const to = moment.max(days);
  if (from.isSame(to, 'day')) return from.format('D MMM YYYY');
  if (from.isSame(to, 'month')) return `${from.format('D')} – ${to.format('D MMM YYYY')}`;
  if (from.isSame(to, 'year')) return `${from.format('D MMM')} – ${to.format('D MMM YYYY')}`;
  return `${from.format('D MMM YYYY')} – ${to.format('D MMM YYYY')}`;
};

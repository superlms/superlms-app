export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'leave'
  | 'holiday'
  | 'not_marked'
  | 'upcoming';

/**
 * How each status is drawn on the month grid.
 *
 * A marked day wears a soft tint behind its number — light enough to read a
 * month at a glance without the page turning into a colour chart. Holiday and
 * the unmarked days carry no tint at all, only a quieter number, so the days
 * that were actually recorded are the ones that stand out.
 */
export const STATUS_META: Record<
  AttendanceStatus,
  { label: string; ink: string; fill: string | null; short: string }
> = {
  present: { label: 'Present', ink: '#15803D', fill: '#DCFCE7', short: 'P' },
  absent: { label: 'Absent', ink: '#B91C1C', fill: '#FEE2E2', short: 'A' },
  leave: { label: 'Leave', ink: '#B45309', fill: '#FEF3C7', short: 'L' },
  holiday: { label: 'Holiday', ink: '#64748B', fill: '#F1F5F9', short: 'H' },
  not_marked: { label: 'Not marked', ink: '#94A3B8', fill: null, short: '—' },
  upcoming: { label: '—', ink: '#CBD5E1', fill: null, short: '' },
};

// The statuses worth explaining under the grid, in the order they are shown.
export const LEGEND: AttendanceStatus[] = ['present', 'absent', 'leave', 'holiday'];

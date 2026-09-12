export type FilterType = 'All' | 'Holiday' | 'Exam' | 'Event' | 'Assignment';

export interface CalEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  type: Exclude<FilterType, 'All'>;
  time?: string;
  location?: string | null;
  color?: string;
  isAllDay?: boolean;
}

export const FILTERS: FilterType[] = [
  'All',
  'Holiday',
  'Exam',
  'Event',
  'Assignment',
];

export const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
export const YEAR_RANGE = Array.from({ length: 20 }, (_, i) => 2020 + i);

// Split a flat run of days into rows of seven.
export function chunkWeeks(days: (string | null)[]): (string | null)[][] {
  const rows: (string | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}

import moment from 'moment';

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

export const TYPE_META: Record<
  Exclude<FilterType, 'All'>,
  { color: string; bg: string; icon: string; iconSet: string }
> = {
  Holiday: {
    color: '#10B981',
    bg: '#D1FAE5',
    icon: 'umbrella-beach',
    iconSet: 'FontAwesome5',
  },
  Exam: {
    color: '#EF4444',
    bg: '#FEE2E2',
    icon: 'file-alt',
    iconSet: 'FontAwesome5',
  },
  Event: {
    color: '#8B5CF6',
    bg: '#EDE9FE',
    icon: 'calendar',
    iconSet: 'FontAwesome',
  },
  Assignment: {
    color: '#F59E0B',
    bg: '#FEF3C7',
    icon: 'clipboard-list',
    iconSet: 'FontAwesome5',
  },
};

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

// Helper function to group events by date
export const groupEventsByDate = (events: CalEvent[]): Record<string, CalEvent[]> => {
  const grouped: Record<string, CalEvent[]> = {};
  events.forEach(event => {
    if (!grouped[event.date]) {
      grouped[event.date] = [];
    }
    grouped[event.date].push(event);
  });
  return grouped;
};

// Helper function to get event types for a date (for calendar dots)
export const getEventTypesForDate = (events: CalEvent[]): Exclude<FilterType, 'All'>[] => {
  const types = new Set<Exclude<FilterType, 'All'>>();
  events.forEach(event => {
    types.add(event.type);
  });
  return Array.from(types);
};

export function chunkWeeks(days: (string | null)[]): (string | null)[][] {
  const rows: (string | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}
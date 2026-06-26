import moment from 'moment';

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'leave'
  | 'holiday'
  | 'not_marked'
  | 'upcoming';

export interface AttendanceData {
  [monthKey: string]: {
    [day: number]: AttendanceStatus;
  };
}

export const STATUS_META: Record<
  AttendanceStatus,
  { color: string; bg: string; label: string }
> = {
  present: { color: '#16A34A', bg: '#DCFCE7', label: 'Present' },
  absent: { color: '#DC2626', bg: '#FEE2E2', label: 'Absent' },
  leave: { color: '#D97706', bg: '#FEF9C3', label: 'Leave' },
  holiday: { color: '#6366F1', bg: '#EDE9FE', label: 'Holiday' },
  not_marked: { color: '#64748B', bg: '#F1F5F9', label: 'Not marked' },
  upcoming: { color: '#94A3B8', bg: '#F8FAFC', label: '–' },
};

export const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const ATTENDANCE_DATA: AttendanceData = {
  [moment().format('YYYY-MM')]: {
    1: 'present',
    2: 'present',
    3: 'present',
    4: 'present',
    5: 'present',
    6: 'holiday',
    7: 'holiday',
    8: 'present',
    9: 'present',
    10: 'absent',
    11: 'present',
    12: 'present',
    13: 'holiday',
    14: 'holiday',
    15: 'present',
    16: 'leave',
    17: 'present',
    18: 'present',
    19: 'present',
    20: 'holiday',
    21: 'holiday',
    22: 'present',
    23: 'absent',
    24: 'present',
    25: 'present',
    26: 'leave',
    27: 'holiday',
    28: 'holiday',
    29: 'present',
    30: 'present',
    31: 'absent',
  },
  [moment().subtract(1, 'month').format('YYYY-MM')]: {
    1: 'present',
    2: 'present',
    3: 'present',
    4: 'present',
    5: 'present',
    6: 'holiday',
    7: 'holiday',
    8: 'present',
    9: 'absent',
    10: 'present',
    11: 'present',
    12: 'present',
    13: 'holiday',
    14: 'holiday',
    15: 'leave',
    16: 'present',
    17: 'present',
    18: 'present',
    19: 'present',
    20: 'holiday',
    21: 'holiday',
    22: 'present',
    23: 'present',
    24: 'absent',
    25: 'present',
    26: 'present',
    27: 'holiday',
    28: 'holiday',
    29: 'present',
    30: 'leave',
  },
  [moment().subtract(2, 'months').format('YYYY-MM')]: {
    1: 'present',
    2: 'present',
    3: 'holiday',
    4: 'holiday',
    5: 'present',
    6: 'present',
    7: 'present',
    8: 'present',
    9: 'present',
    10: 'holiday',
    11: 'holiday',
    12: 'present',
    13: 'present',
    14: 'absent',
    15: 'present',
    16: 'present',
    17: 'holiday',
    18: 'holiday',
    19: 'present',
    20: 'present',
    21: 'present',
    22: 'leave',
    23: 'present',
    24: 'holiday',
    25: 'holiday',
    26: 'present',
    27: 'present',
    28: 'absent',
    29: 'present',
    30: 'present',
    31: 'present',
  },
};

export function chunkWeeks(days: (string | null)[]): (string | null)[][] {
  const rows: (string | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}

export function computeStats(monthKey: string) {
  const data = ATTENDANCE_DATA[monthKey] ?? {};
  const [y, m] = monthKey.split('-').map(Number);
  const totalDays = moment(`${y}-${m}`, 'YYYY-M').daysInMonth();
  const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);

  const workDays = allDays.filter(
    d => moment(`${monthKey}-${d}`, 'YYYY-MM-D').day() !== 0,
  ).length;
  const presentDays = allDays.filter(d => data[d] === 'present').length;
  const absentDays = allDays.filter(d => data[d] === 'absent').length;
  const leaveDays = allDays.filter(d => data[d] === 'leave').length;
  const presentPct =
    workDays > 0 ? ((presentDays / workDays) * 100).toFixed(1) : '0.0';
  const absentPct =
    workDays > 0 ? ((absentDays / workDays) * 100).toFixed(1) : '0.0';

  return {
    totalDays,
    workDays,
    presentDays,
    absentDays,
    leaveDays,
    presentPct,
    absentPct,
  };
}

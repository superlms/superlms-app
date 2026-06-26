import AsyncStorage from '@react-native-async-storage/async-storage';

export type AttendanceStatus = 'present' | 'absent' | 'holiday';

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  status: AttendanceStatus;
}

export interface ClassItem {
  id: string;
  label: string;
}

export const STATUS_CONFIG: Record<
  AttendanceStatus,
  { short: string; full: string; color: string; bg: string; icon: string }
> = {
  present: {
    short: 'P',
    full: 'Present',
    color: '#16A34A',
    bg: '#DCFCE7',
    icon: 'checkmark-circle',
  },
  absent: {
    short: 'A',
    full: 'Absent',
    color: '#DC2626',
    bg: '#FEE2E2',
    icon: 'close-circle',
  },
  holiday: {
    short: 'H',
    full: 'Holiday',
    color: '#6366F1',
    bg: '#EDE9FE',
    icon: 'sunny-outline',
  },
};

export const STATUS_ORDER: AttendanceStatus[] = ['present', 'absent', 'holiday'];

// DB tinyint code for each status (matches the backend status map).
export const STATUS_CODE: Record<AttendanceStatus, number> = {
  present: 1,
  absent: 0,
  holiday: 4,
};

export const CLASSES: ClassItem[] = [
  { id: '1', label: 'Class 6A' },
  { id: '2', label: 'Class 7B' },
  { id: '3', label: 'Class 8C' },
  { id: '4', label: 'Class 9A' },
  { id: '5', label: 'Class 10B' },
];

// Class the logged-in teacher is class-teacher of. `null` → not a class
// teacher, so they must pick a class & section before marking.
export const CLASS_TEACHER_OF: ClassItem | null = { id: '4', label: 'Class 9A' };

export const STUDENTS: Omit<Student, 'status'>[] = [
  { id: '1', rollNo: '01', name: 'Aarav Sharma' },
  { id: '2', rollNo: '02', name: 'Priya Patel' },
  { id: '3', rollNo: '03', name: 'Rohan Mehta' },
  { id: '4', rollNo: '04', name: 'Sneha Verma' },
  { id: '5', rollNo: '05', name: 'Karan Singh' },
  { id: '6', rollNo: '06', name: 'Ananya Gupta' },
  { id: '7', rollNo: '07', name: 'Dev Joshi' },
  { id: '8', rollNo: '08', name: 'Riya Nair' },
  { id: '9', rollNo: '09', name: 'Arjun Rao' },
  { id: '10', rollNo: '10', name: 'Meera Iyer' },
  { id: '11', rollNo: '11', name: 'Vivek Tiwari' },
  { id: '12', rollNo: '12', name: 'Pooja Desai' },
];

export const getDefaultStudents = (): Student[] =>
  STUDENTS.map(s => ({ ...s, status: 'present' }));

export const getCounts = (
  students: Student[],
): Record<AttendanceStatus, number> =>
  students.reduce(
    (acc, s) => {
      acc[s.status]++;
      return acc;
    },
    { present: 0, absent: 0, holiday: 0 },
  );

// ─── Dates ───────────────────────────────────────────────────────────────────
export interface DateItem {
  iso: string;
  weekday: string;
  day: string;
  month: string;
  isToday: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const pad = (n: number) => String(n).padStart(2, '0');

export const toIso = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Last `count` days ending today (oldest first, today last).
export const getRecentDates = (count = 7): DateItem[] => {
  const today = new Date();
  const todayIso = toIso(today);
  const out: DateItem[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = toIso(d);
    out.push({
      iso,
      weekday: WEEKDAYS[d.getDay()],
      day: pad(d.getDate()),
      month: MONTHS[d.getMonth()],
      isToday: iso === todayIso,
    });
  }
  return out;
};

// Last `count` working days (Sundays excluded) ending today — oldest first, today last.
// Sundays are auto-holidays and never markable, so they're skipped entirely. When
// today is a Sunday, it's skipped too and the latest entry is the previous Saturday.
export const getRecentMarkableDates = (count = 3): DateItem[] => {
  const today = new Date();
  const todayIso = toIso(today);
  const out: DateItem[] = [];
  const d = new Date(today);
  while (out.length < count) {
    if (d.getDay() !== 0) {
      // 0 = Sunday
      const iso = toIso(d);
      out.push({
        iso,
        weekday: WEEKDAYS[d.getDay()],
        day: pad(d.getDate()),
        month: MONTHS[d.getMonth()],
        isToday: iso === todayIso,
      });
    }
    d.setDate(d.getDate() - 1);
  }
  return out.reverse();
};

export const formatLong = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]}, ${pad(d)} ${MONTHS[m - 1]} ${y}`;
};

// Teachers may mark today + the previous 2 days (3 days total). Kept in sync
// with the server-side window in AttendanceController.
export const EDIT_WINDOW_DAYS = 2;

const midnight = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Whole days between the attendance date and today (0 = today).
export const daysSince = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  const target = midnight(new Date(y, m - 1, d));
  const now = midnight(new Date());
  return Math.round((now - target) / 86400000);
};

// Editable only for today and the previous EDIT_WINDOW_DAYS days.
export const canEdit = (iso: string): boolean => {
  const diff = daysSince(iso);
  return diff >= 0 && diff <= EDIT_WINDOW_DAYS;
};

// ─── Persistence (so the 3-day edit window survives app restarts) ────────────
export interface AttendanceRecord {
  date: string;
  classId: string;
  classLabel: string;
  statuses: Record<string, AttendanceStatus>;
  submittedAt: string;
}

const STORAGE_KEY = 'attendance_records';

export const recordKey = (date: string, classId: string) =>
  `${date}__${classId}`;

export const loadRecords = async (): Promise<
  Record<string, AttendanceRecord>
> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const getRecord = async (
  date: string,
  classId: string,
): Promise<AttendanceRecord | null> => {
  const all = await loadRecords();
  return all[recordKey(date, classId)] ?? null;
};

export const saveRecord = async (record: AttendanceRecord): Promise<void> => {
  const all = await loadRecords();
  all[recordKey(record.date, record.classId)] = record;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { DAYS, type Day } from '../timetable/timetableData';
import type { TimetablePeriod } from '../../api/timetableApi';
import type { TtBusy, TtFormRow } from '../../api/adminTimetableApi';

/**
 * Timetable's shared pieces and the panel's form rules (app/Livewire/Admin/
 * TimeTable.php), worked out on the phone as the panel works them out on each
 * change: a row's lesson length, the days another row at the same time already
 * takes, and whether the row's teacher is free then.
 */

// 1 = Monday … 6 = Saturday, as the panel stores them.
export const DAY_NUMS = [1, 2, 3, 4, 5, 6];
export const DAY_SHORT: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
export const DAY_FULL: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};
export const dayNum = (d: Day) => DAYS.indexOf(d) + 1;

const hhmm = (t?: string | null) => (t ?? '').slice(0, 5);

/** A period the student's timetable rows can draw. */
export const asPeriod = (p: {
  id: number;
  subject: string;
  start_time: string;
  end_time: string;
  day: number;
}): TimetablePeriod =>
  ({
    id: p.id,
    subject: p.subject,
    subject_id: null,
    teacher: '',
    teacher_id: null,
    standard: '',
    standard_id: null,
    section: '',
    section_id: null,
    day_of_week: p.day,
    day_name: DAY_FULL[p.day] ?? '',
    start_time: p.start_time,
    end_time: p.end_time,
    time_slot: null,
    has_substitute: false,
    substitute_details: null,
    is_active: true,
  } as TimetablePeriod);

/** Lesson length, e.g. "1h 30m" — the panel's rowDuration; '' when the times don't make one. */
export const rowDuration = (start?: string | null, end?: string | null): string => {
  const s = /^(\d{2}):(\d{2})$/.exec(hhmm(start));
  const e = /^(\d{2}):(\d{2})$/.exec(hhmm(end));
  if (!s || !e) return '';
  const mins = Number(e[1]) * 60 + Number(e[2]) - (Number(s[1]) * 60 + Number(s[2]));
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h ? `${h}h ` : ''}${m ? `${m}m` : h ? '' : '0m'}`.trim();
};

/**
 * Days already taken by ANOTHER row that overlaps this row's time slot — a class
 * can only be in one place at a time (occupiedDaysForRow).
 */
export const occupiedDaysForRow = (rows: TtFormRow[], i: number): number[] => {
  const row = rows[i];
  if (!row) return [];
  const start = hhmm(row.start_time);
  const end = hhmm(row.end_time);
  if (!start || !end || start >= end) return [];

  const occupied = new Set<number>();
  rows.forEach((other, j) => {
    if (j === i) return;
    const os = hhmm(other.start_time);
    const oe = hhmm(other.end_time);
    if (!os || !oe || os >= oe) return;
    if (os >= end || oe <= start) return; // no time overlap
    (other.days ?? []).forEach(d => occupied.add(Number(d)));
  });
  return [...occupied];
};

/** Weekdays this row may still pick: Mon–Sat less the occupied ones; its own stay (availableDaysForRow). */
export const availableDaysForRow = (rows: TtFormRow[], i: number): number[] => {
  const occupied = occupiedDaysForRow(rows, i);
  const selected = (rows[i]?.days ?? []).map(Number);
  return DAY_NUMS.filter(d => !occupied.includes(d) || selected.includes(d));
};

/**
 * Is the row's teacher already busy — in another class (saved), or on another
 * row of this form — at an overlapping time on one of its days? A short reason,
 * or null (getRowConflict).
 */
export const rowConflict = (rows: TtFormRow[], i: number, busy: TtBusy[]): string | null => {
  const row = rows[i];
  if (!row) return null;
  const teacherId = Number(row.teacher_id ?? 0);
  if (!teacherId) return null;
  const start = hhmm(row.start_time);
  const end = hhmm(row.end_time);
  if (!start || !end || start >= end) return null;
  const days = (row.days ?? []).map(Number);
  if (days.length === 0) return null;

  // 1) Booked in another class/section at this time.
  const clash = busy.find(
    b => b.teacher_id === teacherId && days.includes(b.day) && hhmm(b.start_time) < end && hhmm(b.end_time) > start,
  );
  if (clash) {
    return `Busy with ${clash.where || 'another class'} (${DAY_SHORT[clash.day] ?? clash.day})`;
  }

  // 2) The same teacher on another row at an overlapping time and day.
  for (let j = 0; j < rows.length; j++) {
    if (j === i) continue;
    const other = rows[j];
    if (Number(other.teacher_id ?? 0) !== teacherId) continue;
    const os = hhmm(other.start_time);
    const oe = hhmm(other.end_time);
    if (!os || !oe) continue;
    if (os >= end || oe <= start) continue;
    const shared = days.filter(d => (other.days ?? []).map(Number).includes(d));
    if (shared.length > 0) return `Teacher already on another subject at this time (${DAY_SHORT[shared[0]] ?? shared[0]})`;
  }
  return null;
};

/**
 * What the panel says before it saves (onSaveTimetable), or '' when the form may
 * go: rows without a subject, a teacher or a day are left out; each kept row
 * needs a real time range, days the class is free then, and a free teacher.
 */
export const formProblem = (rows: TtFormRow[], busy: TtBusy[], isEdit: boolean): string => {
  const kept = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => Number(r.subject_id) > 0 && Number(r.teacher_id ?? 0) > 0 && (r.days ?? []).length > 0);

  if (kept.length === 0 && !isEdit) return 'Add at least one row with a subject, teacher and days to save.';

  for (const { r, i } of kept) {
    const n = r.subject_name || `Subject ${i + 1}`;
    const start = hhmm(r.start_time);
    const end = hhmm(r.end_time);
    if (!start || !end || start >= end) return `${n}: invalid time range.`;
    const occupied = occupiedDaysForRow(rows, i);
    const clash = r.days.map(Number).filter(d => occupied.includes(d));
    if (clash.length > 0) return `${n} (${DAY_FULL[clash[0]] ?? clash[0]}): the class is already scheduled at this time.`;
    const conflict = rowConflict(rows, i, busy);
    if (conflict) return `${n}: ${conflict}`;
  }
  return '';
};

// ── Loading: a timetable sheet, A4 landscape ────────────────────────────────
const A4_LANDSCAPE = 210 / 297;

export const GridSkeleton = ({ width }: { width: number }) => {
  const w = width - 40;
  return (
    <View style={[s.sheet, { width: w, height: Math.round(w * A4_LANDSCAPE) }]}>
      <Skeleton width="40%" height={12} style={s.center} />
      <Skeleton width="24%" height={10} style={s.center} />
      {[0, 1, 2, 3, 4].map(r => (
        <View key={r} style={s.gridRow}>
          {[0, 1, 2, 3, 4, 5, 6].map(c => (
            <Skeleton key={c} width={`${100 / 7 - 1.5}%`} height={r === 0 ? 10 : 18} radius={3} />
          ))}
        </View>
      ))}
    </View>
  );
};

const __mk_s = () => StyleSheet.create({
  sheet: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 14,
    gap: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  center: { alignSelf: 'center' },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

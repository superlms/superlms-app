import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import { theme, onThemeChange } from '../../utils/theme';
import { DAYS, type Day } from './timetableData';
import { fmtTime, type TimetablePeriod } from '../../api/timetableApi';

/**
 * The pieces the student and teacher timetables share.
 *
 * A day is a plain list: who is taking the period, what it is, and when —
 * separated by hairlines. No emoji tiles, no colour picked from a hash of the
 * subject name, no time badges.
 */

/**
 * The Monday of the school week being shown.
 *
 * Sunday belongs to the ISO week that has just finished, so asking moment for
 * the start of "this" week on a Sunday hands back dates that are already in the
 * past. School has moved on by then, so Sunday looks ahead to the week starting
 * the next morning.
 */
const weekStart = (): moment.Moment => {
  const now = moment();
  const start = now.clone().startOf('isoWeek');
  return now.day() === 0 ? start.add(1, 'week') : start;
};

// The date a given school day falls on in the week being shown.
export const dateForDay = (day: Day): moment.Moment =>
  weekStart().add(DAYS.indexOf(day), 'days');

// Today, when it is a school day — null on a Sunday, where nothing is running.
export const schoolToday = (): Day | null => {
  const name = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as Day;
  return DAYS.includes(name) ? name : null;
};

// Which day a timetable should open on: today, or Monday when it is Sunday.
export const defaultDay = (): Day => schoolToday() ?? 'Monday';

const initialsOf = (name?: string | null) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// "08:30:00" → 510. Anything unparseable sorts as -1 so it never reads as "now".
const minutesOf = (t?: string | null): number => {
  if (!t) return -1;
  const [h, m] = t.split(':');
  const hh = parseInt(h, 10);
  const mm = parseInt(m ?? '0', 10);
  if (Number.isNaN(hh)) return -1;
  return hh * 60 + (Number.isNaN(mm) ? 0 : mm);
};

// Which period is running right now — only meaningful while looking at today.
export const currentPeriodId = (
  periods: TimetablePeriod[],
  isToday: boolean,
): number | null => {
  if (!isToday) return null;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const live = periods.find(p => {
    const from = minutesOf(p.start_time);
    const to = minutesOf(p.end_time);
    return from >= 0 && to >= 0 && mins >= from && mins < to;
  });
  return live?.id ?? null;
};

// ── Day selector ─────────────────────────────────────────────────────────────
// The school week as six pills, each carrying the day and its date. The chosen
// day is filled; today, when it is not the chosen one, is outlined and written
// in the accent colour.
export const DaySelector = ({
  selected,
  onSelect,
}: {
  selected: Day;
  onSelect: (d: Day) => void;
}) => {
  const today = schoolToday();

  return (
    <View style={s.days}>
      {DAYS.map(day => {
        const active = selected === day;
        const isToday = day === today;
        const date = dateForDay(day);

        return (
          <TouchableOpacity
            key={day}
            activeOpacity={0.7}
            onPress={() => onSelect(day)}
            style={[s.day, active && s.dayActive, !active && isToday && s.dayToday]}
          >
            <Text
              style={[
                s.dayName,
                active && s.dayNameActive,
                !active && isToday && s.dayTextToday,
              ]}
            >
              {day.slice(0, 3)}
            </Text>
            <Text
              style={[
                s.dayDate,
                active && s.dayDateActive,
                !active && isToday && s.dayTextToday,
              ]}
            >
              {date.format('D')}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ── One period ───────────────────────────────────────────────────────────────
//   (photo)  08:00 AM   English                      NOW
//            09:00 AM   Deepak Singh · Substitute
export const PeriodRow = ({
  period,
  meta,
  avatar,
  avatarName,
  isNow,
  isLast,
}: {
  period: TimetablePeriod;
  /** Who it is with (student) or which class it is for (teacher). */
  meta?: string | null;
  /** The teacher's photo, where the screen has one to show. */
  avatar?: string | null;
  /** Falls back to initials when there is no photo. Omit to drop the slot. */
  avatarName?: string | null;
  isNow: boolean;
  isLast: boolean;
}) => (
  <View style={[s.row, !isLast && s.rowDivider]}>
    {avatarName !== undefined &&
      (avatar ? (
        <Image source={{ uri: avatar }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarFallback]}>
          <Text style={s.avatarInitials}>{initialsOf(avatarName)}</Text>
        </View>
      ))}

    <View style={s.timeCol}>
      <Text style={[s.timeFrom, isNow && s.timeNow]}>{fmtTime(period.start_time) || '—'}</Text>
      {!!period.end_time && <Text style={s.timeTo}>{fmtTime(period.end_time)}</Text>}
    </View>

    <View style={s.body}>
      <View style={s.line}>
        <Text style={s.subject} numberOfLines={1}>
          {period.subject}
        </Text>
        {isNow && <Text style={s.now}>NOW</Text>}
      </View>
      {!!meta && (
        <Text style={s.meta} numberOfLines={1}>
          {meta}
        </Text>
      )}
    </View>
  </View>
);

const __mk_s = () => StyleSheet.create({
  // Day pills
  days: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  day: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  dayActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayToday: { borderColor: theme.colors.primary },
  dayName: { fontSize: 11, fontWeight: '500', color: theme.colors.textMuted },
  dayNameActive: { color: theme.colors.white },
  dayDate: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 2 },
  dayDateActive: { color: theme.colors.white },
  dayTextToday: { color: theme.colors.primary },

  // Period — the face, then the clock, then what it is
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.background },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { flexShrink: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  now: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.primary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  timeCol: { width: 62 },
  timeFrom: { fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  timeNow: { color: theme.colors.primary },
  timeTo: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

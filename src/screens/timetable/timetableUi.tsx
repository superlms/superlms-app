import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { DAYS, type Day } from './timetableData';
import { fmtTime, type TimetablePeriod } from '../../api/timetableApi';

/**
 * The pieces the student and teacher timetables share.
 *
 * A day is a plain list anchored by its times: the clock runs down the left,
 * the subject and who (or which class) it is with sits beside it, and hairlines
 * separate one period from the next. No emoji tiles, no colour picked from a
 * hash of the subject name, no time badges — the times already carry the
 * structure a timetable needs.
 */

// Today as one of the six school days, or Monday when it is Sunday.
export const todayDay = (): Day => {
  const name = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as Day;
  return DAYS.includes(name) ? name : 'Monday';
};

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

// ── Day selector: Mon–Sat as a plain tab strip, today marked with a dot ──────
export const DaySelector = ({
  selected,
  onSelect,
}: {
  selected: Day;
  onSelect: (d: Day) => void;
}) => {
  const today = todayDay();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
      {DAYS.map(day => {
        const active = selected === day;
        return (
          <TouchableOpacity
            key={day}
            activeOpacity={0.6}
            onPress={() => onSelect(day)}
            style={[s.tab, active && s.tabActive]}
          >
            <Text style={[s.tabText, active && s.tabTextActive]}>{day.slice(0, 3)}</Text>
            {day === today && <View style={[s.todayDot, active && s.todayDotActive]} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

// ── One period ───────────────────────────────────────────────────────────────
//   08:00 AM   English                         NOW
//   09:00 AM   Deepak Singh · Substitute
export const PeriodRow = ({
  period,
  meta,
  isNow,
  isLast,
}: {
  period: TimetablePeriod;
  /** Who it is with (student) or which class it is for (teacher). */
  meta?: string | null;
  isNow: boolean;
  isLast: boolean;
}) => (
  <View style={[s.row, !isLast && s.rowDivider]}>
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
  // Day tabs
  tabs: { paddingHorizontal: 20, gap: 18 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.textMuted },
  todayDotActive: { backgroundColor: theme.colors.primary },

  // Period
  row: { flexDirection: 'row', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  timeCol: { width: 74 },
  timeFrom: { fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  timeNow: { color: theme.colors.primary },
  timeTo: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  now: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.primary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { WEEK_LABELS, chunkWeeks } from './calendarTypes';

/**
 * Shared building blocks for the calendar screens (student calendar, admin
 * calendar list, month view and day view).
 *
 * Same plain document look as the More / profile screens: a white page, a
 * borderless month bar, a grid of bare day numbers where only the selected day
 * is filled and a day with events carries one small dot, and events as plain
 * rows separated by hairlines. No cards, shadows, accent strips or coloured
 * type pills.
 */

const { width } = Dimensions.get('window');
// Seven cells across the page, inside its 20px padding. Exported so any other
// month grid (attendance) lines up with this one exactly.
export const CELL = Math.floor((width - 40) / 7);
export const DAY = Math.min(CELL - 10, 40);

// "exam" → "Exam"
export const capitalize = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// "09:00:00" → "09:00"
export const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');

// "All day", "09:00 – 10:00", "09:00", or nothing.
export const timingLabel = (
  isAllDay?: boolean | null,
  start?: string | null,
  end?: string | null,
) => {
  if (isAllDay) return 'All day';
  if (!start) return '';
  return end ? `${hhmm(start)} – ${hhmm(end)}` : hhmm(start);
};

// ── Full-width line, edge to edge ────────────────────────────────────────────
export const FullDivider = () => <View style={s.fullDivider} />;

// ── Month bar: ‹  September 2026  › ──────────────────────────────────────────
// The label opens a picker when `onPressLabel` is given.
export const MonthBar = ({
  label,
  onPrev,
  onNext,
  onPressLabel,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onPressLabel?: () => void;
}) => (
  <View style={s.monthBar}>
    <TouchableOpacity style={s.monthArrow} onPress={onPrev} activeOpacity={0.6} hitSlop={8}>
      <VectorIcon iconSet="Ionicons" iconName="chevron-back" size={18} color={theme.colors.textSecondary} />
    </TouchableOpacity>

    <TouchableOpacity
      style={s.monthLabelBtn}
      onPress={onPressLabel}
      activeOpacity={onPressLabel ? 0.6 : 1}
      disabled={!onPressLabel}
    >
      <Text style={s.monthLabel}>{label}</Text>
      {!!onPressLabel && (
        <VectorIcon iconSet="Ionicons" iconName="chevron-down" size={14} color={theme.colors.textMuted} />
      )}
    </TouchableOpacity>

    <TouchableOpacity style={s.monthArrow} onPress={onNext} activeOpacity={0.6} hitSlop={8}>
      <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  </View>
);

// ── Month grid ───────────────────────────────────────────────────────────────
// Weeks start on Monday. Sundays are muted, today is written in the accent
// colour, the selected day is a filled circle, and a day with events gets one
// small dot underneath. `onlyMarked` limits tapping to days that have events.
export const MonthGrid = ({
  month,
  selected,
  marked,
  onSelectDate,
  onlyMarked,
}: {
  month: moment.Moment;
  selected?: string;
  marked: Record<string, boolean>;
  onSelectDate?: (date: string) => void;
  onlyMarked?: boolean;
}) => {
  const today = moment().format('YYYY-MM-DD');

  const weeks = useMemo(() => {
    const start = month.clone().startOf('month');
    const end = month.clone().endOf('month');
    const offset = (start.day() + 6) % 7;
    const days: (string | null)[] = Array(offset).fill(null);
    for (let d = start.clone(); d.isSameOrBefore(end); d.add(1, 'day')) {
      days.push(d.format('YYYY-MM-DD'));
    }
    while (days.length % 7 !== 0) days.push(null);
    return chunkWeeks(days);
  }, [month]);

  return (
    <View>
      <View style={s.weekRow}>
        {WEEK_LABELS.map((l, i) => (
          <View key={i} style={s.cell}>
            <Text style={s.weekLabel}>{l}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={s.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={`e${wi}${di}`} style={s.cell} />;

            const isSelected = day === selected;
            const isToday = day === today;
            const hasEvents = !!marked[day];
            const isSunday = moment(day).day() === 0;
            const tappable = !!onSelectDate && (!onlyMarked || hasEvents);

            return (
              <TouchableOpacity
                key={day}
                style={s.cell}
                activeOpacity={tappable ? 0.6 : 1}
                disabled={!tappable}
                onPress={tappable ? () => onSelectDate!(day) : undefined}
              >
                <View
                  // Remounted when it turns selected: on Android a view whose
                  // background is switched on later can lose its border radius
                  // and draw as a square instead of a circle.
                  key={isSelected ? 'selected' : 'plain'}
                  style={[s.dayInner, isSelected && s.dayInnerSelected]}
                >
                  <Text
                    style={[
                      s.dayNum,
                      isSunday && s.dayNumSunday,
                      isToday && !isSelected && s.dayNumToday,
                      isSelected && s.dayNumSelected,
                    ]}
                  >
                    {moment(day).date()}
                  </Text>
                </View>
                <View style={[s.dot, hasEvents && s.dotOn]} />
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

// ── One event as a plain row, separated from the next by a divider ───────────
// The type sits at the top of the row, so a list can be read by kind at a
// glance; the title, an optional preview and the timing follow.
//   EXAM
//   Mid-term Mathematics
//   description
//   09:00 – 10:00 · 14 Sep 2026
export const EventRow = ({
  type,
  title,
  description,
  meta,
  onPress,
  isLast,
}: {
  type?: string | null;
  title: string;
  description?: string | null;
  meta?: string | null;
  onPress?: () => void;
  isLast?: boolean;
}) => (
  <TouchableOpacity
    style={[s.row, !isLast && s.rowDivider]}
    activeOpacity={onPress ? 0.6 : 1}
    disabled={!onPress}
    onPress={onPress}
  >
    {!!type && <Text style={s.rowType}>{type.toUpperCase()}</Text>}
    <Text style={s.rowTitle} numberOfLines={1}>
      {title}
    </Text>
    {!!description && (
      <Text style={s.rowDesc} numberOfLines={2}>
        {description}
      </Text>
    )}
    {!!meta && (
      <Text style={s.rowMeta} numberOfLines={1}>
        {meta}
      </Text>
    )}
  </TouchableOpacity>
);

// ── Label / value row for the event detail screens ───────────────────────────
export const DetailRow = ({
  label,
  value,
  last,
}: {
  label: string;
  value?: string | null;
  last?: boolean;
}) => {
  if (!value) return null;
  return (
    <View style={[s.detailRow, !last && s.rowDivider]}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
};

const __mk_s = () => StyleSheet.create({
  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // Month bar
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  monthArrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  monthLabelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthLabel: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },

  // Grid
  weekRow: { flexDirection: 'row' },
  cell: { width: CELL, alignItems: 'center', paddingVertical: 3 },
  weekLabel: { fontSize: 11, fontWeight: '500', color: theme.colors.textMuted, paddingVertical: 6 },
  dayInner: {
    width: DAY,
    height: DAY,
    borderRadius: DAY / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInnerSelected: { backgroundColor: theme.colors.primary, borderRadius: DAY / 2 },
  dayNum: { fontSize: 14, color: theme.colors.textPrimary },
  dayNumSunday: { color: theme.colors.textMuted },
  dayNumToday: { color: theme.colors.primary, fontWeight: '700' },
  dayNumSelected: { color: theme.colors.white, fontWeight: '600' },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 3, backgroundColor: 'transparent' },
  dotOn: { backgroundColor: theme.colors.primary },

  // Event row
  row: { paddingVertical: 14, gap: 3 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowType: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  rowTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowDesc: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },
  rowMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  // Detail row
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
  detailLabel: { width: '40%', paddingRight: 12, fontSize: 14, color: theme.colors.textSecondary },
  detailValue: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

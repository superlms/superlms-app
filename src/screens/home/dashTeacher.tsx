import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import type { TeacherClassAttendance, TeacherDashboard, TeacherWeekDay, WatchStudent } from '../../api/dashboardApi';
import { Initial, LOW_ATTENDANCE, LineRow, Note, PctRow } from './dashboardUi';

/**
 * What the teacher's dashboard and their Analytics share: today's attendance
 * across their classes, the class-by-class rows, the students to watch, and
 * the line that asks for what is still to do.
 */

// "CLASS 2 SECTION A" → "Class 2 Section A". Schools often type class names in
// capitals, which shout from every row.
export const className = (c?: string | null) => quietCaps(c) || 'Class';

/**
 * Today's attendance across a teacher's classes, as the dashboard and Analytics
 * both read it: present out of the students marked, so a class not marked yet
 * doesn't pull the figure down. Older servers don't say who was marked; there
 * it is present out of the roster, as it always was.
 */
export const attendanceToday = (d: TeacherDashboard) => attendanceOf(d.class_attendance?.by_class ?? []);

export const attendanceOf = (rows: TeacherClassAttendance[]) => {
  const roster = rows.reduce((n, c) => n + c.total, 0);
  const present = rows.reduce((n, c) => n + c.present, 0);
  const knowsMarked = rows.some(c => typeof c.marked === 'number');
  const marked = knowsMarked ? rows.reduce((n, c) => n + (c.marked ?? 0), 0) : roster;
  const pct = marked > 0 ? Math.round((present / marked) * 100) : null;
  // The classes still waiting for today's register (a holiday waits for nothing).
  const pending = knowsMarked ? rows.filter(c => !c.holiday && (c.marked ?? 0) === 0) : [];
  return { roster, present, marked, pct, unmarked: pending.length, pending };
};

// The week as one figure: everyone present out of everyone marked, so a day
// with one small class marked doesn't count as much as a full one.
export const weekAverage = (week: TeacherWeekDay[]) => {
  const present = week.reduce((n, d) => n + (d.holiday ? 0 : d.present), 0);
  const marked = week.reduce((n, d) => n + (d.holiday ? 0 : d.marked), 0);
  return marked > 0 ? Math.round((present / marked) * 100) : null;
};

//   Class 2 Section A                                  86%
//   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──────
//   30 present · 5 absent
export const ClassAttendanceRows = ({ rows }: { rows: TeacherClassAttendance[] }) => (
  <>
    {rows.map((c, i) => {
      const isLast = i === rows.length - 1;
      const key = `${c.class}-${i}`;
      const label = className(c.class);
      const students = `${c.total} ${c.total === 1 ? 'student' : 'students'}`;
      if (c.holiday) {
        return <PctRow key={key} label={label} pct={0} value="Holiday" meta={students} empty isLast={isLast} />;
      }
      if (c.marked === 0) {
        return <PctRow key={key} label={label} pct={0} value="Not marked" meta={students} empty isLast={isLast} />;
      }
      const marked = c.marked ?? c.total;
      const absent = c.absent ?? Math.max(marked - c.present, 0);
      const pct = marked > 0 ? Math.round((c.present / marked) * 100) : 0;
      const unmarked = c.total - marked;
      return (
        <PctRow
          key={key}
          label={label}
          pct={pct}
          low={pct < LOW_ATTENDANCE}
          meta={[`${c.present} present`, `${absent} absent`, unmarked > 0 ? `${unmarked} not marked` : null]
            .filter(Boolean)
            .join(' · ')}
          isLast={isLast}
        />
      );
    })}
  </>
);

//   [A]  Asad Khan                                       9%
//        Class 2 Section A · Roll 508 · 1 of 11 days
export const WatchRows = ({ rows, more = 0 }: { rows: WatchStudent[]; more?: number }) => (
  <>
    {rows.map((st, i) => {
      const name = quietCaps(st.name) || 'Student';
      return (
        <LineRow
          key={`${st.name}-${st.class}-${i}`}
          lead={<Initial text={name} />}
          title={name}
          meta={[
            className(st.class),
            st.roll_no != null && st.roll_no !== '' ? `Roll ${st.roll_no}` : null,
            `${st.present_days} of ${st.working_days} days`,
          ]
            .filter(Boolean)
            .join(' · ')}
          trailing={<Text style={s.watchPct}>{st.percentage}%</Text>}
          isLast={i === rows.length - 1 && more === 0}
        />
      );
    })}
    {more > 0 && <Note>and {more} more</Note>}
  </>
);

// ── What is still to do ──────────────────────────────────────────────────────
//   (!)  Attendance not marked                      [ Mark now ]
//        Class 2 Section A · 46 students
export const Callout = ({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  text?: string | null;
  action?: string;
  onAction?: () => void;
}) => (
  <View style={s.callout}>
    <View style={s.calloutIcon}>
      <VectorIcon iconSet="Ionicons" iconName={icon} size={18} color={theme.colors.primary} />
    </View>
    <View style={s.calloutBody}>
      <Text style={s.calloutTitle} numberOfLines={1}>
        {title}
      </Text>
      {!!text && (
        <Text style={s.calloutText} numberOfLines={2}>
          {text}
        </Text>
      )}
    </View>
    {!!action && !!onAction && (
      <TouchableOpacity style={s.calloutButton} activeOpacity={0.75} hitSlop={6} onPress={onAction}>
        <Text style={s.calloutButtonText}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const __mk_s = () => StyleSheet.create({
  watchPct: { fontSize: 15, fontWeight: '600', color: theme.colors.danger },

  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.primary + '40',
    backgroundColor: theme.colors.primary + '0D',
  },
  calloutIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary + '1A',
  },
  calloutBody: { flex: 1, gap: 2 },
  calloutTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  calloutText: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },
  calloutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  calloutButtonText: { fontSize: 13, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

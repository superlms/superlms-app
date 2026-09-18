import React from 'react';
import { StyleSheet, Text } from 'react-native';
import moment from 'moment';
import { theme, onThemeChange } from '../../utils/theme';
import type { AdminDay, AdminStaffAway } from '../../api/adminDashboardApi';
import { Columns, Initial, LOW_ATTENDANCE, LineRow, Note, Pill } from '../home/dashboardUi';
import { ADMIN_MODULES, canAccessAdminModule } from './adminModules';
import { openAdminModule } from '../../navigation/adminRoutes';
import { useAdminProfile } from './useAdminProfile';

/**
 * What the admin Dashboard and Analytics share, on top of the student and
 * teacher dashboards' pieces: money in few characters, the links a sub-admin
 * may follow, the last days as columns and who is away.
 */

// ₹950 · ₹4.5K · ₹45K · ₹1.2L · ₹12L · ₹1.2Cr — short enough for a column.
export const inrShort = (n: number) => {
  const v = Math.round(Number(n) || 0);
  const a = Math.abs(v);
  const cut = (x: number) => String(Math.abs(x) < 10 ? Math.round(x * 10) / 10 : Math.round(x));
  if (a >= 1e7) return `₹${cut(v / 1e7)}Cr`;
  if (a >= 1e5) return `₹${cut(v / 1e5)}L`;
  if (a >= 1e3) return `₹${cut(v / 1e3)}K`;
  return `₹${v}`;
};

// "Session 2026–27"
export const sessionLabel = (s?: string | null) => (s ? `Session ${s.replace('-', '–')}` : null);

/**
 * The admin modules this admin may open, by key ('exam', 'students' …): `can`
 * says whether, and `open` gives the handler — or nothing, so a link to a
 * module a sub-admin hasn't been given isn't drawn.
 */
export const useAdminLinks = (navigation: any) => {
  const permissions = useAdminProfile()?.permissions;
  const find = (key: string) => ADMIN_MODULES.find(m => m.key === key);
  const can = (key: string) => {
    const m = find(key);
    return !!m && canAccessAdminModule(m, permissions);
  };
  const open = (key: string) => {
    const m = find(key);
    return m && can(key) ? () => openAdminModule(navigation, m) : undefined;
  };
  return { can, open };
};

// The last days as columns: the weekday over its date, "Holiday" on a day off.
export const DayColumns = ({ days, height }: { days: AdminDay[]; height?: number }) => (
  <Columns
    height={height}
    data={days.map(d => ({
      key: d.date,
      label: moment(d.date, 'YYYY-MM-DD').format('ddd'),
      sub: d.holiday ? 'Holiday' : moment(d.date, 'YYYY-MM-DD').format('D'),
      value: d.percentage,
      low: d.percentage != null && d.percentage < LOW_ATTENDANCE,
    }))}
  />
);

// Teachers away today: absent, or in for half the day.
export const AwayRows = ({ rows, limit, isLast = true }: { rows: AdminStaffAway[]; limit?: number; isLast?: boolean }) => {
  const shown = limit ? rows.slice(0, limit) : rows;
  const more = rows.length - shown.length;
  return (
    <>
      {shown.map((t, i) => (
        <LineRow
          key={`${t.name}-${i}`}
          lead={<Initial text={t.name} />}
          title={t.name || 'Teacher'}
          trailing={t.status === 'half_day' ? <Pill text="Half day" /> : <Pill text="Absent" tone="bad" />}
          isLast={isLast && i === shown.length - 1 && more === 0}
        />
      ))}
      {more > 0 && <Note>and {more} more</Note>}
    </>
  );
};

// "5 A, 7 B, 9 C and 2 more"
export const listNames = (names: string[], max = 5) =>
  names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} and ${names.length - max} more`;

export const Caption = ({ children }: { children: React.ReactNode }) => <Text style={s.caption}>{children}</Text>;

const __mk_s = () => StyleSheet.create({
  caption: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted, marginTop: 10 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

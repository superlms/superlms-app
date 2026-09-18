import React from 'react';
import type { TeacherClassAttendance, TeacherDashboard } from '../../api/dashboardApi';
import { LOW_ATTENDANCE, PctRow } from './dashboardUi';

/**
 * Today's attendance across a teacher's classes, as the dashboard and Analytics
 * both read it: present out of the students marked, so a class not marked yet
 * doesn't pull the figure down. Older servers don't say who was marked; there
 * it is present out of the roster, as it always was.
 */
export const attendanceToday = (d: TeacherDashboard) => {
  const rows = d.class_attendance?.by_class ?? [];
  const roster = rows.reduce((n, c) => n + c.total, 0);
  const present = rows.reduce((n, c) => n + c.present, 0);
  const knowsMarked = rows.some(c => typeof c.marked === 'number');
  const marked = knowsMarked ? rows.reduce((n, c) => n + (c.marked ?? 0), 0) : roster;
  const pct = marked > 0 ? Math.round((present / marked) * 100) : null;
  const unmarked = knowsMarked ? rows.filter(c => !c.holiday && (c.marked ?? 0) === 0).length : 0;
  return { roster, present, marked, pct, unmarked };
};

//   10 A                                               86%
//   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──────
//   30 present · 5 absent
export const ClassAttendanceRows = ({ rows }: { rows: TeacherClassAttendance[] }) => (
  <>
    {rows.map((c, i) => {
      const isLast = i === rows.length - 1;
      const key = `${c.class}-${i}`;
      const students = `${c.total} ${c.total === 1 ? 'student' : 'students'}`;
      if (c.holiday) {
        return <PctRow key={key} label={c.class} pct={0} value="Holiday" meta={students} empty isLast={isLast} />;
      }
      if (c.marked === 0) {
        return <PctRow key={key} label={c.class} pct={0} value="Not marked" meta={students} empty isLast={isLast} />;
      }
      const marked = c.marked ?? c.total;
      const absent = c.absent ?? Math.max(marked - c.present, 0);
      const pct = marked > 0 ? Math.round((c.present / marked) * 100) : 0;
      const unmarked = c.total - marked;
      return (
        <PctRow
          key={key}
          label={c.class}
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

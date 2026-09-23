import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import { theme, onThemeChange } from '../../utils/theme';

/** Payroll's shared pieces: months to pick, and how a staff status reads. */

export const TITLE = 'Payroll';

/** The last 24 months, newest first, as the panel's month picker offers them. */
export const monthOptions = (count = 24) =>
  Array.from({ length: count }, (_, i) => {
    const m = moment().startOf('month').subtract(i, 'months');
    return { key: m.format('YYYY-MM'), label: m.format('MMMM YYYY') };
  });

/** Salary defaults to the previous month — the payable, fully attended one. */
export const lastMonth = () => moment().subtract(1, 'month').format('YYYY-MM');

/** Academic years (April → March), the current one first. */
export const academicYears = (count = 5) => {
  const start = moment().month() >= 3 ? moment().year() : moment().year() - 1;
  return Array.from({ length: count }, (_, i) => {
    const y = start - i;
    return { key: String(y), label: `Apr ${y} – Mar ${y + 1}` };
  });
};

const tone = (status?: string | null) => {
  switch (status) {
    case 'present':
      return { bg: theme.colors.success + '1F', ink: theme.colors.success };
    case 'absent':
      return { bg: theme.colors.danger + '1F', ink: theme.colors.danger };
    case 'half_day':
      return { bg: '#F59E0B' + '26', ink: '#B45309' };
    case 'leave':
      return { bg: '#3B82F6' + '1F', ink: '#1D4ED8' };
    default:
      return { bg: theme.colors.background, ink: theme.colors.textMuted };
  }
};

export const statusText = (status?: string | null) =>
  status ? status.replace('_', ' ').replace(/^\w/, c => c.toUpperCase()) : 'Not marked';

/** A status as a small coloured word. */
export const StatusPill = ({ status }: { status?: string | null }) => {
  const t = tone(status);
  return (
    <View style={[s.pill, { backgroundColor: t.bg }]}>
      <Text style={[s.pillText, { color: t.ink }]}>{statusText(status)}</Text>
    </View>
  );
};

/** The colours of a calendar day. */
export const dayTone = tone;

const __mk_s = () => StyleSheet.create({
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '600' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

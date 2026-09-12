import React from 'react';
import { StyleSheet, Text } from 'react-native';
import moment from 'moment';

/**
 * The look shared by the conversation screen and the announcement feed.
 *
 * A light, cool page — pale blue-grey rather than white — with bubbles that
 * carry the content: incoming ones on white behind a hairline, outgoing ones on
 * a soft indigo wash with ordinary dark text. Nothing is saturated, nothing is
 * filled for decoration, and the only line on the page is the hairline around a
 * bubble.
 */
export const chatColors = {
  page: '#F5F8FD', // the cool paper everything sits on
  surface: '#FFFFFF', // incoming bubbles, the bars
  surfaceLine: '#E4EAF4', // the hairline around them
  mine: '#E1E9FB', // outgoing bubbles
  mineLine: '#D3DEF7',
  ink: '#1E293B', // message text
  sub: '#64748B', // names, secondary lines
  muted: '#94A3B8', // times, day labels
  accent: '#4F46E5', // ticks, the send button, active tabs
  accentSoft: '#EEF2FF',
};

// "Today", "Yesterday", or "14 Sep 2026".
export const dayLabelFor = (date?: string | null): string => {
  if (!date) return '';
  const d = moment(date);
  if (!d.isValid()) return '';
  if (d.isSame(moment(), 'day')) return 'Today';
  if (d.isSame(moment().subtract(1, 'day'), 'day')) return 'Yesterday';
  return d.format('DD MMM YYYY');
};

// A plain centred line between two days — not a pill.
export const DayLabel = ({ label }: { label: string }) => (
  <Text style={s.dayLabel}>{label.toUpperCase()}</Text>
);

const s = StyleSheet.create({
  dayLabel: {
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: chatColors.muted,
    marginTop: 6,
    marginBottom: 14,
  },
});

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { dayOf, soon, timeLine } from '../exam/paperUi';
import { getSeatingLookups } from '../../api/adminSeatingApi';
import type { DatesheetPaper, SeatingLookups } from '../../api/adminSeatingApi';

// ── The exams, classes and sections every filter offers ──────────────────────
// Loaded once and kept, so the tabs and forms open with them already there.
let lastLookups: SeatingLookups | null = null;

export const useSeatingLookups = () => {
  const [lookups, setLookups] = useState<SeatingLookups | null>(lastLookups);
  useEffect(() => {
    getSeatingLookups()
      .then(l => {
        lastLookups = l;
        setLookups(l);
      })
      .catch(() => {});
  }, []);
  return lookups;
};

/**
 * Pieces the Seating Plan screens share: how a seat is written (as the panel
 * writes it), a datesheet paper drawn as a student's date sheet draws one, and
 * a PDF page's skeleton.
 */

// ── Seats ────────────────────────────────────────────────────────────────────
/** 1 → A, 26 → Z, 27 → AA — the panel's SeatLabel::column. */
export const seatColumn = (colNo: number) => {
  let n = colNo;
  let letters = '';
  while (n > 0) {
    n--;
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26);
  }
  return letters || 'A';
};

/** "A1" — the desk: column letter, then row number. */
export const seatLabel = (rowNo: number, colNo: number) => `${seatColumn(colNo)}${rowNo}`;

// ── Words ────────────────────────────────────────────────────────────────────
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Sat, 10 Oct 2026" */
export const longDay = (iso?: string | null) => dayOf(iso)?.format('ddd, D MMM YYYY') ?? '—';

export const statusLabel = (status?: string | null) => (status === 'published' ? 'Published' : 'Draft');

export const PUBLISHED = '#10B981';
export const DRAFT = '#F59E0B';

// ── A datesheet paper, as a student's date sheet draws it ────────────────────
//   OCT   Mathematics                                   SHIFT 2
//    10   10:00 AM – 1:00 PM  ·  3 hrs
//         Saturday  ·  In 5 days
export const DatesheetPaperRow = ({
  paper,
  showShift,
  isLast,
}: {
  paper: DatesheetPaper;
  showShift: boolean;
  isLast: boolean;
}) => {
  const day = dayOf(paper.exam_date);
  const today = !!day && day.isSame(moment(), 'day');
  const past = !!day && day.isBefore(moment(), 'day');
  const when = day ? soon(day) : null;

  return (
    <View style={[s.row, !isLast && s.rowDivider]}>
      <View style={s.dateCol}>
        {day ? (
          <>
            <Text style={[s.dateMonth, today && s.accent]}>{day.format('MMM').toUpperCase()}</Text>
            <Text style={[s.dateDay, today && s.accent, past && s.muted]}>{day.format('D')}</Text>
          </>
        ) : (
          <Text style={[s.dateDay, s.muted]}>—</Text>
        )}
      </View>

      <View style={s.body}>
        <View style={s.line}>
          <Text style={[s.name, s.fill]} numberOfLines={1}>
            {paper.subject_name || 'Subject'}
          </Text>
          {showShift && <Text style={s.shift}>{`SHIFT ${paper.shift || 1}`}</Text>}
        </View>
        <Text style={s.meta} numberOfLines={1}>
          {timeLine(paper)}
        </Text>
        <Text style={s.when} numberOfLines={1}>
          {day ? day.format('dddd') : 'Date to be announced'}
          {!!when && <Text style={today ? s.accent : undefined}>{`  ·  ${when}`}</Text>}
        </Text>
      </View>
    </View>
  );
};

// ── A PDF page loading: an A4 landscape sheet with a heading and lines ───────
export const PdfPageSkeleton = ({ width }: { width: number }) => {
  const inner = width - 32;
  return (
    <View style={s.skWrap}>
      <View style={[s.skPage, { width: inner, height: Math.round((inner * 210) / 297) }]}>
        <Skeleton width={inner * 0.4} height={12} style={s.skCenter} />
        <Skeleton width={inner * 0.25} height={8} style={[s.skCenter, s.skGap]} />
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} width={inner - 32} height={7} style={s.skLine} />
        ))}
      </View>
    </View>
  );
};

const __mk_s = () => StyleSheet.create({
  // Paper row — the day as its own column, then the paper
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  dateCol: { width: 40, alignItems: 'center', paddingTop: 1 },
  dateMonth: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: theme.colors.textMuted },
  dateDay: { fontSize: 20, fontWeight: '600', lineHeight: 24, color: theme.colors.textPrimary, marginTop: 1 },
  muted: { color: theme.colors.textMuted },
  accent: { color: theme.colors.primary },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fill: { flex: 1 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  shift: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textSecondary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  when: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },

  // PDF skeleton
  skWrap: { flex: 1, alignItems: 'center', paddingTop: 16, backgroundColor: theme.colors.background },
  skPage: { backgroundColor: theme.colors.card, padding: 16, borderRadius: 4 },
  skCenter: { alignSelf: 'center' },
  skGap: { marginTop: 8, marginBottom: 12 },
  skLine: { marginTop: 10, alignSelf: 'center' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

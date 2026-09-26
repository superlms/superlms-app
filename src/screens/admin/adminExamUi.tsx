import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import type { AdminExam, AdminExamStatus } from '../../api/adminExamApi';
import { humanize, marksLabel } from '../exam/examUi';

/**
 * The pieces the admin app's Exams pages share, drawn as the student's exam
 * pages are: a search field on the page's grey, status tabs underlined with
 * their counts, filter pills that open a list, and an exam as a plain row —
 * the day it starts, what it is and where it stands — on hairlines.
 */

// ── Status ───────────────────────────────────────────────────────────────────
// The panel's order and words for an exam's status.
export const STATUS_ORDER: AdminExamStatus[] = ['draft', 'published', 'upcoming', 'active', 'completed'];

export const STATUS_LABEL: Record<AdminExamStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  upcoming: 'Upcoming',
  active: 'Active',
  completed: 'Completed',
};

/** The status the server worked out from the dates, or — from an older server — draft or published. */
export const statusOf = (e: AdminExam): AdminExamStatus => e.status ?? (e.is_published ? 'published' : 'draft');

// The panel's exam types, for when the server's options are not to hand.
export const EXAM_TYPES: Record<string, string> = {
  quarterly: 'Quarterly',
  half_yearly: 'Half Yearly',
  annual: 'Annual',
  unit_test: 'Unit Test',
  pre_board: 'Pre Board',
};

export const TERMS = ['Term-1', 'Term-2'];

/** This session and the next, as the panel offers them ("2026-2027", "2027-2028"). */
export const academicYears = (): string[] => {
  const y = new Date().getFullYear();
  return [`${y}-${y + 1}`, `${y + 1}-${y + 2}`];
};

export const typeLabel = (e: Pick<AdminExam, 'exam_type' | 'exam_type_label'>) =>
  e.exam_type_label || EXAM_TYPES[e.exam_type] || humanize(e.exam_type);

// ── Dates ────────────────────────────────────────────────────────────────────
// Only the date part is read, so a timestamp never slides onto the next day.
const dayOf = (iso?: string | null): moment.Moment | null => {
  if (!iso) return null;
  const d = moment(iso.slice(0, 10), 'YYYY-MM-DD', true);
  return d.isValid() ? d : null;
};

const daysUntil = (d: moment.Moment) => d.diff(moment().startOf('day'), 'days');

/** "3 – 26 Feb 2026", "28 Feb – 6 Mar 2026"; "Dates not set" when it has none. */
export const examRange = (e: Pick<AdminExam, 'start_date' | 'end_date'>): string => {
  const from = dayOf(e.start_date);
  const to = dayOf(e.end_date);
  if (!from && !to) return 'Dates not set';
  if (!from || !to) return `${from ? 'From' : 'Until'} ${(from ?? to)!.format('D MMM YYYY')}`;
  if (from.isSame(to, 'day')) return from.format('D MMM YYYY');
  if (from.isSame(to, 'month')) return `${from.format('D')} – ${to.format('D MMM YYYY')}`;
  if (from.isSame(to, 'year')) return `${from.format('D MMM')} – ${to.format('D MMM YYYY')}`;
  return `${from.format('D MMM YYYY')} – ${to.format('D MMM YYYY')}`;
};

const inDays = (n: number, verb: string) =>
  n === 0 ? `${verb} today` : n === 1 ? `${verb} tomorrow` : `${verb} in ${n} days`;

/** How far off it is, in words — only where that agrees with its status. */
export const examWhen = (e: AdminExam): string | null => {
  const st = statusOf(e);
  if (st === 'upcoming' || st === 'published') {
    const from = dayOf(e.start_date);
    const n = from ? daysUntil(from) : -1;
    return n >= 0 ? inDays(n, 'Starts') : null;
  }
  if (st === 'active') {
    const to = dayOf(e.end_date);
    const n = to ? daysUntil(to) : -1;
    return n >= 0 ? inDays(n, 'Ends') : null;
  }
  return null;
};

/** "Wed, 3 Feb 2026", or '' when there is no date. */
export const longDay = (iso?: string | null) => dayOf(iso)?.format('ddd, D MMM YYYY') ?? '';

/** "12 Sep 2026, 10:30 AM" from a timestamp, or ''. */
export const stamp = (iso?: string | null) => (iso ? moment(iso).format('D MMM YYYY, h:mm A') : '');

/** Out of what — "80 marks · pass 33" — or "Grading system". */
export const marksLine = (e: AdminExam): string | null => {
  if (e.uses_grading_system) return 'Grading system';
  const total = marksLabel(e.total_marks);
  if (!total) return null;
  return e.passing_marks ? `${total} · pass ${Number(e.passing_marks)}` : total;
};

/** "Class 6 – A", or the class alone. */
export const classLabel = (standard?: string | null, section?: string | null) =>
  [standard, section].filter(Boolean).join(' – ');

// ── Search ───────────────────────────────────────────────────────────────────
export const SearchField = ({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) => (
  <View style={s.search}>
    <VectorIcon iconSet="Ionicons" iconName="search-outline" size={16} color={theme.colors.textMuted} />
    <TextInput
      style={s.searchInput}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      value={value}
      onChangeText={onChangeText}
      returnKeyType="search"
    />
    {value.length > 0 && (
      <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8} activeOpacity={0.6}>
        <VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>
    )}
  </View>
);

// ── Tabs ─────────────────────────────────────────────────────────────────────
// As on the student's Exams: the words underlined in the accent when chosen,
// each with its count in grey, and a full-width line under the strip.
export function UnderlineTabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: K; label: string; count?: number }[];
  active: K;
  onChange: (k: K) => void;
}) {
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsBar} contentContainerStyle={s.tabs}>
        {tabs.map(t => {
          const on = t.key === active;
          return (
            <TouchableOpacity key={t.key} activeOpacity={0.6} onPress={() => onChange(t.key)} style={[s.tab, on && s.tabActive]}>
              <Text style={[s.tabText, on && s.tabTextActive]}>
                {t.label}
                {t.count !== undefined && <Text style={s.tabCount}>{`  ${t.count}`}</Text>}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={s.fullDivider} />
    </>
  );
}

// ── Filters ──────────────────────────────────────────────────────────────────
// A pill that says what it narrows to and opens a list; tinted once it narrows.
export const FilterChip = ({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[s.pill, active && s.pillActive, disabled && s.pillDisabled]}
    activeOpacity={0.7}
    disabled={disabled}
    onPress={onPress}
  >
    <Text style={[s.pillText, active && s.pillTextActive]} numberOfLines={1}>
      {label}
    </Text>
    <VectorIcon
      iconSet="Ionicons"
      iconName="chevron-down"
      size={12}
      color={active ? theme.colors.primary : theme.colors.textMuted}
    />
  </TouchableOpacity>
);

/** The pills in a row that scrolls sideways, with Clear once any of them narrows. */
export const FilterBar = ({
  children,
  onClear,
}: {
  children: React.ReactNode;
  /** Given, a Clear link ends the row. */
  onClear?: () => void;
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={s.filterBar}
    contentContainerStyle={s.filters}
    keyboardShouldPersistTaps="handled"
  >
    {children}
    {!!onClear && (
      <TouchableOpacity onPress={onClear} hitSlop={8} activeOpacity={0.6} style={s.clear}>
        <Text style={s.clearText}>Clear</Text>
      </TouchableOpacity>
    )}
  </ScrollView>
);

// ── One exam ─────────────────────────────────────────────────────────────────
//   FEB   Half Yearly Exam                              ACTIVE
//    10   Term-1 · Half Yearly · 80 marks · pass 33
//         10 – 20 Feb 2026  ·  Ends in 4 days
export const AdminExamRow = ({
  exam,
  showYear,
  isLast,
  onPress,
}: {
  exam: AdminExam;
  /** Add the academic year, for a list that spans several. */
  showYear?: boolean;
  isLast: boolean;
  onPress: () => void;
}) => {
  const from = dayOf(exam.start_date);
  const st = statusOf(exam);
  const live = st === 'active';
  const quiet = st === 'completed' || st === 'draft';
  const when = examWhen(exam);

  const seen = new Set([exam.exam_name.trim().toLowerCase()]);
  const meta = [exam.term, typeLabel(exam), showYear ? exam.academic_year : null, marksLine(exam)]
    .filter((v): v is string => {
      const key = (v ?? '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(' · ');

  return (
    <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onPress}>
      <View style={s.dateCol}>
        {from ? (
          <>
            <Text style={[s.dateMonth, live && s.accent]}>{from.format('MMM').toUpperCase()}</Text>
            <Text style={[s.dateDay, live && s.accent, quiet && s.muted]}>{from.format('D')}</Text>
          </>
        ) : (
          <Text style={[s.dateDay, s.muted]}>—</Text>
        )}
      </View>

      <View style={s.body}>
        <View style={s.line}>
          <Text style={s.name} numberOfLines={1}>
            {exam.exam_name}
          </Text>
          <Text style={[s.status, live && s.accent, quiet && s.muted]}>{STATUS_LABEL[st].toUpperCase()}</Text>
        </View>
        {!!meta && (
          <Text style={s.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
        <Text style={s.when} numberOfLines={1}>
          {examRange(exam)}
          {!!when && <Text style={live ? s.accent : undefined}>{`  ·  ${when}`}</Text>}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ── A plain row: a round icon, the title, and a line or two under it ────────
//   (📄)  Mathematics Question Paper
//         Half Yearly · Class 6 – A
//         Mathematics · 12 Sep 2026
export const PlainRow = ({
  icon,
  title,
  lines,
  isLast,
  onPress,
}: {
  icon: string;
  title: string;
  lines: (string | null | undefined)[];
  isLast: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={[s.plainRow, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onPress}>
    <View style={s.lead}>
      <VectorIcon iconSet="Ionicons" iconName={icon} size={17} color={theme.colors.textSecondary} />
    </View>
    <View style={s.plainBody}>
      <Text style={s.name} numberOfLines={1}>
        {title}
      </Text>
      {lines
        .filter((l): l is string => !!l)
        .map((l, i) => (
          <Text key={i} style={i === 0 ? s.meta : s.when} numberOfLines={1}>
            {l}
          </Text>
        ))}
    </View>
    <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
  </TouchableOpacity>
);

// ── Loading and errors ───────────────────────────────────────────────────────
/** Rows as bars, led by a date column or a round icon. */
export const RowsSkeleton = ({ rows = 6, lead = 'date' }: { rows?: number; lead?: 'date' | 'icon' }) => (
  <View style={s.list}>
    {Array.from({ length: rows }, (_, i) => (
      <View key={i} style={[lead === 'date' ? s.row : s.plainRow, i < rows - 1 && s.rowDivider]}>
        {lead === 'date' ? (
          <View style={s.dateCol}>
            <Skeleton width={26} height={10} />
            <Skeleton width={20} height={18} style={s.skDay} />
          </View>
        ) : (
          <Skeleton width={36} height={36} radius={18} />
        )}
        <View style={s.skBody}>
          <Skeleton width={['52%', '44%', '60%'][i % 3] as any} height={14} />
          <Skeleton width={['34%', '40%', '28%'][i % 3] as any} height={12} />
          <Skeleton width={['58%', '50%', '62%'][i % 3] as any} height={12} />
        </View>
      </View>
    ))}
  </View>
);

export const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <View style={s.centeredBox}>
    <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
    <Text style={s.errorText}>{message}</Text>
    <TouchableOpacity onPress={onRetry} hitSlop={10}>
      <Text style={s.linkText}>Try again</Text>
    </TouchableOpacity>
  </View>
);

// The date column and the gap after it.
const DATE_COL = 40;
const GAP = 16;

const __mk_s = () => StyleSheet.create({
  // Search
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  // Tabs. A horizontal ScrollView grows to fill a column by default, so the
  // bar is held to its content.
  tabsBar: { flexGrow: 0 },
  tabs: { paddingHorizontal: 20, paddingTop: 12, gap: 20 },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },
  tabCount: { fontWeight: '400', color: theme.colors.textMuted },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // Filters
  filterBar: { flexGrow: 0 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 190,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  pillDisabled: { opacity: 0.45 },
  pillText: { flexShrink: 1, fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },
  pillTextActive: { color: theme.colors.primary },
  clear: { paddingHorizontal: 6 },
  clearText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },

  // List
  list: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 40 },

  // Exam row — the start date as its own column, then what the exam is.
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: GAP, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  dateCol: { width: DATE_COL, alignItems: 'center', paddingTop: 1 },
  dateMonth: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: theme.colors.textMuted },
  dateDay: { fontSize: 20, fontWeight: '600', lineHeight: 24, color: theme.colors.textPrimary, marginTop: 1 },
  accent: { color: theme.colors.primary },
  muted: { color: theme.colors.textMuted },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  status: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textSecondary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  when: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },

  // Plain row
  plainRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  lead: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  plainBody: { flex: 1, gap: 3 },

  // Loading
  skDay: { marginTop: 6 },
  skBody: { flex: 1, gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

export { s as adminExamStyles };

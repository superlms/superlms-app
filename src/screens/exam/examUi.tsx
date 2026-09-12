import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { DocNoData } from '../more/docUi';
import type { Exam, ExamStatus, SyllabusItem } from './examData';

/**
 * The pieces the student and teacher exam screens share.
 *
 * An exam is a plain row: the day it starts, what it is, and how far off it
 * is — separated by hairlines. No accent bars, tinted icon tiles or pills; the
 * only colour on a row is an exam that is under way.
 */

// "unit_test" → "Unit Test", "theory" → "Theory". A value the school typed with
// its own capitals ("Term-1", "Pre-Board") is left exactly as it is.
export const humanize = (v?: string | null): string => {
  const t = (v ?? '').replace(/_+/g, ' ').trim();
  return t === t.toLowerCase() ? t.replace(/\b[a-z]/g, c => c.toUpperCase()) : t;
};

// "2026-27" and "2026-2027" are the same academic year; both key on 2026.
const yearKey = (y: string) => /\d{4}/.exec(y)?.[0] ?? y;

// "2026-02-03" or "2026-02-03T00:00:00Z" → that calendar day. Only the date
// part is read, so a UTC timestamp can never slide onto the neighbouring day.
const dayOf = (iso?: string | null): moment.Moment | null => {
  if (!iso) return null;
  const d = moment(iso.slice(0, 10), 'YYYY-MM-DD', true);
  return d.isValid() ? d : null;
};

// Whole days from today: 0 today, 1 tomorrow, negative once it has passed.
const daysUntil = (d: moment.Moment) => d.diff(moment().startOf('day'), 'days');

// "Wed, 3 Feb 2026", or '' when the date is missing.
export const longDate = (iso?: string | null): string =>
  dayOf(iso)?.format('ddd, D MMM YYYY') ?? '';

// "3 – 26 Feb 2026", "28 Feb – 6 Mar 2026", "20 Dec 2025 – 4 Jan 2026".
export const shortRange = (exam: Exam): string => {
  const from = dayOf(exam.startIso);
  const to = dayOf(exam.endIso);
  if (!from && !to) return exam.dateRange;
  if (!from || !to) return (from ?? to)!.format('D MMM YYYY');
  if (from.isSame(to, 'day')) return from.format('D MMM YYYY');
  if (from.isSame(to, 'month')) return `${from.format('D')} – ${to.format('D MMM YYYY')}`;
  if (from.isSame(to, 'year')) return `${from.format('D MMM')} – ${to.format('D MMM YYYY')}`;
  return `${from.format('D MMM YYYY')} – ${to.format('D MMM YYYY')}`;
};

const inDays = (n: number, verb: string) =>
  n === 0 ? `${verb} today` : n === 1 ? `${verb} tomorrow` : `${verb} in ${n} days`;

// How far off an exam is, in words. The phrase has to agree with the status the
// school set, so a status that lags its dates gives nothing rather than
// "starts in -3 days".
export const examWhen = (exam: Exam): string | null => {
  if (exam.status === 'Upcoming') {
    const from = dayOf(exam.startIso);
    const n = from ? daysUntil(from) : -1;
    return n >= 0 ? inDays(n, 'Starts') : null;
  }
  if (exam.status === 'Ongoing') {
    const to = dayOf(exam.endIso);
    const n = to ? daysUntil(to) : -1;
    return n >= 0 ? inDays(n, 'Ends') : null;
  }
  return null;
};

const STATUS_ORDER: ExamStatus[] = ['Ongoing', 'Upcoming', 'Completed'];

// Under way first, then whatever starts soonest, then whatever finished most
// recently. An exam without dates goes to the end of its group.
export const sortExams = (list: Exam[]): Exam[] =>
  [...list].sort((a, b) => {
    const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (byStatus) return byStatus;
    const ka = a.startIso?.slice(0, 10) ?? '';
    const kb = b.startIso?.slice(0, 10) ?? '';
    if (ka === kb) return 0;
    if (!ka) return 1;
    if (!kb) return -1;
    const asc = ka < kb ? -1 : 1;
    return a.status === 'Completed' ? -asc : asc;
  });

// ── One exam ─────────────────────────────────────────────────────────────────
//   FEB   Mid Term                                ONGOING
//    10   Term 1 · Unit Test
//         10 – 20 Feb 2026  ·  Ends in 4 days
export const ExamRow = ({
  exam,
  showYear,
  isLast,
  onPress,
  cue,
  expanded,
  children,
}: {
  exam: Exam;
  /** Add the academic year to the meta line, for lists that span several. */
  showYear?: boolean;
  isLast: boolean;
  onPress: () => void;
  /** A quiet link under the row, for rows that open in place. */
  cue?: string;
  expanded?: boolean;
  /** What the row opens onto, set in under the text column. */
  children?: React.ReactNode;
}) => {
  const from = dayOf(exam.startIso);
  const live = exam.status === 'Ongoing';
  const done = exam.status === 'Completed';
  const when = examWhen(exam);

  // Term and type, minus anything that only repeats the exam's own name.
  const seen = new Set([exam.name.trim().toLowerCase()]);
  const meta = [humanize(exam.term), humanize(exam.type), showYear ? exam.academicYear : null]
    .filter((v): v is string => {
      const key = (v ?? '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(' · ');

  return (
    <View style={[!isLast && s.rowDivider]}>
      <TouchableOpacity style={s.row} activeOpacity={0.6} onPress={onPress}>
        <View style={s.dateCol}>
          {from ? (
            <>
              <Text style={[s.dateMonth, live && s.accent]}>
                {from.format('MMM').toUpperCase()}
              </Text>
              <Text style={[s.dateDay, live && s.accent, done && s.dateDayDone]}>
                {from.format('D')}
              </Text>
            </>
          ) : (
            <Text style={[s.dateDay, s.dateDayDone]}>—</Text>
          )}
        </View>

        <View style={s.body}>
          <View style={s.line}>
            <Text style={s.name} numberOfLines={1}>
              {exam.name}
            </Text>
            <Text style={[s.status, live && s.accent, done && s.statusDone]}>
              {exam.status.toUpperCase()}
            </Text>
          </View>
          {!!meta && (
            <Text style={s.meta} numberOfLines={1}>
              {meta}
            </Text>
          )}
          <Text style={s.when} numberOfLines={1}>
            {shortRange(exam)}
            {!!when && <Text style={live ? s.accent : undefined}>{`  ·  ${when}`}</Text>}
          </Text>
          {!!cue && (
            <View style={s.cue}>
              <Text style={s.cueText}>{cue}</Text>
              <VectorIcon
                iconSet="Ionicons"
                iconName={expanded ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={theme.colors.primary}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {!!children && <View style={s.below}>{children}</View>}
    </View>
  );
};

// ── Syllabus ─────────────────────────────────────────────────────────────────
// Each subject on its own line with how many topics it has, and the topics
// underneath as one run of text rather than a chip each.
export const SyllabusList = ({ items }: { items: SyllabusItem[] }) => (
  <View>
    {items.map((item, i) => (
      <View
        key={`${item.subject}-${i}`}
        style={[s.sylRow, i < items.length - 1 && s.sylDivider]}
      >
        <View style={s.line}>
          <Text style={s.sylSubject} numberOfLines={1}>
            {item.subject}
          </Text>
          <Text style={s.sylCount}>
            {item.topics.length} {item.topics.length === 1 ? 'topic' : 'topics'}
          </Text>
        </View>
        {item.topics.length > 0 && (
          <Text style={s.sylTopics}>{item.topics.join('  ·  ')}</Text>
        )}
      </View>
    ))}
  </View>
);

// ── The whole list ───────────────────────────────────────────────────────────
type Tab = ExamStatus | 'All';

// A search field only earns its row once there is a list to hunt through.
const SEARCH_FROM = 8;

export const ExamList = ({
  exams,
  loading,
  refreshing,
  onRefresh,
  error,
  onRetry,
  onPressExam,
  rowExtras,
  emptySubtitle,
}: {
  exams: Exam[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  error: string | null;
  onRetry: () => void;
  onPressExam: (exam: Exam) => void;
  /** Per-row additions — the teacher's screen opens a syllabus in place. */
  rowExtras?: (exam: Exam) => { cue?: string; expanded?: boolean; below?: React.ReactNode };
  emptySubtitle: string;
}) => {
  const [tab, setTab] = useState<Tab>('All');
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => sortExams(exams), [exams]);

  const counts = useMemo(() => {
    const c: Record<ExamStatus, number> = { Ongoing: 0, Upcoming: 0, Completed: 0 };
    exams.forEach(e => {
      c[e.status] += 1;
    });
    return c;
  }, [exams]);

  // All, then only the statuses that actually have exams — and no strip at all
  // when every exam shares one status.
  const tabs = useMemo<Tab[]>(() => {
    const present = STATUS_ORDER.filter(st => counts[st] > 0);
    return present.length > 1 ? ['All', ...present] : [];
  }, [counts]);

  // A refresh can take away the status being looked at; fall back to All.
  const activeTab: Tab = tabs.includes(tab) ? tab : 'All';

  const showYear = useMemo(
    () => new Set(exams.map(e => e.academicYear).filter(Boolean).map(yearKey)).size > 1,
    [exams],
  );

  const searching = exams.length >= SEARCH_FROM;
  const q = searching ? query.trim().toLowerCase() : '';

  const visible = sorted.filter(
    e =>
      (activeTab === 'All' || e.status === activeTab) &&
      (!q ||
        [e.name, humanize(e.type), humanize(e.term), e.academicYear].some(v =>
          v.toLowerCase().includes(q),
        )),
  );

  const refreshControl = <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />;

  if (loading && !refreshing && exams.length === 0) {
    return (
      <View style={s.list}>
        {[0, 1, 2, 3, 4].map(i => (
          <View key={i} style={[s.row, i < 4 && s.rowDivider]}>
            <View style={s.dateCol}>
              <Skeleton width={26} height={10} />
              <Skeleton width={20} height={18} style={s.skeletonDay} />
            </View>
            <View style={s.skeletonBody}>
              <Skeleton width="50%" height={14} />
              <Skeleton width="32%" height={12} />
              <Skeleton width="60%" height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (error && exams.length === 0) {
    return (
      <ScrollView contentContainerStyle={s.grow} refreshControl={refreshControl}>
        <View style={s.centeredBox}>
          <VectorIcon
            iconSet="Ionicons"
            iconName="cloud-offline-outline"
            size={32}
            color={theme.colors.textMuted}
          />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={onRetry} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      {searching && (
        <View style={[s.search, tabs.length === 0 && s.searchAlone]}>
          <VectorIcon iconSet="Ionicons" iconName="search-outline" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search exams"
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} activeOpacity={0.6}>
              <VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {tabs.length > 0 && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.tabsBar}
            contentContainerStyle={s.tabs}
          >
            {tabs.map(t => {
              const active = activeTab === t;
              return (
                <TouchableOpacity
                  key={t}
                  activeOpacity={0.6}
                  onPress={() => setTab(t)}
                  style={[s.tab, active && s.tabActive]}
                >
                  <Text style={[s.tabText, active && s.tabTextActive]}>
                    {t}
                    <Text style={s.tabCount}>{`  ${t === 'All' ? exams.length : counts[t]}`}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={s.fullDivider} />
        </>
      )}

      <ScrollView
        style={s.fill}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.list, visible.length === 0 && s.grow]}
        refreshControl={refreshControl}
      >
        {visible.length === 0 ? (
          q ? (
            <DocNoData
              icon="search-outline"
              title="No matches"
              subtitle={`No exam matches “${query.trim()}”.`}
            />
          ) : (
            <DocNoData icon="school-outline" title="No exams" subtitle={emptySubtitle} />
          )
        ) : (
          visible.map((exam, i) => {
            const extra = rowExtras?.(exam);
            return (
              <ExamRow
                key={exam.id}
                exam={exam}
                showYear={showYear}
                isLast={i === visible.length - 1}
                onPress={() => onPressExam(exam)}
                cue={extra?.cue}
                expanded={extra?.expanded}
              >
                {extra?.below}
              </ExamRow>
            );
          })
        )}
      </ScrollView>
    </>
  );
};

// The date column and the gap after it — the opened-in-place block lines up
// with the text column by adding the two.
const DATE_COL = 40;
const GAP = 16;

const __mk_s = () => StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },

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
  searchAlone: { marginBottom: 4 },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  // Status tabs. A horizontal ScrollView grows to fill a column by default,
  // so the bar is held to its content.
  tabsBar: { flexGrow: 0 },
  tabs: { paddingHorizontal: 20, paddingTop: 12, gap: 20 },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },
  tabCount: { fontWeight: '400', color: theme.colors.textMuted },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // List
  list: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 40 },

  // Row — the start date as its own column, then what the exam is.
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: GAP, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  dateCol: { width: DATE_COL, alignItems: 'center', paddingTop: 1 },
  dateMonth: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: theme.colors.textMuted },
  dateDay: { fontSize: 20, fontWeight: '600', lineHeight: 24, color: theme.colors.textPrimary, marginTop: 1 },
  dateDayDone: { color: theme.colors.textMuted },
  accent: { color: theme.colors.primary },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  status: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textSecondary },
  statusDone: { color: theme.colors.textMuted },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  when: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  cue: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 },
  cueText: { fontSize: 13, fontWeight: '500', color: theme.colors.primary },
  below: { marginLeft: DATE_COL + GAP, marginBottom: 14 },

  // Syllabus
  sylRow: { paddingVertical: 10 },
  sylDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  sylSubject: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  sylCount: { fontSize: 12, color: theme.colors.textMuted },
  sylTopics: { fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary, marginTop: 3 },

  // Loading
  skeletonDay: { marginTop: 6 },
  skeletonBody: { flex: 1, gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

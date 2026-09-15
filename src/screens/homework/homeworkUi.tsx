import React, { useCallback, useRef } from 'react';
import {
  Linking,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { SkeletonIcon, SkeletonText } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { fmtTime } from '../../api/timetableApi';
import type { HomeworkItem } from '../../api/homeworkApi';
import { AppAlert } from '../../components/AppDialog';

/**
 * The pieces the student and teacher homework screens share.
 *
 * The last fortnight as a row of dated pills, then the chosen day's homework as
 * plain rows on hairlines: its period and file, whose it is, the task itself.
 * No accent bars, emoji tiles or pills.
 *
 * Every piece takes `skeleton`, and a load draws the page itself that way — the
 * same heading, rows, lines and icons as grey bars and boxes — so the skeleton
 * cannot drift from the page.
 */

export const HOMEWORK_DAYS = 15;

// A day as the API writes it, read in local time — not toISOString(), which is
// UTC and turns "today" into yesterday before 05:30 in India.
export const dayKey = (d: moment.Moment) => d.format('YYYY-MM-DD');
export const todayKey = () => dayKey(moment());

// The last fortnight, ending today.
const recentDays = () =>
  Array.from({ length: HOMEWORK_DAYS }, (_, i) =>
    moment().startOf('day').subtract(HOMEWORK_DAYS - 1 - i, 'days'),
  );

// "Today, 13 September", "Yesterday, 12 September", "Friday, 11 September".
export const dayTitle = (key: string) => {
  const d = moment(key, 'YYYY-MM-DD');
  const diff = moment().startOf('day').diff(d, 'days');
  const date = d.format('D MMMM');
  return diff === 0 ? `Today, ${date}` : diff === 1 ? `Yesterday, ${date}` : d.format('dddd, D MMMM');
};

// "3 tasks", "1 task"
export const tasks = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;

// "09:00 AM – 09:45 AM": the homework's period in the timetable.
export const periodLabel = (hw: HomeworkItem) =>
  hw.period_start ? [fmtTime(hw.period_start), fmtTime(hw.period_end)].filter(Boolean).join(' – ') : null;

export const openFile = async (url?: string | null) => {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    AppAlert.alert('Error', 'Unable to open this attachment.');
  }
};

// ── Text and icons, or their skeletons ───────────────────────────────────────
const Words = ({
  skeleton,
  style,
  children,
}: {
  skeleton?: boolean;
  style: StyleProp<TextStyle>;
  children: React.ReactNode;
}) =>
  skeleton ? <SkeletonText style={style}>{children}</SkeletonText> : <Text style={style}>{children}</Text>;

const Glyph = ({
  skeleton,
  ...icon
}: {
  skeleton?: boolean;
  iconName: string;
  size: number;
  color: string;
}) => (skeleton ? <SkeletonIcon iconSet="Ionicons" {...icon} /> : <VectorIcon iconSet="Ionicons" {...icon} />);

// ── Days ─────────────────────────────────────────────────────────────────────
// The chosen day is filled; today, when it is not the chosen one, is outlined
// and written in the accent colour. A day with homework carries a dot. The
// strip opens scrolled to its end, where today is.
export const DateStrip = ({
  selected,
  onSelect,
  marked,
}: {
  selected: string;
  onSelect: (key: string) => void;
  marked: Set<string>;
}) => {
  const ref = useRef<ScrollView>(null);
  const today = todayKey();

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      // A horizontal ScrollView grows to fill a column by default.
      style={s.stripBar}
      contentContainerStyle={s.strip}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}
    >
      {recentDays().map(d => {
        const key = dayKey(d);
        const active = key === selected;
        const isToday = key === today;
        const textStyle = [active && s.dayTextActive, !active && isToday && s.dayTextToday];

        return (
          <TouchableOpacity
            key={key}
            activeOpacity={0.7}
            onPress={() => onSelect(key)}
            style={[s.day, active && s.dayActive, !active && isToday && s.dayToday]}
          >
            <Text style={[s.dayName, ...textStyle]}>{d.format('ddd')}</Text>
            <Text style={[s.dayDate, ...textStyle]}>{d.format('D')}</Text>
            <View style={[s.dot, marked.has(key) && (active ? s.dotActive : s.dotOn)]} />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

// ── Day heading ──────────────────────────────────────────────────────────────
export const DayHead = ({
  day,
  line,
  skeleton,
}: {
  day: string;
  line?: string | null;
  skeleton?: boolean;
}) => (
  <View style={s.dayHead}>
    <Words skeleton={skeleton} style={s.dayTitle}>{dayTitle(day)}</Words>
    {!!line && <Words skeleton={skeleton} style={s.dayLine}>{line}</Words>}
  </View>
);

// ── A section of the day: a student's Completed ─────────────────────────────
export const SectionTitle = ({
  title,
  first,
  skeleton,
}: {
  title: string;
  first?: boolean;
  skeleton?: boolean;
}) => (
  <Words skeleton={skeleton} style={[s.sectionTitle, first && s.sectionTitleFirst]}>
    {title}
  </Words>
);

// ── The tick a student marks homework complete with ─────────────────────────
// A box to tick: empty and grey while still to do, filled green once done —
// Present's green on Mark Attendance.
const TICK = 21;
const TICK_GREEN = '#16A34A';

export const CompleteTick = ({
  done,
  onPress,
  skeleton,
}: {
  done: boolean;
  onPress?: () => void;
  skeleton?: boolean;
}) => (
  <TouchableOpacity
    hitSlop={10}
    activeOpacity={0.6}
    disabled={done || !onPress || skeleton}
    onPress={onPress}
    accessibilityRole="checkbox"
    accessibilityState={{ checked: done }}
    accessibilityLabel={done ? 'Completed' : 'Mark as complete'}
  >
    <Glyph
      skeleton={skeleton}
      iconName={done ? 'checkbox' : 'square-outline'}
      size={TICK}
      color={done ? TICK_GREEN : theme.colors.textMuted}
    />
  </TouchableOpacity>
);

// ── A teacher's edit and delete ──────────────────────────────────────────────
export const RowActions = ({
  onEdit,
  onDelete,
  skeleton,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  skeleton?: boolean;
}) => (
  <View style={s.actions}>
    <TouchableOpacity onPress={onEdit} disabled={skeleton} hitSlop={10} activeOpacity={0.6}>
      <Glyph skeleton={skeleton} iconName="create-outline" size={17} color={theme.colors.textMuted} />
    </TouchableOpacity>
    <TouchableOpacity onPress={onDelete} disabled={skeleton} hitSlop={10} activeOpacity={0.6}>
      <Glyph skeleton={skeleton} iconName="trash-outline" size={17} color={theme.colors.textMuted} />
    </TouchableOpacity>
  </View>
);

// ── One homework ─────────────────────────────────────────────────────────────
// The period's time and the attachment share the top line with the row's
// actions; under them whose it is, the title and the whole task, each running
// to the row's right edge.
//   09:00 AM – 09:45 AM · View image                             ✎  🗑
//   Mathematics · 10th (A)          (a student's: Mathematics · Ms. Patel)
//   Chapter 3 Exercise
//   Solve problems 1–10 from chapter 3, showing every step.
export const HomeworkRow = ({
  hw,
  period,
  heading,
  trailing,
  done,
  isLast,
  onPreviewImage,
  skeleton,
}: {
  hw: HomeworkItem;
  period?: string | null;
  // "Mathematics · 10th (A)" for the teacher, "Mathematics · Ms. Patel" for a student.
  heading?: string;
  trailing?: React.ReactNode;
  // Completed: the title and task in quieter ink.
  done?: boolean;
  isLast: boolean;
  onPreviewImage: (url: string) => void;
  skeleton?: boolean;
}) => {
  const desc = hw.description?.trim();
  const isImage = hw.file_type === 'image';
  const hasFile = !!hw.file_url;
  // With no time and no file, the heading takes the top line itself.
  const hasTop = !!period || hasFile;

  return (
    <View style={[s.row, !isLast && s.rowDivider]}>
      <View style={s.topLine}>
        <View style={s.topLeft}>
          {hasTop ? (
            <>
              {!!period && <Words skeleton={skeleton} style={s.period}>{period}</Words>}
              {/* The dot keeps its room in a skeleton, unseen */}
              {!!period && hasFile && <Text style={[s.heading, skeleton && s.unseen]}>·</Text>}
              {hasFile && (
                <TouchableOpacity
                  style={s.attach}
                  hitSlop={6}
                  activeOpacity={0.6}
                  disabled={skeleton}
                  onPress={() => (isImage ? onPreviewImage(hw.file_url!) : openFile(hw.file_url))}
                >
                  <Glyph
                    skeleton={skeleton}
                    iconName={isImage ? 'image-outline' : 'document-attach-outline'}
                    size={13}
                    color={theme.colors.primary}
                  />
                  <Words skeleton={skeleton} style={s.attachText}>
                    {isImage ? 'View image' : 'Open attachment'}
                  </Words>
                </TouchableOpacity>
              )}
            </>
          ) : (
            !!heading && <Words skeleton={skeleton} style={s.heading}>{heading}</Words>
          )}
        </View>
        {trailing}
      </View>
      {hasTop && !!heading && <Words skeleton={skeleton} style={s.heading}>{heading}</Words>}
      <Words skeleton={skeleton} style={[s.title, done && s.titleDone]}>{quietCaps(hw.title)}</Words>
      {!!desc && <Words skeleton={skeleton} style={[s.desc, done && s.descDone]}>{desc}</Words>}
    </View>
  );
};

// ── Loading ──────────────────────────────────────────────────────────────────
// A load or a pull to refresh shows the page as a skeleton: the day's heading,
// its homework row for row — each one's time, file, whose it is, title and
// task on the lines they take — a student's Completed section, or the empty
// day. Still, and hidden from screen readers.
export const SkeletonList = ({
  bare,
  children,
}: {
  // Without the list's side padding, for a page that has none (No subject assigned).
  bare?: boolean;
  children: React.ReactNode;
}) => (
  <View
    style={s.skeleton}
    pointerEvents="none"
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
  >
    <View style={bare ? undefined : s.list}>{children}</View>
  </View>
);

/** What a list held the last time it loaded on this phone. */
export interface LastHomework {
  items: HomeworkItem[];
  // A teacher with no subjects in the timetable.
  noSubjects?: boolean;
}

// A day of ordinary homework, for a list never loaded on this phone.
const sample = (
  id: number,
  day: string,
  subject: string,
  title: string,
  description: string,
  period: [string, string],
  file: HomeworkItem['file_type'],
): HomeworkItem => ({
  id,
  title,
  description,
  subject: { id, name: subject, code: null },
  standard: '10th',
  standard_id: null,
  section: 'A',
  section_id: null,
  assigned_by: 'Class teacher',
  assigned_date: day,
  assigned_time: null,
  days_ago: null,
  file_url: file ? 'file' : null,
  file_type: file,
  period_start: period[0],
  period_end: period[1],
  is_completed: false,
});

const sampleDay = (day: string) => [
  sample(-1, day, 'Mathematics', 'Chapter 3 exercise',
    'Solve questions 1 to 10 from the exercise, showing every step of your working.', ['09:00', '09:45'], 'image'),
  sample(-2, day, 'English', 'Reading comprehension',
    'Read pages 42 to 48 and answer the questions at the end of the lesson.', ['10:00', '10:45'], null),
  sample(-3, day, 'Science', 'The water cycle',
    'Write a short note on the water cycle with a labelled diagram.', ['11:00', '11:45'], 'pdf'),
];

/**
 * The homework a loading page is drawn from: what is on screen once the list
 * has loaded; before that, what it held last time if that has the day; or a
 * sample day.
 */
export const homeworkToDraw = (
  loaded: boolean,
  items: HomeworkItem[],
  last: LastHomework | null | undefined,
  day: string,
) => (loaded ? items : last?.items?.some(h => h.assigned_date === day) ? last.items : sampleDay(day));

/**
 * What this list held the last time it loaded on this phone, for this account,
 * and `remember` for each load. Only the words and whether there was a file are
 * kept, never the file's link.
 */
export const useLastHomework = (who: 'student' | 'teacher') => {
  const [last, remember] = useLastLoaded<LastHomework>(`homework:${who}`);

  const rememberHomework = useCallback(
    (next: LastHomework) =>
      remember({ ...next, items: next.items.map(h => ({ ...h, file_url: h.file_url ? 'file' : null })) }),
    [remember],
  );

  return [last, rememberHomework] as const;
};

export const ErrorBox = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <View style={s.centeredBox}>
    <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
    <Text style={s.errorText}>{message}</Text>
    <TouchableOpacity onPress={onRetry} hitSlop={10}>
      <Text style={s.linkText}>Try again</Text>
    </TouchableOpacity>
  </View>
);

const __mk_s = () => StyleSheet.create({
  // Days
  stripBar: { flexGrow: 0 },
  strip: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  day: {
    width: 48,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  dayActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayToday: { borderColor: theme.colors.primary },
  dayName: { fontSize: 11, fontWeight: '500', color: theme.colors.textMuted },
  dayDate: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 2 },
  dayTextActive: { color: theme.colors.white },
  dayTextToday: { color: theme.colors.primary },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 4, backgroundColor: 'transparent' },
  dotOn: { backgroundColor: theme.colors.primary },
  dotActive: { backgroundColor: theme.colors.white },

  // Day heading and sections
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  dayHead: { paddingTop: 14, paddingBottom: 4 },
  dayTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  dayLine: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 22, marginBottom: 2 },
  sectionTitleFirst: { marginTop: 10 },

  // Row: the top line with its actions, then full-width lines
  row: { paddingVertical: 14, gap: 3 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topLeft: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6 },
  period: { fontSize: 12, lineHeight: 17, fontWeight: '600', color: theme.colors.primary },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // As big as the heading under it
  attachText: { fontSize: 12, lineHeight: 17, fontWeight: '500', color: theme.colors.primary },
  heading: { fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
  title: { fontSize: 15, fontWeight: '500', lineHeight: 20, color: theme.colors.textPrimary },
  titleDone: { color: theme.colors.textSecondary },
  desc: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, marginTop: 3 },
  descDone: { color: theme.colors.textMuted },
  // A teacher's edit and delete, side by side
  actions: { flexDirection: 'row', gap: 18 },

  // Loading
  skeleton: { flex: 1, overflow: 'hidden' },
  // Hidden by opacity: on Android a transparent text colour draws as black.
  unseen: { opacity: 0 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

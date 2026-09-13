import React, { useRef } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { fmtTime } from '../../api/timetableApi';
import type { HomeworkItem } from '../../api/homeworkApi';

/**
 * The pieces the student and teacher homework screens share.
 *
 * The last fortnight as a row of dated pills, then the chosen day's homework as
 * plain rows on hairlines: its period and file, whose it is, the task itself.
 * No accent bars, emoji tiles or pills.
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
    Alert.alert('Error', 'Unable to open this attachment.');
  }
};

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
export const DayHead = ({ day, line }: { day: string; line?: string | null }) => (
  <View style={s.dayHead}>
    <Text style={s.dayTitle}>{dayTitle(day)}</Text>
    {!!line && <Text style={s.dayLine}>{line}</Text>}
  </View>
);

// ── The tick a student marks homework complete with ─────────────────────────
export const CompleteTick = ({ done, onPress }: { done: boolean; onPress?: () => void }) => (
  <TouchableOpacity
    hitSlop={10}
    activeOpacity={0.6}
    disabled={done || !onPress}
    onPress={onPress}
    accessibilityLabel={done ? 'Completed' : 'Mark as complete'}
  >
    <VectorIcon
      iconSet="Ionicons"
      iconName={done ? 'checkmark-circle' : 'checkmark-circle-outline'}
      size={21}
      color={done ? theme.colors.success : theme.colors.textMuted}
    />
  </TouchableOpacity>
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
              {!!period && <Text style={s.period}>{period}</Text>}
              {!!period && hasFile && <Text style={s.heading}>·</Text>}
              {hasFile && (
                <TouchableOpacity
                  style={s.attach}
                  hitSlop={6}
                  activeOpacity={0.6}
                  onPress={() => (isImage ? onPreviewImage(hw.file_url!) : openFile(hw.file_url))}
                >
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName={isImage ? 'image-outline' : 'document-attach-outline'}
                    size={13}
                    color={theme.colors.primary}
                  />
                  <Text style={s.attachText}>{isImage ? 'View image' : 'Open attachment'}</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            !!heading && <Text style={s.heading}>{heading}</Text>
          )}
        </View>
        {trailing}
      </View>
      {hasTop && !!heading && <Text style={s.heading}>{heading}</Text>}
      <Text style={[s.title, done && s.titleDone]}>{quietCaps(hw.title)}</Text>
      {!!desc && <Text style={[s.desc, done && s.descDone]}>{desc}</Text>}
    </View>
  );
};

// ── Loading / failing ────────────────────────────────────────────────────────
// The rows as they will arrive, each box at the height of its line: the time
// with the row's actions, the heading, the title and two lines of task.
const HEAD_W = ['46%', '38%', '54%'];
const TITLE_W = ['62%', '50%', '70%'];

export const HomeworkSkeleton = ({
  trailing,
}: {
  // The right of each top line: the teacher's edit and delete, or a student's tick.
  trailing: 'actions' | 'tick';
}) => (
  <View style={s.list}>
    <View style={s.dayHead}>
      <View style={s.skDayTitle}>
        <Skeleton width="45%" height={13} />
      </View>
      <View style={s.skDayLine}>
        <Skeleton width={52} height={10} />
      </View>
    </View>
    {[0, 1, 2].map(i => (
      <View key={i} style={[s.row, i < 2 && s.rowDivider]}>
        <View style={s.topLine}>
          <View style={[s.topLeft, s.skSmall]}>
            <Skeleton width={128} height={10} />
          </View>
          {trailing === 'actions' ? (
            <View style={s.skActions}>
              <Skeleton width={17} height={17} radius={5} />
              <Skeleton width={17} height={17} radius={5} />
            </View>
          ) : (
            <Skeleton width={21} height={21} radius={11} />
          )}
        </View>
        <View style={s.skSmall}>
          <Skeleton width={HEAD_W[i]} height={10} />
        </View>
        <View style={s.skTitle}>
          <Skeleton width={TITLE_W[i]} height={13} />
        </View>
        <View style={[s.skDesc, s.skDescFirst]}>
          <Skeleton width="92%" height={11} />
        </View>
        <View style={s.skDesc}>
          <Skeleton width="58%" height={11} />
        </View>
      </View>
    ))}
  </View>
);

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

  // Day heading
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  dayHead: { paddingTop: 14, paddingBottom: 4 },
  dayTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  dayLine: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

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

  // Skeleton boxes, at the heights of the real lines
  skDayTitle: { height: 20, justifyContent: 'center' },
  skDayLine: { height: 16, marginTop: 2, justifyContent: 'center' },
  skSmall: { height: 17, justifyContent: 'center' },
  skActions: { flexDirection: 'row', gap: 18 },
  skTitle: { height: 20, justifyContent: 'center' },
  skDesc: { height: 19, justifyContent: 'center' },
  skDescFirst: { marginTop: 3 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

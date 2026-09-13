import React, { useRef, useState } from 'react';
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
import type { HomeworkItem } from '../../api/homeworkApi';

/**
 * The pieces the student and teacher homework screens share.
 *
 * The last fortnight as a row of dated pills, then the chosen day's homework as
 * plain rows on hairlines: what it is, whose it is, the task itself and any
 * attachment. No accent bars, emoji tiles or pills.
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

// ── The tick a student marks homework done with ─────────────────────────────
export const DoneTick = ({ done, onPress }: { done: boolean; onPress?: () => void }) => (
  <TouchableOpacity
    style={s.tick}
    hitSlop={8}
    activeOpacity={0.6}
    disabled={done || !onPress}
    onPress={onPress}
  >
    <VectorIcon
      iconSet="Ionicons"
      iconName={done ? 'checkmark-circle' : 'ellipse-outline'}
      size={22}
      color={done ? theme.colors.success : theme.colors.textMuted}
    />
  </TouchableOpacity>
);

// ── One homework ─────────────────────────────────────────────────────────────
//   ◯  Chapter 3 Exercise                                      ✎  🗑
//      Mathematics · Ms. Patel · 09:30 AM
//      Solve problems 1–10 from chapter 3 …
//      Open attachment
export const HomeworkRow = ({
  hw,
  meta,
  leading,
  trailing,
  done,
  isLast,
  onPreviewImage,
}: {
  hw: HomeworkItem;
  meta: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  done?: boolean;
  isLast: boolean;
  onPreviewImage: (url: string) => void;
}) => {
  // The task is cut to two lines; tapping the row reads the rest.
  const [expanded, setExpanded] = useState(false);
  const desc = hw.description?.trim();
  const isImage = hw.file_type === 'image';

  return (
    <View style={[s.row, !isLast && s.rowDivider]}>
      {leading}

      <TouchableOpacity
        style={s.body}
        activeOpacity={desc ? 0.6 : 1}
        disabled={!desc}
        onPress={() => setExpanded(e => !e)}
      >
        <Text style={[s.title, done && s.titleDone]}>{quietCaps(hw.title)}</Text>
        {!!meta && (
          <Text style={s.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
        {!!desc && (
          <Text style={[s.desc, done && s.descDone]} numberOfLines={expanded ? undefined : 2}>
            {desc}
          </Text>
        )}
        {!!hw.file_url && (
          <TouchableOpacity
            style={s.attach}
            hitSlop={6}
            activeOpacity={0.6}
            onPress={() => (isImage ? onPreviewImage(hw.file_url!) : openFile(hw.file_url))}
          >
            <VectorIcon
              iconSet="Ionicons"
              iconName={isImage ? 'image-outline' : 'document-attach-outline'}
              size={15}
              color={theme.colors.primary}
            />
            <Text style={s.attachText}>{isImage ? 'View image' : 'Open attachment'}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {trailing}
    </View>
  );
};

// ── Loading / failing ────────────────────────────────────────────────────────
export const HomeworkSkeleton = () => (
  <View style={s.list}>
    <View style={s.dayHead}>
      <Skeleton width="45%" height={15} />
      <Skeleton width="20%" height={12} style={s.skLine} />
    </View>
    {[0, 1, 2].map(i => (
      <View key={i} style={[s.row, i < 2 && s.rowDivider]}>
        <View style={s.skBody}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={12} />
          <Skeleton width="90%" height={12} />
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

  // Row
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tick: { width: 24, alignItems: 'center', marginTop: -1 },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '500', lineHeight: 20, color: theme.colors.textPrimary },
  titleDone: { color: theme.colors.textSecondary },
  meta: { fontSize: 12, color: theme.colors.textMuted },
  desc: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, marginTop: 3 },
  descDone: { color: theme.colors.textMuted },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7, alignSelf: 'flex-start' },
  attachText: { fontSize: 13, fontWeight: '500', color: theme.colors.primary },

  // Loading
  skLine: { marginTop: 6 },
  skBody: { flex: 1, gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

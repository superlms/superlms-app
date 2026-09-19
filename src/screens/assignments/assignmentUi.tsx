import React from 'react';
import {
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton, SkeletonText } from '../../components/Skeleton';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { resolveFileUrl } from '../subjects/subjectsUi';
import type { Assignment, SubmissionStatus } from '../../api/assignmentApi';

/**
 * The pieces the Assignments screens share: how a date, a status and a file
 * read, a line of facts, an MCQ option, and text that can stand as its own
 * skeleton.
 */

// ── Dates ────────────────────────────────────────────────────────────────────
const parse = (dt?: string | null) => (dt ? moment(dt, ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD HH:mm', moment.ISO_8601]) : null);

// "Today, 2:50 PM", "Tomorrow, 9:00 AM", "22 Sep, 5:00 PM" (the year too when it isn't this one).
export const whenLabel = (dt?: string | null): string => {
  const m = parse(dt);
  if (!m || !m.isValid()) return '';
  const time = m.format('h:mm A');
  if (m.isSame(moment(), 'day')) return `Today, ${time}`;
  if (m.isSame(moment().add(1, 'day'), 'day')) return `Tomorrow, ${time}`;
  if (m.isSame(moment().subtract(1, 'day'), 'day')) return `Yesterday, ${time}`;
  return m.format(m.isSame(moment(), 'year') ? 'D MMM, h:mm A' : 'D MMM YYYY, h:mm A');
};

// "Due Today, 5:00 PM", or "Opens 23 Sep, 9:00 AM" for one yet to start.
export const dueLine = (a: Pick<Assignment, 'window_status' | 'start_date' | 'end_date'>): string =>
  a.window_status === 'upcoming' && a.start_date
    ? `Opens ${whenLabel(a.start_date)}`
    : a.end_date
    ? `Due ${whenLabel(a.end_date)}`
    : 'No due date';

// "Class 5 A"
export const classLabel = (a: Pick<Assignment, 'standard' | 'section'>) =>
  [a.standard, a.section].filter(Boolean).join(' ');

// "MCQ · 10 questions" / "Written · text or a file"
export const kindLabel = (a: Pick<Assignment, 'type' | 'question_count' | 'submission_mode'>) => {
  if (a.type === 'mcq') return `MCQ · ${a.question_count} question${a.question_count === 1 ? '' : 's'}`;
  const how = { text: 'answer in text', file: 'answer as a file', both: 'text and/or a file' }[a.submission_mode] ?? '';
  return how ? `Written · ${how}` : 'Written';
};

// "8/10"
export const num = (n: number) => String(Math.round(n * 100) / 100);

// ── Status ───────────────────────────────────────────────────────────────────
export const STATUS: Record<SubmissionStatus | 'pending', { label: string; color: string }> = {
  pending: { label: 'Not submitted', color: theme.colors.textMuted },
  submitted: { label: 'Submitted', color: theme.colors.primary },
  reviewed: { label: 'Checked', color: '#16A34A' },
  approved: { label: 'Approved', color: '#16A34A' },
  rejected: { label: 'Rejected', color: theme.colors.danger },
};

// ── Text, or its skeleton ────────────────────────────────────────────────────
export const Words = ({
  skeleton,
  style,
  numberOfLines,
  children,
}: {
  skeleton?: boolean;
  style: StyleProp<TextStyle>;
  numberOfLines?: number;
  children: React.ReactNode;
}) =>
  skeleton ? (
    <SkeletonText style={style} numberOfLines={numberOfLines}>
      {children}
    </SkeletonText>
  ) : (
    <Text style={style} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );

// ── A line of facts: "Due    Today, 5:00 PM" ────────────────────────────────
export const Fact = ({ label, value, skeleton }: { label: string; value: string; skeleton?: boolean }) => (
  <View style={s.fact}>
    <Words skeleton={skeleton} style={s.factLabel}>
      {label}
    </Words>
    <View style={s.factValueBox}>
      <Words skeleton={skeleton} style={s.factValue}>
        {value}
      </Words>
    </View>
  </View>
);

// ── Files ────────────────────────────────────────────────────────────────────
// What a file is — Image, PDF or File — from its name or link; never its name.
export const fileKind = (nameOrUrl?: string | null, type?: string | null) => {
  const ext = (nameOrUrl ?? '').split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (type?.startsWith('image/') || /^(jpe?g|png|gif|webp|heic|heif|bmp)$/.test(ext)) {
    return { label: 'Image', icon: 'image' };
  }
  if (type === 'application/pdf' || ext === 'pdf') return { label: 'PDF', icon: 'file-text' };
  return { label: 'File', icon: 'file' };
};

export const openFile = async (url?: string | null) => {
  const link = resolveFileUrl(url);
  if (!link) return;
  try {
    await Linking.openURL(link);
  } catch {
    AppAlert.alert('Error', 'Unable to open this file on this device.');
  }
};

/** A file as a chip: its kind, then open (a saved file) or a cross (one being picked). */
export const FileChip = ({
  name,
  type,
  onPress,
  onRemove,
  skeleton,
}: {
  name?: string | null;
  type?: string | null;
  onPress?: () => void;
  onRemove?: () => void;
  skeleton?: boolean;
}) => {
  const kind = fileKind(name, type);
  const chip = (
    <TouchableOpacity
      style={[s.chip, skeleton && s.unseen]}
      activeOpacity={0.7}
      disabled={skeleton || !onPress}
      onPress={onPress}
    >
      <VectorIcon iconSet="Feather" iconName={kind.icon} size={14} color={theme.colors.primary} />
      <Text style={s.chipText}>{kind.label}</Text>
      {onRemove ? (
        <TouchableOpacity onPress={onRemove} hitSlop={10} activeOpacity={0.6}>
          <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
      ) : (
        !!onPress && <VectorIcon iconSet="Feather" iconName="external-link" size={12} color={theme.colors.textMuted} />
      )}
    </TouchableOpacity>
  );
  if (!skeleton) return chip;
  return (
    <View style={s.chipWrap}>
      {chip}
      <Skeleton radius={theme.radius.full} style={s.fill} />
    </View>
  );
};

// ── MCQ options ──────────────────────────────────────────────────────────────
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// idle: not chosen · picked: chosen while answering · right: chosen and correct ·
// wrong: chosen and not correct · answer: the correct one, not chosen.
export type OptionState = 'idle' | 'picked' | 'right' | 'wrong' | 'answer';

export const OptionRow = ({
  index,
  text,
  state,
  onPress,
  skeleton,
}: {
  index: number;
  text: string;
  state: OptionState;
  onPress?: () => void;
  skeleton?: boolean;
}) => {
  const tone =
    state === 'picked'
      ? theme.colors.primary
      : state === 'right' || state === 'answer'
      ? '#16A34A'
      : state === 'wrong'
      ? theme.colors.danger
      : null;
  const filled = state === 'picked' || state === 'right' || state === 'wrong';
  const mark = state === 'right' || state === 'answer' ? 'checkmark' : state === 'wrong' ? 'close' : null;

  return (
    <TouchableOpacity
      style={[s.option, !!tone && { borderColor: tone }, filled && tone ? { backgroundColor: `${tone}0F` } : null]}
      activeOpacity={0.7}
      disabled={!onPress || skeleton}
      onPress={onPress}
    >
      {skeleton ? (
        <Skeleton width={24} height={24} radius={12} />
      ) : (
        <View style={[s.letter, !!tone && { borderColor: tone }, filled && tone ? { backgroundColor: tone } : null]}>
          <Text style={[s.letterText, !!tone && { color: tone }, filled && tone ? s.letterTextOn : null]}>
            {LETTERS[index] ?? String(index + 1)}
          </Text>
        </View>
      )}
      <View style={s.optionBody}>
        <Words skeleton={skeleton} style={s.optionText}>
          {text}
        </Words>
      </View>
      {!skeleton && !!mark && !!tone && <VectorIcon iconSet="Ionicons" iconName={mark} size={17} color={tone} />}
    </TouchableOpacity>
  );
};

const __mk_s = () => StyleSheet.create({
  fact: { flexDirection: 'row', gap: 12, paddingVertical: 5 },
  factLabel: { width: 72, fontSize: 13, color: theme.colors.textMuted },
  factValueBox: { flex: 1 },
  factValue: { fontSize: 14, color: theme.colors.textPrimary },

  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  chipText: { fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  chipWrap: { alignSelf: 'flex-start' },
  // Hidden by opacity: on Android a transparent colour draws text and borders black.
  unseen: { opacity: 0 },
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  letter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  letterTextOn: { color: theme.colors.white },
  optionBody: { flex: 1 },
  optionText: { fontSize: 14, color: theme.colors.textPrimary, lineHeight: 20 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

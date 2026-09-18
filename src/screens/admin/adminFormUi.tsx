import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { MonthBar, MonthGrid } from '../calendar/calendarUi';
import { PickedFile } from '../../api/adminProfileApi';

/**
 * The admin forms' pieces, drawn as the student and teacher forms are (Contact
 * School, Topic Content): white cards with the label inside and the text under
 * it, a segment for a few choices, plain bottom sheets for dates, times and
 * lists, a file as a chip, and the full-width button under the form.
 */

// ── Files ────────────────────────────────────────────────────────────────────
export const ONE_MB = 1024 * 1024;

export const isPdfFile = (f: Pick<PickedFile, 'type' | 'name'>) =>
  (f.type || '').includes('pdf') || (f.name || '').toLowerCase().endsWith('.pdf');

export const isPdfUrl = (url: string) => /\.pdf(\?|#|$)/i.test(url);

/** A picked file over the panel's 1 MB limit says so, and isn't kept. */
export const withinOneMb = (f: PickedFile, what = 'Attachment') => {
  if (f.size && f.size > ONE_MB) {
    AppAlert.alert('File too large', `${what} must be 1 MB (1024 KB) or smaller.`);
    return false;
  }
  return true;
};

// ── Times ────────────────────────────────────────────────────────────────────
// "14:05" → "02:05 PM"; anything else as it comes.
export const clock12 = (t?: string | null): string => {
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return t;
  const h = Number(m[1]);
  return `${String(h % 12 || 12).padStart(2, '0')}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

// "7:30 AM", "07:30", "07:30:00" → "07:30"; '' when it can't be read.
export const toHHmm = (t?: string | null): string => {
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/.exec(t.trim());
  if (!m) return '';
  let h = Number(m[1]);
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  if (h > 23 || Number(m[2]) > 59) return '';
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};

// ── Fields ───────────────────────────────────────────────────────────────────

/** A text field as a card: the label inside, the text under it; tap anywhere on it to type. */
export const FormCard = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  minHeight,
  keyboardType,
  maxLength,
  autoCapitalize,
  editable = true,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** A tall box for long text. */
  minHeight?: number;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
  returnKeyType?: 'next' | 'done';
  onSubmitEditing?: () => void;
  style?: object;
}) => {
  const own = useRef<TextInput>(null);
  const ref = inputRef ?? own;
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      style={[s.field, focused && s.fieldFocused, !editable && s.fieldDisabled, style]}
      onPress={() => ref.current?.focus()}
    >
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        ref={ref}
        style={[s.fieldInput, !!minHeight && { minHeight }]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        editable={editable}
        returnKeyType={returnKeyType}
        submitBehavior={onSubmitEditing ? 'submit' : undefined}
        onSubmitEditing={onSubmitEditing}
      />
    </Pressable>
  );
};

/** A choice as a card: the label inside, what is chosen under it, and a chevron. */
export const PickerCard = ({
  label,
  value,
  placeholder = 'Select',
  icon = 'chevron-down',
  onPress,
  disabled,
  style,
}: {
  label: string;
  value?: string | null;
  placeholder?: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
}) => (
  <TouchableOpacity
    style={[s.field, s.pickerField, disabled && s.fieldDisabled, style]}
    activeOpacity={0.7}
    disabled={disabled}
    onPress={onPress}
  >
    <View style={s.pickerBody}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={[s.pickerValue, !value && s.placeholder]} numberOfLines={1}>
        {value || placeholder}
      </Text>
    </View>
    <VectorIcon iconSet="Ionicons" iconName={icon} size={16} color={theme.colors.textMuted} />
  </TouchableOpacity>
);

export const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.sectionLabel}>{children}</Text>
);

/** A few choices side by side, the chosen one raised. */
export function Segment<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={s.segment}>
      {options.map(o => {
        const active = value === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            activeOpacity={0.7}
            onPress={() => onChange(o.key)}
            style={[s.segmentItem, active && s.segmentItemActive]}
          >
            <Text style={[s.segmentText, active && s.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Several choices that can each be on, as chips with a tick. */
export function ChipChoices({
  options,
  selected,
  onToggle,
}: {
  options: { key: string; label: string }[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <View style={s.chips}>
      {options.map(o => {
        const on = selected.includes(o.key);
        return (
          <TouchableOpacity
            key={o.key}
            style={[s.choice, on && s.choiceOn]}
            activeOpacity={0.7}
            onPress={() => onToggle(o.key)}
          >
            {on && <VectorIcon iconSet="Ionicons" iconName="checkmark" size={14} color={theme.colors.primary} />}
            <Text style={[s.choiceText, on && s.choiceTextOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const SwitchRow = ({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => (
  <View style={s.switchRow}>
    <Text style={s.switchLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
      thumbColor={theme.colors.white}
    />
  </View>
);

/** A file as a chip — its kind, never its name — that opens, or comes off with the cross. */
export const FileChip = ({
  kind,
  onPress,
  onRemove,
}: {
  kind: 'pdf' | 'image';
  onPress?: () => void;
  onRemove?: () => void;
}) => (
  <TouchableOpacity style={s.chip} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress} onPress={onPress}>
    <VectorIcon
      iconSet="Feather"
      iconName={kind === 'pdf' ? 'file-text' : 'image'}
      size={14}
      color={theme.colors.primary}
    />
    <Text style={s.chipText}>{kind === 'pdf' ? 'PDF' : 'Image'}</Text>
    {onRemove ? (
      <TouchableOpacity onPress={onRemove} hitSlop={8}>
        <VectorIcon iconSet="Ionicons" iconName="close" size={15} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    ) : (
      !!onPress && <VectorIcon iconSet="Feather" iconName="external-link" size={12} color={theme.colors.textMuted} />
    )}
  </TouchableOpacity>
);

export const Hint = ({ children }: { children: React.ReactNode }) => <Text style={s.hint}>{children}</Text>;

export const FormError = ({ children }: { children?: string }) =>
  children ? <Text style={s.errorText}>{children}</Text> : null;

export const SubmitButton = ({
  label,
  busy,
  onPress,
}: {
  label: string;
  busy?: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    style={[s.submitBtn, busy && s.submitBtnBusy]}
    disabled={busy}
  >
    {busy ? (
      <ActivityIndicator color={theme.colors.white} size="small" />
    ) : (
      <Text style={s.submitText}>{label}</Text>
    )}
  </TouchableOpacity>
);

/** A quiet text action at the foot of a detail page ("Delete event"). */
export const QuietAction = ({
  icon,
  label,
  danger,
  onPress,
  busy,
}: {
  icon: string;
  label: string;
  danger?: boolean;
  onPress: () => void;
  busy?: boolean;
}) => {
  const color = danger ? theme.colors.danger : theme.colors.primary;
  return (
    <TouchableOpacity style={s.quiet} activeOpacity={0.6} onPress={onPress} hitSlop={8} disabled={busy}>
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <VectorIcon iconSet="Feather" iconName={icon} size={15} color={color} />
      )}
      <Text style={[s.quietText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
};

/** Asks before something that can't be undone, with the action in red. */
export const confirmDestructive = (
  title: string,
  message: string,
  actionLabel: string,
  onConfirm: () => void,
) =>
  AppAlert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: actionLabel, style: 'destructive', onPress: onConfirm },
  ]);

// ── Sheets ───────────────────────────────────────────────────────────────────

const Sheet = ({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={s.sheetWrap}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>{title}</Text>
          {children}
          {footer}
        </View>
      </View>
    </Modal>
  );
};

export interface SheetOption {
  key: string;
  label: string;
  sub?: string;
}

/**
 * A list to choose from. One choice applies and closes; with `multi`, each row
 * ticks on and off and Done closes.
 */
export const OptionSheet = ({
  visible,
  title,
  options,
  selected,
  multi,
  onPick,
  onClose,
  emptyText = 'Nothing to choose from yet.',
}: {
  visible: boolean;
  title: string;
  options: SheetOption[];
  selected: string[];
  multi?: boolean;
  onPick: (key: string) => void;
  onClose: () => void;
  emptyText?: string;
}) => (
  <Sheet
    visible={visible}
    title={title}
    onClose={onClose}
    footer={
      multi ? (
        <View style={s.sheetFooter}>
          <SubmitButton label="Done" onPress={onClose} />
        </View>
      ) : undefined
    }
  >
    <ScrollView style={s.sheetList} showsVerticalScrollIndicator={false}>
      {options.length === 0 && <Text style={s.sheetEmpty}>{emptyText}</Text>}
      {options.map((o, i) => {
        const active = selected.includes(o.key);
        return (
          <TouchableOpacity
            key={o.key}
            style={[s.sheetRow, i < options.length - 1 && s.sheetRowDivider]}
            activeOpacity={0.6}
            onPress={() => {
              onPick(o.key);
              if (!multi) onClose();
            }}
          >
            {multi && (
              <VectorIcon
                iconSet="Ionicons"
                iconName={active ? 'checkbox' : 'square-outline'}
                size={19}
                color={active ? theme.colors.primary : theme.colors.textMuted}
              />
            )}
            <View style={s.sheetRowBody}>
              <Text style={[s.sheetRowText, active && !multi && s.sheetRowTextActive]}>{o.label}</Text>
              {!!o.sub && <Text style={s.sheetRowSub}>{o.sub}</Text>}
            </View>
            {active && !multi && (
              <VectorIcon iconSet="Ionicons" iconName="checkmark" size={18} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </Sheet>
);

const NO_MARKS: Record<string, boolean> = {};

/** A day, as a month calendar in a sheet; tapping a day applies it and closes. */
export const DateSheet = ({
  visible,
  value,
  onPick,
  onClose,
  title = 'Select date',
  maxDate,
}: {
  visible: boolean;
  value?: string | null; // YYYY-MM-DD
  onPick: (date: string) => void;
  onClose: () => void;
  title?: string;
  /** No day after this one (YYYY-MM-DD). */
  maxDate?: string;
}) => {
  const [month, setMonth] = useState(() => moment(value || undefined).startOf('month'));

  // Opens on the chosen day's month every time.
  useEffect(() => {
    if (visible) setMonth(moment(value || undefined).startOf('month'));
  }, [visible, value]);

  const canNext = !maxDate || month.isBefore(moment(maxDate).startOf('month'));

  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <MonthBar
        label={month.format('MMMM YYYY')}
        onPrev={() => setMonth(m => m.clone().subtract(1, 'month'))}
        onNext={() => {
          if (canNext) setMonth(m => m.clone().add(1, 'month'));
        }}
      />
      <View style={s.sheetGrid}>
        <MonthGrid
          month={month}
          selected={value ?? undefined}
          marked={NO_MARKS}
          onSelectDate={d => {
            onPick(d);
            onClose();
          }}
          disabledDate={maxDate ? d => d > maxDate : undefined}
        />
      </View>
    </Sheet>
  );
};

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const ROW_H = 40;

const TimeColumn = ({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) => {
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    const i = Math.max(0, items.indexOf(value));
    const t = setTimeout(() => ref.current?.scrollTo({ y: Math.max(0, (i - 2) * ROW_H), animated: false }), 0);
    return () => clearTimeout(t);
    // Only where it opens; a tap keeps the list where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  return (
    <ScrollView ref={ref} style={s.timeCol} showsVerticalScrollIndicator={false} nestedScrollEnabled>
      {items.map(v => {
        const on = v === value;
        return (
          <TouchableOpacity key={v} style={[s.timeCell, on && s.timeCellOn]} activeOpacity={0.6} onPress={() => onChange(v)}>
            <Text style={[s.timeText, on && s.timeTextOn]}>{v}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

/** A time of day: the hour, the minute and AM or PM, then Done. Gives "HH:mm". */
export const TimeSheet = ({
  visible,
  value,
  title = 'Select time',
  onPick,
  onClose,
}: {
  visible: boolean;
  value?: string | null; // HH:mm
  title?: string;
  onPick: (hhmm: string) => void;
  onClose: () => void;
}) => {
  const start = toHHmm(value) || '09:00';
  const [h, setH] = useState('09');
  const [m, setM] = useState('00');
  const [ap, setAp] = useState<'AM' | 'PM'>('AM');

  useEffect(() => {
    if (!visible) return;
    const [hh, mm] = start.split(':').map(Number);
    setH(String(hh % 12 || 12).padStart(2, '0'));
    setM(String(mm).padStart(2, '0'));
    setAp(hh < 12 ? 'AM' : 'PM');
  }, [visible, start]);

  const done = () => {
    let hh = Number(h) % 12;
    if (ap === 'PM') hh += 12;
    onPick(`${String(hh).padStart(2, '0')}:${m}`);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={
        <View style={s.sheetFooter}>
          <SubmitButton label={`Set ${h}:${m} ${ap}`} onPress={done} />
        </View>
      }
    >
      {visible && (
        <View style={s.timeRow}>
          <TimeColumn items={HOURS} value={h} onChange={setH} />
          <Text style={s.timeColon}>:</Text>
          <TimeColumn items={MINUTES} value={m} onChange={setM} />
          <View style={s.ampm}>
            {(['AM', 'PM'] as const).map(v => (
              <TouchableOpacity
                key={v}
                style={[s.timeCell, s.ampmCell, ap === v && s.timeCellOn]}
                activeOpacity={0.6}
                onPress={() => setAp(v)}
              >
                <Text style={[s.timeText, ap === v && s.timeTextOn]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </Sheet>
  );
};

const __mk_s = () => StyleSheet.create({
  // Input cards — label inside, borderless input underneath
  field: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldFocused: { borderColor: theme.colors.primary },
  fieldDisabled: { opacity: 0.6 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },
  fieldInput: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: 4,
    marginTop: 2,
  },
  pickerField: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickerBody: { flex: 1 },
  pickerValue: { fontSize: 15, color: theme.colors.textPrimary, paddingVertical: 4, marginTop: 2 },
  placeholder: { color: theme.colors.textMuted },

  sectionLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted, marginBottom: 8 },

  // Segment
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentItemActive: { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
  segmentText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  segmentTextActive: { color: theme.colors.primary, fontWeight: '600' },

  // Choices and file chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  choiceOn: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryLight },
  choiceText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  choiceTextOn: { color: theme.colors.primary },
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

  // Switch
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 15, color: theme.colors.textPrimary },

  hint: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 17 },
  errorText: { fontSize: 13, color: theme.colors.danger, lineHeight: 18 },

  // Submit
  submitBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnBusy: { opacity: 0.7 },
  submitText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },

  // Quiet action
  quiet: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  quietText: { fontSize: 14, fontWeight: '500' },

  // Sheets
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 14,
  },
  sheetTitle: {
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  sheetList: { paddingHorizontal: 20, flexGrow: 0 },
  sheetEmpty: { paddingVertical: 18, fontSize: 14, color: theme.colors.textMuted },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sheetRowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sheetRowBody: { flex: 1 },
  sheetRowText: { fontSize: 15, color: theme.colors.textPrimary },
  sheetRowTextActive: { color: theme.colors.primary, fontWeight: '600' },
  sheetRowSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  sheetFooter: { paddingHorizontal: 20, paddingTop: 4 },
  sheetGrid: { paddingHorizontal: 20, paddingBottom: 8 },

  // Time
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 8 },
  timeCol: { flex: 1, height: ROW_H * 5 },
  timeColon: { fontSize: 18, fontWeight: '600', color: theme.colors.textMuted },
  timeCell: { height: ROW_H, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.sm },
  timeCellOn: { backgroundColor: theme.colors.primaryLight },
  timeText: { fontSize: 16, color: theme.colors.textPrimary },
  timeTextOn: { color: theme.colors.primary, fontWeight: '700' },
  ampm: { flex: 1, gap: 8 },
  ampmCell: { borderWidth: 1, borderColor: theme.colors.border },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

export { s as adminFormStyles };

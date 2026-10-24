import React, { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton, SkeletonText } from '../../components/Skeleton';
import SavingButton, { type SaveState } from '../../components/SavingButton';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * The teacher's student form, drawn the outlined way: each field a thin
 * outline with its name set into the top border, a quiet heading with a line
 * over each block, and the yes-or-no choices as cards that tick. The Change
 * Password screens (Settings, and the admin's) are drawn with the same pieces.
 *
 * The name in the border sits on the page's own white (theme card), so these
 * belong on a card-coloured screen.
 */

// ── A block's heading ────────────────────────────────────────────────────────
//   STUDENT ─────────────────────────────────
export const FormHeading = ({ title, first, skeleton }: { title: string; first?: boolean; skeleton?: boolean }) => (
  <View style={[s.heading, first && s.headingFirst]}>
    {skeleton ? (
      <SkeletonText style={s.headingText}>{title.toUpperCase()}</SkeletonText>
    ) : (
      <Text style={s.headingText}>{title.toUpperCase()}</Text>
    )}
    <View style={s.headingLine} />
  </View>
);

// ── A field as a skeleton ────────────────────────────────────────────────────
// The same outline, its name a bar in the border and the value a bar as long
// as what the field holds — so the form being opened has its own shape.
export const SkeletonField = ({
  label,
  value,
  half,
  multiline,
}: {
  label: string;
  value?: string | null;
  half?: boolean;
  multiline?: boolean;
}) => (
  <View style={[s.field, half && s.half]}>
    <View style={[s.box, s.skBox, multiline && s.skBoxMultiline]}>
      {!!value && (
        <SkeletonText style={s.input} numberOfLines={multiline ? 2 : 1}>
          {value}
        </SkeletonText>
      )}
    </View>
    <View style={s.labelWrap} pointerEvents="none">
      <View style={s.skLabel}>
        <SkeletonText style={s.label} numberOfLines={1}>
          {label}
        </SkeletonText>
      </View>
    </View>
  </View>
);

// A yes-or-no card as a skeleton.
export const SkeletonCheck = ({ label, note }: { label: string; note?: string }) => (
  <View style={s.check}>
    <Skeleton width={34} height={34} radius={10} />
    <View style={s.checkBody}>
      <SkeletonText style={s.checkLabel}>{label}</SkeletonText>
      {!!note && <SkeletonText style={s.checkNote}>{note}</SkeletonText>}
    </View>
    <Skeleton width={22} height={22} radius={7} />
  </View>
);

// ── Save, and how it is going ────────────────────────────────────────────────
//   idle     [ +  Add student ]
//   saving   [ ◌  Adding student…  ]  a light sweeps across, again and again
//   upload   [ ↑  Uploading · 42% ]  filling up as the photo goes
//   done     [ ✓  Student added ]     green, the tick springs in
// The app's SavingButton, at the form's size.
export type { SaveState };

export const SaveButton = (props: {
  state: SaveState;
  icon: string;
  label: string;
  busyLabel: string;
  doneLabel: string;
  onPress: () => void;
}) => <SavingButton {...props} />;

// ── A field with its name in the border ─────────────────────────────────────
//   ╭─ Full Name * ─────────────────╮
//   │ Aarav Sharma                  │
//   ╰───────────────────────────────╯
// A field the save stopped at (error) is outlined red, with what is wrong
// under it in place of the hint, until it is typed in again.
export const OutlinedField = forwardRef<TextInput, {
  label: string;
  /** A small star after the name: the form won't save without it. */
  required?: boolean;
  /** A line under the box — what the school expects there. */
  hint?: string;
  /** What is wrong with it: the outline and the name turn red, this under it. */
  error?: string | null;
  multiline?: boolean;
  /** Share the line with the field beside it, inside a FieldPair. */
  half?: boolean;
  [key: string]: any;
}>(({ label, required, hint, error, multiline, half, ...props }, ref) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[s.field, half && s.half]}>
      <View style={[s.box, focused && s.boxFocused, !!error && s.boxError]}>
        <TextInput
          ref={ref}
          style={[s.input, multiline && s.inputMultiline]}
          placeholderTextColor={theme.colors.textMuted + 'B3'}
          multiline={multiline}
          {...props}
          onFocus={(e: any) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e: any) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
      </View>
      <BorderLabel text={label} required={required} focused={focused} error={!!error} />
      {error ? <Text style={s.error}>{error}</Text> : !!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
});

// ── A password, the same outline with an eye ────────────────────────────────
//   ╭─ New Password * ──────────────╮
//   │ ••••••••                   👁  │
//   ╰───────────────────────────────╯
// The eye shows what was typed, and hides it again.
export const OutlinedPasswordField = forwardRef<TextInput, {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  [key: string]: any;
}>(({ label, required, hint, error, ...props }, ref) => {
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);

  return (
    <View style={s.field}>
      <View style={[s.box, s.boxRow, focused && s.boxFocused, !!error && s.boxError]}>
        <TextInput
          ref={ref}
          style={[s.input, s.inputFill]}
          placeholderTextColor={theme.colors.textMuted + 'B3'}
          secureTextEntry={!shown}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
          onFocus={(e: any) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e: any) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
        <TouchableOpacity
          onPress={() => setShown(v => !v)}
          hitSlop={10}
          activeOpacity={0.6}
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
        >
          <VectorIcon
            iconSet="Ionicons"
            iconName={shown ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={focused ? theme.colors.primary : theme.colors.textMuted}
          />
        </TouchableOpacity>
      </View>
      <BorderLabel text={label} required={required} focused={focused} error={!!error} />
      {error ? <Text style={s.error}>{error}</Text> : !!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
});

/** One of a change-password form's three boxes. */
export type PasswordBox = 'current' | 'next' | 'confirm';
export type PasswordWrong = { box: PasswordBox | null; message: string };

// The server's names for the three boxes.
const PASSWORD_SERVER_BOXES: [string, PasswordBox][] = [
  ['current_password', 'current'],
  ['new_password', 'next'],
  ['new_password_confirmation', 'confirm'],
];

/**
 * What the server said when it refused a new password, set against the box it
 * is about: the first of its field errors, or its message ("Current password
 * is incorrect" is the first box's), or the fallback.
 */
export const passwordServerWrong = (e: any, fallback: string): PasswordWrong => {
  const data = e?.response?.data;
  const errors = data?.errors;
  if (errors && typeof errors === 'object') {
    for (const [key, box] of PASSWORD_SERVER_BOXES) {
      const first = Array.isArray(errors[key]) ? errors[key][0] : null;
      if (first) return { box, message: String(first) };
    }
  }
  const message = (typeof data?.message === 'string' && data.message) || e?.message || fallback;
  return { box: /current/i.test(message) ? 'current' : null, message };
};

// The name set into the top border: drawn over the line on the page's colour.
export const BorderLabel = ({
  text,
  required,
  focused,
  error,
}: {
  text: string;
  required?: boolean;
  focused?: boolean;
  error?: boolean;
}) => (
  <View style={s.labelWrap} pointerEvents="none">
    <Text style={[s.label, focused && s.labelFocused, error && s.labelError]} numberOfLines={1}>
      {text}
      {required && <Text style={s.star}> *</Text>}
    </Text>
  </View>
);

// Two fields side by side, where both are short.
export const FieldPair = ({ children }: { children: React.ReactNode }) => <View style={s.pair}>{children}</View>;

// ── A yes-or-no, as a card that ticks ────────────────────────────────────────
//   ╭───────────────────────────────────────╮
//   │ [bus]  Takes the bus             [✓]  │
//   │        Billed on the route below      │
//   ╰───────────────────────────────────────╯
export const CheckCard = ({
  icon,
  label,
  note,
  value,
  onValueChange,
}: {
  icon: string;
  label: string;
  note?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => (
  <TouchableOpacity
    style={[s.check, value && s.checkOn]}
    activeOpacity={0.75}
    onPress={() => onValueChange(!value)}
    accessibilityRole="checkbox"
    accessibilityState={{ checked: value }}
    accessibilityLabel={label}
  >
    <View style={[s.checkIcon, value && s.checkIconOn]}>
      <VectorIcon iconSet="Ionicons" iconName={icon} size={18} color={value ? theme.colors.primary : theme.colors.textMuted} />
    </View>
    <View style={s.checkBody}>
      <Text style={s.checkLabel}>{label}</Text>
      {!!note && <Text style={s.checkNote}>{note}</Text>}
    </View>
    <View style={[s.tick, value && s.tickOn]}>
      {value && <VectorIcon iconSet="Ionicons" iconName="checkmark" size={15} color={theme.colors.white} />}
    </View>
  </TouchableOpacity>
);

const __mk_s = () => StyleSheet.create({
  // Heading
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 30, marginBottom: 2 },
  headingFirst: { marginTop: 22 },
  headingText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, color: theme.colors.textMuted },
  headingLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },

  // Field — room above for the name that sits in the border. Slim: a 44pt box
  // with 14pt type, the outline a thin line.
  field: { marginTop: 16 },
  half: { flex: 1 },
  box: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 13,
  },
  // The width of the outline stays the same, so the text doesn't shift on focus.
  boxFocused: { borderColor: theme.colors.primary },
  boxError: { borderColor: theme.colors.danger },
  // A box with something beside the text (the password's eye).
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputFill: { flex: 1 },
  input: {
    minHeight: 44,
    paddingVertical: 9,
    paddingHorizontal: 0,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  inputMultiline: { minHeight: 70, paddingTop: 13, textAlignVertical: 'top' },
  labelWrap: { position: 'absolute', top: -8, left: 9, right: 9, flexDirection: 'row' },
  label: {
    flexShrink: 1,
    paddingHorizontal: 5,
    backgroundColor: theme.colors.card,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  labelFocused: { color: theme.colors.primary },
  labelError: { color: theme.colors.danger },
  star: { color: theme.colors.danger },
  hint: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4, marginLeft: 14 },
  error: { fontSize: 11, color: theme.colors.danger, marginTop: 4, marginLeft: 14 },

  pair: { flexDirection: 'row', gap: 12 },

  // Check card
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  checkOn: { borderColor: theme.colors.primary + '66', backgroundColor: theme.colors.primary + '0A' },
  checkIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  checkIconOn: { backgroundColor: theme.colors.primary + '1A' },
  checkBody: { flex: 1, gap: 2 },
  checkLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  checkNote: { fontSize: 12, color: theme.colors.textMuted },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },

  // Skeleton field: the box keeps the field's height; its value bar sits where the text would.
  skBox: { minHeight: 44, justifyContent: 'center' },
  skBoxMultiline: { minHeight: 70, justifyContent: 'flex-start', paddingTop: 4 },
  skLabel: { paddingHorizontal: 5, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

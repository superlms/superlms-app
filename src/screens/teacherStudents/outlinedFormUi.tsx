import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * The teacher's student form, drawn the outlined way: each field a thin
 * outline with its name set into the top border, a quiet heading with a line
 * over each block, and the yes-or-no choices as cards that tick.
 *
 * The name in the border sits on the page's own white (theme card), so these
 * belong on a card-coloured screen.
 */

// ── A block's heading ────────────────────────────────────────────────────────
//   STUDENT ─────────────────────────────────
export const FormHeading = ({ title, first }: { title: string; first?: boolean }) => (
  <View style={[s.heading, first && s.headingFirst]}>
    <Text style={s.headingText}>{title.toUpperCase()}</Text>
    <View style={s.headingLine} />
  </View>
);

// ── A field with its name in the border ─────────────────────────────────────
//   ╭─ Full Name * ─────────────────╮
//   │ Aarav Sharma                  │
//   ╰───────────────────────────────╯
export const OutlinedField = ({
  label,
  required,
  hint,
  multiline,
  half,
  ...props
}: {
  label: string;
  /** A small star after the name: the form won't save without it. */
  required?: boolean;
  /** A line under the box — what the school expects there. */
  hint?: string;
  multiline?: boolean;
  /** Share the line with the field beside it, inside a FieldPair. */
  half?: boolean;
  [key: string]: any;
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[s.field, half && s.half]}>
      <View style={[s.box, focused && s.boxFocused]}>
        <TextInput
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
      <BorderLabel text={label} required={required} focused={focused} />
      {!!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
};

// The name set into the top border: drawn over the line on the page's colour.
export const BorderLabel = ({ text, required, focused }: { text: string; required?: boolean; focused?: boolean }) => (
  <View style={s.labelWrap} pointerEvents="none">
    <Text style={[s.label, focused && s.labelFocused]} numberOfLines={1}>
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
      {value && <VectorIcon iconSet="Ionicons" iconName="checkmark" size={16} color={theme.colors.white} />}
    </View>
  </TouchableOpacity>
);

const __mk_s = () => StyleSheet.create({
  // Heading
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 30, marginBottom: 2 },
  headingFirst: { marginTop: 22 },
  headingText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, color: theme.colors.textMuted },
  headingLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },

  // Field — room above for the name that sits in the border
  field: { marginTop: 18 },
  half: { flex: 1 },
  box: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  // The width of the outline stays the same, so the text doesn't shift on focus.
  boxFocused: { borderColor: theme.colors.primary },
  input: {
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: 0,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  inputMultiline: { minHeight: 84, paddingTop: 16, textAlignVertical: 'top' },
  labelWrap: { position: 'absolute', top: -8, left: 10, right: 10, flexDirection: 'row' },
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
  star: { color: theme.colors.danger },
  hint: { fontSize: 11, color: theme.colors.textMuted, marginTop: 5, marginLeft: 15 },

  pair: { flexDirection: 'row', gap: 12 },

  // Check card
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  checkOn: { borderColor: theme.colors.primary + '66', backgroundColor: theme.colors.primary + '0A' },
  checkIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  checkIconOn: { backgroundColor: theme.colors.primary + '1A' },
  checkBody: { flex: 1, gap: 2 },
  checkLabel: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  checkNote: { fontSize: 12, color: theme.colors.textMuted },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

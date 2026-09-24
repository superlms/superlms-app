import React, { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * The pieces the student form is drawn with: a small heading over each block,
 * then fields that are an outline and nothing else — no fill behind them — so
 * the page reads as one sheet.
 */

// A block's name, over the fields it holds.
export const FormSection = ({ title, first }: { title: string; first?: boolean }) => (
  <Text style={[s.section, first && s.sectionFirst]}>{title.toUpperCase()}</Text>
);

//   Full Name
//   ┌──────────────────────────────┐
//   │ Aarav Sharma                 │
//   └──────────────────────────────┘
export const FormField = ({
  label,
  hint,
  multiline,
  half,
  markFilled,
  ...props
}: {
  label: string;
  /** A word under the box — what the school expects there. */
  hint?: string;
  multiline?: boolean;
  /** Share the line with the field beside it, inside a FormPair. */
  half?: boolean;
  /** The outline turns the accent colour while typed in, and once it holds something. */
  markFilled?: boolean;
  [key: string]: any;
}) => {
  const [focused, setFocused] = useState(false);
  const marked = markFilled && (focused || String(props.value ?? '').trim() !== '');

  return (
    <View style={[s.field, half && s.half]}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMultiline, marked && s.inputMarked]}
        placeholderTextColor={theme.colors.textMuted}
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
      {!!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
};

// Two fields side by side, where both are short.
export const FormPair = ({ children }: { children: React.ReactNode }) => (
  <View style={s.pair}>{children}</View>
);

export const FormToggle = ({
  label,
  note,
  value,
  onValueChange,
}: {
  label: string;
  note?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => (
  <View style={s.toggle}>
    <View style={s.toggleBody}>
      <Text style={s.toggleLabel}>{label}</Text>
      {!!note && <Text style={s.toggleNote}>{note}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
      thumbColor={theme.colors.white}
    />
  </View>
);

const __mk_s = () => StyleSheet.create({
  section: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: theme.colors.textMuted,
    marginTop: 24,
    marginBottom: 2,
  },
  sectionFirst: { marginTop: 18 },

  field: { marginTop: 12 },
  half: { flex: 1 },
  label: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  inputMultiline: { minHeight: 74, textAlignVertical: 'top' },
  inputMarked: { borderColor: theme.colors.primary },
  hint: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },

  pair: { flexDirection: 'row', gap: 12 },

  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
  },
  toggleBody: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  toggleNote: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

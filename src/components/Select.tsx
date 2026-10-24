import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme, onThemeChange } from '../utils/theme';
import VectorIcon from './VectorIcon';

export interface SelectOption {
  label: string;
  value: string | number;
}

interface Props {
  label?: string;
  placeholder?: string;
  value?: string | number | null;
  options: SelectOption[];
  onChange: (value: string | number) => void;
  disabled?: boolean;
  /** The box outlined only, with no fill — for forms drawn that way. */
  plain?: boolean;
  /** Once something is chosen, the outline turns the accent colour. */
  markChosen?: boolean;
  /** The label set into the box's top border instead of over it (outlined forms, on a card-coloured page). */
  notched?: boolean;
  /** A small star after a notched label: the form needs it. */
  required?: boolean;
  /** What is wrong with the choice (notched forms): outlined red, said under it. */
  error?: string | null;
}

// Labelled dropdown: a pressable box that opens a modal list. Replaces the chip
// pickers on admin forms so long option lists (classes, routes) stay compact.
const Select = ({
  label,
  placeholder = 'Select',
  value,
  options,
  onChange,
  disabled,
  plain,
  markChosen,
  notched,
  required,
  error,
}: Props) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  const wrong = notched && !!error;

  return (
    <View style={notched ? styles.notchedWrap : styles.wrap}>
      {!!label && !notched && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[
          styles.box,
          (plain || notched) && styles.boxPlain,
          notched && styles.boxNotched,
          (markChosen && !!selected) || (notched && open) ? styles.boxChosen : null,
          wrong && styles.boxError,
          disabled && styles.boxDisabled,
        ]}
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <Text style={[styles.value, notched && styles.valueNotched, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <VectorIcon iconSet="Ionicons" iconName="chevron-down" size={notched ? 16 : 18} color={theme.colors.textMuted} />
      </TouchableOpacity>
      {!!label && notched && (
        <View style={styles.notchLabelWrap} pointerEvents="none">
          <Text style={[styles.notchLabel, open && styles.notchLabelOpen, wrong && styles.notchLabelError]} numberOfLines={1}>
            {label}
            {required && <Text style={styles.star}> *</Text>}
          </Text>
        </View>
      )}
      {wrong && <Text style={styles.error}>{error}</Text>}

      {/* The choices, on the app's centred card: the name, a line, then the rows */}
      <Modal transparent visible={open} animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label || placeholder}</Text>
            <View style={styles.sheetRule} />
            <ScrollView
              style={styles.sheetList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {options.length === 0 && <Text style={styles.empty}>No options</Text>}
              {options.map((o, i) => {
                const active = o.value === value;
                return (
                  <TouchableOpacity
                    key={String(o.value)}
                    style={[styles.row, i < options.length - 1 && styles.rowLine]}
                    activeOpacity={0.6}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.rowText, active && styles.rowTextActive]}>{o.label}</Text>
                    {active && (
                      <VectorIcon iconSet="Ionicons" iconName="checkmark" size={18} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.sheetRule} />
            <TouchableOpacity style={styles.cancel} activeOpacity={0.6} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Select;

const __mk_styles = () =>
  StyleSheet.create({
    wrap: { marginTop: 12 },
    label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 },
    // Notched: room above for the label that sits in the border, and the
    // outlined fields' height and padding.
    notchedWrap: { marginTop: 16 },
    boxNotched: {
      minHeight: 44,
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth * 2,
    },
    valueNotched: { fontSize: 14 },
    boxError: { borderColor: theme.colors.danger },
    notchLabelError: { color: theme.colors.danger },
    error: { fontSize: 11, color: theme.colors.danger, marginTop: 4, marginLeft: 14 },
    notchLabelWrap: { position: 'absolute', top: -8, left: 9, right: 9, flexDirection: 'row' },
    notchLabel: {
      flexShrink: 1,
      paddingHorizontal: 5,
      backgroundColor: theme.colors.card,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      color: theme.colors.textSecondary,
    },
    notchLabelOpen: { color: theme.colors.primary },
    star: { color: theme.colors.danger },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      backgroundColor: theme.colors.background,
    },
    boxPlain: { backgroundColor: 'transparent' },
    boxChosen: { borderColor: theme.colors.primary },
    boxDisabled: { opacity: 0.5 },
    value: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, marginRight: 8 },
    placeholder: { color: theme.colors.textMuted },
    // The choices: the app's centred popup card (as the update and lock cards).
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    sheet: {
      width: '100%',
      maxWidth: 340,
      maxHeight: '72%',
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    sheetTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      textAlign: 'center',
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 14,
    },
    sheetRule: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
    sheetList: { flexGrow: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 48,
      paddingHorizontal: 20,
    },
    rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
    rowText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, marginRight: 8 },
    rowTextActive: { color: theme.colors.primary, fontWeight: '600' },
    empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 20 },
    cancel: { height: 50, alignItems: 'center', justifyContent: 'center' },
    cancelText: { fontSize: 15, fontWeight: '500', color: theme.colors.textSecondary },
  });

let styles = __mk_styles();
onThemeChange(() => {
  styles = __mk_styles();
});
